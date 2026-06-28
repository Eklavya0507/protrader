(() => {
  "use strict";

  const EVENT_ICONS = {
    account_created: "person_add",
    sign_in_success: "login",
    sign_in_failed: "warning",
    google_sign_in_success: "login",
    google_sign_in_failed: "warning",
    two_factor_challenge_issued: "shield_lock",
    two_factor_sign_in_success: "verified_user",
    two_factor_sign_in_failed: "gpp_bad",
    two_factor_setup_started: "qr_code_2",
    two_factor_enabled: "verified_user",
    two_factor_disabled: "gpp_bad",
    recovery_codes_regenerated: "key",
    password_changed: "password",
    password_reset_requested: "lock_reset",
    password_reset_completed: "lock_reset",
    profile_updated: "manage_accounts",
    session_started: "devices",
    session_trust_changed: "verified",
    session_reported_not_mine: "report",
    session_revoked: "phonelink_erase",
    other_sessions_revoked: "devices_off",
    all_sessions_revoked: "devices_off",
    signed_out: "logout",
    email_change_requested: "mark_email_unread",
    email_change_canceled: "cancel",
    email_change_completed: "alternate_email",
    account_data_exported: "download",
  };

  const waitForAuth = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (window.ProTradeAuth?.ready) {
        await window.ProTradeAuth.ready;
        return window.ProTradeAuth;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("ProTrade authentication helper was not found.");
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Unknown time"
      : date.toLocaleString();
  };

  const buildCard = () => {
    const section = document.createElement("section");
    section.id = "protradeSecurityActivityCard";
    section.className = "panel rounded-2xl p-6 lg:p-7";
    section.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px">
        <div>
          <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)">Audit trail</p>
          <h2 style="margin:7px 0 0;font-size:20px;font-weight:900">Security Activity</h2>
          <p style="margin:7px 0 0;max-width:690px;color:var(--muted);font-size:14px;line-height:1.65">Review sign-ins, password changes, two-factor actions and device-session security events.</p>
        </div>
        <button id="protradeSecurityActivityRefresh" type="button" class="secondary-btn" style="border-radius:12px;padding:10px 14px;font-weight:900">
          <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle">refresh</span>
          Refresh
        </button>
      </div>

      <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px">
        <select id="protradeSecurityOutcomeFilter" class="field" style="width:auto;min-width:170px">
          <option value="">All outcomes</option>
          <option value="success">Successful</option>
          <option value="failure">Failed</option>
        </select>
        <span id="protradeSecurityActivityCount" style="display:flex;align-items:center;color:var(--muted);font-size:13px;font-weight:800"></span>
      </div>

      <div id="protradeSecurityActivityNotice" style="display:none;margin-top:16px;border:1px solid var(--line);background:var(--panel-2);border-radius:14px;padding:13px 15px;font-size:14px"></div>
      <div id="protradeSecurityActivityList" style="margin-top:18px;display:grid;gap:10px"></div>
      <button id="protradeSecurityActivityMore" type="button" class="secondary-btn" style="display:none;margin-top:14px;width:100%;border-radius:12px;padding:11px 16px;font-weight:900">Load more</button>
    `;

    return section;
  };

  const start = async () => {
    if (
      !window.location.pathname.endsWith("settings.html") ||
      document.getElementById("protradeSecurityActivityCard")
    ) {
      return;
    }

    const securityPanel = document.getElementById("panel-security");
    if (!securityPanel) return;

    const auth = await waitForAuth();
    const card = buildCard();
    securityPanel.appendChild(card);

    const list = document.getElementById(
      "protradeSecurityActivityList"
    );
    const notice = document.getElementById(
      "protradeSecurityActivityNotice"
    );
    const count = document.getElementById(
      "protradeSecurityActivityCount"
    );
    const more = document.getElementById(
      "protradeSecurityActivityMore"
    );
    const filter = document.getElementById(
      "protradeSecurityOutcomeFilter"
    );
    const refresh = document.getElementById(
      "protradeSecurityActivityRefresh"
    );

    let page = 1;
    let hasMore = false;
    let loading = false;

    const showNotice = (message, error = false) => {
      if (!message) {
        notice.style.display = "none";
        notice.textContent = "";
        return;
      }

      notice.style.display = "block";
      notice.style.color = error
        ? "var(--red)"
        : "var(--muted)";
      notice.textContent = message;
    };

    const renderItems = (items, append) => {
      if (!append) list.innerHTML = "";

      for (const item of items) {
        const row = document.createElement("article");
        const failed = item.outcome === "failure";
        const icon =
          EVENT_ICONS[item.eventType] ||
          (failed ? "warning" : "security");
        const device = [
          item.browser,
          item.operatingSystem,
          item.deviceType,
        ]
          .filter(Boolean)
          .join(" · ");

        row.className = "panel-soft";
        row.style.cssText =
          "border-radius:16px;padding:15px;display:flex;gap:13px;align-items:flex-start";

        row.innerHTML = `
          <div style="width:42px;height:42px;flex:0 0 42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:${failed ? "color-mix(in srgb,var(--red) 12%,var(--panel-2))" : "color-mix(in srgb,var(--green) 12%,var(--panel-2))"};color:${failed ? "var(--red)" : "var(--green)"}">
            <span class="material-symbols-outlined">${escapeHtml(icon)}</span>
          </div>
          <div style="min-width:0;flex:1">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px">
              <strong style="font-size:14px">${escapeHtml(item.title)}</strong>
              <time style="color:var(--muted);font-size:12px;font-weight:700">${escapeHtml(formatDate(item.createdAt))}</time>
            </div>
            ${item.message ? `<p style="margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.55">${escapeHtml(item.message)}</p>` : ""}
            <p style="margin:7px 0 0;color:var(--muted);font-size:12px">${escapeHtml(device || "Unknown device")}</p>
          </div>
        `;

        list.appendChild(row);
      }
    };

    const load = async ({ append = false } = {}) => {
      if (loading) return;
      loading = true;
      refresh.disabled = true;
      more.disabled = true;
      showNotice(append ? "" : "Loading security activity…");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (filter.value) {
          params.set("outcome", filter.value);
        }

        const response = await auth.apiFetch(
          `${auth.API_BASE}/security/activity?${params.toString()}`,
          {
            headers: { Accept: "application/json" },
          }
        );

        const body = await response.json().catch(() => ({}));

        if (!response.ok || body.success === false) {
          throw new Error(
            body.message || "Security activity could not be loaded."
          );
        }

        renderItems(body.data || [], append);
        hasMore = body.hasMore === true;
        more.style.display = hasMore ? "block" : "none";
        count.textContent = `${Number(body.total) || 0} event${
          Number(body.total) === 1 ? "" : "s"
        }`;

        if (!append && !(body.data || []).length) {
          showNotice(
            "No recorded security activity yet. New events will appear here."
          );
        } else {
          showNotice("");
        }
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        loading = false;
        refresh.disabled = false;
        more.disabled = false;
      }
    };

    refresh.addEventListener("click", () => {
      page = 1;
      load();
    });

    filter.addEventListener("change", () => {
      page = 1;
      load();
    });

    more.addEventListener("click", () => {
      page += 1;
      load({ append: true });
    });

    await load();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
})();
