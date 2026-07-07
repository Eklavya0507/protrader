/*
  ProTrade Calendar + Performance Dashboard
  Backend-integrated with the existing protected ProTrade APIs.
*/

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const API_BASE =
    window.ProTradeAuth?.API_BASE ||
    "https://protrader-backend-n8oj.onrender.com/api";

  const ENDPOINTS = {
    trades: `${API_BASE}/trades`,
    settings: `${API_BASE}/settings`,
    alertSummary: `${API_BASE}/security/alerts/summary`,
  };

  const RANGE_LABELS = {
    "1W": "1 Week",
    "1M": "1 Month",
    "3M": "3 Months",
    "6M": "6 Months",
    "1Y": "1 Year",
    ALL: "All Time",
    CUSTOM: "Custom Range",
  };

  const state = {
    theme: localStorage.getItem("protrade-theme") || "dark",
    currentDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    currentView: "month",
    balanceHidden: false,
    trades: [],
    settings: {},
    alertSummary: null,
    resultFilter: "all",
    performanceRange: "1M",
    customStart: null,
    customEnd: null,
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const optionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseTradeDate = (trade) => {
    const raw = trade?.tradeDate || trade?.createdAt;
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  };

  const tradeDateKey = (trade) => {
    const raw = String(trade?.tradeDate || "");
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = parseTradeDate(trade);
    return parsed ? formatDateInput(parsed) : "";
  };

  const dateKey = (date) => formatDateInput(date);

  const currencyCode = () => state.settings.currency || "USD";

  const money = (value, signed = false, compact = false) => {
    const amount = number(value);
    const absolute = Math.abs(amount);
    let formatted;

    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode(),
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : currencyCode() === "JPY" ? 0 : 2,
        maximumFractionDigits: compact ? 1 : currencyCode() === "JPY" ? 0 : 2,
      }).format(absolute);
    } catch {
      formatted = `$${absolute.toFixed(compact ? 0 : 2)}`;
    }

    if (!signed) return formatted;
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
    return formatted;
  };

  const resultOf = (trade) => {
    const result = String(trade?.result || "").toLowerCase();
    if (["win", "loss", "breakeven", "open"].includes(result)) return result;
    const pnl = number(trade?.profitLoss);
    return pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  };

  const pnlOf = (trade) => number(trade?.profitLoss);
  const rrOf = (trade) => number(trade?.rr);

  const setText = (selector, value) => {
    const node = typeof selector === "string" ? $(selector) : selector;
    if (node) node.textContent = value;
  };

  const setValueClass = (node, value) => {
    if (!node) return;
    node.classList.remove("positive", "negative");
    if (number(value) > 0) node.classList.add("positive");
    if (number(value) < 0) node.classList.add("negative");
  };

  const setStatus = (message, status = "loading") => {
    const node = $("#calendarStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = status;
  };

  const toast = (title, message = "") => {
    const stack = $("#toastStack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    stack.appendChild(node);
    window.setTimeout(() => node.remove(), 3400);
  };

  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    if (!$$('.modal-backdrop:not([hidden])').length) {
      document.body.style.overflow = "";
    }
  };

  const apiJson = async (url, options = {}) => {
    const headers = new Headers(options.headers || undefined);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await window.fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    }

    return body;
  };

  const calculateStats = (trades) => {
    const list = Array.isArray(trades) ? trades : [];
    const wins = list.filter((trade) => resultOf(trade) === "win").length;
    const losses = list.filter((trade) => resultOf(trade) === "loss").length;
    const breakeven = list.filter((trade) => resultOf(trade) === "breakeven").length;
    const open = list.filter((trade) => resultOf(trade) === "open").length;
    const closed = wins + losses + breakeven;
    const net = list.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const grossProfit = list.reduce(
      (sum, trade) => sum + Math.max(pnlOf(trade), 0),
      0
    );
    const grossLoss = Math.abs(
      list.reduce((sum, trade) => sum + Math.min(pnlOf(trade), 0), 0)
    );
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = closed ? (wins / closed) * 100 : 0;
    const averageR = list.length
      ? list.reduce((sum, trade) => sum + rrOf(trade), 0) / list.length
      : 0;

    return {
      total: list.length,
      wins,
      losses,
      breakeven,
      open,
      closed,
      net,
      grossProfit,
      grossLoss,
      profitFactor,
      winRate,
      averageR,
    };
  };

  const calendarTrades = () =>
    state.resultFilter === "all"
      ? state.trades
      : state.trades.filter((trade) => resultOf(trade) === state.resultFilter);

  const tradesForDate = (key) =>
    calendarTrades().filter((trade) => tradeDateKey(trade) === key);

  const getMonthTrades = (year, month) => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    return calendarTrades().filter((trade) => tradeDateKey(trade).startsWith(prefix));
  };

  const getYearTrades = (year) => {
    const prefix = `${year}-`;
    return calendarTrades().filter((trade) => tradeDateKey(trade).startsWith(prefix));
  };

  const getVisiblePeriodTrades = () => {
    const year = state.currentDate.getFullYear();
    if (state.currentView === "month") {
      return getMonthTrades(year, state.currentDate.getMonth());
    }
    return getYearTrades(year);
  };

  const syncThemeControls = (theme) => {
    const isDark = theme === "dark";
    setText("#themeLabel", isDark ? "Dark Mode" : "Light Mode");
    setText("#headerThemeLabel", isDark ? "Dark" : "Light");

    $$('[data-theme-toggle]').forEach((button) => {
      button.setAttribute("aria-checked", String(isDark));
      button.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
      );
      button.title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    });
  };

  const runThemeAnimation = () => {
    const root = document.documentElement;
    const flash = $("#themeTransitionFlash");
    root.classList.remove("theme-changing");
    void root.offsetWidth;
    root.classList.add("theme-changing");
    flash?.classList.remove("animate");
    void flash?.offsetWidth;
    flash?.classList.add("animate");

    window.setTimeout(() => {
      root.classList.remove("theme-changing");
      flash?.classList.remove("animate");
    }, 680);
  };

  const applyTheme = (theme, animate = false, saveRemote = false) => {
    const choice = String(theme || "Dark").toLowerCase();
    const resolved = choice === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : choice === "light" ? "light" : "dark";
    state.theme = choice;
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem("protrade-theme", choice);
    syncThemeControls(resolved);

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#06111f" : "#f5f9fc");

    if (animate) animateThemeTransition();

    if (saveRemote) {
      const remoteTheme = choice === "system" ? "System" : resolved === "dark" ? "Dark" : "Light";
      apiJson(ENDPOINTS.settings, {
        method: "PUT",
        body: JSON.stringify({ theme: remoteTheme }),
      }).catch((error) => toast("Theme not synced", error.message));
    }
  };

  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true, true);
    toast("Theme changed", `${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
  };

  const updateProfile = () => {
    const user = window.ProTradeAuth?.getUser?.() || {};
    const name = state.settings.fullName || user.name || "Trader";
    const role = state.settings.tradingRole || "Independent Trader";
    const initials =
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "T";

    $$(".auth-user-name").forEach((node) => {
      node.textContent = name;
    });
    $$(".auth-user-initials").forEach((node) => {
      node.textContent = initials;
    });
    setText("#profileRole", role);
  };

  const updateBalance = () => {
    const net = state.trades.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const balance = number(state.settings.startingBalance) + net;
    const value = state.balanceHidden ? "••••••••" : money(balance);
    setText("#balanceValue", value);
    setText("#equityValue", value);
  };

  const updateNotifications = () => {
    const unread = number(state.alertSummary?.unread);
    const badge = $("#notificationBadge");
    if (!badge) return;
    badge.textContent = String(unread);
    badge.hidden = unread < 1;
  };

  const updateSummary = () => {
    const trades = getVisiblePeriodTrades();
    const wins = trades.filter((trade) => resultOf(trade) === "win");
    const losses = trades.filter((trade) => resultOf(trade) === "loss");
    const winAmount = wins.reduce((sum, trade) => sum + pnlOf(trade), 0);
    const lossAmount = losses.reduce((sum, trade) => sum + pnlOf(trade), 0);

    setText("#winChip", `${wins.length} (${money(winAmount)})`);
    setText("#lossChip", `${losses.length} (${money(lossAmount)})`);
    setText("#tradeChip", String(trades.length));
  };

  const renderWeeks = () => {
    const container = $("#weekCards");
    if (!container) return;
    container.innerHTML = "";

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const mondayOffset = (first.getDay() + 6) % 7;
    const totalWeeks = Math.ceil((mondayOffset + last.getDate()) / 7);
    const base = Math.max(1, number(state.settings.startingBalance, 1));

    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
      const weekStartDay = 1 - mondayOffset + weekIndex * 7;
      let total = 0;
      let tradeCount = 0;
      let activeDays = 0;

      for (let offset = 0; offset < 7; offset += 1) {
        const day = weekStartDay + offset;
        if (day < 1 || day > last.getDate()) continue;
        const trades = tradesForDate(dateKey(new Date(year, month, day)));
        if (trades.length) activeDays += 1;
        tradeCount += trades.length;
        total += trades.reduce((sum, trade) => sum + pnlOf(trade), 0);
      }

      const card = document.createElement("button");
      card.type = "button";
      card.className = "week-card";
      card.innerHTML = `
        <div class="week-card-head"><strong>Week ${weekIndex + 1}</strong><span>${tradeCount} trades</span></div>
        <div class="week-card-value"><strong class="${total > 0 ? "positive" : total < 0 ? "negative" : ""}">${money(total, true)}</strong><small>${((total / base) * 100).toFixed(2)}%</small></div>
        <small>${activeDays} active days</small>
      `;

      card.addEventListener("click", () => {
        $$(".week-card").forEach((item) => item.classList.remove("active"));
        card.classList.add("active");
        toast(`Week ${weekIndex + 1}`, `${tradeCount} trades, ${money(total, true)} net P&L.`);
      });

      container.appendChild(card);
    }
  };

  const renderMonth = () => {
    const grid = $("#calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const mondayIndex = (first.getDay() + 6) % 7;
    const previousLast = new Date(year, month, 0).getDate();
    const todayKey = dateKey(new Date());

    for (let index = 0; index < 42; index += 1) {
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
      const trades = tradesForDate(key);
      const pnl = trades.reduce((sum, trade) => sum + pnlOf(trade), 0);
      const totalR = trades.reduce((sum, trade) => sum + rrOf(trade), 0);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-cell";
      if (outside) button.classList.add("outside");
      if (key === todayKey) button.classList.add("today");

      button.innerHTML = `
        <span class="day-top"><span class="date-number">${day}</span><span class="trade-count">${trades.length} trades</span></span>
        <span class="day-pnl ${pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}">${money(pnl, true)}</span>
        <span class="day-r">${totalR >= 0 ? "+" : ""}${totalR.toFixed(1)}R &nbsp; ${money(pnl, true)}</span>
      `;

      button.addEventListener("click", () => {
        $$(".day-cell").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        showDayDetail(cellDate, trades);
      });

      grid.appendChild(button);
    }
  };

  const compactMonthMarkup = (year, month, selected = false) => {
    const first = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const dayCells = [];
    const monthName = new Intl.DateTimeFormat("en-US", { month: "short" }).format(first);
    const todayKey = dateKey(new Date());

    for (let index = 0; index < offset; index += 1) {
      dayCells.push('<button class="compact-day blank" type="button" tabindex="-1"></button>');
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const key = dateKey(new Date(year, month, day));
      const trades = tradesForDate(key);
      const pnl = trades.reduce((sum, trade) => sum + pnlOf(trade), 0);
      let performanceClass = "";
      if (pnl >= 120) performanceClass = "strong-profit";
      else if (pnl > 0) performanceClass = "profit";
      else if (pnl <= -60) performanceClass = "strong-loss";
      else if (pnl < 0) performanceClass = "loss";

      dayCells.push(`
        <button class="compact-day ${performanceClass} ${key === todayKey ? "today" : ""}" type="button" data-compact-date="${key}" title="${trades.length ? `${trades.length} trade(s), ${money(pnl, true)}` : "No trades"}">${day}</button>
      `);
    }

    return `
      <section class="compact-month ${selected ? "selected-month" : ""}">
        <button class="compact-month-title" type="button" data-open-month="${month}" data-open-year="${year}">${monthName}</button>
        <div class="compact-weekdays"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        <div class="compact-days">${dayCells.join("")}</div>
      </section>
    `;
  };

  const bindCompactCalendar = (root) => {
    $$('[data-compact-date]', root).forEach((button) => {
      button.addEventListener("click", () => {
        const date = new Date(`${button.dataset.compactDate}T00:00:00`);
        showDayDetail(date, tradesForDate(button.dataset.compactDate));
      });
    });

    $$('[data-open-month]', root).forEach((button) => {
      button.addEventListener("click", () => {
        state.currentDate = new Date(
          number(button.dataset.openYear),
          number(button.dataset.openMonth),
          1
        );
        switchView("month");
      });
    });
  };

  const ordinalQuarter = (quarter) => ["1st", "2nd", "3rd", "4th"][quarter - 1];

  const renderQuarter = () => {
    const view = $("#quarterView");
    if (!view) return;
    const year = state.currentDate.getFullYear();

    const quarterCards = Array.from({ length: 4 }, (_, quarterIndex) => {
      const quarter = quarterIndex + 1;
      const startMonth = quarterIndex * 3;
      const quarterTrades = [0, 1, 2].flatMap((offset) =>
        getMonthTrades(year, startMonth + offset)
      );
      const quarterPnl = quarterTrades.reduce((sum, trade) => sum + pnlOf(trade), 0);

      return `
        <article class="quarter-card">
          <div class="quarter-card-head"><h4>${ordinalQuarter(quarter)} - Quarter</h4><span class="${quarterPnl > 0 ? "positive" : quarterPnl < 0 ? "negative" : ""}">${quarterTrades.length} trades · ${money(quarterPnl, true)}</span></div>
          <div class="quarter-months">${[0, 1, 2]
            .map((offset) => compactMonthMarkup(year, startMonth + offset))
            .join("")}</div>
        </article>
      `;
    }).join("");

    view.innerHTML = `<div class="quarter-board">${quarterCards}</div>`;
    bindCompactCalendar(view);
  };

  const renderYear = () => {
    const view = $("#yearView");
    if (!view) return;
    const year = state.currentDate.getFullYear();
    view.innerHTML = `<div class="year-board"><div class="year-months">${Array.from(
      { length: 12 },
      (_, month) => compactMonthMarkup(year, month, month === state.currentDate.getMonth())
    ).join("")}</div></div>`;
    bindCompactCalendar(view);
  };

  const updatePeriodTitle = () => {
    const year = state.currentDate.getFullYear();
    if (state.currentView === "month") {
      setText(
        "#periodTitle",
        new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
          state.currentDate
        )
      );
    } else {
      setText("#periodTitle", String(year));
    }
  };

  const renderAllCalendar = () => {
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
  };

  const switchView = (view, showMessage = true) => {
    state.currentView = view;
    $$("#viewSwitch button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    $("#monthView").classList.toggle("month-hidden", view !== "month");
    $("#quarterView").classList.toggle("active", view === "quarter");
    $("#yearView").classList.toggle("active", view === "year");
    renderAllCalendar();

    if (showMessage) {
      toast("Calendar view changed", `${view[0].toUpperCase() + view.slice(1)} view selected.`);
    }
  };

  const changePeriod = (step) => {
    if (state.currentView === "month") {
      state.currentDate = new Date(
        state.currentDate.getFullYear(),
        state.currentDate.getMonth() + step,
        1
      );
    } else {
      state.currentDate = new Date(
        state.currentDate.getFullYear() + step,
        state.currentDate.getMonth(),
        1
      );
    }
    renderAllCalendar();
  };

  const showDayDetail = (date, trades) => {
    const formatted = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);

    setText("#dayModalTitle", formatted);
    setText(
      "#dayModalSubtitle",
      trades.length
        ? `${trades.length} trade${trades.length === 1 ? "" : "s"} recorded in MongoDB.`
        : "No trades recorded."
    );

    const list = $("#dayDetailList");
    if (!trades.length) {
      list.innerHTML = '<div class="day-detail-row"><span>No trade data</span><strong>—</strong></div>';
    } else {
      list.innerHTML = trades
        .map((trade) => {
          const pnl = pnlOf(trade);
          const result = resultOf(trade);
          return `
            <div class="day-detail-row">
              <span><b>${escapeHtml(trade.symbol || "—")}</b><small class="day-detail-meta">${escapeHtml(trade.direction || "—")} · ${escapeHtml(trade.session || "Other")} · ${escapeHtml(result[0].toUpperCase() + result.slice(1))}</small></span>
              <strong class="${pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}">${money(pnl, true)} · ${rrOf(trade) >= 0 ? "+" : ""}${rrOf(trade).toFixed(2)}R</strong>
            </div>
          `;
        })
        .join("");
    }

    openModal("dayModal");
  };

  const rangeWindow = () => {
    if (state.performanceRange === "CUSTOM" && state.customStart && state.customEnd) {
      return { start: state.customStart, end: state.customEnd };
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start;

    if (state.performanceRange === "1W") {
      start = new Date(end);
      start.setDate(start.getDate() - 6);
    } else if (state.performanceRange === "1M") {
      start = new Date(end);
      start.setDate(start.getDate() - 29);
    } else if (state.performanceRange === "3M") {
      start = new Date(end);
      start.setMonth(start.getMonth() - 3);
    } else if (state.performanceRange === "6M") {
      start = new Date(end);
      start.setMonth(start.getMonth() - 6);
    } else if (state.performanceRange === "1Y") {
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
    } else {
      const dates = state.trades.map(parseTradeDate).filter(Boolean);
      start = dates.length
        ? new Date(Math.min(...dates.map((date) => date.getTime())))
        : new Date(end);
    }

    start.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const performanceTrades = () => {
    const { start, end } = rangeWindow();
    return state.trades.filter((trade) => {
      const date = parseTradeDate(trade);
      return date && date >= start && date <= end;
    });
  };

  const formatRangeText = (start, end) => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  };

  const performanceCanvasSize = (canvas) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: rect.width, height: rect.height };
  };

  const cssVariable = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const equitySeries = () => {
    const { start, end } = rangeWindow();
    const orderedAll = [...state.trades]
      .filter((trade) => parseTradeDate(trade))
      .sort((a, b) => parseTradeDate(a) - parseTradeDate(b));

    let balance = number(state.settings.startingBalance);
    orderedAll.forEach((trade) => {
      const date = parseTradeDate(trade);
      if (date < start) balance += pnlOf(trade);
    });

    const series = [{ date: new Date(start), value: balance }];
    orderedAll.forEach((trade) => {
      const date = parseTradeDate(trade);
      if (date >= start && date <= end) {
        balance += pnlOf(trade);
        series.push({ date, value: balance });
      }
    });

    if (series.length === 1) series.push({ date: new Date(end), value: balance });
    return series;
  };

  const drawPerformanceChart = () => {
    const canvas = $("#performanceEquityChart");
    if (!canvas || canvas.clientWidth < 2 || canvas.clientHeight < 2) return;

    const { context, width, height } = performanceCanvasSize(canvas);
    const series = equitySeries();
    const values = series.map((point) => point.value);
    let minimumValue = Math.min(...values);
    let maximumValue = Math.max(...values);
    if (minimumValue === maximumValue) {
      const paddingValue = Math.max(1, Math.abs(minimumValue) * 0.02);
      minimumValue -= paddingValue;
      maximumValue += paddingValue;
    }

    const padding = { left: 58, right: 14, top: 14, bottom: 28 };
    const chartWidth = Math.max(1, width - padding.left - padding.right);
    const chartHeight = Math.max(1, height - padding.top - padding.bottom);
    const valueRange = maximumValue - minimumValue;
    const startTime = series[0].date.getTime();
    const endTime = series[series.length - 1].date.getTime();
    const timeRange = Math.max(1, endTime - startTime);

    context.clearRect(0, 0, width, height);
    context.font = "9px Inter, sans-serif";

    const gridColor = cssVariable("--line");
    const mutedColor = cssVariable("--muted");
    const greenColor = cssVariable("--green");

    for (let tickIndex = 0; tickIndex < 5; tickIndex += 1) {
      const ratio = tickIndex / 4;
      const tick = maximumValue - ratio * valueRange;
      const y = padding.top + ratio * chartHeight;
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.strokeStyle = gridColor;
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = mutedColor;
      context.textAlign = "right";
      context.fillText(money(tick, false, true), padding.left - 8, y + 3);
    }

    const points = series.map((point) => {
      const x = padding.left + ((point.date.getTime() - startTime) / timeRange) * chartWidth;
      const y = padding.top + chartHeight - ((point.value - minimumValue) / valueRange) * chartHeight;
      return [x, y];
    });

    const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
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

    const labelFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    for (let index = 0; index < 5; index += 1) {
      const ratio = index / 4;
      const date = new Date(startTime + ratio * timeRange);
      const x = padding.left + ratio * chartWidth;
      context.fillStyle = mutedColor;
      context.textAlign = index === 0 ? "left" : index === 4 ? "right" : "center";
      context.fillText(labelFormatter.format(date), x, height - 8);
    }
  };

  const heatColor = (pnl, hasTrades, maxAbs) => {
    if (!hasTrades) return cssVariable("--line");
    if (pnl === 0) return "#f3e9a3";
    const strength = Math.min(3, Math.max(1, Math.ceil((Math.abs(pnl) / Math.max(1, maxAbs)) * 3)));
    const positive = ["#b9dca0", "#6fc27e", "#2ea85b"];
    const negative = ["#ef9d65", "#f36a5d", "#f24c57"];
    return pnl > 0 ? positive[strength - 1] : negative[strength - 1];
  };

  const renderPerformanceHeatmap = () => {
    const grid = $("#performanceHeatmapGrid");
    if (!grid) return;
    grid.innerHTML = "";
    grid.insertAdjacentHTML("beforeend", '<div class="performance-heat-label"></div>');

    for (let week = 1; week <= 8; week += 1) {
      grid.insertAdjacentHTML("beforeend", `<div class="performance-heat-label">W${week}</div>`);
    }

    const { end } = rangeWindow();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const endSunday = new Date(endDay);
    endSunday.setDate(endSunday.getDate() + ((7 - endSunday.getDay()) % 7));
    const startMonday = new Date(endSunday);
    startMonday.setDate(startMonday.getDate() - 55);

    const daily = new Map();
    for (let week = 0; week < 8; week += 1) {
      for (let row = 0; row < 7; row += 1) {
        const date = new Date(startMonday);
        date.setDate(startMonday.getDate() + week * 7 + row);
        const key = dateKey(date);
        const trades = state.trades.filter((trade) => tradeDateKey(trade) === key);
        daily.set(key, {
          date,
          trades,
          pnl: trades.reduce((sum, trade) => sum + pnlOf(trade), 0),
        });
      }
    }

    const maxAbs = Math.max(1, ...[...daily.values()].map((item) => Math.abs(item.pnl)));
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    dayLabels.forEach((label, rowIndex) => {
      grid.insertAdjacentHTML("beforeend", `<div class="performance-heat-label">${label}</div>`);
      for (let week = 0; week < 8; week += 1) {
        const date = new Date(startMonday);
        date.setDate(startMonday.getDate() + week * 7 + rowIndex);
        const item = daily.get(dateKey(date));
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "performance-heat-cell";
        cell.style.background = heatColor(item.pnl, item.trades.length > 0, maxAbs);
        cell.title = `${date.toLocaleDateString("en-GB")} · ${item.trades.length} trades · ${money(item.pnl, true)}`;
        cell.addEventListener("click", () => {
          toast(
            date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
            `${item.trades.length} trades · ${money(item.pnl, true)} net P&L`
          );
        });
        grid.appendChild(cell);
      }
    });
  };

  const updatePerformanceDonut = (stats) => {
    const total = Math.max(1, stats.closed);
    const winPercentage = stats.closed ? (stats.wins / stats.closed) * 100 : 0;
    const lossPercentage = stats.closed ? (stats.losses / stats.closed) * 100 : 0;
    const breakevenPercentage = stats.closed ? (stats.breakeven / stats.closed) * 100 : 0;
    const winEnd = winPercentage;
    const lossEnd = winPercentage + lossPercentage;

    $("#performanceDonut").style.background = `conic-gradient(var(--green) 0 ${winEnd}%, var(--red) ${winEnd}% ${lossEnd}%, var(--yellow) ${lossEnd}% 100%)`;
    setText("#performanceWins", `Win ${stats.wins} (${winPercentage.toFixed(1)}%)`);
    setText("#performanceLosses", `Loss ${stats.losses} (${lossPercentage.toFixed(1)}%)`);
    setText(
      "#performanceBreakeven",
      `Breakeven ${stats.breakeven} (${breakevenPercentage.toFixed(1)}%)`
    );
    setText("#performanceTradeCaption", `${stats.total} trades`);
  };

  const renderRankings = (trades) => {
    const render = (containerSelector, keyFn, emptyLabel) => {
      const container = $(containerSelector);
      if (!container) return;
      const groups = new Map();

      trades.forEach((trade) => {
        const key = String(keyFn(trade) || emptyLabel).trim() || emptyLabel;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(trade);
      });

      const rows = [...groups.entries()]
        .map(([name, items]) => ({
          name,
          trades: items.length,
          net: items.reduce((sum, trade) => sum + pnlOf(trade), 0),
        }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 3);

      if (!rows.length) {
        container.innerHTML = '<p class="empty-ranking">No data in this range.</p>';
        return;
      }

      container.innerHTML = rows
        .map(
          (row) => `
            <button type="button" data-ranking-name="${escapeHtml(row.name)}">
              <span>${escapeHtml(row.name)} <small>· ${row.trades}</small></span>
              <strong class="${row.net > 0 ? "positive" : row.net < 0 ? "negative" : ""}">${money(row.net, true)}</strong>
            </button>
          `
        )
        .join("");

      $$('[data-ranking-name]', container).forEach((button) => {
        button.addEventListener("click", () => {
          toast(button.dataset.rankingName, "Calculated from your selected performance range.");
        });
      });
    };

    render("#topStrategies", (trade) => trade.model, "Unspecified Strategy");
    render("#topSymbols", (trade) => trade.symbol, "Unknown Symbol");
  };

  const updateFooter = (stats) => {
    const denominator = Math.max(1, stats.closed);
    setText("#footerTotalTrades", String(stats.total));
    setText("#footerWins", `${stats.wins} (${((stats.wins / denominator) * 100).toFixed(1)}%)`);
    setText("#footerLosses", `${stats.losses} (${((stats.losses / denominator) * 100).toFixed(1)}%)`);
    setText(
      "#footerBreakeven",
      `${stats.breakeven} (${((stats.breakeven / denominator) * 100).toFixed(1)}%)`
    );
  };

  const renderPerformance = () => {
    const trades = performanceTrades();
    const stats = calculateStats(trades);
    const { start, end } = rangeWindow();

    setText("#performanceNetProfit", money(stats.net, true));
    setValueClass($("#performanceNetProfit"), stats.net);
    setText("#performanceTotalTrades", String(stats.total));
    setText("#performanceWinRate", `${stats.winRate.toFixed(1)}%`);
    setValueClass($("#performanceWinRate"), stats.winRate);
    setText(
      "#performanceProfitFactor",
      Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"
    );
    setValueClass($("#performanceProfitFactor"), stats.profitFactor);
    setText("#performanceAverageR", `${stats.averageR.toFixed(2)}R`);
    setValueClass($("#performanceAverageR"), stats.averageR);
    setText("#performanceRangeLabel", RANGE_LABELS[state.performanceRange] || "Custom Range");
    setText("#dateRangeText", formatRangeText(start, end));

    updatePerformanceDonut(stats);
    renderPerformanceHeatmap();
    renderRankings(trades);
    updateFooter(stats);
    window.requestAnimationFrame(drawPerformanceChart);
  };

  const setPerformanceRange = (range, showMessage = true) => {
    state.performanceRange = range;
    if (range !== "CUSTOM") {
      state.customStart = null;
      state.customEnd = null;
    }

    $$("#performanceRangeTabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.performanceRange === range);
    });

    renderPerformance();
    if (showMessage) {
      toast("Performance range updated", `${RANGE_LABELS[range]} selected.`);
    }
  };

  const tradePayloadFromForm = (form) => {
    const data = new FormData(form);
    const payload = {
      tradeDate: String(data.get("tradeDate") || ""),
      symbol: String(data.get("symbol") || "").trim().toUpperCase(),
      direction: String(data.get("direction") || "Long"),
      session: String(data.get("session") || "Other"),
      result: String(data.get("result") || "Open"),
      entryPrice: optionalNumber(data.get("entryPrice")),
      exitPrice: optionalNumber(data.get("exitPrice")),
      stopLoss: optionalNumber(data.get("stopLoss")),
      takeProfit: optionalNumber(data.get("takeProfit")),
      quantity: optionalNumber(data.get("quantity")) ?? 1,
      commission: optionalNumber(data.get("commission")) ?? 0,
      profitLoss: optionalNumber(data.get("profitLoss")) ?? 0,
      rr: optionalNumber(data.get("rr")) ?? 0,
      model: String(data.get("model") || "").trim(),
      protocol: String(data.get("protocol") || "").trim(),
      entryTime: String(data.get("entryTime") || ""),
      exitTime: String(data.get("exitTime") || ""),
      notes: String(data.get("notes") || "").trim(),
      screenshotUrl: String(data.get("screenshotUrl") || "").trim(),
    };

    const rating = optionalNumber(data.get("rating"));
    if (rating !== undefined) payload.rating = rating;

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === "") delete payload[key];
    });

    return payload;
  };

  const normalizeSession = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (["asian", "asia", "tokyo"].includes(normalized)) return "Asian";
    if (normalized === "london") return "London";
    if (["new york", "newyork", "ny"].includes(normalized)) return "New York";
    return "Other";
  };

  const normalizeImportTrade = (raw = {}) => {
    const directionRaw = String(raw.direction || raw.side || "Long").toLowerCase();
    const direction = ["short", "sell"].includes(directionRaw) ? "Short" : "Long";
    const pnl = optionalNumber(raw.profitLoss ?? raw.pnl ?? raw["P&L"]) ?? 0;
    const resultRaw = String(raw.result || "").trim().toLowerCase();
    const result = ["win", "loss", "breakeven", "open"].includes(resultRaw)
      ? resultRaw[0].toUpperCase() + resultRaw.slice(1)
      : pnl > 0
        ? "Win"
        : pnl < 0
          ? "Loss"
          : "Breakeven";

    return {
      tradeDate: raw.tradeDate || raw.date,
      symbol: String(raw.symbol || raw.pair || "").trim().toUpperCase(),
      direction,
      session: normalizeSession(raw.session),
      model: raw.model || raw.strategy || "",
      protocol: raw.protocol || "",
      entryTime: raw.entryTime || "",
      exitTime: raw.exitTime || "",
      entryPrice: optionalNumber(raw.entryPrice ?? raw.entry),
      exitPrice: optionalNumber(raw.exitPrice ?? raw.exit),
      stopLoss: optionalNumber(raw.stopLoss),
      takeProfit: optionalNumber(raw.takeProfit),
      commission: optionalNumber(raw.commission) ?? 0,
      quantity: optionalNumber(raw.quantity ?? raw.lotSize) ?? 1,
      profitLoss: pnl,
      rr: optionalNumber(raw.rr ?? raw.rMultiple) ?? 0,
      result,
      notes: String(raw.notes || ""),
      screenshotUrl: String(raw.screenshotUrl || ""),
    };
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const values = [];
      let value = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"' && quoted) {
          value += '"';
          index += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === "," && !quoted) {
          values.push(value.trim());
          value = "";
        } else {
          value += char;
        }
      }
      values.push(value.trim());
      return values;
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
  };

  const importTrades = async (file) => {
    const text = await file.text();
    let records;

    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    } else {
      records = parseCsv(text);
    }

    const valid = records
      .slice(0, 100)
      .map(normalizeImportTrade)
      .filter((trade) => trade.tradeDate && trade.symbol && trade.entryPrice !== undefined);

    if (!valid.length) {
      throw new Error(
        "No valid rows found. Required: tradeDate/date, symbol/pair and entryPrice/entry."
      );
    }

    let success = 0;
    for (const trade of valid) {
      await apiJson(ENDPOINTS.trades, {
        method: "POST",
        body: JSON.stringify(trade),
      });
      success += 1;
      setStatus(`Importing trades… ${success}/${valid.length}`, "loading");
    }

    toast("Import complete", `${success} trades saved to MongoDB.`);
    await loadData();
  };

  const preferredTradeSession = () => {
    const preferred = String(state.settings.preferredSession || "Other");
    return preferred === "Asia" ? "Asian" : ["London", "New York", "Other"].includes(preferred) ? preferred : "Other";
  };

  const resetTradeFormDefaults = () => {
    const form = $("#tradeForm");
    if (!form) return;
    form.reset();
    $("#tradeDate").value = formatDateInput(new Date());
    $("#tradeSession").value = preferredTradeSession();
    form.elements.quantity.value = "1";
    form.elements.commission.value = "0";
    form.elements.profitLoss.value = "0";
    form.elements.rr.value = String(number(state.settings.defaultRR, 0));
  };

  const loadData = async () => {
    setStatus("Connecting securely to ProTrade…", "loading");

    try {
      await window.ProTradeAuth?.ready;

      const [tradeBody, settingsBody, alertResult] = await Promise.all([
        apiJson(ENDPOINTS.trades),
        apiJson(ENDPOINTS.settings),
        apiJson(ENDPOINTS.alertSummary).catch(() => ({ data: null })),
      ]);

      state.trades = Array.isArray(tradeBody.data) ? tradeBody.data : [];
      state.settings = settingsBody.data || {};
      state.alertSummary = alertResult.data || null;

      updateProfile();
      applyTheme(state.settings.theme || state.theme, false, false);
      updateBalance();
      updateNotifications();
      resetTradeFormDefaults();
      renderAllCalendar();
      renderPerformance();
      setStatus(`${state.trades.length} trades synced from MongoDB`, "ready");
    } catch (error) {
      console.error("Calendar load failed:", error);
      setStatus(error.message || "Calendar data could not be loaded.", "error");
      toast("Calendar not loaded", error.message || "Please try again.");
    }
  };

  const setupFramework = () => {
    applyTheme(state.theme, false, false);

    $$('[data-theme-toggle]').forEach((button) => {
      button.addEventListener("click", toggleTheme);
    });

    $$('.nav-item[data-route]').forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.route === "calendar.html") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        window.location.href = button.dataset.route;
      });
    });

    $("#mobileMenuBtn")?.addEventListener("click", () => {
      document.body.classList.add("sidebar-open");
    });

    $("#sidebarOverlay")?.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });

    $("#profileBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#profilePopover").hidden = !$("#profilePopover").hidden;
      $("#accountPopover").hidden = true;
    });

    $$('[data-profile-action]').forEach((button) => {
      button.addEventListener("click", () => {
        $("#profilePopover").hidden = true;
        if (button.dataset.profileAction === "settings") {
          window.location.href = "settings.html";
        }
        // Logout is handled centrally by auth.js through data-auth-logout.
      });
    });

    $("#balanceBtn")?.addEventListener("click", () => {
      state.balanceHidden = !state.balanceHidden;
      updateBalance();
      toast(state.balanceHidden ? "Balance hidden" : "Balance visible");
    });

    $("#importBtn")?.addEventListener("click", () => $("#importFile")?.click());
    $("#importFile")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        await importTrades(file);
      } catch (error) {
        setStatus(`${state.trades.length} trades synced from MongoDB`, "ready");
        toast("Import failed", error.message);
      }
    });

    $("#dateRangeBtn")?.addEventListener("click", () => {
      const { start, end } = rangeWindow();
      $("#startDate").value = formatDateInput(start);
      $("#endDate").value = formatDateInput(end);
      openModal("dateModal");
    });

    $("#accountBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#accountPopover").hidden = !$("#accountPopover").hidden;
      $("#profilePopover").hidden = true;
    });

    $$('[data-account]').forEach((button) => {
      button.addEventListener("click", () => {
        setText("#accountText", "All Accounts");
        $("#accountPopover").hidden = true;
        toast("All Accounts", "Separate broker accounts are not in the current backend yet.");
      });
    });

    $("#notificationBtn")?.addEventListener("click", () => {
      const unread = number(state.alertSummary?.unread);
      const latest = state.alertSummary?.latest;
      toast(
        "Security Alerts",
        latest
          ? `${unread} unread · ${latest.title}: ${latest.message}`
          : "No security alerts are currently available."
      );
    });

    $("#newTradeBtn")?.addEventListener("click", () => {
      resetTradeFormDefaults();
      openModal("tradeModal");
    });

    $$('[data-close]').forEach((button) => {
      button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    $$('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(backdrop.id);
      });
    });

    $("#openTradesPageBtn")?.addEventListener("click", () => {
      window.location.href = "trades.html";
    });

    document.addEventListener("click", () => {
      if ($("#accountPopover")) $("#accountPopover").hidden = true;
      if ($("#profilePopover")) $("#profilePopover").hidden = true;
    });
  };

  const setupCalendar = () => {
    $("#previousPeriodBtn")?.addEventListener("click", () => changePeriod(-1));
    $("#nextPeriodBtn")?.addEventListener("click", () => changePeriod(1));

    $$("#viewSwitch button").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    $("#calendarAccountFilter")?.addEventListener("change", () => {
      toast("All Accounts", "Current backend stores one combined journal per user.");
    });

    $("#calendarResultFilter")?.addEventListener("change", (event) => {
      state.resultFilter = event.target.value;
      renderAllCalendar();
      toast("Calendar filter", event.target.options[event.target.selectedIndex].text);
    });

    $("#dateForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const start = new Date(`${$("#startDate").value}T00:00:00`);
      const end = new Date(`${$("#endDate").value}T23:59:59`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        toast("Invalid range", "Start date must be before end date.");
        return;
      }

      state.customStart = start;
      state.customEnd = end;
      state.performanceRange = "CUSTOM";
      $$("#performanceRangeTabs button").forEach((button) => button.classList.remove("active"));
      closeModal("dateModal");
      renderPerformance();
      toast("Date range updated", formatRangeText(start, end));
    });

    $("#tradeForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = $("#saveTradeBtn");
      const payload = tradePayloadFromForm(form);

      if (!payload.tradeDate || !payload.symbol || payload.entryPrice === undefined) {
        toast("Missing required fields", "Trade date, symbol and entry price are required.");
        return;
      }

      submit.disabled = true;
      submit.textContent = "Saving…";

      try {
        const body = await apiJson(ENDPOINTS.trades, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        state.trades.unshift(body.data);
        state.currentDate = new Date(`${payload.tradeDate}T00:00:00`);
        closeModal("tradeModal");
        switchView("month", false);
        updateBalance();
        renderPerformance();
        setStatus(`${state.trades.length} trades synced from MongoDB`, "ready");
        toast("Trade saved", `${payload.symbol} saved to MongoDB successfully.`);
        resetTradeFormDefaults();
      } catch (error) {
        toast("Trade not saved", error.message);
      } finally {
        submit.disabled = false;
        submit.textContent = "Save to MongoDB";
      }
    });
  };

  const setupPerformance = () => {
    $$("#performanceRangeTabs button").forEach((button) => {
      button.addEventListener("click", () => {
        setPerformanceRange(button.dataset.performanceRange);
      });
    });

    $("#performanceNextRangeBtn")?.addEventListener("click", () => {
      const order = ["1W", "1M", "3M", "6M", "1Y", "ALL"];
      const currentIndex = order.indexOf(state.performanceRange);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % order.length;
      setPerformanceRange(order[nextIndex]);
    });

    $$('[data-performance-metric]').forEach((card) => {
      card.addEventListener("click", () => {
        toast(
          card.dataset.performanceMetric,
          `Current range: ${RANGE_LABELS[state.performanceRange] || "Custom Range"}`
        );
      });
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(drawPerformanceChart, 120);
    });
  };

  const setupKeyboardControls = () => {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.body.classList.remove("sidebar-open");
      $$('.modal-backdrop:not([hidden])').forEach((modal) => closeModal(modal.id));
      if ($("#accountPopover")) $("#accountPopover").hidden = true;
      if ($("#profilePopover")) $("#profilePopover").hidden = true;
    });
  };

  const init = async () => {
    setupFramework();
    setupCalendar();
    setupPerformance();
    setupKeyboardControls();
    renderAllCalendar();
    renderPerformance();
    await loadData();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
