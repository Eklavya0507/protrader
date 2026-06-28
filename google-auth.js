(() => {
  "use strict";

  const AUTH_API =
    "https://protrader-backend-n8oj.onrender.com/api/auth/google";
  const TWO_FACTOR_VERIFY_API =
    "https://protrader-backend-n8oj.onrender.com/api/auth/2fa/login/verify";
  const TOKEN_KEY = "protrade_auth_token";
  const USER_KEY = "protrade_auth_user";

  const nativeFetch = window.fetch.bind(window);

  const showError = (message) => {
    const box = document.getElementById("errorBox");
    const text = document.getElementById("errorMessage");

    if (text) text.textContent = message;
    if (box) box.classList.add("show");
  };

  const safeNextPage = () => {
    const params = new URLSearchParams(
      window.location.search
    );
    const next = String(params.get("next") || "").trim();

    return /^[a-z0-9-]+\.html$/i.test(next)
      ? next
      : "dashboard.html";
  };

  const setGoogleLoading = (loading) => {
    const wrapper = document.getElementById(
      "googleButtonWrapper"
    );
    const label = document.getElementById("googleStatus");

    if (wrapper) {
      wrapper.style.opacity = loading ? "0.55" : "1";
      wrapper.style.pointerEvents = loading
        ? "none"
        : "auto";
    }

    if (label) {
      label.textContent = loading
        ? "Verifying Google account…"
        : "";
    }
  };

  const injectTwoFactorStyles = () => {
    if (document.getElementById("protrade2faLoginStyle")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "protrade2faLoginStyle";
    style.textContent = `
      #protrade2faLoginOverlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(3, 6, 7, .82);
        backdrop-filter: blur(9px);
        font-family: "DM Sans", sans-serif;
      }
      #protrade2faLoginCard {
        width: min(460px, calc(100vw - 36px));
        border: 1px solid #30383d;
        border-radius: 24px;
        padding: 25px;
        background: #151a1d;
        color: #eef1f2;
        box-shadow: 0 30px 100px rgba(0,0,0,.52);
      }
      #protrade2faLoginInput {
        width: 100%;
        min-height: 52px;
        margin-top: 17px;
        border: 1px solid #30383d;
        border-radius: 14px;
        padding: 0 15px;
        outline: none;
        background: #101415;
        color: #eef1f2;
        font: 800 17px/1 "DM Sans", sans-serif;
        letter-spacing: .08em;
      }
      #protrade2faLoginInput:focus {
        border-color: #7ca2ff;
        box-shadow: 0 0 0 3px rgba(124,162,255,.14);
      }
      .protrade2faLoginButton {
        min-height: 46px;
        border: 0;
        border-radius: 13px;
        padding: 0 17px;
        cursor: pointer;
        font: 800 14px/1 "DM Sans", sans-serif;
      }
      .protrade2faLoginButton:disabled {
        cursor: wait;
        opacity: .58;
      }
    `;

    document.head.appendChild(style);
  };

  const requestTwoFactorCode = (
    challenge,
    originalRequestUrl
  ) =>
    new Promise((resolve, reject) => {
      injectTwoFactorStyles();

      document
        .getElementById("protrade2faLoginOverlay")
        ?.remove();

      const overlay = document.createElement("div");
      overlay.id = "protrade2faLoginOverlay";

      const email = String(
        challenge?.data?.email || ""
      ).trim();

      overlay.innerHTML = `
        <div id="protrade2faLoginCard" role="dialog" aria-modal="true" aria-labelledby="protrade2faLoginTitle">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
            <div>
              <p style="margin:0;color:#7ca2ff;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase">Second verification step</p>
              <h2 id="protrade2faLoginTitle" style="margin:8px 0 0;font-size:24px;font-weight:900">Enter your security code</h2>
              <p style="margin:9px 0 0;color:#9da7ad;font-size:14px;line-height:1.65">Use the current six-digit authenticator code or one unused recovery code${email ? ` for <strong style="color:#eef1f2">${email.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</strong>` : ""}.</p>
            </div>
            <div style="width:46px;height:46px;flex:0 0 46px;border-radius:15px;background:rgba(124,162,255,.12);display:flex;align-items:center;justify-content:center;color:#7ca2ff">
              <span class="material-symbols-outlined">shield_lock</span>
            </div>
          </div>

          <input id="protrade2faLoginInput" type="text" inputmode="text" autocomplete="one-time-code" maxlength="32" placeholder="123456 or recovery code" aria-label="Authenticator or recovery code"/>

          <p id="protrade2faLoginMessage" style="min-height:20px;margin:11px 0 0;color:#ff827b;font-size:13px;font-weight:700"></p>

          <div style="margin-top:17px;display:flex;justify-content:flex-end;gap:10px">
            <button id="protrade2faLoginCancel" class="protrade2faLoginButton" type="button" style="border:1px solid #30383d;background:#1d2326;color:#eef1f2">Cancel</button>
            <button id="protrade2faLoginSubmit" class="protrade2faLoginButton" type="button" style="background:#315dce;color:white;box-shadow:0 14px 36px rgba(49,93,206,.28)">Verify and sign in</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const input = overlay.querySelector(
        "#protrade2faLoginInput"
      );
      const submit = overlay.querySelector(
        "#protrade2faLoginSubmit"
      );
      const cancel = overlay.querySelector(
        "#protrade2faLoginCancel"
      );
      const message = overlay.querySelector(
        "#protrade2faLoginMessage"
      );

      const close = () => overlay.remove();

      const verify = async () => {
        const code = input.value.trim();

        if (!code) {
          message.textContent =
            "Enter your authenticator or recovery code.";
          input.focus();
          return;
        }

        submit.disabled = true;
        cancel.disabled = true;
        submit.textContent = "Verifying…";
        message.textContent = "";

        try {
          const response = await nativeFetch(
            TWO_FACTOR_VERIFY_API,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                challengeToken:
                  challenge.challengeToken,
                code,
              }),
            }
          );

          const body = await response
            .json()
            .catch(() => ({}));

          if (
            !response.ok ||
            body.success === false ||
            !body.token
          ) {
            throw new Error(
              body.message ||
                "Two-factor verification failed."
            );
          }

          close();
          resolve(body);
        } catch (error) {
          message.textContent =
            error.message ||
            "Two-factor verification failed.";
          input.value = "";
          input.focus();
          submit.disabled = false;
          cancel.disabled = false;
          submit.textContent = "Verify and sign in";
        }
      };

      submit.addEventListener("click", verify);

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          verify();
        }
      });

      cancel.addEventListener("click", () => {
        close();
        reject(
          new Error(
            "Two-factor verification was cancelled."
          )
        );
      });

      window.setTimeout(() => input.focus(), 50);
    });

  const shouldInspectAuthResponse = (
    input,
    options = {}
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input?.url || "";

    const method = String(
      options.method ||
        (input instanceof Request
          ? input.method
          : "GET")
    ).toUpperCase();

    if (method !== "POST") return false;

    return (
      url.endsWith("/api/auth/login") ||
      url.endsWith("/api/auth/google")
    );
  };

  window.fetch = async (input, options = {}) => {
    const response = await nativeFetch(input, options);

    if (!shouldInspectAuthResponse(input, options)) {
      return response;
    }

    const body = await response
      .clone()
      .json()
      .catch(() => null);

    if (
      !body?.requiresTwoFactor ||
      !body?.challengeToken
    ) {
      return response;
    }

    try {
      const verified = await requestTwoFactorCode(
        body,
        typeof input === "string" ? input : input?.url
      );

      return new Response(JSON.stringify(verified), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type":
            "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            error.message ||
            "Two-factor verification was not completed.",
        }),
        {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }
  };

  const handleGoogleCredential = async (response) => {
    const credential = String(
      response?.credential || ""
    ).trim();

    if (!credential) {
      showError(
        "Google did not return a sign-in credential."
      );
      return;
    }

    setGoogleLoading(true);

    try {
      const apiResponse = await window.fetch(AUTH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ credential }),
      });

      const body = await apiResponse
        .json()
        .catch(() => ({}));

      if (
        !apiResponse.ok ||
        body.success === false ||
        !body.token
      ) {
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
        error.message ||
          "Could not connect Google to ProTrade."
      );
      setGoogleLoading(false);
    }
  };

  const renderGoogleButton = () => {
    const clientId = String(
      window.PROTRADE_GOOGLE_CLIENT_ID || ""
    ).trim();

    const container = document.getElementById(
      "googleSignInButton"
    );

    if (!container) return;

    if (
      !clientId ||
      clientId.includes(
        "PASTE_YOUR_GOOGLE_WEB_CLIENT_ID"
      )
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

    window.google.accounts.id.renderButton(
      container,
      {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width,
      }
    );
  };

  window.addEventListener("load", renderGoogleButton);
})();
