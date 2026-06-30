(() => {
  "use strict";

  const API_BASE = "https://protrader-backend-n8oj.onrender.com/api";
  const TOKEN_KEY = "protrade_auth_token";
  const USER_KEY = "protrade_auth_user";
  const REFRESH_TOKEN_KEY = "protrade_refresh_token";
  const SESSION_ID_KEY = "protrade_session_id";
  const DEVICE_ID_KEY = "protrade_device_id";

  const nativeFetch = window.fetch.bind(window);
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const protectedPages = new Set([
    "dashboard.html",
    "trades.html",
    "calendar.html",
    "analytics.html",
    "psychology.html",
    "ai-journal.html",
    "settings.html",
  ]);

  const isProtectedPage = protectedPages.has(currentPage);

  const safeNextPage = (value) => {
    const candidate = String(value || "").trim();
    return /^[a-z0-9-]+\.html$/i.test(candidate)
      ? candidate
      : "dashboard.html";
  };

  const getTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  };

  const getDeviceId = () => {
    let value = localStorage.getItem(DEVICE_ID_KEY);

    if (/^[a-zA-Z0-9._:-]{16,160}$/.test(String(value || ""))) {
      return value;
    }

    value =
      window.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(DEVICE_ID_KEY, value);
    return value;
  };

  const clearSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  };

  const saveSessionPayload = (body = {}) => {
    if (body.token) {
      sessionStorage.setItem(TOKEN_KEY, body.token);
    }

    if (body.refreshToken) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, body.refreshToken);
    }

    if (body.sessionId) {
      sessionStorage.setItem(SESSION_ID_KEY, body.sessionId);
    }

    if (body.data) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(body.data));
    }

    return body;
  };

  const redirectToLogin = () => {
    const next = encodeURIComponent(safeNextPage(currentPage));
    window.location.replace(`login.html?next=${next}`);
  };

  let resolveReady;
  let rejectReady;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const apiUrlFromInput = (input) => {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (input && typeof input.url === "string") return input.url;
    return "";
  };

  const isPublicAuthRequest = (url) =>
    url.startsWith(`${API_BASE}/auth/login`) ||
    url.startsWith(`${API_BASE}/auth/register`) ||
    url.startsWith(`${API_BASE}/auth/google`) ||
    url.startsWith(`${API_BASE}/auth/verify-email`) ||
    url.startsWith(`${API_BASE}/auth/verification-status`) ||
    url.startsWith(`${API_BASE}/auth/resend-verification`) ||
    url.startsWith(`${API_BASE}/auth/forgot-password`) ||
    url.startsWith(`${API_BASE}/auth/reset-password`) ||
    url.startsWith(`${API_BASE}/auth/password-reset-status`) ||
    url.startsWith(`${API_BASE}/auth/2fa/login/verify`) ||
    url.startsWith(`${API_BASE}/auth/sessions/refresh`);

  const isProtectedApiRequest = (url) =>
    isProtectedPage &&
    url.startsWith(API_BASE) &&
    !isPublicAuthRequest(url);

  const withClientHeaders = (headersInput) => {
    const headers = new Headers(headersInput || undefined);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const timezone = getTimezone();
    if (timezone && !headers.has("X-Client-Timezone")) {
      headers.set("X-Client-Timezone", timezone);
    }

    const deviceId = getDeviceId();
    if (deviceId && !headers.has("X-Client-Device-Id")) {
      headers.set("X-Client-Device-Id", deviceId);
    }

    return headers;
  };

  let refreshPromise = null;

  const refreshManagedSession = async () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      throw new Error("A refresh session is not available.");
    }

    refreshPromise = (async () => {
      const response = await nativeFetch(
        `${API_BASE}/auth/sessions/refresh`,
        {
          method: "POST",
          headers: withClientHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ refreshToken }),
        }
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.success === false || !body.token) {
        throw new Error(
          body.message || "Your session could not be refreshed."
        );
      }

      saveSessionPayload(body);
      return body;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  };

  const upgradeLegacyToken = async (legacyToken, user = null) => {
    const token = String(legacyToken || "").trim();

    if (!token) {
      throw new Error("Authentication token is missing.");
    }

    const response = await nativeFetch(
      `${API_BASE}/auth/sessions/start`,
      {
        method: "POST",
        headers: withClientHeaders({
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      }
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false || !body.token) {
      throw new Error(
        body.message || "Secure session could not be started."
      );
    }

    if (!body.data && user) {
      body.data = user;
    }

    saveSessionPayload(body);
    return body;
  };

  const ensureManagedSession = async () => {
    let token = sessionStorage.getItem(TOKEN_KEY);
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

    if (!token && refreshToken) {
      const refreshed = await refreshManagedSession();
      return refreshed.token;
    }

    if (!token) {
      throw new Error("Authentication required.");
    }

    if (!refreshToken) {
      try {
        const upgraded = await upgradeLegacyToken(token);
        token = upgraded.token;
      } catch (error) {
        console.warn(
          "Managed session upgrade pending:",
          error.message
        );
      }
    }

    return token;
  };

  const performProtectedFetch = async (
    input,
    options = {},
    allowRefresh = true
  ) => {
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (!token) {
      throw new Error("Authentication required.");
    }

    const headers = withClientHeaders(
      options.headers ||
        (input instanceof Request ? input.headers : undefined)
    );

    headers.set("Authorization", `Bearer ${token}`);

    const response = await nativeFetch(input, {
      ...options,
      headers,
    });

    if (response.status !== 401 || !allowRefresh) {
      return response;
    }

    try {
      const refreshed = await refreshManagedSession();
      const retryHeaders = withClientHeaders(headers);

      retryHeaders.set(
        "Authorization",
        `Bearer ${refreshed.token}`
      );

      return nativeFetch(input, {
        ...options,
        headers: retryHeaders,
      });
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  const secureFetch = async (input, options = {}) => {
    const url = apiUrlFromInput(input);

    if (!isProtectedApiRequest(url)) {
      return nativeFetch(input, options);
    }

    await ready;

    try {
      return await performProtectedFetch(
        input,
        options,
        true
      );
    } catch (error) {
      clearSession();
      redirectToLogin();
      throw error;
    }
  };

  window.fetch = secureFetch;

  const createAuthOverlay = () => {
    if (
      !isProtectedPage ||
      document.getElementById("protradeAuthOverlay")
    ) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "protradeAuthOverlay";
    overlay.innerHTML = `
      <div style="width:54px;height:54px;border-radius:18px;background:#315dce;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:white;box-shadow:0 18px 50px rgba(49,93,206,.28)">P</div>
      <div style="margin-top:18px;font:800 17px/1.2 'DM Sans',sans-serif;color:#eef1f2">Verifying secure session</div>
      <div style="margin-top:7px;font:500 13px/1.5 'DM Sans',sans-serif;color:#9da7ad">Loading your private workspace…</div>
      <div style="margin-top:18px;width:170px;height:4px;border-radius:999px;background:#252b2f;overflow:hidden">
        <div style="height:100%;width:48%;border-radius:999px;background:#7ca2ff;animation:protradeAuthSlide 1s ease-in-out infinite"></div>
      </div>
    `;

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#080b0c",
      textAlign: "center",
    });

    const style = document.createElement("style");
    style.id = "protradeAuthOverlayStyle";
    style.textContent = `
      @keyframes protradeAuthSlide {
        from { transform: translateX(-65%); }
        to { transform: translateX(165%); }
      }
    `;

    document.head.appendChild(style);
    document.body.prepend(overlay);
  };

  const removeAuthOverlay = () => {
    document.getElementById("protradeAuthOverlay")?.remove();
    document.getElementById("protradeAuthOverlayStyle")?.remove();
  };

  const updateUserInterface = (user) => {
    const displayName = user?.name || "Trader";
    const email = user?.email || "";

    const initials =
      displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase() || "T";

    document
      .querySelectorAll(".auth-user-name, #sidebarProfileName")
      .forEach((element) => {
        element.textContent = displayName;
      });

    document
      .querySelectorAll(".auth-user-email")
      .forEach((element) => {
        element.textContent = email;
      });

    document
      .querySelectorAll(".auth-user-initials")
      .forEach((element) => {
        element.textContent = initials;
      });

    document.querySelectorAll("p, span, div").forEach((element) => {
      if (element.children.length > 0) return;

      const value = element.textContent.trim();

      if (
        ["Alex Rivera", "Gautam Kumar", "Gautam"].includes(
          value
        )
      ) {
        element.textContent = displayName;
      }

      if (
        value === "alex.rivera@protrade.com" ||
        value === "gautamkuswha4467@gmail.com"
      ) {
        element.textContent = email;
      }
    });

    document
      .querySelectorAll("[data-auth-logout]")
      .forEach((button) => {
        if (button.dataset.authBound === "true") return;

        button.dataset.authBound = "true";

        button.addEventListener("click", async () => {
          button.disabled = true;
          const oldLabel = button.innerHTML;
          button.innerHTML = "Signing out…";

          try {
            await performProtectedFetch(
              `${API_BASE}/auth/sessions/current`,
              { method: "DELETE" },
              true
            );
          } catch (error) {
            console.warn(
              "Session revoke request was not completed:",
              error
            );
          } finally {
            clearSession();
            button.innerHTML = oldLabel;
            window.location.replace("login.html?logout=1");
          }
        });
      });
  };

  const logoutCurrentDevice = async () => {
    try {
      await performProtectedFetch(
        `${API_BASE}/auth/sessions/current`,
        { method: "DELETE" },
        true
      );
    } catch (error) {
      console.warn(
        "Logout API request failed:",
        error.message
      );
    } finally {
      clearSession();
      window.location.replace("login.html?logout=1");
    }
  };

  window.ProTradeAuth = {
    API_BASE,
    TOKEN_KEY,
    USER_KEY,
    REFRESH_TOKEN_KEY,
    SESSION_ID_KEY,
    DEVICE_ID_KEY,
    ready,
    getToken: () => sessionStorage.getItem(TOKEN_KEY),
    getRefreshToken: () =>
      sessionStorage.getItem(REFRESH_TOKEN_KEY),
    getSessionId: () =>
      sessionStorage.getItem(SESSION_ID_KEY),
    getUser: () => {
      try {
        return JSON.parse(
          sessionStorage.getItem(USER_KEY) || "null"
        );
      } catch {
        return null;
      }
    },
    authHeaders: () => ({
      Authorization: `Bearer ${
        sessionStorage.getItem(TOKEN_KEY) || ""
      }`,
      "X-Client-Timezone": getTimezone(),
      "X-Client-Device-Id": getDeviceId(),
    }),
    apiFetch: secureFetch,
    saveSession: saveSessionPayload,
    refreshSession: refreshManagedSession,
    upgradeToken: upgradeLegacyToken,
    clearSession,
    logout: logoutCurrentDevice,
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const downloadTextFile = (filename, text) => {
    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const createRecoveryDialog = (codes) => {
    const existing =
      document.getElementById("protradeRecoveryDialog");
    existing?.remove();

    const safeCodes = Array.isArray(codes)
      ? codes.map((code) => String(code))
      : [];

    const overlay = document.createElement("div");
    overlay.id = "protradeRecoveryDialog";
    overlay.innerHTML = `
      <div class="panel" style="width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border-radius:22px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.45)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px">
          <div>
            <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--green)">Save these now</p>
            <h2 style="margin:7px 0 0;font-size:22px;font-weight:900">ProTrade recovery codes</h2>
            <p style="margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.6">Each code works once. Keep them offline and never share them.</p>
          </div>
          <button id="protradeRecoveryClose" type="button" class="secondary-btn" style="border-radius:12px;padding:9px 12px;font-weight:800">Close</button>
        </div>
        <div style="margin-top:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">
          ${safeCodes
            .map(
              (code) =>
                `<code style="display:block;border:1px solid var(--line);background:var(--panel-2);padding:12px;border-radius:12px;text-align:center;font-size:14px;font-weight:800;letter-spacing:.08em">${escapeHtml(
                  code
                )}</code>`
            )
            .join("")}
        </div>
        <div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:10px">
          <button id="protradeRecoveryDownload" type="button" class="primary-btn" style="border-radius:12px;padding:11px 16px;font-weight:800">Download codes</button>
          <button id="protradeRecoveryCopy" type="button" class="secondary-btn" style="border-radius:12px;padding:11px 16px;font-weight:800">Copy codes</button>
        </div>
        <p id="protradeRecoveryMessage" style="margin:12px 0 0;color:var(--muted);font-size:13px"></p>
      </div>
    `;

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
      background: "rgba(3,6,7,.78)",
      backdropFilter: "blur(8px)",
    });

    document.body.appendChild(overlay);

    const text = safeCodes.join("\n");
    const message = overlay.querySelector(
      "#protradeRecoveryMessage"
    );

    overlay
      .querySelector("#protradeRecoveryClose")
      .addEventListener("click", () => overlay.remove());

    overlay
      .querySelector("#protradeRecoveryDownload")
      .addEventListener("click", () => {
        downloadTextFile(
          "ProTrade-2FA-Recovery-Codes.txt",
          `ProTrade authenticator recovery codes\n\n${text}\n`
        );
        message.textContent = "Recovery-code file downloaded.";
      });

    overlay
      .querySelector("#protradeRecoveryCopy")
      .addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          message.textContent = "Recovery codes copied.";
        } catch {
          message.textContent =
            "Copy failed. Use Download codes instead.";
        }
      });
  };

  const installTwoFactorSettings = async () => {
    if (
      currentPage !== "settings.html" ||
      document.getElementById("protradeTwoFactorCard")
    ) {
      return;
    }

    const securityPanel =
      document.getElementById("panel-security");

    if (!securityPanel) return;

    const card = document.createElement("section");
    card.id = "protradeTwoFactorCard";
    card.className = "panel rounded-2xl p-6 lg:p-7";
    card.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px">
        <div>
          <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)">Account protection</p>
          <h2 style="margin:7px 0 0;font-size:20px;font-weight:900">Authenticator two-factor authentication</h2>
          <p style="margin:7px 0 0;max-width:690px;color:var(--muted);font-size:14px;line-height:1.65">Require a fresh authenticator or recovery code after your password or Google sign-in.</p>
        </div>
        <span id="protrade2faBadge" style="border:1px solid var(--line);background:var(--panel-2);color:var(--muted);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900">Checking…</span>
      </div>

      <div id="protrade2faNotice" style="display:none;margin-top:18px;border:1px solid var(--line);background:var(--panel-2);border-radius:14px;padding:13px 15px;font-size:14px;line-height:1.55"></div>

      <div id="protrade2faDisabled" style="display:none;margin-top:22px">
        <label style="display:block">
          <span class="label">Current Password</span>
          <input id="protrade2faSetupPassword" class="field" type="password" autocomplete="current-password" placeholder="Required for password accounts"/>
          <span class="helper">Google-only accounts can leave this blank.</span>
        </label>
        <button id="protrade2faStartBtn" type="button" class="primary-btn" style="margin-top:16px;border-radius:12px;padding:12px 18px;font-weight:900">Set up authenticator</button>
      </div>

      <div id="protrade2faSetup" style="display:none;margin-top:22px">
        <div style="display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:22px;align-items:start">
          <div style="border:1px solid var(--line);background:white;border-radius:18px;padding:12px">
            <img id="protrade2faQr" alt="ProTrade authenticator QR code" style="display:block;width:100%;height:auto;border-radius:10px"/>
          </div>
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:900">Scan and confirm</h3>
            <p style="margin:7px 0 0;color:var(--muted);font-size:14px;line-height:1.65">Scan with Google Authenticator, Microsoft Authenticator or another TOTP app, then enter its current six-digit code.</p>
            <div style="margin-top:15px">
              <span class="label">Manual setup key</span>
              <code id="protrade2faManualKey" style="display:block;overflow-wrap:anywhere;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:12px;font-size:13px;font-weight:800;letter-spacing:.08em"></code>
            </div>
            <label style="display:block;margin-top:15px">
              <span class="label">Authenticator Code</span>
              <input id="protrade2faEnableCode" class="field" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="123456"/>
            </label>
            <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px">
              <button id="protrade2faEnableBtn" type="button" class="primary-btn" style="border-radius:12px;padding:12px 18px;font-weight:900">Enable 2FA</button>
              <button id="protrade2faCancelBtn" type="button" class="secondary-btn" style="border-radius:12px;padding:12px 18px;font-weight:900">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <div id="protrade2faEnabled" style="display:none;margin-top:22px">
        <div class="panel-soft" style="border-radius:16px;padding:16px">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px">
            <div>
              <p style="margin:0;font-weight:900">Authenticator protection is active</p>
              <p id="protrade2faDetails" style="margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.6"></p>
            </div>
            <span class="material-symbols-outlined" style="color:var(--green);font-size:30px">verified_user</span>
          </div>
        </div>

        <div style="margin-top:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
          <label>
            <span class="label">Current Password</span>
            <input id="protrade2faActionPassword" class="field" type="password" autocomplete="current-password" placeholder="Required for password accounts"/>
          </label>
          <label>
            <span class="label">Current Authenticator or Recovery Code</span>
            <input id="protrade2faActionCode" class="field" autocomplete="one-time-code" placeholder="6-digit or recovery code"/>
          </label>
        </div>

        <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px">
          <button id="protrade2faRegenerateBtn" type="button" class="secondary-btn" style="border-radius:12px;padding:12px 18px;font-weight:900">Generate new recovery codes</button>
          <button id="protrade2faDisableBtn" type="button" class="danger-btn" style="border-radius:12px;padding:12px 18px;font-weight:900">Disable 2FA</button>
        </div>
      </div>
    `;

    securityPanel.prepend(card);

    const $ = (id) => document.getElementById(id);
    const badge = $("protrade2faBadge");
    const notice = $("protrade2faNotice");
    const disabledView = $("protrade2faDisabled");
    const setupView = $("protrade2faSetup");
    const enabledView = $("protrade2faEnabled");

    let currentStatus = null;

    const setNotice = (message, type = "info") => {
      if (!message) {
        notice.style.display = "none";
        notice.textContent = "";
        return;
      }

      const palette = {
        info: ["var(--primary)", "var(--panel-2)"],
        success: ["var(--green)", "var(--panel-2)"],
        error: ["var(--red)", "var(--panel-2)"],
      };

      notice.style.display = "block";
      notice.style.color = palette[type][0];
      notice.style.background = palette[type][1];
      notice.textContent = message;
    };

    const setBusy = (button, busy, busyText) => {
      if (!button) return;

      if (busy) {
        button.dataset.oldText = button.textContent;
        button.textContent = busyText;
        button.disabled = true;
        button.style.opacity = ".65";
      } else {
        button.textContent =
          button.dataset.oldText || button.textContent;
        button.disabled = false;
        button.style.opacity = "1";
      }
    };

    const apiJson = async (path, options = {}) => {
      const response = await window.fetch(
        `${API_BASE}/auth${path}`,
        {
          ...options,
          headers: {
            Accept: "application/json",
            ...(options.body
              ? { "Content-Type": "application/json" }
              : {}),
            ...(options.headers || {}),
          },
        }
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.success === false) {
        throw new Error(
          body.message || "Two-factor request failed."
        );
      }

      return body;
    };

    const adoptReplacementToken = async (body) => {
      if (!body?.token) return;

      try {
        await upgradeLegacyToken(body.token, body.data || null);
      } catch (error) {
        console.warn(
          "Managed-session upgrade after 2FA change failed:",
          error.message
        );
        clearSession();
        saveSessionPayload(body);
      }
    };

    const renderStatus = (status) => {
      currentStatus = status;
      const enabled = status?.enabled === true;

      badge.textContent = enabled ? "Enabled" : "Disabled";
      badge.style.color = enabled
        ? "var(--green)"
        : "var(--muted)";
      badge.style.borderColor = enabled
        ? "color-mix(in srgb,var(--green) 40%,var(--line))"
        : "var(--line)";

      disabledView.style.display = enabled ? "none" : "block";
      enabledView.style.display = enabled ? "block" : "none";
      setupView.style.display = "none";

      if (enabled) {
        const enabledAt = status.enabledAt
          ? new Date(status.enabledAt).toLocaleString()
          : "Unknown";

        $("protrade2faDetails").textContent =
          `Enabled ${enabledAt}. Recovery codes remaining: ${
            Number(status.recoveryCodesRemaining) || 0
          }.`;
      }
    };

    const loadStatus = async () => {
      badge.textContent = "Checking…";

      try {
        const body = await apiJson("/2fa/status");
        renderStatus(body.data || {});
        setNotice("");
      } catch (error) {
        badge.textContent = "Unavailable";
        setNotice(error.message, "error");
      }
    };

    $("protrade2faStartBtn").addEventListener(
      "click",
      async () => {
        const button = $("protrade2faStartBtn");
        setBusy(button, true, "Creating QR…");
        setNotice("");

        try {
          const body = await apiJson("/2fa/setup", {
            method: "POST",
            body: JSON.stringify({
              currentPassword:
                $("protrade2faSetupPassword").value,
            }),
          });

          $("protrade2faQr").src =
            body.data?.qrCodeDataUrl || "";
          $("protrade2faManualKey").textContent =
            body.data?.manualKey || "";

          disabledView.style.display = "none";
          enabledView.style.display = "none";
          setupView.style.display = "block";

          setNotice(
            "QR created. Confirm it before the setup expires.",
            "success"
          );
        } catch (error) {
          setNotice(error.message, "error");
        } finally {
          setBusy(button, false);
        }
      }
    );

    $("protrade2faCancelBtn").addEventListener(
      "click",
      () => {
        setupView.style.display = "none";
        disabledView.style.display = "block";
        $("protrade2faEnableCode").value = "";
        setNotice("");
      }
    );

    $("protrade2faEnableBtn").addEventListener(
      "click",
      async () => {
        const button = $("protrade2faEnableBtn");
        const code =
          $("protrade2faEnableCode").value.trim();

        if (!code) {
          setNotice(
            "Enter the current authenticator code.",
            "error"
          );
          return;
        }

        setBusy(button, true, "Enabling…");
        setNotice("");

        try {
          const body = await apiJson("/2fa/enable", {
            method: "POST",
            body: JSON.stringify({ code }),
          });

          await adoptReplacementToken(body);
          $("protrade2faEnableCode").value = "";
          $("protrade2faSetupPassword").value = "";

          if (Array.isArray(body.recoveryCodes)) {
            createRecoveryDialog(body.recoveryCodes);
          }

          setNotice(
            "Authenticator two-factor authentication is enabled.",
            "success"
          );
          await loadStatus();
        } catch (error) {
          setNotice(error.message, "error");
        } finally {
          setBusy(button, false);
        }
      }
    );

    $("protrade2faRegenerateBtn").addEventListener(
      "click",
      async () => {
        const button = $("protrade2faRegenerateBtn");
        const code =
          $("protrade2faActionCode").value.trim();

        if (!code) {
          setNotice(
            "Enter a fresh authenticator code.",
            "error"
          );
          return;
        }

        setBusy(button, true, "Generating…");
        setNotice("");

        try {
          const body = await apiJson(
            "/2fa/recovery-codes/regenerate",
            {
              method: "POST",
              body: JSON.stringify({
                currentPassword:
                  $("protrade2faActionPassword").value,
                code,
              }),
            }
          );

          $("protrade2faActionCode").value = "";
          $("protrade2faActionPassword").value = "";

          if (Array.isArray(body.recoveryCodes)) {
            createRecoveryDialog(body.recoveryCodes);
          }

          setNotice(
            "New recovery codes generated. Older codes are invalid.",
            "success"
          );
          await loadStatus();
        } catch (error) {
          setNotice(error.message, "error");
        } finally {
          setBusy(button, false);
        }
      }
    );

    $("protrade2faDisableBtn").addEventListener(
      "click",
      async () => {
        const confirmed = window.confirm(
          "Disable authenticator two-factor authentication?"
        );

        if (!confirmed) return;

        const button = $("protrade2faDisableBtn");
        const code =
          $("protrade2faActionCode").value.trim();

        if (!code) {
          setNotice(
            "Enter an authenticator or recovery code.",
            "error"
          );
          return;
        }

        setBusy(button, true, "Disabling…");
        setNotice("");

        try {
          const body = await apiJson("/2fa/disable", {
            method: "POST",
            body: JSON.stringify({
              currentPassword:
                $("protrade2faActionPassword").value,
              code,
            }),
          });

          await adoptReplacementToken(body);
          $("protrade2faActionCode").value = "";
          $("protrade2faActionPassword").value = "";

          setNotice(
            "Two-factor authentication disabled.",
            "success"
          );
          await loadStatus();
        } catch (error) {
          setNotice(error.message, "error");
        } finally {
          setBusy(button, false);
        }
      }
    );

    await loadStatus();
  };

  if (!isProtectedPage) {
    resolveReady(null);
    return;
  }

  const initialToken = sessionStorage.getItem(TOKEN_KEY);
  const initialRefreshToken =
    sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (!initialToken && !initialRefreshToken) {
    redirectToLogin();
    return;
  }

  document.addEventListener(
    "DOMContentLoaded",
    createAuthOverlay
  );

  (async () => {
    try {
      await ensureManagedSession();

      const response = await performProtectedFetch(
        `${API_BASE}/auth/me`,
        {
          headers: { Accept: "application/json" },
        },
        true
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.success === false) {
        throw new Error(
          body.message || "Authentication failed."
        );
      }

      const user = body.data;
      sessionStorage.setItem(
        USER_KEY,
        JSON.stringify(user)
      );

      const finish = async () => {
        updateUserInterface(user);
        removeAuthOverlay();
        resolveReady(user);

        window.dispatchEvent(
          new CustomEvent("protrade:auth-ready", {
            detail: user,
          })
        );

        try {
          await installTwoFactorSettings();
        } catch (error) {
          console.error(
            "2FA settings UI failed:",
            error
          );
        }
      };

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          finish,
          { once: true }
        );
      } else {
        await finish();
      }
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );
      clearSession();
      rejectReady(error);
      redirectToLogin();
    }
  })();
})();


(() => {
  "use strict";

  if (
    document.querySelector(
      'script[data-protrade-new-device-login-popup]'
    )
  ) {
    return;
  }

  const script = document.createElement("script");
  script.src = "new-device-login-popup.js";
  script.defer = true;
  script.dataset.protradeNewDeviceLoginPopup = "true";
  document.head.appendChild(script);
})();
