(() => {
  "use strict";

  const API_BASE = "https://protrader-backend-n8oj.onrender.com/api";
  const TOKEN_KEY = "protrade_auth_token";
  const USER_KEY = "protrade_auth_user";

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
  const token = sessionStorage.getItem(TOKEN_KEY);

  const safeNextPage = (value) => {
    const candidate = String(value || "").trim();
    return /^[a-z0-9-]+\.html$/i.test(candidate)
      ? candidate
      : "dashboard.html";
  };

  const clearSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  };

  const redirectToLogin = () => {
    const next = encodeURIComponent(safeNextPage(currentPage));
    window.location.replace(`login.html?next=${next}`);
  };

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
        Connecting to ProTrade…
      </div>
      <div style="
        width:160px;height:4px;margin-top:18px;border-radius:999px;
        overflow:hidden;background:#252c30;">
        <div style="
          width:45%;height:100%;border-radius:999px;background:#6f9cff;
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
      element.textContent = user?.email || "";
    });

    document.querySelectorAll(".auth-user-initials").forEach((element) => {
      element.textContent = initials;
    });

    const logoutButtons = document.querySelectorAll("[data-auth-logout]");
    logoutButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        const oldLabel = button.innerHTML;
        button.innerHTML = "Signing out…";

        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ""}`,
              Accept: "application/json",
            },
          });
        } catch (error) {
          console.warn("Logout API request was not completed:", error);
        } finally {
          clearSession();
          button.innerHTML = oldLabel;
          window.location.replace("login.html?logout=1");
        }
      });
    });
  };

  const authenticatedFetch = async (url, options = {}) => {
    await window.ProTradeAuth.ready;

    const activeToken = sessionStorage.getItem(TOKEN_KEY);
    const headers = new Headers(options.headers || {});

    headers.set("Authorization", `Bearer ${activeToken}`);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearSession();
      redirectToLogin();
      throw new Error("Your login session has expired.");
    }

    return response;
  };

  let resolveReady;
  let rejectReady;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  window.ProTradeAuth = {
    API_BASE,
    TOKEN_KEY,
    USER_KEY,
    ready,
    getToken: () => sessionStorage.getItem(TOKEN_KEY),
    getUser: () => {
      try {
        return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
      } catch {
        return null;
      }
    },
    authHeaders: () => ({
      Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ""}`,
    }),
    apiFetch: authenticatedFetch,
    logout: () => {
      clearSession();
      window.location.replace("login.html?logout=1");
    },
  };

  if (!isProtectedPage) {
    resolveReady(null);
    return;
  }

  if (!token) {
    redirectToLogin();
    return;
  }

  document.addEventListener("DOMContentLoaded", createAuthOverlay);

  fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
    .then(async (response) => {
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
    })
    .catch((error) => {
      console.error("Authentication check failed:", error);
      clearSession();
      rejectReady(error);
      redirectToLogin();
    });
})();
