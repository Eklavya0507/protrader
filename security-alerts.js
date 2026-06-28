(() => {
  "use strict";

  const ICONS = {
    repeated_failed_sign_in: "password",
    repeated_failed_two_factor: "shield_lock",
    new_device_session: "devices",
    refresh_token_reuse: "key_off",
    unknown_device_reported: "report",
    password_changed: "password",
    password_reset_completed: "lock_reset",
    two_factor_disabled: "gpp_bad",
    email_changed: "alternate_email",
    recovery_codes_regenerated: "key",
    two_factor_enabled: "verified_user",
    all_sessions_revoked: "devices_off",
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

    throw new Error(
      "ProTrade authentication helper was not found."
    );
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
    section.id = "protradeSecurityAlertsCard";
    section.className = "panel rounded-2xl p-6 lg:p-7";

    section.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px">
        <div>
          <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--primary)">Suspicious activity detection</p>
          <h2 style="margin:7px 0 0;font-size:20px;font-weight:900">Security Alerts</h2>
          <p style="margin:7px 0 0;max-width:720px;color:var(--muted);font-size:14px;line-height:1.65">ProTrade detects repeated failed sign-ins, incorrect 2FA attempts, unfamiliar device sessions and critical account changes.</p>
        </div>
        <button id="protradeAlertsRefresh" type="button" class="secondary-btn" style="border-radius:12px;padding:10px 14px;font-weight:900">
          <span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle">refresh</span>
          Refresh
        </button>
      </div>

      <div id="protradeAlertsSummary" style="margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div class="panel-soft" style="border-radius:14px;padding:14px"><strong id="protradeAlertsUnread">—</strong><p style="margin:5px 0 0;color:var(--muted);font-size:12px">Unread</p></div>
        <div class="panel-soft" style="border-radius:14px;padding:14px"><strong id="protradeAlertsCritical">—</strong><p style="margin:5px 0 0;color:var(--muted);font-size:12px">Critical unread</p></div>
        <div class="panel-soft" style="border-radius:14px;padding:14px"><strong id="protradeAlerts30Days">—</strong><p style="margin:5px 0 0;color:var(--muted);font-size:12px">Last 30 days</p></div>
      </div>

      <div class="panel-soft" style="margin-top:16px;border-radius:16px;padding:16px">
        <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:14px">
          <div>
            <strong style="font-size:14px">Alert preferences</strong>
            <p style="margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.55">New-device emails remain managed by Active Devices. These options control Batch 7 critical and warning emails.</p>
          </div>
          <button id="protradeAlertsSavePreferences" type="button" class="primary-btn" style="border-radius:11px;padding:10px 14px;font-weight:900">Save preferences</button>
        </div>
        <div style="margin-top:14px;display:grid;gap:11px">
          <label style="display:flex;align-items:center;justify-content:space-between;gap:14px">
            <span><strong style="font-size:13px">In-app security alerts</strong><small style="display:block;margin-top:3px;color:var(--muted)">Create alerts inside Settings → Security.</small></span>
            <input id="protradeAlertsInApp" type="checkbox"/>
          </label>
          <label style="display:flex;align-items:center;justify-content:space-between;gap:14px">
            <span><strong style="font-size:13px">Critical security emails</strong><small style="display:block;margin-top:3px;color:var(--muted)">Password, 2FA, email and token-reuse alerts.</small></span>
            <input id="protradeAlertsEmailCritical" type="checkbox"/>
          </label>
          <label style="display:flex;align-items:center;justify-content:space-between;gap:14px">
            <span><strong style="font-size:13px">Warning security emails</strong><small style="display:block;margin-top:3px;color:var(--muted)">Recovery-code and other warning alerts.</small></span>
            <input id="protradeAlertsEmailWarning" type="checkbox"/>
          </label>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <select id="protradeAlertsStatusFilter" class="field" style="width:auto;min-width:165px">
          <option value="">All alerts</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select id="protradeAlertsSeverityFilter" class="field" style="width:auto;min-width:165px">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Information</option>
        </select>
        <button id="protradeAlertsReadAll" type="button" class="secondary-btn" style="border-radius:11px;padding:10px 14px;font-weight:900">Mark all read</button>
        <span id="protradeAlertsCount" style="color:var(--muted);font-size:13px;font-weight:800"></span>
      </div>

      <div id="protradeAlertsNotice" style="display:none;margin-top:14px;border:1px solid var(--line);background:var(--panel-2);border-radius:14px;padding:13px 15px;font-size:14px"></div>
      <div id="protradeAlertsList" style="margin-top:16px;display:grid;gap:10px"></div>
      <button id="protradeAlertsMore" type="button" class="secondary-btn" style="display:none;margin-top:14px;width:100%;border-radius:12px;padding:11px 16px;font-weight:900">Load more</button>
    `;

    return section;
  };

  const start = async () => {
    if (
      !window.location.pathname.endsWith("settings.html") ||
      document.getElementById("protradeSecurityAlertsCard")
    ) {
      return;
    }

    const securityPanel =
      document.getElementById("panel-security");

    if (!securityPanel) return;

    const auth = await waitForAuth();
    const card = buildCard();

    const activityCard = document.getElementById(
      "protradeSecurityActivityCard"
    );

    if (activityCard) {
      activityCard.insertAdjacentElement("beforebegin", card);
    } else {
      securityPanel.appendChild(card);
    }

    const byId = (id) => document.getElementById(id);
    const list = byId("protradeAlertsList");
    const notice = byId("protradeAlertsNotice");
    const more = byId("protradeAlertsMore");
    const count = byId("protradeAlertsCount");
    const refresh = byId("protradeAlertsRefresh");
    const statusFilter = byId(
      "protradeAlertsStatusFilter"
    );
    const severityFilter = byId(
      "protradeAlertsSeverityFilter"
    );

    let page = 1;
    let loading = false;

    const showNotice = (message, isError = false) => {
      if (!message) {
        notice.style.display = "none";
        notice.textContent = "";
        return;
      }

      notice.style.display = "block";
      notice.style.color = isError
        ? "var(--red)"
        : "var(--muted)";
      notice.textContent = message;
    };

    const apiJson = async (path, options = {}) => {
      const response = await auth.apiFetch(
        `${auth.API_BASE}/security/alerts${path}`,
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
          body.message || "Security-alert request failed."
        );
      }

      return body;
    };

    const loadSummary = async () => {
      const body = await apiJson("/summary");
      const data = body.data || {};

      byId("protradeAlertsUnread").textContent =
        Number(data.unread) || 0;
      byId("protradeAlertsCritical").textContent =
        Number(data.criticalUnread) || 0;
      byId("protradeAlerts30Days").textContent =
        Number(data.total30Days) || 0;
    };

    const loadPreferences = async () => {
      const body = await apiJson("/preferences");
      const data = body.data || {};

      byId("protradeAlertsInApp").checked =
        data.inAppAlerts === true;
      byId("protradeAlertsEmailCritical").checked =
        data.emailCriticalAlerts === true;
      byId("protradeAlertsEmailWarning").checked =
        data.emailWarningAlerts === true;
    };

    const renderAlerts = (items, append) => {
      if (!append) list.innerHTML = "";

      for (const item of items) {
        const row = document.createElement("article");
        const unread = item.status === "unread";
        const severity =
          ["critical", "warning", "info"].includes(
            item.severity
          )
            ? item.severity
            : "info";
        const icon =
          ICONS[item.type] ||
          (severity === "critical"
            ? "gpp_bad"
            : "notifications_active");
        const severityColor =
          severity === "critical"
            ? "var(--red)"
            : severity === "warning"
              ? "#d69b2d"
              : "var(--primary)";
        const device = [
          item.browser,
          item.operatingSystem,
          item.deviceType,
        ]
          .filter(Boolean)
          .join(" · ");

        row.className = "panel-soft";
        row.dataset.alertId = item.id;
        row.style.cssText = `border-radius:16px;padding:15px;display:flex;gap:13px;align-items:flex-start;${unread ? "border-color:" + severityColor + ";" : ""}`;

        row.innerHTML = `
          <div style="width:42px;height:42px;flex:0 0 42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,${severityColor} 12%,var(--panel-2));color:${severityColor}">
            <span class="material-symbols-outlined">${escapeHtml(icon)}</span>
          </div>
          <div style="min-width:0;flex:1">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <strong style="font-size:14px">${escapeHtml(item.title)}</strong>
                ${unread ? `<span style="width:8px;height:8px;border-radius:50%;background:${severityColor}"></span>` : ""}
              </div>
              <time style="color:var(--muted);font-size:12px;font-weight:700">${escapeHtml(formatDate(item.createdAt))}</time>
            </div>
            <p style="margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.55">${escapeHtml(item.message)}</p>
            <p style="margin:7px 0 0;color:var(--muted);font-size:12px">${escapeHtml(device || "Unknown device")}${item.emailSent ? " · Email sent" : ""}</p>
            ${unread ? `<button type="button" data-mark-alert-read="${escapeHtml(item.id)}" class="secondary-btn" style="margin-top:10px;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800">Mark read</button>` : ""}
          </div>
        `;

        list.appendChild(row);
      }
    };

    const loadAlerts = async ({ append = false } = {}) => {
      if (loading) return;

      loading = true;
      refresh.disabled = true;
      more.disabled = true;

      if (!append) showNotice("Loading security alerts…");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (statusFilter.value) {
          params.set("status", statusFilter.value);
        }

        if (severityFilter.value) {
          params.set("severity", severityFilter.value);
        }

        const body = await apiJson(
          `/?${params.toString()}`
        );

        renderAlerts(body.data || [], append);
        more.style.display = body.hasMore
          ? "block"
          : "none";
        count.textContent = `${Number(body.total) || 0} alert${
          Number(body.total) === 1 ? "" : "s"
        }`;

        if (!append && !(body.data || []).length) {
          showNotice(
            "No security alerts yet. ProTrade will add one when suspicious or important account activity is detected."
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

    const reloadAll = async () => {
      page = 1;
      await Promise.all([
        loadSummary(),
        loadPreferences(),
      ]);
      await loadAlerts();
    };

    byId("protradeAlertsSavePreferences").addEventListener(
      "click",
      async (event) => {
        const button = event.currentTarget;
        const oldText = button.textContent;

        button.disabled = true;
        button.textContent = "Saving…";

        try {
          await apiJson("/preferences", {
            method: "PATCH",
            body: JSON.stringify({
              inAppAlerts:
                byId("protradeAlertsInApp").checked,
              emailCriticalAlerts:
                byId("protradeAlertsEmailCritical")
                  .checked,
              emailWarningAlerts:
                byId("protradeAlertsEmailWarning")
                  .checked,
            }),
          });

          showNotice(
            "Security-alert preferences saved."
          );
        } catch (error) {
          showNotice(error.message, true);
        } finally {
          button.disabled = false;
          button.textContent = oldText;
        }
      }
    );

    list.addEventListener("click", async (event) => {
      const button = event.target.closest(
        "[data-mark-alert-read]"
      );

      if (!button) return;

      button.disabled = true;

      try {
        await apiJson(
          `/${encodeURIComponent(
            button.dataset.markAlertRead
          )}/read`,
          {
            method: "PATCH",
          }
        );

        await reloadAll();
      } catch (error) {
        button.disabled = false;
        showNotice(error.message, true);
      }
    });

    byId("protradeAlertsReadAll").addEventListener(
      "click",
      async () => {
        try {
          await apiJson("/read-all", {
            method: "PATCH",
          });

          await reloadAll();
        } catch (error) {
          showNotice(error.message, true);
        }
      }
    );

    refresh.addEventListener("click", reloadAll);

    statusFilter.addEventListener("change", () => {
      page = 1;
      loadAlerts();
    });

    severityFilter.addEventListener("change", () => {
      page = 1;
      loadAlerts();
    });

    more.addEventListener("click", () => {
      page += 1;
      loadAlerts({ append: true });
    });

    try {
      await reloadAll();
    } catch (error) {
      showNotice(error.message, true);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
})();
