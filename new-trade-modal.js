(() => {
  "use strict";

  if (window.__PROTRADE_NEW_TRADE_MODAL_INSTALLED__) return;
  window.__PROTRADE_NEW_TRADE_MODAL_INSTALLED__ = true;

  let overlay = null;
  let previousBodyOverflow = "";
  let reloadAfterClose = false;

  const currentPage = () =>
    window.location.pathname.split("/").pop() || "dashboard.html";

  const normalizedText = (node) =>
    String(node?.textContent || "")
      .replace(/\s+/g, " ")
      .replace(/^\+\s*/, "")
      .trim()
      .toLowerCase();

  const isNewTradeTrigger = (node) => {
    if (!node || node.disabled) return false;
    if (
      node.matches(
        "#newTrade, #newTradeBtn, #openNewTrade, [data-new-trade], [data-action='new-trade'], .new-trade-btn"
      )
    ) {
      return true;
    }
    return normalizedText(node) === "new trade";
  };

  const injectStyles = () => {
    if (document.getElementById("protradeNewTradeModalStyles")) return;
    const style = document.createElement("style");
    style.id = "protradeNewTradeModalStyles";
    style.textContent = `
      .protrade-new-trade-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147482000;
        display: grid;
        place-items: center;
        padding: 12px;
        background: rgba(3, 9, 16, .72);
        backdrop-filter: blur(9px);
        animation: protradeTradeOverlayIn .18s ease both;
      }
      .protrade-new-trade-frame-shell {
        width: min(1240px, 100%);
        height: min(94vh, 1040px);
        position: relative;
        border: 1px solid rgba(148,177,210,.22);
        border-radius: 18px;
        overflow: hidden;
        background: #06111f;
        box-shadow: 0 34px 100px rgba(0,0,0,.52);
      }
      .protrade-new-trade-frame {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
        background: #06111f;
      }
      .protrade-new-trade-loading {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        color: #9badc2;
        background: #06111f;
        font: 600 13px/1.4 Inter, system-ui, sans-serif;
        transition: opacity .18s ease;
        pointer-events: none;
      }
      .protrade-new-trade-loading.is-ready { opacity: 0; }
      @keyframes protradeTradeOverlayIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 760px) {
        .protrade-new-trade-overlay { padding: 0; }
        .protrade-new-trade-frame-shell { width: 100%; height: 100%; border-radius: 0; border: 0; }
      }
    `;
    document.head.appendChild(style);
  };

  const showParentToast = (message) => {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483000",
      padding: "11px 14px",
      border: "1px solid rgba(40,200,154,.28)",
      borderRadius: "11px",
      color: "#eafff8",
      background: "#0b2926",
      boxShadow: "0 16px 42px rgba(0,0,0,.32)",
      font: "700 12px/1.35 Inter,system-ui,sans-serif"
    });
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2200);
  };

  const closeModal = () => {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = previousBodyOverflow;

    if (reloadAfterClose) {
      reloadAfterClose = false;
      window.setTimeout(() => window.location.reload(), 250);
    }
  };

  const openModal = () => {
    if (overlay) return;
    injectStyles();

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    overlay = document.createElement("div");
    overlay.className = "protrade-new-trade-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Log Trade");

    const shell = document.createElement("div");
    shell.className = "protrade-new-trade-frame-shell";

    const loading = document.createElement("div");
    loading.className = "protrade-new-trade-loading";
    loading.textContent = "Opening secure trade form…";

    const frame = document.createElement("iframe");
    frame.className = "protrade-new-trade-frame";
    frame.title = "ProTrade Log Trade";
    frame.src = `trade-log.html?embed=1&return=${encodeURIComponent(currentPage())}`;
    frame.addEventListener("load", () => loading.classList.add("is-ready"));

    shell.append(loading, frame);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });
  };

  document.addEventListener(
    "click",
    (event) => {
      const candidate = event.target.closest("button, a");
      if (!isNewTradeTrigger(candidate)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openModal();
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay) closeModal();
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || !event.data) return;

    if (event.data.type === "protrade:trade-log-close") {
      closeModal();
      return;
    }

    if (event.data.type === "protrade:trade-created") {
      reloadAfterClose = true;
      showParentToast("Trade saved to MongoDB successfully.");
      window.dispatchEvent(
        new CustomEvent("protrade:trade-created", {
          detail: event.data.trade || null
        })
      );
      closeModal();
    }
  });
})();
