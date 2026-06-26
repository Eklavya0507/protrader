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

    value = window.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

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
        throw new Error(body.message || "Your session could not be refreshed.");
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

    const response = await nativeFetch(`${API_BASE}/auth/sessions/start`, {
      method: "POST",
      headers: withClientHeaders({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({}),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false || !body.token) {
      throw new Error(body.message || "Secure session could not be started.");
    }

    if (!body.data && user) body.data = user;
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
        // Backward compatibility during deployment: the old token can still
        // load the workspace. The next page refresh will try again.
        console.warn("Managed session upgrade pending:", error.message);
      }
    }

    return token;
  };

  const performProtectedFetch = async (input, options = {}, allowRefresh = true) => {
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (!token) {
      throw new Error("Authentication required.");
    }

    const headers = withClientHeaders(
      options.headers || (input instanceof Request ? input.headers : undefined)
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
      retryHeaders.set("Authorization", `Bearer ${refreshed.token}`);

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
      return await performProtectedFetch(input, options, true);
    } catch (error) {
      clearSession();
      redirectToLogin();
      throw error;
    }
  };

  window.fetch = secureFetch;

  const createAuthOverlay = () => {
    if (!isProtectedPage || document.getElementById("protradeAuthOverlay")) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "protradeAuthOverlay";
    overlay.innerHTML = `
      <div style="
        width:54px;height:54px;border-radius:18px;
        display:flex;align-items:center;justify-content:center;
        background:#1266d9;color:white;font:800 24px/1 Arial,sans-serif;
        box-shadow:0 18px 50px rgba(18,102,217,.35);">P</div>
      <div style="margin-top:18px;font:800 17px/1.3 Arial,sans-serif;color:#eef3f7;">
        Verifying secure session
      </div>
      <div style="margin-top:8px;font:500 13px/1.5 Arial,sans-serif;color:#98a5ad;">
        Loading your private workspace…
      </div>
      <div style="
        width:160px;height:4px;margin-top:18px;border-radius:999px;
        overflow:hidden;background:#252c30;">
        <div style="
          width:45%;height:100%;border-radius:inherit;background:#6f9cff;
          animation:protradeAuthSlide 1s ease-in-out infinite alternate;"></div>
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
    const initials = displayName
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

    document.querySelectorAll(".auth-user-email").forEach((element) => {
      element.textContent = email;
    });

    document.querySelectorAll(".auth-user-initials").forEach((element) => {
      element.textContent = initials;
    });

    document.querySelectorAll("p, span, div").forEach((element) => {
      if (element.children.length > 0) return;

      const value = element.textContent.trim();

      if (["Alex Rivera", "Gautam Kumar", "Gautam"].includes(value)) {
        element.textContent = displayName;
      }

      if (
        value === "alex.rivera@protrade.com" ||
        value === "gautamkuswha4467@gmail.com"
      ) {
        element.textContent = email;
      }
    });

    document.querySelectorAll("[data-auth-logout]").forEach((button) => {
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
          console.warn("Session revoke request was not completed:", error);
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
      console.warn("Logout API request failed:", error.message);
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
    getRefreshToken: () => sessionStorage.getItem(REFRESH_TOKEN_KEY),
    getSessionId: () => sessionStorage.getItem(SESSION_ID_KEY),
    getUser: () => {
      try {
        return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
      } catch {
        return null;
      }
    },
    authHeaders: () => ({
      Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ""}`,
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

  if (!isProtectedPage) {
    resolveReady(null);
    return;
  }

  const initialToken = sessionStorage.getItem(TOKEN_KEY);
  const initialRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (!initialToken && !initialRefreshToken) {
    redirectToLogin();
    return;
  }

  document.addEventListener("DOMContentLoaded", createAuthOverlay);

  (async () => {
    try {
      await ensureManagedSession();

      let response = await performProtectedFetch(
        `${API_BASE}/auth/me`,
        { headers: { Accept: "application/json" } },
        true
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || body.success === false) {
        throw new Error(body.message || "Authentication failed.");
      }

      const user = body.data;
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));

      const finish = () => {
        updateUserInterface(user);
        removeAuthOverlay();
        resolveReady(user);

        window.dispatchEvent(
          new CustomEvent("protrade:auth-ready", { detail: user })
        );
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", finish, { once: true });
      } else {
        finish();
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      clearSession();
      rejectReady(error);
      redirectToLogin();
    }
  })();
})();
