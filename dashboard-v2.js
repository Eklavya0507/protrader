(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const state = {
    trades: [],
    visibleTrades: [],
    settings: {},
    alerts: [],
    totalBalance: 0,
    equity: 0,
    calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    theme: localStorage.getItem("protrade-theme") || "dark",
    balanceHidden: false,
    activeRange: "1M",
    startDate: null,
    endDate: null,
  };

  const API_BASE = window.ProTradeAuth?.API_BASE || "https://protrader-backend-n8oj.onrender.com/api";
  const TRADES_API = `${API_BASE}/trades`;
  const SETTINGS_API = `${API_BASE}/settings`;
  const ALERTS_API = `${API_BASE}/security/alerts`;

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

  const currencyCode = () => state.settings.currency || "USD";

  const money = (value, signed = false) => {
    const amount = number(value);
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formatted = formatter.format(Math.abs(amount));
    if (!signed) return formatted;
    return `${amount >= 0 ? "+" : "-"}${formatted}`;
  };

  const percent = (value, digits = 2) => `${number(value).toFixed(digits)}%`;

  const parseTradeDate = (trade) => {
    const raw = trade?.tradeDate || trade?.createdAt;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const localDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const tradeResult = (trade) => {
    const result = String(trade?.result || "").toLowerCase();
    const pnl = number(trade?.profitLoss);
    if (result === "win" || pnl > 0) return "win";
    if (result === "loss" || pnl < 0) return "loss";
    if (result === "open") return "open";
    return "breakeven";
  };

  const setText = (selector, value) => {
    const element = typeof selector === "string" ? $(selector) : selector;
    if (element) element.textContent = value;
  };

  const setStatus = (message) => {
    setText("#dashboardStatus", message);
  };

  const toast = (message, icon = "✓") => {
    const toastElement = $("#toast");
    if (!toastElement) return;
    setText("#toast span", icon);
    setText("#toastText", message);
    toastElement.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastElement.classList.remove("show"), 3200);
  };

  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!$$('.modal.open').length) document.body.style.overflow = "";
  };

  const openInfo = (title, html) => {
    setText("#infoModalTitle", title);
    const content = $("#infoModalContent");
    if (content) content.innerHTML = html;
    openModal("infoModal");
  };

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed (${response.status})`);
    }
    return body;
  };

  const waitForAuth = async () => {
    if (!window.ProTradeAuth?.ready) {
      throw new Error("ProTrade authentication helper is missing.");
    }
    return window.ProTradeAuth.ready;
  };

  const calculateStats = (trades) => {
    const rows = Array.isArray(trades) ? trades : [];
    const results = rows.map(tradeResult);
    const wins = results.filter((value) => value === "win").length;
    const losses = results.filter((value) => value === "loss").length;
    const breakeven = results.filter((value) => value === "breakeven").length;
    const open = results.filter((value) => value === "open").length;
    const closed = wins + losses + breakeven;
    const netPnl = rows.reduce((sum, trade) => sum + number(trade.profitLoss), 0);
    const grossProfit = rows.reduce((sum, trade) => sum + Math.max(number(trade.profitLoss), 0), 0);
    const grossLoss = Math.abs(rows.reduce((sum, trade) => sum + Math.min(number(trade.profitLoss), 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const winRate = closed > 0 ? (wins / closed) * 100 : 0;
    const expectancy = closed > 0 ? netPnl / closed : 0;
    const averageRR = rows.length
      ? rows.reduce((sum, trade) => sum + number(trade.rr), 0) / rows.length
      : 0;
    const averageLot = rows.length
      ? rows.reduce((sum, trade) => sum + number(trade.quantity), 0) / rows.length
      : 0;

    return {
      total: rows.length,
      wins,
      losses,
      breakeven,
      open,
      closed,
      netPnl,
      grossProfit,
      grossLoss,
      profitFactor,
      winRate,
      expectancy,
      averageRR,
      averageLot,
    };
  };

  const calculateDrawdown = (trades) => {
    const sorted = [...trades].sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0));
    let balance = number(state.settings.startingBalance, 0);
    let peak = balance;
    let maxAmount = 0;
    let maxPercent = 0;

    for (const trade of sorted) {
      balance += number(trade.profitLoss);
      peak = Math.max(peak, balance);
      const amount = peak - balance;
      const drawdownPercent = peak > 0 ? (amount / peak) * 100 : 0;
      if (amount > maxAmount) maxAmount = amount;
      if (drawdownPercent > maxPercent) maxPercent = drawdownPercent;
    }

    return { amount: maxAmount, percent: maxPercent };
  };

  const applyDateFilter = () => {
    state.visibleTrades = state.trades.filter((trade) => {
      const date = parseTradeDate(trade);
      if (!date) return false;
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (state.startDate && day < state.startDate) return false;
      if (state.endDate && day > state.endDate) return false;
      return true;
    });
    renderDashboard();
  };

  const currentDayPnl = () => {
    const today = localDateKey(new Date());
    return state.trades
      .filter((trade) => localDateKey(parseTradeDate(trade)) === today)
      .reduce((sum, trade) => sum + number(trade.profitLoss), 0);
  };

  const updateBalances = () => {
    const mask = "••••••••";
    setText("#sidebarBalance", state.balanceHidden ? mask : money(state.totalBalance));
    setText("#sidebarEquity", state.balanceHidden ? mask : money(state.equity));
    setText("#totalBalance", state.balanceHidden ? mask : money(state.totalBalance));
    const toggle = $("#balanceToggle");
    if (toggle) toggle.textContent = state.balanceHidden ? "○" : "◉";
  };

  const renderTopStats = () => {
    const stats = calculateStats(state.visibleTrades);
    const allStats = calculateStats(state.trades);
    const startingBalance = number(state.settings.startingBalance, 0);
    state.totalBalance = startingBalance + allStats.netPnl;
    state.equity = state.totalBalance;

    updateBalances();
    setText("#netProfit", money(stats.netPnl, true));
    setText("#todayPnl", money(currentDayPnl(), true));
    setText("#winRate", percent(stats.winRate));
    setText("#profitFactor", Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞");
    setText("#profitFactorLabel", stats.profitFactor >= 2 ? "Strong" : stats.profitFactor >= 1 ? "Positive" : stats.total ? "Needs work" : "No data");
    setText("#expectancy", money(stats.expectancy));

    const drawdown = calculateDrawdown(state.visibleTrades);
    setText("#maxDrawdownPercent", `-${percent(drawdown.percent)}`);
    setText("#maxDrawdownAmount", `-${money(drawdown.amount)}`);

    setText("#totalTrades", String(stats.total));
    setText("#footerTrades", String(stats.total));
    setText("#footerWins", `${stats.wins} (${stats.closed ? ((stats.wins / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerLosses", `${stats.losses} (${stats.closed ? ((stats.losses / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerBreakeven", `${stats.breakeven} (${stats.closed ? ((stats.breakeven / stats.closed) * 100).toFixed(1) : "0.0"}%)`);

    const winPercent = stats.closed ? (stats.wins / stats.closed) * 100 : 0;
    const lossPercent = stats.closed ? (stats.losses / stats.closed) * 100 : 0;
    const donut = $("#winLossDonut");
    if (donut) {
      donut.style.setProperty("--win", `${winPercent}%`);
      donut.style.setProperty("--lossEnd", `${Math.min(100, winPercent + lossPercent)}%`);
    }
    setText("#winningTradesMetric", `${stats.wins} (${winPercent.toFixed(1)}%)`);
    setText("#losingTradesMetric", `${stats.losses} (${lossPercent.toFixed(1)}%)`);
    setText("#breakevenTradesMetric", `${stats.breakeven} (${stats.closed ? ((stats.breakeven / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
  };

  const renderSessionPerformance = () => {
    const container = $("#sessionPerformanceList");
    if (!container) return;
    const sessions = ["London", "New York", "Asian", "Other"];
    const rows = sessions.map((session) => {
      const trades = state.visibleTrades.filter((trade) => String(trade.session || "Other") === session);
      const stats = calculateStats(trades);
      return { session, ...stats };
    });

    if (!rows.some((row) => row.total)) {
      container.innerHTML = '<div class="muted-table-cell">No session data available.</div>';
      return;
    }

    container.innerHTML = rows
      .map((row) => {
        const width = Math.max(0, Math.min(100, row.winRate));
        const orange = row.session === "Asian" ? " orange-bar" : "";
        return `<div class="bar-row"><span>${escapeHtml(row.session)}</span><div class="bar-track${orange}"><i style="width:${width.toFixed(1)}%"></i></div><b>${row.winRate.toFixed(1)}%</b></div>`;
      })
      .join("");
  };

  const pairRows = () => {
    const groups = new Map();
    for (const trade of state.visibleTrades) {
      const symbol = String(trade.symbol || "Unknown").toUpperCase();
      if (!groups.has(symbol)) groups.set(symbol, []);
      groups.get(symbol).push(trade);
    }
    return [...groups.entries()]
      .map(([symbol, trades]) => ({ symbol, ...calculateStats(trades) }))
      .sort((a, b) => b.netPnl - a.netPnl || b.total - a.total);
  };

  const renderTopPairs = () => {
    const body = $("#topPairsBody");
    if (!body) return;
    const rows = pairRows().slice(0, 5);
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="muted-table-cell">No pair data yet.</td></tr>';
      return;
    }
    body.innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.symbol)}</td><td>${row.total}</td><td>${row.winRate.toFixed(1)}%</td><td class="${row.netPnl >= 0 ? "profit" : "loss"}">${money(row.netPnl, true)}</td></tr>`).join("");
  };

  const renderRecentTrades = () => {
    const body = $("#recentTradesBody");
    if (!body) return;
    const trades = [...state.visibleTrades]
      .sort((a, b) => (parseTradeDate(b)?.getTime() || 0) - (parseTradeDate(a)?.getTime() || 0))
      .slice(0, 5);

    if (!trades.length) {
      body.innerHTML = '<tr><td colspan="7" class="muted-table-cell">No trades found for this period.</td></tr>';
      return;
    }

    body.innerHTML = trades.map((trade) => {
      const pnl = number(trade.profitLoss);
      const date = parseTradeDate(trade);
      const direction = trade.direction === "Short" ? "Sell" : "Buy";
      return `<tr>
        <td>${escapeHtml(trade.symbol || "—")}</td>
        <td class="${trade.direction === "Short" ? "loss" : "profit"}">${direction}</td>
        <td>${number(trade.entryPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>
        <td>${trade.exitPrice == null ? "—" : number(trade.exitPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>
        <td>${number(trade.rr) ? `1:${number(trade.rr).toFixed(2)}` : "—"}</td>
        <td class="${pnl >= 0 ? "profit" : "loss"}">${money(pnl, true)}</td>
        <td>${date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td>
      </tr>`;
    }).join("");
  };

  const mostCommon = (values) => {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  };

  const renderRiskAndPsychology = () => {
    const stats = calculateStats(state.visibleTrades);
    const riskPerTrade = number(state.settings.riskPerTrade);
    const highestRisk = Math.max(riskPerTrade, number(state.settings.maxDailyLoss));
    setText("#riskAverage", riskPerTrade ? percent(riskPerTrade) : "—");
    setText("#riskHighest", highestRisk ? percent(highestRisk) : "—");
    setText("#averageLotSize", stats.total ? stats.averageLot.toFixed(2) : "—");
    setText("#averageRiskReward", stats.total ? `1:${stats.averageRR.toFixed(2)}` : "—");
    setText("#ruleViolations", "Not tracked");

    const ratings = state.visibleTrades.map((trade) => number(trade.rating, NaN)).filter(Number.isFinite);
    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
    const mistakes = state.visibleTrades.flatMap((trade) => Array.isArray(trade.mistakeTags) ? trade.mistakeTags : []);
    const daily = new Map();
    state.visibleTrades.forEach((trade) => {
      const date = parseTradeDate(trade);
      if (!date) return;
      const day = date.toLocaleDateString("en-US", { weekday: "long" });
      daily.set(day, (daily.get(day) || 0) + Math.abs(number(trade.profitLoss)));
    });
    const emotionalDay = [...daily.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    setText("#averageConfidence", averageRating ? `${averageRating.toFixed(1)} / 5 rating` : "Not tracked");
    setText("#averageStress", "Not tracked");
    setText("#bestMood", "Not tracked");
    setText("#commonMistake", mostCommon(mistakes));
    setText("#emotionalDay", emotionalDay);
  };

  const renderHeatmap = () => {
    const grid = $("#heatGrid");
    if (!grid) return;
    const buckets = Array.from({ length: 30 }, () => ({ count: 0, pnl: 0 }));
    const hourStarts = [6, 9, 12, 15, 18, 21];

    state.visibleTrades.forEach((trade) => {
      const date = parseTradeDate(trade);
      if (!date) return;
      const day = (date.getDay() + 6) % 7;
      if (day > 4) return;
      const timeParts = String(trade.entryTime || "").match(/^(\d{1,2}):(\d{2})/);
      const hour = timeParts ? number(timeParts[1]) : date.getHours();
      let column = hourStarts.findIndex((start, index) => hour >= start && (index === hourStarts.length - 1 || hour < hourStarts[index + 1]));
      if (column < 0) column = hour < 6 ? 0 : 5;
      const bucket = buckets[column * 5 + day];
      bucket.count += 1;
      bucket.pnl += number(trade.profitLoss);
    });

    const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
    grid.replaceChildren(...buckets.map((bucket, index) => {
      const cell = document.createElement("button");
      cell.type = "button";
      const level = bucket.count ? Math.max(1, Math.min(7, Math.ceil((bucket.count / maxCount) * 7))) : 1;
      cell.className = `heat-cell h${level}`;
      cell.title = `${bucket.count} trade(s), ${money(bucket.pnl, true)}`;
      cell.addEventListener("click", () => toast(`${bucket.count} trade(s), ${money(bucket.pnl, true)} in this window.`, bucket.pnl >= 0 ? "✓" : "!"));
      cell.dataset.index = String(index);
      return cell;
    }));
  };

  const fitCanvas = (canvas) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  };

  const rangeStart = (latestDate, range) => {
    if (!latestDate || range === "ALL") return null;
    const start = new Date(latestDate);
    const days = { "1W": 7, "1M": 31, "3M": 93, "6M": 186, "1Y": 366 }[range] || 31;
    start.setDate(start.getDate() - days + 1);
    return start;
  };

  const equitySeries = () => {
    const sorted = [...state.visibleTrades]
      .filter((trade) => parseTradeDate(trade))
      .sort((a, b) => parseTradeDate(a) - parseTradeDate(b));
    const latest = parseTradeDate(sorted.at(-1)) || new Date();
    const start = rangeStart(latest, state.activeRange);
    const ranged = start ? sorted.filter((trade) => parseTradeDate(trade) >= start) : sorted;
    let balance = number(state.settings.startingBalance, 0);
    if (ranged.length && ranged[0] !== sorted[0]) {
      const firstTime = parseTradeDate(ranged[0])?.getTime() || 0;
      balance += sorted.filter((trade) => (parseTradeDate(trade)?.getTime() || 0) < firstTime).reduce((sum, trade) => sum + number(trade.profitLoss), 0);
    }
    const points = [{ date: start || parseTradeDate(ranged[0]) || new Date(), equity: balance, drawdown: 0 }];
    let peak = balance;
    ranged.forEach((trade) => {
      balance += number(trade.profitLoss);
      peak = Math.max(peak, balance);
      points.push({ date: parseTradeDate(trade), equity: balance, drawdown: peak > 0 ? ((balance - peak) / peak) * 100 : 0 });
    });
    return points;
  };

  const drawEquityChart = () => {
    const canvas = $("#equityChart");
    if (!canvas) return;
    const { ctx, width, height } = fitCanvas(canvas);
    if (width < 10 || height < 10) return;
    ctx.clearRect(0, 0, width, height);

    const pad = { left: 68, right: 45, top: 16, bottom: 30 };
    const innerW = Math.max(1, width - pad.left - pad.right);
    const innerH = Math.max(1, height - pad.top - pad.bottom);
    const points = equitySeries();
    const equities = points.map((point) => point.equity);
    let min = Math.min(...equities);
    let max = Math.max(...equities);
    if (min === max) { min -= Math.max(100, Math.abs(min) * 0.02); max += Math.max(100, Math.abs(max) * 0.02); }
    const span = Math.max(1, max - min);
    min -= span * 0.12;
    max += span * 0.12;

    ctx.strokeStyle = css("--border");
    ctx.fillStyle = css("--muted");
    ctx.font = "9px system-ui";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 5; i += 1) {
      const y = pad.top + (i * innerH) / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      const value = max - (i * (max - min)) / 4;
      ctx.fillText(money(value), 2, y);
    }

    const xFor = (index) => pad.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const yFor = (value) => pad.top + ((max - value) / (max - min)) * innerH;
    const chartPoints = points.map((point, index) => ({ x: xFor(index), y: yFor(point.equity), ...point }));
    const green = state.theme === "dark" ? "#2d8cff" : css("--green");
    const red = css("--red");

    const area = ctx.createLinearGradient(0, pad.top, 0, pad.top + innerH);
    area.addColorStop(0, state.theme === "dark" ? "rgba(48,137,255,.34)" : "rgba(32,185,102,.20)");
    area.addColorStop(1, "rgba(40,150,220,0)");
    ctx.beginPath();
    ctx.moveTo(chartPoints[0].x, pad.top + innerH);
    chartPoints.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(chartPoints.at(-1).x, pad.top + innerH);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    ctx.beginPath();
    chartPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 7;
    ctx.shadowColor = green;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const maxDrawdown = Math.min(-1, ...points.map((point) => point.drawdown));
    const ddY = (value) => pad.top + innerH * 0.55 + (Math.abs(value) / Math.abs(maxDrawdown || -1)) * innerH * 0.42;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = ddY(point.drawdown);
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = red;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    labelIndexes.forEach((index) => {
      const date = points[index]?.date;
      if (date) ctx.fillText(date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), xFor(index), height - 6);
    });
    ctx.textAlign = "left";
  };

  const drawRiskChart = () => {
    const canvas = $("#riskChart");
    if (!canvas) return;
    const { ctx, width, height } = fitCanvas(canvas);
    if (width < 10 || height < 10) return;
    ctx.clearRect(0, 0, width, height);
    const pad = { left: 26, right: 8, top: 9, bottom: 18 };
    const iw = width - pad.left - pad.right;
    const ih = height - pad.top - pad.bottom;
    const trades = [...state.visibleTrades].sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0)).slice(-10);
    const risk = trades.map((trade) => number(state.settings.startingBalance) > 0 ? (Math.abs(number(trade.profitLoss)) / number(state.settings.startingBalance)) * 100 : 0);
    const rr = trades.map((trade) => number(trade.rr));
    const lot = trades.map((trade) => number(trade.quantity));
    const all = [...risk, ...rr, ...lot, 1];
    const max = Math.max(...all) * 1.15;

    ctx.strokeStyle = css("--border");
    [0, 0.5, 1].forEach((ratio) => { const y = pad.top + ratio * ih; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); });
    const series = [
      { color: css("--green"), values: risk },
      { color: state.theme === "dark" ? "#358dff" : "#4f8fe6", values: rr },
      { color: css("--red"), values: lot },
    ];
    series.forEach((item) => {
      if (!item.values.length) return;
      ctx.beginPath();
      item.values.forEach((value, index) => {
        const x = pad.left + (item.values.length === 1 ? iw / 2 : (index * iw) / (item.values.length - 1));
        const y = pad.top + ih - (value / max) * ih;
        index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.45;
      ctx.stroke();
    });
    ctx.fillStyle = css("--muted");
    ctx.font = "8px system-ui";
    ctx.fillText(max.toFixed(1), 2, pad.top + 3);
    ctx.fillText("0", 10, pad.top + ih + 3);
  };

  const drawCharts = () => {
    drawEquityChart();
    drawRiskChart();
  };

  const renderCalendar = () => {
    const date = state.calendarDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
    setText("#calendarTitle", title);
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousDays = new Date(year, month, 0).getDate();
    const pnlByDay = new Map();
    const tradesByDay = new Map();

    state.trades.forEach((trade) => {
      const tradeDate = parseTradeDate(trade);
      if (!tradeDate || tradeDate.getFullYear() !== year || tradeDate.getMonth() !== month) return;
      const day = tradeDate.getDate();
      pnlByDay.set(day, (pnlByDay.get(day) || 0) + number(trade.profitLoss));
      tradesByDay.set(day, (tradesByDay.get(day) || 0) + 1);
    });

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      let day;
      let muted = false;
      if (index < startOffset) { day = previousDays - startOffset + index + 1; muted = true; }
      else if (index >= startOffset + daysInMonth) { day = index - startOffset - daysInMonth + 1; muted = true; }
      else day = index - startOffset + 1;
      const pnl = muted ? null : pnlByDay.get(day);
      const count = muted ? 0 : tradesByDay.get(day) || 0;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `calendar-day${muted ? " muted" : ""}`;
      cell.innerHTML = `<b>${day}</b>${pnl != null ? `<em class="${pnl >= 0 ? "profit" : "loss"}">${money(pnl, true)}</em>` : ""}`;
      cell.addEventListener("click", () => {
        $$(".calendar-day").forEach((item) => item.classList.remove("today"));
        cell.classList.add("today");
        toast(`${day} ${title}: ${count} trade(s), ${pnl == null ? "no P&L" : money(pnl, true)}.`, "▦");
      });
      cells.push(cell);
    }
    $("#calendarGrid")?.replaceChildren(...cells);
  };

  const renderProfile = () => {
    const user = window.ProTradeAuth?.getUser?.() || {};
    const name = state.settings.fullName || user.name || "Trader";
    const role = state.settings.tradingRole || "Independent Trader";
    setText("#sidebarProfileName", name);
    setText("#sidebarProfileRole", role);
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "T";
    setText(".auth-user-initials", initials);
    setText("#sidebarBroker", "Not configured");
  };

  const renderDashboard = () => {
    renderTopStats();
    renderSessionPerformance();
    renderTopPairs();
    renderRecentTrades();
    renderRiskAndPsychology();
    renderHeatmap();
    renderCalendar();
    requestAnimationFrame(drawCharts);
  };

  const loadAlerts = async () => {
    try {
      const [body, summaryBody] = await Promise.all([
        apiJson(`${ALERTS_API}?limit=5`),
        apiJson(`${ALERTS_API}/summary`),
      ]);
      state.alerts = Array.isArray(body.data) ? body.data : [];
      const unread = number(summaryBody.data?.unread);
      setText("#notificationCount", unread > 99 ? "99+" : String(unread));
      const badge = $("#notificationCount");
      if (badge) badge.hidden = unread === 0;
    } catch (error) {
      console.warn("Dashboard alerts unavailable:", error.message);
      state.alerts = [];
      const badge = $("#notificationCount");
      if (badge) badge.hidden = true;
    }
  };

  const loadDashboard = async () => {
    setStatus("Loading your live ProTrade dashboard.");
    try {
      await waitForAuth();
      const [tradeBody, settingBody] = await Promise.all([
        apiJson(TRADES_API),
        apiJson(SETTINGS_API),
      ]);
      state.trades = Array.isArray(tradeBody.data) ? tradeBody.data : [];
      state.visibleTrades = [...state.trades];
      state.settings = settingBody.data || {};
      const latestTradeDate = parseTradeDate([...state.trades].sort((a, b) => (parseTradeDate(b)?.getTime() || 0) - (parseTradeDate(a)?.getTime() || 0))[0]);
      if (latestTradeDate) state.calendarDate = new Date(latestTradeDate.getFullYear(), latestTradeDate.getMonth(), 1);
      renderProfile();
      renderDashboard();
      await loadAlerts();
      setStatus(`Dashboard loaded with ${state.trades.length} trades.`);
      toast(`Dashboard synced with ${state.trades.length} live ${state.trades.length === 1 ? "trade" : "trades"}.`, "✓");
    } catch (error) {
      console.error(error);
      setStatus(`Dashboard failed to load: ${error.message}`);
      toast(`Could not load dashboard: ${error.message}`, "!");
      const body = $("#recentTradesBody");
      if (body) body.innerHTML = '<tr><td colspan="7" class="muted-table-cell loss">Could not load live data. Refresh after the Render server wakes up.</td></tr>';
    }
  };

  const saveThemePreference = async (theme) => {
    try {
      await apiJson(SETTINGS_API, {
        method: "PUT",
        body: JSON.stringify({ theme: theme === "dark" ? "Dark" : "Light" }),
      });
    } catch (error) {
      console.warn("Theme preference could not be saved:", error.message);
    }
  };

  const applyTheme = (theme, saveRemote = false) => {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    const toggle = $("#themeToggle");
    if (toggle) toggle.checked = theme === "dark";
    setText("#themeModeLabel", theme === "dark" ? "Dark Mode" : "Light Mode");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#07111f" : "#edf5fb");
    localStorage.setItem("protrade-theme", theme);
    requestAnimationFrame(drawCharts);
    if (saveRemote) saveThemePreference(theme);
  };

  const normalizeTrade = (raw) => {
    const directionRaw = String(raw.direction || raw.side || "").toLowerCase();
    const direction = ["long", "buy"].includes(directionRaw) ? "Long" : ["short", "sell"].includes(directionRaw) ? "Short" : "";
    const rrRaw = String(raw.rr ?? raw.riskReward ?? "").trim();
    const rr = rrRaw.includes(":") ? number(rrRaw.split(":").at(-1)) : number(rrRaw);
    const pnl = number(raw.profitLoss ?? raw.pnl);
    const sessionRaw = String(raw.session || "Other").trim();
    const session = ["Asian", "London", "New York", "Other"].includes(sessionRaw) ? sessionRaw : "Other";
    return {
      symbol: String(raw.symbol || raw.pair || "").trim().toUpperCase(),
      tradeDate: raw.tradeDate || raw.date || "",
      entryTime: raw.entryTime || "",
      exitTime: raw.exitTime || "",
      session,
      model: raw.model || "",
      protocol: raw.protocol || "",
      direction,
      entryPrice: number(raw.entryPrice ?? raw.entry, NaN),
      exitPrice: raw.exitPrice == null && raw.exit == null ? undefined : number(raw.exitPrice ?? raw.exit),
      stopLoss: raw.stopLoss == null ? undefined : number(raw.stopLoss),
      takeProfit: raw.takeProfit == null ? undefined : number(raw.takeProfit),
      commission: number(raw.commission),
      quantity: number(raw.quantity, 1),
      profitLoss: pnl,
      rr,
      result: raw.result || (pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven"),
      rating: raw.rating == null ? undefined : number(raw.rating),
      checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
      mistakeTags: Array.isArray(raw.mistakeTags) ? raw.mistakeTags : [],
      notes: raw.notes || "",
    };
  };

  const validImportedTrade = (trade) => Boolean(trade.symbol && trade.tradeDate && trade.direction && Number.isFinite(trade.entryPrice));

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(value); value = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(value); value = "";
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
      } else value += char;
    }
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  };

  const importTrades = async (file) => {
    const text = await file.text();
    let rawRows;
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    } else {
      rawRows = parseCsv(text);
    }
    const trades = rawRows.map(normalizeTrade).filter(validImportedTrade).slice(0, 100);
    if (!trades.length) throw new Error("No valid trades found. Required columns: symbol/pair, tradeDate/date, direction, entryPrice/entry.");
    if (!window.confirm(`Import ${trades.length} trade(s) into your ProTrade account? Duplicate detection is not available yet.`)) return;

    let imported = 0;
    for (const trade of trades) {
      await apiJson(TRADES_API, { method: "POST", body: JSON.stringify(trade) });
      imported += 1;
      setStatus(`Importing trades: ${imported}/${trades.length}`);
    }
    toast(`${imported} trade(s) imported successfully.`, "⇩");
    await loadDashboard();
  };

  const bindEvents = () => {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");
    const showSidebar = () => { sidebar?.classList.add("open"); overlay?.classList.add("show"); };
    const hideSidebar = () => { sidebar?.classList.remove("open"); overlay?.classList.remove("show"); };
    $("#openSidebar")?.addEventListener("click", showSidebar);
    $("#closeSidebar")?.addEventListener("click", hideSidebar);
    overlay?.addEventListener("click", hideSidebar);
    $$(".nav-item[data-page]").forEach((item) => item.addEventListener("click", hideSidebar));

    $("#themeToggle")?.addEventListener("change", (event) => {
      applyTheme(event.target.checked ? "dark" : "light", true);
      toast(event.target.checked ? "Dark mode enabled." : "Light mode enabled.", "◐");
    });

    $("#balanceToggle")?.addEventListener("click", () => {
      state.balanceHidden = !state.balanceHidden;
      updateBalances();
      toast(state.balanceHidden ? "Account balances hidden." : "Account balances visible.", "◉");
    });

    $("#dateFilterButton")?.addEventListener("click", () => openModal("dateModal"));
    $("#accountFilterButton")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#accountDropdown").hidden = !$("#accountDropdown").hidden;
      $("#profileDropdown").hidden = true;
    });
    $$("#accountDropdown button").forEach((button) => button.addEventListener("click", () => {
      setText("#accountFilterText", button.textContent);
      $("#accountDropdown").hidden = true;
      toast("All account data selected. Multi-account support is not in the backend yet.", "✓");
    }));

    $("#profileMenuButton")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#profileDropdown").hidden = !$("#profileDropdown").hidden;
      $("#accountDropdown").hidden = true;
    });
    $$('[data-profile-action="profile"], [data-profile-action="settings"]').forEach((button) => button.addEventListener("click", () => { window.location.href = "settings.html"; }));
    document.addEventListener("click", () => {
      if ($("#accountDropdown")) $("#accountDropdown").hidden = true;
      if ($("#profileDropdown")) $("#profileDropdown").hidden = true;
    });

    $("#notificationButton")?.addEventListener("click", () => {
      if (!state.alerts.length) {
        openInfo("Security Notifications", '<div class="info-card-list"><div>No recent security alerts.</div><div><a href="settings.html">Open Security Settings →</a></div></div>');
        return;
      }
      const html = state.alerts.map((alert) => `<div><strong>${escapeHtml(alert.title || "Security alert")}</strong><br><span>${escapeHtml(alert.message || "")}</span></div>`).join("");
      openInfo("Security Notifications", `<div class="info-card-list">${html}<div><a href="settings.html">Review all security alerts →</a></div></div>`);
    });

    $("#viewAllPairsButton")?.addEventListener("click", () => {
      const rows = pairRows();
      const body = rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.symbol)}</td><td>${row.total}</td><td>${row.winRate.toFixed(1)}%</td><td class="${row.netPnl >= 0 ? "profit" : "loss"}">${money(row.netPnl, true)}</td></tr>`).join("") : '<tr><td colspan="4">No pair data yet.</td></tr>';
      openInfo("All Trading Pairs", `<table><thead><tr><th>Pair</th><th>Trades</th><th>Win %</th><th>Net Profit</th></tr></thead><tbody>${body}</tbody></table>`);
    });

    $("#importTradesButton")?.addEventListener("click", () => $("#importFile")?.click());
    $("#importFile")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importTrades(file);
      } catch (error) {
        console.error(error);
        toast(`Import failed: ${error.message}`, "!");
      } finally {
        event.target.value = "";
      }
    });

    $$('[data-close-modal]').forEach((element) => element.addEventListener("click", () => closeModal("tradeModal")));
    $$('[data-close-date]').forEach((element) => element.addEventListener("click", () => closeModal("dateModal")));
    $$('[data-close-info]').forEach((element) => element.addEventListener("click", () => closeModal("infoModal")));
    $("#openTradeModal")?.addEventListener("click", () => {
      const dateInput = $('#tradeForm input[name="tradeDate"]');
      if (dateInput && !dateInput.value) dateInput.value = localDateKey(new Date());
      openModal("tradeModal");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") ["tradeModal", "dateModal", "infoModal"].forEach(closeModal);
    });

    $("#dateForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const startRaw = $("#startDate")?.value;
      const endRaw = $("#endDate")?.value;
      if (!startRaw && !endRaw) {
        state.startDate = null;
        state.endDate = null;
        setText("#dateRangeText", "All trading history");
        closeModal("dateModal");
        applyDateFilter();
        return;
      }
      if (!startRaw || !endRaw) return toast("Select both start and end dates.", "!");
      const start = new Date(`${startRaw}T00:00:00`);
      const end = new Date(`${endRaw}T00:00:00`);
      if (start > end) return toast("Start date must be before the end date.", "!");
      state.startDate = start;
      state.endDate = end;
      const format = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      setText("#dateRangeText", `${format.format(start)} – ${format.format(end)}`);
      closeModal("dateModal");
      applyDateFilter();
      toast("Dashboard date range updated.", "▣");
    });
    $("#clearDateRange")?.addEventListener("click", () => {
      state.startDate = null;
      state.endDate = null;
      if ($("#startDate")) $("#startDate").value = "";
      if ($("#endDate")) $("#endDate").value = "";
      setText("#dateRangeText", "All trading history");
      closeModal("dateModal");
      applyDateFilter();
      toast("Showing all trading history.", "▣");
    });

    $("#rangeTabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-range]");
      if (!button) return;
      state.activeRange = button.dataset.range;
      $$("#rangeTabs button").forEach((item) => item.classList.toggle("active", item === button));
      drawEquityChart();
      toast(`${state.activeRange} chart range selected.`, "⌁");
    });

    $("#prevMonth")?.addEventListener("click", () => {
      state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1);
      renderCalendar();
    });
    $("#nextMonth")?.addEventListener("click", () => {
      state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1);
      renderCalendar();
    });

    $("#tradeForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form));
      const payload = normalizeTrade(data);
      if (!validImportedTrade(payload)) return toast("Symbol, date, direction and entry price are required.", "!");
      submit.disabled = true;
      const oldLabel = submit.textContent;
      submit.textContent = "Saving…";
      try {
        const body = await apiJson(TRADES_API, { method: "POST", body: JSON.stringify(payload) });
        state.trades.unshift(body.data);
        applyDateFilter();
        closeModal("tradeModal");
        form.reset();
        const quantity = form.querySelector('[name="quantity"]');
        if (quantity) quantity.value = "1";
        toast("Trade saved to MongoDB successfully.", "✓");
      } catch (error) {
        console.error(error);
        toast(`Trade save failed: ${error.message}`, "!");
      } finally {
        submit.disabled = false;
        submit.textContent = oldLabel;
      }
    });

    if (window.matchMedia("(pointer: fine)").matches) {
      $$(".tilt").forEach((card) => {
        card.addEventListener("mousemove", (event) => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${-y * 1.4}deg) rotateY(${x * 1.4}deg) translateY(-1px)`;
        });
        card.addEventListener("mouseleave", () => { card.style.transform = ""; });
      });
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawCharts, 120);
    });
  };

  const init = async () => {
    bindEvents();
    applyTheme(state.theme);
    renderCalendar();
    drawCharts();
    await loadDashboard();
  };

  init();
})();
