(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = window.ProTradeAuth?.API_BASE || "https://protrader-backend-n8oj.onrender.com/api";
  const ENDPOINTS = {
    trades: `${API_BASE}/trades`,
    settings: `${API_BASE}/settings`,
    alerts: `${API_BASE}/security/alerts`,
    alertSummary: `${API_BASE}/security/alerts/summary`,
  };

  const state = {
    trades: [],
    filteredTrades: [],
    settings: {},
    alertSummary: null,
    balanceHidden: false,
    range: "1M",
    startDate: null,
    endDate: null,
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  };

  const escapeHtml = (value) => String(value ?? "")
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

  const safeArray = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

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

  const dateKey = (date) => date ? formatDateInput(date) : "";

  const currency = () => state.settings.currency || "USD";

  const money = (value, signed = false) => {
    const amount = number(value);
    let formatted;
    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency(),
        minimumFractionDigits: currency() === "JPY" ? 0 : 2,
        maximumFractionDigits: currency() === "JPY" ? 0 : 2,
      }).format(Math.abs(amount));
    } catch {
      formatted = `$${Math.abs(amount).toFixed(2)}`;
    }
    return signed ? `${amount >= 0 ? "+" : "-"}${formatted}` : formatted;
  };

  const setText = (selector, value) => {
    const node = typeof selector === "string" ? $(selector) : selector;
    if (node) node.textContent = value;
  };

  const setClassByValue = (node, value) => {
    if (!node) return;
    node.classList.remove("positive", "negative");
    if (number(value) > 0) node.classList.add("positive");
    if (number(value) < 0) node.classList.add("negative");
  };

  const setStatus = (message, stateName = "loading") => {
    const node = $("#dashboardStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = stateName;
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
    const node = document.getElementById(id);
    if (!node) return;
    node.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeModal = (id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.hidden = true;
    if (!$$('.modal-backdrop:not([hidden])').length) document.body.style.overflow = "";
  };

  const info = (title, subtitle, html) => {
    setText("#infoTitle", title);
    setText("#infoSubtitle", subtitle);
    const body = $("#infoBody");
    if (body) body.innerHTML = html;
    openModal("infoModal");
  };

  const apiJson = async (url, options = {}) => {
    const headers = new Headers(options.headers || undefined);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await window.fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    }
    return body;
  };

  const resultOf = (trade) => {
    const result = String(trade?.result || "").toLowerCase();
    if (["win", "loss", "breakeven", "open"].includes(result)) return result;
    const pnl = number(trade?.profitLoss);
    return pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  };

  const calculateStats = (trades) => {
    const list = Array.isArray(trades) ? trades : [];
    const results = list.map(resultOf);
    const wins = results.filter((x) => x === "win").length;
    const losses = results.filter((x) => x === "loss").length;
    const breakeven = results.filter((x) => x === "breakeven").length;
    const open = results.filter((x) => x === "open").length;
    const closed = wins + losses + breakeven;
    const net = list.reduce((sum, trade) => sum + number(trade.profitLoss), 0);
    const grossProfit = list.reduce((sum, trade) => sum + Math.max(number(trade.profitLoss), 0), 0);
    const grossLoss = Math.abs(list.reduce((sum, trade) => sum + Math.min(number(trade.profitLoss), 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = closed ? (wins / closed) * 100 : 0;
    const expectancy = closed ? net / closed : 0;
    const averageRR = list.length ? list.reduce((sum, trade) => sum + number(trade.rr), 0) / list.length : 0;
    const averageLot = list.length ? list.reduce((sum, trade) => sum + number(trade.quantity), 0) / list.length : 0;
    return { total: list.length, wins, losses, breakeven, open, closed, net, grossProfit, grossLoss, profitFactor, winRate, expectancy, averageRR, averageLot };
  };

  const calculateStreaks = (trades) => {
    const ordered = [...trades].sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0));
    let current = 0;
    let best = 0;
    for (const trade of ordered) {
      if (resultOf(trade) === "win") {
        current += 1;
        best = Math.max(best, current);
      } else if (resultOf(trade) !== "open") {
        current = 0;
      }
    }
    return { current, best };
  };

  const calculateDrawdown = (trades) => {
    const ordered = [...trades].sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0));
    let balance = number(state.settings.startingBalance);
    let peak = balance;
    let maxAmount = 0;
    let maxPercent = 0;
    for (const trade of ordered) {
      balance += number(trade.profitLoss);
      peak = Math.max(peak, balance);
      const amount = peak - balance;
      const percent = peak > 0 ? (amount / peak) * 100 : 0;
      maxAmount = Math.max(maxAmount, amount);
      maxPercent = Math.max(maxPercent, percent);
    }
    return { amount: maxAmount, percent: maxPercent };
  };

  const filterTrades = () => {
    state.filteredTrades = state.trades.filter((trade) => {
      const date = parseTradeDate(trade);
      if (!date) return false;
      if (state.startDate && date < state.startDate) return false;
      if (state.endDate && date > state.endDate) return false;
      return true;
    });
  };

  const pnlBetween = (start, end) => state.trades.reduce((sum, trade) => {
    const date = parseTradeDate(trade);
    return date && date >= start && date <= end ? sum + number(trade.profitLoss) : sum;
  }, 0);

  const updateProfile = () => {
    const user = window.ProTradeAuth?.getUser?.() || {};
    const name = state.settings.fullName || user.name || "Trader";
    const role = state.settings.tradingRole || "Independent Trader";
    $$(".auth-user-name").forEach((node) => { node.textContent = name; });
    const userInitials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "T";
    $$(".auth-user-initials").forEach((node) => { node.textContent = userInitials; });
    setText("#profileRole", role);
  };

  const applyTheme = (theme, saveRemote = false) => {
    const choice = String(theme || "Dark").toLowerCase();
    const resolved = choice === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : choice === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = resolved;
    setText("#themeLabel", choice === "system" ? `System · ${resolved === "dark" ? "Dark" : "Light"}` : resolved === "dark" ? "Dark Mode" : "Light Mode");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#06111f" : "#f5f9fc");
    window.localStorage.setItem("protrade-theme", choice);
    requestAnimationFrame(drawAllCharts);
    if (saveRemote) {
      const remoteTheme = choice === "system" ? "System" : resolved === "dark" ? "Dark" : "Light";
      apiJson(ENDPOINTS.settings, { method:"PUT", body:JSON.stringify({ theme: remoteTheme }) })
        .catch((error) => toast("Theme not synced", error.message));
    }
  };

  const updateBalances = () => {
    const stats = calculateStats(state.trades);
    const total = number(state.settings.startingBalance) + stats.net;
    const shown = state.balanceHidden ? "••••••••" : money(total);
    setText("#sidebarBalance", shown);
    setText("#sidebarEquity", shown);
    setText("#kpiTotalBalance", shown);
  };

  const renderKPIs = () => {
    const all = calculateStats(state.trades);
    const visible = calculateStats(state.filteredTrades);
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = pnlBetween(dayStart, now);
    const week = pnlBetween(weekStart, now);
    const month = pnlBetween(monthStart, now);
    const streaks = calculateStreaks(state.trades);
    const drawdown = calculateDrawdown(state.trades);

    updateBalances();
    const values = [
      ["#kpiTodayPnl", today],
      ["#kpiWeekPnl", week],
      ["#kpiMonthPnl", month],
    ];
    for (const [selector, value] of values) {
      setText(selector, money(value, true));
      setClassByValue($(selector), value);
    }
    setText("#kpiTodayPnlNote", `${number(state.settings.startingBalance) ? ((today / number(state.settings.startingBalance)) * 100).toFixed(2) : "0.00"}%`);
    setText("#kpiWeekPnlNote", `${number(state.settings.startingBalance) ? ((week / number(state.settings.startingBalance)) * 100).toFixed(2) : "0.00"}%`);
    setText("#kpiMonthPnlNote", `${number(state.settings.startingBalance) ? ((month / number(state.settings.startingBalance)) * 100).toFixed(2) : "0.00"}%`);
    setText("#kpiTotalBalanceNote", `${all.net >= 0 ? "↗" : "↘"} ${money(all.net, true)} journal P&L`);
    setText("#kpiWinRate", `${visible.winRate.toFixed(2)}%`);
    setText("#kpiWinRateNote", `${visible.wins}W / ${visible.losses}L`);
    setText("#kpiProfitFactor", Number.isFinite(visible.profitFactor) ? visible.profitFactor.toFixed(2) : "∞");
    setText("#kpiProfitFactorNote", visible.total ? (visible.profitFactor >= 2 ? "Strong" : visible.profitFactor >= 1 ? "Positive" : "Needs work") : "No data");
    setText("#kpiExpectancy", money(visible.expectancy));
    setText("#kpiExpectancyNote", "Per closed trade");
    setText("#kpiAvgRR", `1:${Math.abs(visible.averageRR).toFixed(2)}`);
    setText("#kpiAvgRRNote", "Average recorded R");
    setText("#kpiWinStreak", String(streaks.current));
    setText("#kpiWinStreakNote", `Best: ${streaks.best}`);
    setText("#kpiMaxDrawdown", `${drawdown.percent.toFixed(2)}%`);
    setText("#kpiMaxDrawdownNote", `-${money(drawdown.amount)}`);

    setText("#footerTotalTrades", String(visible.total));
    setText("#footerWins", `${visible.wins} (${visible.closed ? ((visible.wins / visible.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerLosses", `${visible.losses} (${visible.closed ? ((visible.losses / visible.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerBreakeven", `${visible.breakeven} (${visible.closed ? ((visible.breakeven / visible.closed) * 100).toFixed(1) : "0.0"}%)`);
  };

  const renderWinLoss = () => {
    const stats = calculateStats(state.filteredTrades);
    const base = stats.closed || 1;
    const win = (stats.wins / base) * 360;
    const loss = ((stats.wins + stats.losses) / base) * 360;
    const donut = $("#dashWinLossDonut");
    if (donut) {
      donut.style.setProperty("--win-angle", `${win}deg`);
      donut.style.setProperty("--loss-angle", `${loss}deg`);
    }
    setText("#dashWinsLegend", `${stats.wins} (${stats.closed ? ((stats.wins / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#dashLossesLegend", `${stats.losses} (${stats.closed ? ((stats.losses / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#dashBreakevenLegend", `${stats.breakeven} (${stats.closed ? ((stats.breakeven / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#dashTotalTrades", String(stats.total));
  };

  const renderSessions = () => {
    const wrap = $("#dashSessionBars");
    if (!wrap) return;
    const names = ["London", "New York", "Asian", "Other"];
    wrap.innerHTML = names.map((name) => {
      const trades = state.filteredTrades.filter((trade) => trade.session === name);
      const stats = calculateStats(trades);
      const width = Math.max(0, Math.min(100, stats.winRate));
      return `<div><span>${escapeHtml(name)}</span><div${name === "Asian" ? ' class="orange"' : ""}><i style="--w:${width.toFixed(1)}%"></i></div><strong>${width.toFixed(1)}%</strong></div>`;
    }).join("");
  };

  const pairRows = () => {
    const map = new Map();
    for (const trade of state.filteredTrades) {
      const symbol = String(trade.symbol || "UNKNOWN").toUpperCase();
      if (!map.has(symbol)) map.set(symbol, []);
      map.get(symbol).push(trade);
    }
    return [...map.entries()].map(([symbol, trades]) => ({ symbol, trades, stats: calculateStats(trades) }))
      .sort((a, b) => b.stats.net - a.stats.net);
  };

  const renderPairs = () => {
    const tbody = $("#dashTopPairsBody");
    if (!tbody) return;
    const rows = pairRows().slice(0, 5);
    tbody.innerHTML = rows.length ? rows.map(({ symbol, stats }) => `
      <tr><td>${escapeHtml(symbol)}</td><td>${stats.total}</td><td>${stats.winRate.toFixed(1)}%</td><td class="${stats.net >= 0 ? "positive" : "negative"}">${money(stats.net, true)}</td></tr>
    `).join("") : '<tr><td class="empty-row" colspan="4">No trades in selected range.</td></tr>';
  };

  const renderTimeAnalysis = () => {
    const byHour = new Map();
    const byDay = new Map();
    for (const trade of state.filteredTrades) {
      const pnl = number(trade.profitLoss);
      const hour = String(trade.entryTime || "").split(":")[0];
      if (/^\d{1,2}$/.test(hour)) byHour.set(hour, (byHour.get(hour) || 0) + pnl);
      const date = parseTradeDate(trade);
      if (date) {
        const day = date.toLocaleDateString("en-US", { weekday: "long" });
        byDay.set(day, (byDay.get(day) || 0) + pnl);
      }
    }
    const bestEntry = (map, best) => [...map.entries()].sort((a, b) => best ? b[1] - a[1] : a[1] - b[1])[0];
    const bestHour = bestEntry(byHour, true);
    const worstHour = bestEntry(byHour, false);
    const bestDay = bestEntry(byDay, true);
    const worstDay = bestEntry(byDay, false);
    const fmtHour = (entry) => entry ? new Date(2000, 0, 1, Number(entry[0])).toLocaleTimeString("en-US", { hour: "numeric" }) : "Not tracked";
    const wrap = $("#dashTimeStats");
    if (wrap) wrap.innerHTML = `
      <p><span>Best Hour</span><strong class="positive">${escapeHtml(fmtHour(bestHour))}</strong></p>
      <p><span>Worst Hour</span><strong class="negative">${escapeHtml(fmtHour(worstHour))}</strong></p>
      <p><span>Best Day</span><strong class="positive">${escapeHtml(bestDay?.[0] || "No data")}</strong></p>
      <p><span>Worst Day</span><strong class="negative">${escapeHtml(worstDay?.[0] || "No data")}</strong></p>`;
  };

  const renderRiskAndPsychology = () => {
    const trades = state.filteredTrades;
    const start = number(state.settings.startingBalance);
    const risks = trades.map((trade) => {
      const entry = optionalNumber(trade.entryPrice);
      const stop = optionalNumber(trade.stopLoss);
      const qty = number(trade.quantity, 1);
      if (entry === undefined || stop === undefined) return null;
      const amount = Math.abs(entry - stop) * qty;
      return { amount, percent: start > 0 ? (amount / start) * 100 : 0 };
    }).filter(Boolean);
    const avgRisk = risks.length ? risks.reduce((s, x) => s + x.percent, 0) / risks.length : 0;
    const maxRisk = risks.length ? Math.max(...risks.map((x) => x.percent)) : 0;
    const stats = calculateStats(trades);
    const riskWrap = $("#dashRiskStats");
    if (riskWrap) riskWrap.innerHTML = `
      <p><span>Average Risk %</span><strong>${avgRisk.toFixed(2)}%</strong></p>
      <p><span>Highest Risk %</span><strong>${maxRisk.toFixed(2)}%</strong></p>
      <p><span>Average Lot Size</span><strong>${stats.averageLot.toFixed(2)}</strong></p>
      <p><span>Average R Multiple</span><strong>${stats.averageRR.toFixed(2)}R</strong></p>
      <p><span>Rule Violations</span><strong>Not tracked</strong></p>`;

    const mistakes = new Map();
    for (const trade of trades) {
      for (const tag of safeArray(trade.mistakeTags)) mistakes.set(tag, (mistakes.get(tag) || 0) + 1);
    }
    const topMistake = [...mistakes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "None recorded";
    const rated = trades.filter((trade) => Number.isFinite(Number(trade.rating)));
    const avgRating = rated.length ? rated.reduce((s, t) => s + number(t.rating), 0) / rated.length : 0;
    const psych = $("#dashPsychList");
    if (psych) psych.innerHTML = `
      <p><span>Average Review Rating</span><strong>${rated.length ? `${avgRating.toFixed(1)} / 5` : "Not tracked"}</strong></p>
      <p><span>Avg Confidence</span><strong>Not tracked</strong></p>
      <p><span>Avg Stress</span><strong>Not tracked</strong></p>
      <p><span>Most Common Mistake</span><strong class="orange-text">${escapeHtml(topMistake)}</strong></p>
      <p><span>Psychology Fields</span><strong>Backend update needed</strong></p>`;
  };

  const renderRecent = () => {
    const tbody = $("#dashRecentTrades tbody");
    if (!tbody) return;
    const rows = [...state.filteredTrades].sort((a, b) => (parseTradeDate(b)?.getTime() || 0) - (parseTradeDate(a)?.getTime() || 0)).slice(0, 7);
    tbody.innerHTML = rows.length ? rows.map((trade) => {
      const pnl = number(trade.profitLoss);
      const date = parseTradeDate(trade);
      return `<tr data-id="${escapeHtml(trade._id)}"><td>${escapeHtml(trade.symbol)}</td><td class="${trade.direction === "Long" ? "positive" : "negative"}">${trade.direction === "Long" ? "Buy" : "Sell"}</td><td>${number(trade.entryPrice).toLocaleString()}</td><td>${trade.exitPrice === undefined || trade.exitPrice === null ? "—" : number(trade.exitPrice).toLocaleString()}</td><td>${number(trade.rr).toFixed(2)}R</td><td class="${pnl >= 0 ? "positive" : "negative"}">${money(pnl, true)}</td><td>${date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td></tr>`;
    }).join("") : '<tr><td class="empty-row" colspan="7">No trades in selected range.</td></tr>';
  };

  const renderCalendar = () => {
    const grid = $("#dashCalendarGrid");
    if (!grid) return;
    const month = state.calendarMonth;
    setText("#dashCalendarTitle", month.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const mondayIndex = (first.getDay() + 6) % 7;
    const pnlMap = new Map();
    for (const trade of state.trades) {
      const date = parseTradeDate(trade);
      if (!date || date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth()) continue;
      const key = date.getDate();
      pnlMap.set(key, (pnlMap.get(key) || 0) + number(trade.profitLoss));
    }
    const parts = [];
    for (let i = 0; i < mondayIndex; i += 1) parts.push('<button type="button" class="empty" disabled></button>');
    for (let day = 1; day <= lastDay; day += 1) {
      const pnl = pnlMap.get(day);
      const cls = pnl === undefined ? "" : pnl >= 0 ? "profit" : "loss";
      parts.push(`<button type="button" class="${cls}" data-day="${day}"><span>${day}</span><strong>${pnl === undefined ? "" : money(pnl, true)}</strong></button>`);
    }
    grid.innerHTML = parts.join("");
  };

  const renderHeatmap = () => {
    const grid = $("#dashHeatGrid");
    if (!grid) return;
    const cells = [];
    for (let hour = 8; hour <= 15; hour += 1) {
      cells.push(`<span>${hour}:00</span>`);
      for (let day = 1; day <= 5; day += 1) {
        const pnl = state.filteredTrades.reduce((sum, trade) => {
          const date = parseTradeDate(trade);
          const h = Number(String(trade.entryTime || "").split(":")[0]);
          return date && date.getDay() === day && h === hour ? sum + number(trade.profitLoss) : sum;
        }, 0);
        const opacity = Math.min(1, Math.abs(pnl) / 500 + 0.12);
        const color = pnl > 0 ? `rgba(32,173,96,${opacity})` : pnl < 0 ? `rgba(225,74,78,${opacity})` : "rgba(127,140,150,.08)";
        cells.push(`<button type="button" style="background:${color}" title="${money(pnl, true)}"></button>`);
      }
    }
    grid.innerHTML = cells.join("");
  };

  const setupCanvas = (canvas) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, width: rect.width, height: rect.height };
  };

  const rangeStart = () => {
    const now = new Date();
    const map = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };
    if (!map[state.range]) return new Date(0);
    return new Date(now.getTime() - map[state.range] * 86400000);
  };

  const drawEquityChart = () => {
    const canvas = $("#dashEquityChart");
    if (!canvas) return;
    const { ctx, width, height } = setupCanvas(canvas);
    const list = [...state.trades].filter((trade) => (parseTradeDate(trade)?.getTime() || 0) >= rangeStart().getTime())
      .sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0));
    const start = number(state.settings.startingBalance);
    const values = [start];
    let balance = start;
    for (const trade of list) { balance += number(trade.profitLoss); values.push(balance); }
    if (values.length === 1) values.push(start);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 24;
    const points = values.map((value, index) => [pad + index / (values.length - 1) * (width - pad * 2), height - pad - (value - min) / span * (height - pad * 2)]);
    const line = getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#20ad60";
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#dce3e8";
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const y = pad + i * (height - pad * 2) / 5;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
    }
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(32,173,96,.25)"); gradient.addColorStop(1, "rgba(32,173,96,0)");
    ctx.lineTo(points.at(-1)[0], height - pad); ctx.lineTo(points[0][0], height - pad); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  };

  const drawRiskChart = () => {
    const canvas = $("#dashRiskChart");
    if (!canvas) return;
    const { ctx, width, height } = setupCanvas(canvas);
    const list = state.filteredTrades.slice(-12);
    const values = list.map((trade) => Math.abs(number(trade.rr)));
    if (!values.length) values.push(0);
    const max = Math.max(...values, 1);
    const gap = 5;
    const barWidth = Math.max(3, (width - gap * (values.length + 1)) / values.length);
    const green = getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#20ad60";
    values.forEach((value, index) => {
      const h = value / max * (height - 22);
      ctx.fillStyle = green;
      ctx.fillRect(gap + index * (barWidth + gap), height - h - 8, barWidth, h);
    });
  };

  const drawAllCharts = () => {
    drawEquityChart();
    drawRiskChart();
  };

  const renderDashboard = () => {
    filterTrades();
    renderKPIs();
    renderWinLoss();
    renderSessions();
    renderPairs();
    renderTimeAnalysis();
    renderRiskAndPsychology();
    renderRecent();
    renderCalendar();
    renderHeatmap();
    drawAllCharts();
  };

  const loadData = async () => {
    setStatus("Loading protected ProTrade data…", "loading");
    try {
      await window.ProTradeAuth.ready;
      const [tradesBody, settingsBody, alertBody] = await Promise.all([
        apiJson(ENDPOINTS.trades),
        apiJson(ENDPOINTS.settings),
        apiJson(ENDPOINTS.alertSummary).catch(() => ({ data: { unread: 0, latest: null } })),
      ]);
      state.trades = Array.isArray(tradesBody.data) ? tradesBody.data : [];
      state.settings = settingsBody.data || {};
      state.alertSummary = alertBody.data || { unread: 0, latest: null };
      updateProfile();
      applyTheme(state.settings.theme || window.localStorage.getItem("protrade-theme") || "Dark", false);
      const unread = number(state.alertSummary.unread);
      setText("#notificationCount", unread ? String(unread) : "");
      renderDashboard();
      setStatus(`${state.trades.length} trades synced from MongoDB.`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message, "error");
      toast("Dashboard could not load", error.message);
    }
  };

  const tradePayloadFromForm = (form) => {
    const data = new FormData(form);
    const payload = {
      tradeDate: data.get("tradeDate"),
      symbol: String(data.get("symbol") || "").trim().toUpperCase(),
      direction: data.get("direction"),
      session: data.get("session") || "Other",
      model: String(data.get("model") || "").trim(),
      protocol: String(data.get("protocol") || "").trim(),
      entryTime: String(data.get("entryTime") || "").trim(),
      exitTime: String(data.get("exitTime") || "").trim(),
      entryPrice: optionalNumber(data.get("entryPrice")),
      exitPrice: optionalNumber(data.get("exitPrice")),
      stopLoss: optionalNumber(data.get("stopLoss")),
      takeProfit: optionalNumber(data.get("takeProfit")),
      quantity: optionalNumber(data.get("quantity")) ?? 1,
      commission: optionalNumber(data.get("commission")) ?? 0,
      profitLoss: optionalNumber(data.get("profitLoss")) ?? 0,
      rr: optionalNumber(data.get("rr")) ?? 0,
      result: data.get("result") || "Open",
      rating: optionalNumber(data.get("rating")),
      notes: String(data.get("notes") || "").trim(),
      screenshotUrl: String(data.get("screenshotUrl") || "").trim(),
    };
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === "") delete payload[key];
    }
    return payload;
  };

  const normalizeImportTrade = (raw) => {
    const pnl = optionalNumber(raw.profitLoss ?? raw.pnl ?? raw["Net P&L"] ?? raw["P&L"]);
    const sessionRaw = String(raw.session || "Other").toLowerCase();
    const session = sessionRaw.includes("london") ? "London" : sessionRaw.includes("new york") || sessionRaw === "ny" ? "New York" : sessionRaw.includes("asia") || sessionRaw.includes("tokyo") ? "Asian" : "Other";
    const directionRaw = String(raw.direction || "Long").toLowerCase();
    const direction = directionRaw.includes("short") || directionRaw.includes("sell") ? "Short" : "Long";
    const resultRaw = String(raw.result || "").toLowerCase();
    const result = ["win", "loss", "breakeven", "open"].includes(resultRaw) ? resultRaw[0].toUpperCase() + resultRaw.slice(1) : pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";
    return {
      tradeDate: raw.tradeDate || raw.date,
      symbol: String(raw.symbol || raw.pair || "").trim().toUpperCase(),
      direction,
      session,
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
      profitLoss: pnl ?? 0,
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
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
        else value += char;
      }
      values.push(value.trim());
      return values;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] ?? ""])));
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
    const valid = records.slice(0, 100).map(normalizeImportTrade).filter((trade) => trade.tradeDate && trade.symbol && trade.entryPrice !== undefined);
    if (!valid.length) throw new Error("No valid rows found. Required: tradeDate/date, symbol/pair and entryPrice/entry.");
    let success = 0;
    for (const trade of valid) {
      await apiJson(ENDPOINTS.trades, { method: "POST", body: JSON.stringify(trade) });
      success += 1;
    }
    toast("Import complete", `${success} trades saved to MongoDB.`);
    await loadData();
  };

  const setupEvents = () => {
    $$(".nav-item[data-route]").forEach((button) => button.addEventListener("click", () => {
      window.location.href = button.dataset.route;
    }));
    $("#mobileMenuBtn")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));

    $("#profileBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#profilePopover").hidden = !$("#profilePopover").hidden;
      $("#accountPopover").hidden = true;
    });
    $$('[data-profile-action]').forEach((button) => button.addEventListener("click", async () => {
      $("#profilePopover").hidden = true;
      if (button.dataset.profileAction === "logout") {
        await window.ProTradeAuth?.logout?.();
        return;
      }
      window.location.href = "settings.html";
    }));

    $("#themeSwitch")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "Light" : "Dark", true));
    $("#balanceVisibilityBtn")?.addEventListener("click", () => { state.balanceHidden = !state.balanceHidden; updateBalances(); });

    $("#accountSelectorBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#accountPopover").hidden = !$("#accountPopover").hidden;
    });
    $$('[data-account]').forEach((button) => button.addEventListener("click", () => {
      setText("#accountLabel", "All Accounts");
      $("#accountPopover").hidden = true;
      toast("All Accounts", "Current backend does not have separate broker-account records yet.");
    }));

    $("#notificationBtn")?.addEventListener("click", () => {
      const latest = state.alertSummary?.latest;
      info("Security Alerts", `${number(state.alertSummary?.unread)} unread alert(s)`, latest ? `<p><strong>${escapeHtml(latest.title)}</strong></p><p>${escapeHtml(latest.message)}</p><p><a href="settings.html">Open Security Settings</a></p>` : '<p>No security alerts are currently available.</p>');
    });

    $("#newTradeBtn")?.addEventListener("click", () => {
      const dateInput = $("#tradeDate");
      if (dateInput && !dateInput.value) dateInput.value = formatDateInput(new Date());
      openModal("tradeModal");
    });

    $("#tradeForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const body = await apiJson(ENDPOINTS.trades, { method: "POST", body: JSON.stringify(tradePayloadFromForm(event.currentTarget)) });
        state.trades.unshift(body.data);
        closeModal("tradeModal");
        event.currentTarget.reset();
        renderDashboard();
        toast("Trade saved", "Trade saved to MongoDB successfully.");
      } catch (error) {
        toast("Trade not saved", error.message);
      } finally {
        submit.disabled = false;
      }
    });

    $("#importTradesBtn")?.addEventListener("click", () => $("#importTradesInput")?.click());
    $("#importTradesInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try { await importTrades(file); }
      catch (error) { toast("Import failed", error.message); }
    });

    $$("[data-dash-metric]").forEach((button) => button.addEventListener("click", () => {
      const metric = button.dataset.dashMetric || "Performance Metric";
      const value = button.querySelector("strong")?.textContent?.trim() || "—";
      const note = button.querySelector("small")?.textContent?.trim() || "Calculated from your synchronized trades.";
      info(
        metric,
        "Live MongoDB performance metric",
        `<p><strong>${escapeHtml(value)}</strong></p><p>${escapeHtml(note)}</p><p><a href="reports.html">Open detailed reports →</a></p>`
      );
    }));

    $("#dateRangeBtn")?.addEventListener("click", () => openModal("dateModal"));
    $("#dateForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const start = new Date(`${$("#startDate").value}T00:00:00`);
      const end = new Date(`${$("#endDate").value}T23:59:59`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        toast("Invalid date range", "Start date must be before end date.");
        return;
      }
      state.startDate = start;
      state.endDate = end;
      setText("#dateRangeLabel", `${start.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })} - ${end.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}`);
      closeModal("dateModal");
      renderDashboard();
    });

    $$("#dashRangeTabs button").forEach((button) => button.addEventListener("click", () => {
      $$("#dashRangeTabs button").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      state.range = button.dataset.range;
      drawEquityChart();
    }));

    $("#dashPrevMonth")?.addEventListener("click", () => { state.calendarMonth.setMonth(state.calendarMonth.getMonth() - 1); renderCalendar(); });
    $("#dashNextMonth")?.addEventListener("click", () => { state.calendarMonth.setMonth(state.calendarMonth.getMonth() + 1); renderCalendar(); });
    $("#dashRefreshBtn")?.addEventListener("click", loadData);
    $("#dashExportBtn")?.addEventListener("click", () => {
      const stats = calculateStats(state.filteredTrades);
      const rows = [
        ["Metric", "Value"], ["Total Trades", stats.total], ["Wins", stats.wins], ["Losses", stats.losses],
        ["Net P&L", stats.net], ["Win Rate", stats.winRate.toFixed(2)], ["Profit Factor", Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "Infinity"],
      ];
      const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "protrade-dashboard-summary.csv"; link.click(); URL.revokeObjectURL(url);
    });
    $("#dashViewPairsBtn")?.addEventListener("click", () => {
      const rows = pairRows();
      info("All Trading Pairs", "Performance calculated from your MongoDB trades", rows.length ? `<table class="dash-table"><thead><tr><th>Pair</th><th>Trades</th><th>Win %</th><th>Net</th></tr></thead><tbody>${rows.map(({symbol,stats}) => `<tr><td>${escapeHtml(symbol)}</td><td>${stats.total}</td><td>${stats.winRate.toFixed(1)}%</td><td>${money(stats.net,true)}</td></tr>`).join("")}</tbody></table>` : "<p>No trades found.</p>");
    });

    $$('[data-close]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    $$('.modal-backdrop').forEach((node) => node.addEventListener("click", (event) => { if (event.target === node) closeModal(node.id); }));
    document.addEventListener("click", () => { if ($("#profilePopover")) $("#profilePopover").hidden = true; if ($("#accountPopover")) $("#accountPopover").hidden = true; });
    window.addEventListener("resize", () => { clearTimeout(window.__dashResize); window.__dashResize = setTimeout(drawAllCharts, 120); });
  };

  const init = async () => {
    setupEvents();
    applyTheme(window.localStorage.getItem("protrade-theme") || "Dark", false);
    const today = new Date();
    const start = new Date(today.getTime() - 29 * 86400000);
    state.startDate = start;
    state.endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const tradeDate = $("#tradeDate");
    if (tradeDate) tradeDate.value = formatDateInput(today);
    await loadData();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
