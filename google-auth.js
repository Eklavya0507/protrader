(() => {
  "use strict";

  const AUTH_API =
    "https://protrader-backend-n8oj.onrender.com/api/auth/google";
  const TOKEN_KEY = "protrade_auth_token";
  const USER_KEY = "protrade_auth_user";

  const showError = (message) => {
    const box = document.getElementById("errorBox");
    const text = document.getElementById("errorMessage");

    if (text) text.textContent = message;
    if (box) box.classList.add("show");
  };

  const safeNextPage = () => {
    const params = new URLSearchParams(window.location.search);
    const next = String(params.get("next") || "").trim();

    return /^[a-z0-9-]+\.html$/i.test(next)
      ? next
      : "dashboard.html";
  };

  const setGoogleLoading = (loading) => {
    const wrapper = document.getElementById("googleButtonWrapper");
    const label = document.getElementById("googleStatus");

    if (wrapper) {
      wrapper.style.opacity = loading ? "0.55" : "1";
      wrapper.style.pointerEvents = loading ? "none" : "auto";
    }

    if (label) {
      label.textContent = loading
        ? "Verifying Google account…"
        : "";
    }
  };

  const handleGoogleCredential = async (response) => {
    const credential = String(response?.credential || "").trim();

    if (!credential) {
      showError("Google did not return a sign-in credential.");
      return;
    }

    setGoogleLoading(true);

    try {
      const apiResponse = await fetch(AUTH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ credential }),
      });

      const body = await apiResponse.json().catch(() => ({}));

      if (!apiResponse.ok || body.success === false) {
        throw new Error(
          body.message || "Google sign-in failed."
        );
      }

      sessionStorage.setItem(TOKEN_KEY, body.token);
      sessionStorage.setItem(
        USER_KEY,
        JSON.stringify(body.data || null)
      );

      window.location.replace(safeNextPage());
    } catch (error) {
      showError(
        error.message || "Could not connect Google to ProTrade."
      );
      setGoogleLoading(false);
    }
  };

  const renderGoogleButton = () => {
    const clientId = String(
      window.PROTRADE_GOOGLE_CLIENT_ID || ""
    ).trim();

    const container =
      document.getElementById("googleSignInButton");

    if (!container) return;

    if (
      !clientId ||
      clientId.includes("PASTE_YOUR_GOOGLE_WEB_CLIENT_ID")
    ) {
      showError(
        "Google Client ID is not configured in google-config.js."
      );
      return;
    }

    if (!window.google?.accounts?.id) {
      window.setTimeout(renderGoogleButton, 150);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const width = Math.min(
      400,
      Math.max(260, container.clientWidth || 360)
    );

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width,
    });
  };

  window.addEventListener("load", renderGoogleButton);
})();
