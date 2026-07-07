/*
  ProTrade Calendar + Performance Dashboard
  Interactive Calendar, Performance analytics and theme controls.
*/

(() => {
      "use strict";

      const $ = (selector, root = document) => root.querySelector(selector);
      const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

      const state = {
        theme: localStorage.getItem("protrade-calendar-dark-preview-theme") || "dark",
        currentDate: new Date(2024, 4, 1),
        currentView: "month",
        balanceHidden: false,
        trades: {
          "2024-05-01": [{ symbol: "EURUSD", pnl: 30, r: 0.6, session: "London" }],
          "2024-05-02": [{ symbol: "XAUUSD", pnl: -20, r: -0.4, session: "New York" }],
          "2024-05-03": [{ symbol: "NAS100", pnl: 120, r: 2.4, session: "New York" }],
          "2024-05-06": [{ symbol: "EURUSD", pnl: 80, r: 1.6, session: "London" }],
          "2024-05-07": [{ symbol: "GBPUSD", pnl: 40, r: 0.8, session: "London" }],
          "2024-05-08": [{ symbol: "XAUUSD", pnl: -30, r: -0.6, session: "New York" }],
          "2024-05-09": [{ symbol: "NAS100", pnl: 200, r: 3.1, session: "New York" }],
          "2024-05-10": [{ symbol: "EURUSD", pnl: 60, r: 1.2, session: "London" }],
          "2024-05-13": [{ symbol: "USDJPY", pnl: -20, r: -0.4, session: "Tokyo" }],
          "2024-05-14": [{ symbol: "EURUSD", pnl: 90, r: 1.8, session: "London" }],
          "2024-05-15": [{ symbol: "GBPUSD", pnl: 140, r: 2.3, session: "London" }],
          "2024-05-16": [{ symbol: "XAUUSD", pnl: -70, r: -1.1, session: "New York" }],
          "2024-05-17": [{ symbol: "NAS100", pnl: 60, r: 1.0, session: "New York" }],
          "2024-05-20": [{ symbol: "EURUSD", pnl: 160, r: 2.8, session: "London" }],
          "2024-05-21": [{ symbol: "GBPUSD", pnl: -60, r: -1.0, session: "London" }],
          "2024-05-22": [{ symbol: "EURUSD", pnl: 90, r: 1.5, session: "London" }],
          "2024-05-23": [{ symbol: "NAS100", pnl: 130, r: 2.1, session: "New York" }],
          "2024-05-24": [{ symbol: "USDJPY", pnl: -10, r: -0.2, session: "Tokyo" }],
          "2024-05-27": [{ symbol: "XAUUSD", pnl: 120, r: 2.0, session: "New York" }],
          "2024-05-28": [{ symbol: "EURUSD", pnl: 60, r: 1.0, session: "London" }],
          "2024-05-29": [{ symbol: "GBPUSD", pnl: -40, r: -0.7, session: "London" }],
          "2024-05-31": [{ symbol: "NAS100", pnl: 120, r: 2.2, session: "New York" }],
          "2024-01-12": [{ symbol: "EURUSD", pnl: 85, r: 1.4, session: "London" }],
          "2024-01-22": [{ symbol: "XAUUSD", pnl: -45, r: -0.8, session: "New York" }],
          "2024-02-08": [{ symbol: "GBPUSD", pnl: 70, r: 1.1, session: "London" }],
          "2024-03-19": [{ symbol: "NAS100", pnl: 130, r: 2.2, session: "New York" }],
          "2024-04-08": [{ symbol: "USDJPY", pnl: -30, r: -0.5, session: "Tokyo" }],
          "2024-06-24": [{ symbol: "EURUSD", pnl: 95, r: 1.7, session: "London" }],
          "2024-07-02": [{ symbol: "EURUSD", pnl: 119, r: 2.38, session: "London" }],
          "2024-07-03": [{ symbol: "XAUUSD", pnl: 202.5, r: 2.02, session: "New York" }],
          "2024-07-07": [{ symbol: "GBPUSD", pnl: 45.3, r: 0.45, session: "London" }],
          "2024-07-11": [{ symbol: "USDJPY", pnl: -55, r: -0.55, session: "Tokyo" }],
          "2024-07-15": [{ symbol: "NAS100", pnl: 165, r: 1.65, session: "New York" }],
          "2024-07-18": [{ symbol: "XAUUSD", pnl: -60, r: -0.60, session: "New York" }],
          "2024-08-05": [{ symbol: "GBPUSD", pnl: -84.2, r: -0.84, session: "London" }],
          "2024-09-24": [{ symbol: "NAS100", pnl: 129.5, r: 1.29, session: "New York" }],
          "2024-10-14": [{ symbol: "EURUSD", pnl: 75, r: 1.2, session: "London" }],
          "2024-11-06": [{ symbol: "XAUUSD", pnl: -40, r: -0.7, session: "New York" }],
          "2024-12-18": [{ symbol: "NAS100", pnl: 180, r: 2.8, session: "New York" }]
        }
      };

      function dateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }

      function money(value) {
        const sign = value > 0 ? "+" : value < 0 ? "-" : "";
        return `${sign}$${Math.abs(value).toFixed(1)}`;
      }

      function toast(title, message = "") {
        const node = document.createElement("div");
        node.className = "toast";
        node.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
        $("#toastStack").appendChild(node);
        setTimeout(() => node.remove(), 3200);
      }

      function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = "hidden";
      }

      function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.hidden = true;
        if (!$$(".modal-backdrop:not([hidden])").length) {
          document.body.style.overflow = "";
        }
      }

      function syncThemeControls(theme) {
        const isDark = theme === "dark";

        $("#themeLabel").textContent = isDark ? "Dark Mode" : "Light Mode";
        $("#headerThemeLabel").textContent = isDark ? "Dark" : "Light";

        $$("[data-theme-toggle]").forEach((button) => {
          button.setAttribute("aria-checked", String(isDark));
          button.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
          );
          button.title = isDark
            ? "Switch to Light Mode"
            : "Switch to Dark Mode";
        });
      }

      function runThemeAnimation() {
        const root = document.documentElement;
        const flash = $("#themeTransitionFlash");

        root.classList.remove("theme-changing");
        void root.offsetWidth;
        root.classList.add("theme-changing");

        flash.classList.remove("animate");
        void flash.offsetWidth;
        flash.classList.add("animate");

        window.setTimeout(() => {
          root.classList.remove("theme-changing");
          flash.classList.remove("animate");
        }, 680);
      }

      function applyTheme(theme, animate = false) {
        state.theme = theme;
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("protrade-calendar-dark-preview-theme", theme);
        syncThemeControls(theme);

        document.querySelector('meta[name="theme-color"]').setAttribute(
          "content",
          theme === "dark" ? "#010307" : "#f4f8fb"
        );

        if (animate) {
          runThemeAnimation();
        }

        if ($("#performanceEquityChart")) {
          window.requestAnimationFrame(drawPerformanceChart);
        }
      }

      function toggleTheme() {
        const nextTheme = state.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme, true);
        toast(
          "Theme changed",
          `${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`
        );
      }

      function setupFramework() {
        applyTheme(state.theme);

        $$("[data-theme-toggle]").forEach((button) => {
          button.addEventListener("click", toggleTheme);
        });

        $$(".nav-item[data-route]").forEach((button) => {
          button.addEventListener("click", () => {
            window.location.href = button.dataset.route;
          });
        });

        $$(".nav-item[data-page]").forEach((button) => {
          button.addEventListener("click", () => {
            if (button.dataset.page === "Calendar") {
              window.scrollTo({ top: 0, behavior: "smooth" });
              toast("Calendar", "You are already on the Calendar page.");
              return;
            }
            toast(button.dataset.page, `${button.dataset.page} page is not included in this Calendar package.`);
          });
        });

        $("#mobileMenuBtn").addEventListener("click", () => {
          document.body.classList.add("sidebar-open");
        });

        $("#sidebarOverlay").addEventListener("click", () => {
          document.body.classList.remove("sidebar-open");
        });

        $("#profileBtn").addEventListener("click", (event) => {
          event.stopPropagation();
          $("#profilePopover").hidden = !$("#profilePopover").hidden;
          $("#accountPopover").hidden = true;
        });

        $$("[data-profile]").forEach((button) => {
          button.addEventListener("click", () => {
            $("#profilePopover").hidden = true;
            toast(
              button.dataset.profile === "logout" ? "Demo action" : "Profile",
              button.dataset.profile === "logout"
                ? "Sign out is disabled in this frontend demo."
                : `${button.textContent.trim()} selected.`
            );
          });
        });

        $("#balanceBtn").addEventListener("click", () => {
          state.balanceHidden = !state.balanceHidden;
          $("#balanceValue").textContent = state.balanceHidden ? "••••••••" : "$12,540.00";
          $("#equityValue").textContent = state.balanceHidden ? "••••••••" : "$13,214.75";
          toast(state.balanceHidden ? "Balance hidden" : "Balance visible");
        });

        $("#importBtn").addEventListener("click", () => $("#importFile").click());
        $("#importFile").addEventListener("change", (event) => {
          const file = event.target.files[0];
          if (file) toast("Import selected", `${file.name} is ready for backend upload.`);
          event.target.value = "";
        });

        $("#dateRangeBtn").addEventListener("click", () => openModal("dateModal"));

        $("#accountBtn").addEventListener("click", (event) => {
          event.stopPropagation();
          $("#accountPopover").hidden = !$("#accountPopover").hidden;
          $("#profilePopover").hidden = true;
        });

        $$("[data-account]").forEach((button) => {
          button.addEventListener("click", () => {
            $("#accountText").textContent = button.dataset.account;
            $("#accountPopover").hidden = true;
            toast("Account changed", button.dataset.account);
          });
        });

        $("#notificationBtn").addEventListener("click", () => {
          toast("Notifications", "3 calendar updates are available.");
        });

        $("#newTradeBtn").addEventListener("click", () => openModal("tradeModal"));

        $$("[data-close]").forEach((button) => {
          button.addEventListener("click", () => closeModal(button.dataset.close));
        });

        $$(".modal-backdrop").forEach((backdrop) => {
          backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) closeModal(backdrop.id);
          });
        });

        document.addEventListener("click", () => {
          $("#accountPopover").hidden = true;
          $("#profilePopover").hidden = true;
        });
      }

      function getMonthTrades(year, month) {
        const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
        return Object.entries(state.trades)
          .filter(([key]) => key.startsWith(prefix))
          .flatMap(([, trades]) => trades);
      }

      function getYearTrades(year) {
        const prefix = `${year}-`;
        return Object.entries(state.trades)
          .filter(([key]) => key.startsWith(prefix))
          .flatMap(([, trades]) => trades);
      }

      function getVisiblePeriodTrades() {
        const year = state.currentDate.getFullYear();

        if (state.currentView === "month") {
          return getMonthTrades(year, state.currentDate.getMonth());
        }

        // The video-style Q and Y overviews both summarize the complete year.
        return getYearTrades(year);
      }

      function updateSummary() {
        const trades = getVisiblePeriodTrades();
        const wins = trades.filter((trade) => trade.pnl > 0);
        const losses = trades.filter((trade) => trade.pnl < 0);
        const winAmount = wins.reduce((sum, trade) => sum + trade.pnl, 0);
        const lossAmount = losses.reduce((sum, trade) => sum + trade.pnl, 0);

        $("#winChip").textContent = `${wins.length} ($${winAmount.toFixed(0)})`;
        $("#lossChip").textContent = `${losses.length} (-$${Math.abs(lossAmount).toFixed(0)})`;
        $("#tradeChip").textContent = String(trades.length);
      }

      function renderWeeks() {
        const container = $("#weekCards");
        container.innerHTML = "";

        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const mondayOffset = (first.getDay() + 6) % 7;
        const totalWeeks = Math.ceil((mondayOffset + last.getDate()) / 7);

        for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
          const weekStartDay = 1 - mondayOffset + weekIndex * 7;
          let total = 0;
          let tradeCount = 0;
          let activeDays = 0;

          for (let i = 0; i < 7; i++) {
            const day = weekStartDay + i;
            if (day < 1 || day > last.getDate()) continue;
            const key = dateKey(new Date(year, month, day));
            const trades = state.trades[key] || [];
            if (trades.length) activeDays += 1;
            tradeCount += trades.length;
            total += trades.reduce((sum, trade) => sum + trade.pnl, 0);
          }

          const card = document.createElement("button");
          card.type = "button";
          card.className = "week-card";
          card.innerHTML = `
            <div class="week-card-head">
              <strong>Week ${weekIndex + 1}</strong>
              <span>${tradeCount} trades</span>
            </div>
            <div class="week-card-value">
              <strong class="${total > 0 ? "positive" : total < 0 ? "negative" : ""}">${money(total)}</strong>
              <small>${total === 0 ? "0.00%" : `${(total / 12540 * 100).toFixed(2)}%`}</small>
            </div>
            <small>${activeDays} days</small>
          `;

          card.addEventListener("click", () => {
            $$(".week-card").forEach((item) => item.classList.remove("active"));
            card.classList.add("active");
            toast(`Week ${weekIndex + 1}`, `${tradeCount} trades, ${money(total)} net P&L.`);
          });

          container.appendChild(card);
        }
      }

      function renderMonth() {
        const grid = $("#calendarGrid");
        grid.innerHTML = "";

        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const mondayIndex = (first.getDay() + 6) % 7;
        const previousLast = new Date(year, month, 0).getDate();

        for (let index = 0; index < 42; index++) {
          let day;
          let outside = false;
          let cellDate;

          if (index < mondayIndex) {
            day = previousLast - mondayIndex + index + 1;
            outside = true;
            cellDate = new Date(year, month - 1, day);
          } else if (index >= mondayIndex + last.getDate()) {
            day = index - mondayIndex - last.getDate() + 1;
            outside = true;
            cellDate = new Date(year, month + 1, day);
          } else {
            day = index - mondayIndex + 1;
            cellDate = new Date(year, month, day);
          }

          const key = dateKey(cellDate);
          const trades = state.trades[key] || [];
          const pnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
          const r = trades.reduce((sum, trade) => sum + trade.r, 0);

          const button = document.createElement("button");
          button.type = "button";
          button.className = "day-cell";
          if (outside) button.classList.add("outside");
          if (key === "2024-05-07") button.classList.add("today");

          button.innerHTML = `
            <span class="day-top">
              <span class="date-number">${day}</span>
              <span class="trade-count">${trades.length} trades</span>
            </span>
            <span class="day-pnl ${pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}">${money(pnl)}</span>
            <span class="day-r">${r >= 0 ? "+" : ""}${r.toFixed(1)}R &nbsp; ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(1)}</span>
          `;

          button.addEventListener("click", () => {
            $$(".day-cell").forEach((item) => item.classList.remove("selected"));
            button.classList.add("selected");
            showDayDetail(cellDate, trades);
          });

          grid.appendChild(button);
        }
      }

      function compactMonthMarkup(year, month, selected = false) {
        const first = new Date(year, month, 1);
        const totalDays = new Date(year, month + 1, 0).getDate();
        const offset = (first.getDay() + 6) % 7;
        const dayCells = [];
        const monthName = new Intl.DateTimeFormat("en-US", { month: "short" })
          .format(first);

        for (let index = 0; index < offset; index++) {
          dayCells.push('<button class="compact-day blank" type="button" tabindex="-1"></button>');
        }

        for (let day = 1; day <= totalDays; day++) {
          const date = new Date(year, month, day);
          const key = dateKey(date);
          const trades = state.trades[key] || [];
          const pnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);

          let performanceClass = "";
          if (pnl >= 120) performanceClass = "strong-profit";
          else if (pnl > 0) performanceClass = "profit";
          else if (pnl <= -60) performanceClass = "strong-loss";
          else if (pnl < 0) performanceClass = "loss";

          const todayClass = key === "2024-05-07" ? "today" : "";

          dayCells.push(`
            <button
              class="compact-day ${performanceClass} ${todayClass}"
              type="button"
              data-compact-date="${key}"
              title="${trades.length ? `${trades.length} trade(s), ${money(pnl)}` : "No trades"}"
            >${day}</button>
          `);
        }

        return `
          <section class="compact-month ${selected ? "selected-month" : ""}">
            <button
              class="compact-month-title"
              type="button"
              data-open-month="${month}"
              data-open-year="${year}"
            >${monthName}</button>
            <div class="compact-weekdays">
              <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
            </div>
            <div class="compact-days">${dayCells.join("")}</div>
          </section>
        `;
      }

      function bindCompactCalendar(root) {
        $$("[data-compact-date]", root).forEach((button) => {
          button.addEventListener("click", () => {
            const date = new Date(`${button.dataset.compactDate}T00:00:00`);
            const trades = state.trades[button.dataset.compactDate] || [];
            showDayDetail(date, trades);
          });
        });

        $$("[data-open-month]", root).forEach((button) => {
          button.addEventListener("click", () => {
            state.currentDate = new Date(
              Number(button.dataset.openYear),
              Number(button.dataset.openMonth),
              1
            );
            switchView("month");
          });
        });
      }

      function ordinalQuarter(quarter) {
        return ["1st", "2nd", "3rd", "4th"][quarter - 1];
      }

      function renderQuarter() {
        const view = $("#quarterView");
        const year = state.currentDate.getFullYear();

        const quarterCards = Array.from({ length: 4 }, (_, quarterIndex) => {
          const quarter = quarterIndex + 1;
          const startMonth = quarterIndex * 3;
          const quarterTrades = [0, 1, 2]
            .flatMap((offset) => getMonthTrades(year, startMonth + offset));
          const quarterPnl = quarterTrades.reduce((sum, trade) => sum + trade.pnl, 0);

          return `
            <article class="quarter-card">
              <div class="quarter-card-head">
                <h4>${ordinalQuarter(quarter)} - Quarter</h4>
                <span class="${quarterPnl > 0 ? "positive" : quarterPnl < 0 ? "negative" : ""}">
                  ${quarterTrades.length} trades · ${money(quarterPnl)}
                </span>
              </div>
              <div class="quarter-months">
                ${[0, 1, 2]
                  .map((offset) => compactMonthMarkup(year, startMonth + offset))
                  .join("")}
              </div>
            </article>
          `;
        }).join("");

        view.innerHTML = `<div class="quarter-board">${quarterCards}</div>`;
        bindCompactCalendar(view);
      }

      function renderYear() {
        const view = $("#yearView");
        const year = state.currentDate.getFullYear();

        view.innerHTML = `
          <div class="year-board">
            <div class="year-months">
              ${Array.from({ length: 12 }, (_, month) =>
                compactMonthMarkup(
                  year,
                  month,
                  month === state.currentDate.getMonth()
                )
              ).join("")}
            </div>
          </div>
        `;

        bindCompactCalendar(view);
      }

      function updatePeriodTitle() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        if (state.currentView === "month") {
          $("#periodTitle").textContent = new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric"
          }).format(state.currentDate);
        } else if (state.currentView === "quarter") {
          $("#periodTitle").textContent = String(year);
        } else {
          $("#periodTitle").textContent = String(year);
        }
      }

      function switchView(view) {
        state.currentView = view;

        $$("#viewSwitch button").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === view);
        });

        $("#monthView").classList.toggle("month-hidden", view !== "month");
        $("#quarterView").classList.toggle("active", view === "quarter");
        $("#yearView").classList.toggle("active", view === "year");
        $("#weekCards").hidden = view !== "month";

        updatePeriodTitle();
        updateSummary();

        if (view === "month") {
          renderWeeks();
          renderMonth();
        } else if (view === "quarter") {
          renderQuarter();
        } else {
          renderYear();
        }

        toast("Calendar view changed", `${view[0].toUpperCase() + view.slice(1)} view selected.`);
      }

      function changePeriod(step) {
        if (state.currentView === "month") {
          state.currentDate = new Date(
            state.currentDate.getFullYear(),
            state.currentDate.getMonth() + step,
            1
          );
        } else {
          // Both Quarter overview and Year overview move year-by-year.
          state.currentDate = new Date(
            state.currentDate.getFullYear() + step,
            state.currentDate.getMonth(),
            1
          );
        }

        renderAllCalendar();
      }

      function showDayDetail(date, trades) {
        const formatted = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric"
        }).format(date);

        $("#dayModalTitle").textContent = formatted;
        $("#dayModalSubtitle").textContent = trades.length
          ? `${trades.length} trade${trades.length === 1 ? "" : "s"} recorded.`
          : "No trades recorded.";

        const list = $("#dayDetailList");
        if (!trades.length) {
          list.innerHTML = `
            <div class="day-detail-row">
              <span>No trade data</span><strong>$0.00</strong>
            </div>
          `;
        } else {
          list.innerHTML = trades.map((trade) => `
            <div class="day-detail-row">
              <span>${trade.symbol} · ${trade.session}</span>
              <strong class="${trade.pnl >= 0 ? "positive" : "negative"}">${money(trade.pnl)} · ${trade.r >= 0 ? "+" : ""}${trade.r.toFixed(1)}R</strong>
            </div>
          `).join("");
        }

        openModal("dayModal");
      }

      function renderAllCalendar() {
        updatePeriodTitle();
        updateSummary();
        $("#weekCards").hidden = state.currentView !== "month";

        if (state.currentView === "month") {
          renderWeeks();
          renderMonth();
        } else if (state.currentView === "quarter") {
          renderQuarter();
        } else {
          renderYear();
        }
      }

      function setupCalendar() {
        $("#previousPeriodBtn").addEventListener("click", () => changePeriod(-1));
        $("#nextPeriodBtn").addEventListener("click", () => changePeriod(1));

        $$("#viewSwitch button").forEach((button) => {
          button.addEventListener("click", () => switchView(button.dataset.view));
        });

        $("#calendarAccountFilter").addEventListener("change", (event) => {
          toast("Calendar account", event.target.value);
        });

        $("#calendarTypeFilter").addEventListener("change", (event) => {
          toast("Trade type", event.target.value);
        });

        $("#dateForm").addEventListener("submit", (event) => {
          event.preventDefault();

          const start = new Date($("#startDate").value + "T00:00:00");
          const end = new Date($("#endDate").value + "T00:00:00");

          if (start > end) {
            toast("Invalid range", "Start date must be before end date.");
            return;
          }

          const formatter = new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          });

          $("#dateRangeText").textContent = `${formatter.format(start)} - ${formatter.format(end)}`;
          closeModal("dateModal");
          toast("Date range updated");
        });

        $("#tradeForm").addEventListener("submit", (event) => {
          event.preventDefault();

          const data = new FormData(event.currentTarget);
          const key = String(data.get("date"));
          const trade = {
            symbol: String(data.get("symbol")).toUpperCase(),
            pnl: Number(data.get("pnl")),
            r: Number(data.get("r")),
            session: String(data.get("session")),
            direction: String(data.get("direction"))
          };

          if (!state.trades[key]) state.trades[key] = [];
          state.trades[key].push(trade);

          state.currentDate = new Date(`${key}T00:00:00`);
          switchView("month");
          updatePerformanceFromTrade(trade);
          closeModal("tradeModal");
          toast("Trade added", `${trade.symbol} added to ${key}.`);
          event.currentTarget.reset();
        });
      }


      const performanceState = {
        range: "1M",
        totalTrades: 229,
        netProfit: 12914.75,
        wins: 145,
        losses: 73,
        breakeven: 11,
        profitFactor: 2.41,
        averageR: 1.32
      };

      const performanceRangeData = {
        "1W": [7200,7600,7450,8000,8350,8700,9100],
        "1M": [6800,7200,7500,7400,7900,8300,8700,8100,7600,8000,8400,8800,8600,9200,8900,9500,9300,9800,10100,9600,9900,10400,11000,9500,10200,9900,10400,10800,10200,10700,10400,10900,11200,11500,11100,11600,11300,11800,11400,12000,12400,11700,12100,12500,11900,12400,12800,13200,12900,13600,13400,14000],
        "3M": [5200,5600,6100,6500,7000,6800,7400,8000,8400,8800,9300,9000,9700,10300,10900,11400,11900,12500,13100,13700,14000],
        "6M": [4300,4800,5200,5800,6300,6900,7500,8200,8800,9500,10200,10900,11600,12300,13000,13600,14000],
        "1Y": [3200,3800,4500,5100,5900,6800,7600,8500,9400,10300,11200,12100,13000,14000],
        "ALL": [1500,2100,2900,3800,4700,5700,6800,8000,9200,10500,11800,13000,14000]
      };

      const performanceRangeMetrics = {
        "1W":  { profit: 860.40, trades: 18, winRate: 66.7, factor: 2.18, avgR: 1.24, label: "1 Week" },
        "1M":  { profit: 12914.75, trades: 229, winRate: 63.0, factor: 2.41, avgR: 1.32, label: "1 Month" },
        "3M":  { profit: 23780.20, trades: 418, winRate: 61.7, factor: 2.28, avgR: 1.26, label: "3 Months" },
        "6M":  { profit: 41250.60, trades: 782, winRate: 62.2, factor: 2.36, avgR: 1.29, label: "6 Months" },
        "1Y":  { profit: 68440.10, trades: 1425, winRate: 60.9, factor: 2.21, avgR: 1.18, label: "1 Year" },
        "ALL": { profit: 112840.25, trades: 2358, winRate: 59.8, factor: 2.08, avgR: 1.12, label: "All Time" }
      };

      const performanceHeatRows = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const performanceHeatValues = [
        [-2, 2, 1, 2, 0, 1, 3, 3],
        [-3,-1, 1, 2, 3, 1, 1, 1],
        [ 0, 0, 2, 1, 3, 2, 2, 1],
        [ 0, 0, 2, 0, 0, 2, 2, 1],
        [-2,-2,-1, 2,-2, 2, 3, 3],
        [-2,-3,-3,-1, 0, 3, 3, 3],
        [-1, 0, 0, 0, 0, 0, 1, 1]
      ];

      const performanceHeatColors = {
        "-3": "#f24c57",
        "-2": "#f36a5d",
        "-1": "#ef9d65",
        "0": "#f3e9a3",
        "1": "#b9dca0",
        "2": "#6fc27e",
        "3": "#2ea85b"
      };

      function renderPerformanceHeatmap() {
        const grid = $("#performanceHeatmapGrid");
        if (!grid) return;

        grid.innerHTML = "";
        grid.insertAdjacentHTML("beforeend", '<div class="performance-heat-label"></div>');

        for (let week = 1; week <= 8; week += 1) {
          grid.insertAdjacentHTML("beforeend", `<div class="performance-heat-label">W${week}</div>`);
        }

        performanceHeatRows.forEach((day, rowIndex) => {
          grid.insertAdjacentHTML("beforeend", `<div class="performance-heat-label">${day}</div>`);

          performanceHeatValues[rowIndex].forEach((value, columnIndex) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "performance-heat-cell";
            cell.style.background = performanceHeatColors[value];

            cell.addEventListener("click", () => {
              const status = value > 0
                ? "Winning day"
                : value < 0
                  ? "Losing day"
                  : "Breakeven day";

              toast(`${day} · Week ${columnIndex + 1}`, status);
            });

            grid.appendChild(cell);
          });
        });
      }

      function performanceCanvasSize(canvas) {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));

        const context = canvas.getContext("2d");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        return {
          context,
          width: rect.width,
          height: rect.height
        };
      }

      function performanceCssVariable(name) {
        return getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim();
      }

      function drawPerformanceChart() {
        const canvas = $("#performanceEquityChart");
        if (!canvas) return;

        const { context, width, height } = performanceCanvasSize(canvas);
        const values = performanceRangeData[performanceState.range];
        const minimumValue = Math.min(...values);
        const maximumValue = Math.max(...values);
        const padding = { left: 48, right: 12, top: 14, bottom: 28 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        context.clearRect(0, 0, width, height);
        context.font = "9px Inter, sans-serif";

        const gridColor = performanceCssVariable("--line");
        const mutedColor = performanceCssVariable("--muted");
        const greenColor = performanceCssVariable("--green");
        const ticks = [6000, 8000, 10000, 12000, 14000];

        ticks.forEach((tick) => {
          const y = padding.top + chartHeight - ((tick - 6000) / 8000) * chartHeight;

          context.beginPath();
          context.moveTo(padding.left, y);
          context.lineTo(width - padding.right, y);
          context.strokeStyle = gridColor;
          context.lineWidth = 1;
          context.stroke();

          context.fillStyle = mutedColor;
          context.textAlign = "right";
          context.fillText(`$${tick / 1000}K`, padding.left - 8, y + 3);
        });

        const points = values.map((value, index) => {
          const x = padding.left + (index / (values.length - 1)) * chartWidth;
          const normalizedValue = (value - minimumValue) / Math.max(1, maximumValue - minimumValue);
          const y = padding.top + chartHeight - normalizedValue * chartHeight;
          return [x, y];
        });

        const gradient = context.createLinearGradient(
          0,
          padding.top,
          0,
          padding.top + chartHeight
        );

        gradient.addColorStop(0, "rgba(40,168,95,.22)");
        gradient.addColorStop(1, "rgba(40,168,95,0)");

        context.beginPath();

        points.forEach(([x, y], index) => {
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });

        context.strokeStyle = greenColor;
        context.lineWidth = 2.1;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.stroke();

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        context.lineTo(lastPoint[0], padding.top + chartHeight);
        context.lineTo(firstPoint[0], padding.top + chartHeight);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();

        const labels = ["May 1", "May 15", "Jun 1", "Jun 15", "Jul 1"];

        labels.forEach((label, index) => {
          const x = padding.left + (index / (labels.length - 1)) * chartWidth;
          context.fillStyle = mutedColor;
          context.textAlign = index === 0
            ? "left"
            : index === labels.length - 1
              ? "right"
              : "center";
          context.fillText(label, x, height - 8);
        });
      }

      function updatePerformanceDonut() {
        const total = Math.max(
          1,
          performanceState.wins +
          performanceState.losses +
          performanceState.breakeven
        );

        const winPercentage = performanceState.wins / total * 100;
        const lossPercentage = performanceState.losses / total * 100;
        const winEnd = winPercentage;
        const lossEnd = winPercentage + lossPercentage;

        $("#performanceDonut").style.background = `
          conic-gradient(
            var(--green) 0 ${winEnd}%,
            var(--red) ${winEnd}% ${lossEnd}%,
            var(--yellow) ${lossEnd}% 100%
          )
        `;

        $("#performanceWins").textContent =
          `Win ${performanceState.wins} (${winPercentage.toFixed(1)}%)`;

        $("#performanceLosses").textContent =
          `Loss ${performanceState.losses} (${lossPercentage.toFixed(1)}%)`;

        $("#performanceBreakeven").textContent =
          `Breakeven ${performanceState.breakeven} (${(
            performanceState.breakeven / total * 100
          ).toFixed(1)}%)`;

        $("#performanceTradeCaption").textContent = `${total} trades`;
      }

      function setPerformanceRange(range, showMessage = true) {
        performanceState.range = range;
        const metrics = performanceRangeMetrics[range];

        $$("#performanceRangeTabs button").forEach((button) => {
          button.classList.toggle(
            "active",
            button.dataset.performanceRange === range
          );
        });

        $("#performanceNetProfit").textContent =
          `$${metrics.profit.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;

        $("#performanceTotalTrades").textContent = String(metrics.trades);
        $("#performanceWinRate").textContent = `${metrics.winRate.toFixed(1)}%`;
        $("#performanceProfitFactor").textContent = metrics.factor.toFixed(2);
        $("#performanceAverageR").textContent = `${metrics.avgR.toFixed(2)}R`;
        $("#performanceRangeLabel").textContent = metrics.label;

        drawPerformanceChart();

        if (showMessage) {
          toast("Performance range updated", `${metrics.label} selected.`);
        }
      }

      function updatePerformanceFromTrade(trade) {
        performanceState.totalTrades += 1;
        performanceState.netProfit += trade.pnl;
        performanceState.averageR =
          (
            performanceState.averageR * (performanceState.totalTrades - 1) +
            trade.r
          ) / performanceState.totalTrades;

        if (trade.pnl > 0) performanceState.wins += 1;
        else if (trade.pnl < 0) performanceState.losses += 1;
        else performanceState.breakeven += 1;

        $("#performanceTotalTrades").textContent =
          String(performanceState.totalTrades);

        $("#performanceNetProfit").textContent =
          `$${performanceState.netProfit.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`;

        const calculatedWinRate =
          performanceState.wins / performanceState.totalTrades * 100;

        $("#performanceWinRate").textContent =
          `${calculatedWinRate.toFixed(1)}%`;

        $("#performanceAverageR").textContent =
          `${performanceState.averageR.toFixed(2)}R`;

        updatePerformanceDonut();
      }

      function setupPerformanceDashboard() {
        $$("#performanceRangeTabs button").forEach((button) => {
          button.addEventListener("click", () => {
            setPerformanceRange(button.dataset.performanceRange);
          });
        });

        $("#performanceNextRangeBtn").addEventListener("click", () => {
          const order = ["1W", "1M", "3M", "6M", "1Y", "ALL"];
          const nextIndex =
            (order.indexOf(performanceState.range) + 1) % order.length;
          setPerformanceRange(order[nextIndex]);
        });

        $$("[data-performance-metric]").forEach((card) => {
          card.addEventListener("click", () => {
            toast(
              card.dataset.performanceMetric,
              `Current range: ${performanceRangeMetrics[performanceState.range].label}`
            );
          });
        });

        $$("[data-performance-detail]").forEach((button) => {
          button.addEventListener("click", () => {
            toast(
              button.dataset.performanceDetail,
              "Performance breakdown selected."
            );
          });
        });

        renderPerformanceHeatmap();
        updatePerformanceDonut();
        setPerformanceRange("1M", false);

        let performanceResizeTimer = 0;

        window.addEventListener("resize", () => {
          clearTimeout(performanceResizeTimer);
          performanceResizeTimer = window.setTimeout(
            drawPerformanceChart,
            120
          );
        });
      }


      function setupKeyboardControls() {
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;

          document.body.classList.remove("sidebar-open");

          $$(".modal-backdrop:not([hidden])").forEach((modal) => {
            closeModal(modal.id);
          });

          $("#accountPopover").hidden = true;
          $("#profilePopover").hidden = true;
        });
      }

      function init() {
        setupFramework();
        setupCalendar();
        setupPerformanceDashboard();
        setupKeyboardControls();
        renderAllCalendar();
      }

      document.addEventListener("DOMContentLoaded", init);
    })();
