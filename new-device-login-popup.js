(() => {
  "use strict";

  const CHECK_EVERY_MS = 10000;
  const MAX_CHECKS = 18;
  const RECENT_WINDOW_MS = 5 * 60 * 1000;
  const SEEN_KEY = "protrade_seen_new_device_alerts";

  const protectedPages = new Set([
    "dashboard.html",
    "trades.html",
    "calendar.html",
    "analytics.html",
    "psychology.html",
    "ai-journal.html",
    "settings.html",
  ]);

  const currentPage =
    window.location.pathname.split("/").pop() ||
    "index.html";

  if (!protectedPages.has(currentPage)) return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const readSeen = () => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(SEEN_KEY) || "[]"
      );

      return Array.isArray(value)
        ? value.map(String)
        : [];
    } catch {
      return [];
    }
  };

  const rememberSeen = (id) => {
    const ids = [...new Set([...readSeen(), String(id)])]
      .slice(-50);

    sessionStorage.setItem(
      SEEN_KEY,
      JSON.stringify(ids)
    );
  };

  const ensureStyles = () => {
    if (
      document.getElementById(
        "protradeNewDevicePopupStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");
    style.id = "protradeNewDevicePopupStyles";
    style.textContent = `
      #protradeNewDevicePopupHost {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483000;
        width: min(430px, calc(100vw - 36px));
        pointer-events: none;
      }

      #protradeNewDevicePopup {
        pointer-events: auto;
        border: 1px solid rgba(235,174,59,.5);
        border-radius: 20px;
        padding: 17px;
        background: rgba(18,23,26,.98);
        color: #eef1f2;
        box-shadow: 0 26px 80px rgba(0,0,0,.48);
        backdrop-filter: blur(14px);
        animation: protradeNewDevicePopupIn .24s ease-out;
        font-family: "DM Sans", system-ui, sans-serif;
      }

      @keyframes protradeNewDevicePopupIn {
        from {
          opacity: 0;
          transform: translateY(-12px) scale(.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;

    document.head.appendChild(style);
  };

  const showPopup = (alert) => {
    ensureStyles();

    document
      .getElementById("protradeNewDevicePopupHost")
      ?.remove();

    const host = document.createElement("div");
    host.id = "protradeNewDevicePopupHost";

    const device = [
      alert.browser,
      alert.operatingSystem,
      alert.deviceType,
    ]
      .filter(Boolean)
      .join(" · ");

    host.innerHTML = `
      <section id="protradeNewDevicePopup" role="alert" aria-live="assertive">
        <div style="display:flex;align-items:flex-start;gap:13px">
          <div style="width:44px;height:44px;flex:0 0 44px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(235,174,59,.14);color:#ebb23b">
            <span class="material-symbols-outlined">devices</span>
          </div>

          <div style="min-width:0;flex:1">
            <p style="margin:0;color:#ebb23b;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase">
              New device login
            </p>

            <h3 style="margin:5px 0 0;font-size:17px;line-height:1.35">
              ${escapeHtml(
                alert.title || "New device session detected"
              )}
            </h3>

            <p style="margin:7px 0 0;color:#aab3b8;font-size:13px;line-height:1.55">
              ${escapeHtml(
                alert.message ||
                  "Your ProTrade account was opened on a new device or private browser session."
              )}
            </p>

            <p style="margin:8px 0 0;color:#d5dade;font-size:12px;font-weight:800">
              ${escapeHtml(device || "Unknown device")}
            </p>

            <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
              <button id="protradeReviewNewDevice" type="button" style="border:0;border-radius:10px;padding:9px 13px;background:#315dce;color:white;font-weight:900;cursor:pointer">
                Review device
              </button>

              <button id="protradeCloseNewDevicePopup" type="button" style="border:1px solid #394247;border-radius:10px;padding:9px 13px;background:#202629;color:#eef1f2;font-weight:800;cursor:pointer">
                OK
              </button>
            </div>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(host);

    host
      .querySelector("#protradeReviewNewDevice")
      .addEventListener("click", () => {
        window.location.href =
          "settings.html#panel-security";
      });

    host
      .querySelector("#protradeCloseNewDevicePopup")
      .addEventListener("click", () => {
        host.remove();
      });
  };

  const waitForAuth = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (window.ProTradeAuth?.ready) {
        await window.ProTradeAuth.ready;
        return window.ProTradeAuth;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );
    }

    return null;
  };

  const fetchRecentNewDeviceAlert = async (auth) => {
    const response = await auth.apiFetch(
      `${auth.API_BASE}/security/alerts?status=unread&limit=20`,
      {
        headers: { Accept: "application/json" },
      }
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false) {
      return null;
    }

    const seen = new Set(readSeen());
    const cutoff = Date.now() - RECENT_WINDOW_MS;

    return (body.data || []).find((alert) => {
      const createdAt = new Date(
        alert.createdAt
      ).getTime();

      return (
        alert.type === "new_device_session" &&
        !seen.has(String(alert.id)) &&
        Number.isFinite(createdAt) &&
        createdAt >= cutoff
      );
    }) || null;
  };

  const start = async () => {
    const auth = await waitForAuth();
    if (!auth) return;

    let checks = 0;

    const check = async () => {
      checks += 1;

      try {
        const alert =
          await fetchRecentNewDeviceAlert(auth);

        if (alert) {
          rememberSeen(alert.id);
          showPopup(alert);
          return true;
        }
      } catch (error) {
        console.warn(
          "New-device popup check failed:",
          error.message
        );
      }

      return false;
    };

    window.setTimeout(async () => {
      if (await check()) return;

      const timer = window.setInterval(
        async () => {
          const found = await check();

          if (found || checks >= MAX_CHECKS) {
            window.clearInterval(timer);
          }
        },
        CHECK_EVERY_MS
      );
    }, 2500);
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
