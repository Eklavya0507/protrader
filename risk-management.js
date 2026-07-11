(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = window.ProTradeAuth?.API_BASE || "https://protrader-backend-n8oj.onrender.com/api";
  const ENDPOINTS = {
    trades: `${API_BASE}/trades`,
    settings: `${API_BASE}/settings`,
    alertSummary: `${API_BASE}/security/alerts/summary`,
  };

  const OPEN_EXPOSURE_REFERENCE = 5;
  const DRAWDOWN_REFERENCE = 15;

  const state = {
    trades: [],
    settings: {},
    alertSummary: null,
    balanceHidden: false,
    rangeDays: 30,
    metrics: null,
  };

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const optionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value)));
  const percent = (value, digits = 1) => `${number(value).toFixed(digits)}%`;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const currencyCode = () => state.settings.currency || "USD";
  const money = (value, signed = false) => {
    const amount = number(value);
    let formatted;
    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode(),
        minimumFractionDigits: currencyCode() === "JPY" ? 0 : 2,
        maximumFractionDigits: currencyCode() === "JPY" ? 0 : 2,
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

  const setStatus = (message, stateName = "loading") => {
    const node = $("#riskStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = stateName;
  };

  const parseTradeDate = (trade) => {
    const raw = trade?.tradeDate || trade?.createdAt;
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  };

  const localDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const resultOf = (trade) => {
    const raw = String(trade?.result || "").toLowerCase();
    if (["win", "loss", "breakeven", "open"].includes(raw)) return raw;
    const pnl = number(trade?.profitLoss);
    return pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  };

  const estimatedRiskAmount = (trade) => {
    const pnl = Math.abs(number(trade?.profitLoss));
    const rr = Math.abs(number(trade?.rr));
    if (pnl > 0 && rr > 0.01 && resultOf(trade) !== "open") return pnl / rr;

    const entry = optionalNumber(trade?.entryPrice);
    const stop = optionalNumber(trade?.stopLoss);
    const quantity = Math.abs(number(trade?.quantity, 1));
    if (entry !== undefined && stop !== undefined && quantity > 0) {
      return Math.abs(entry - stop) * quantity + Math.abs(number(trade?.commission));
    }
    return 0;
  };

  const dateFilteredTrades = () => {
    if (!state.rangeDays) return [...state.trades];
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (state.rangeDays - 1));
    return state.trades.filter((trade) => {
      const date = parseTradeDate(trade);
      return date && date >= cutoff;
    });
  };

  const buildEquityAndDrawdown = (trades, startingBalance) => {
    const ordered = [...trades]
      .filter((trade) => resultOf(trade) !== "open")
      .sort((a, b) => (parseTradeDate(a)?.getTime() || 0) - (parseTradeDate(b)?.getTime() || 0));

    let equity = Math.max(0, number(startingBalance));
    let peak = Math.max(equity, 0.000001);
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    const points = [];

    for (const trade of ordered) {
      equity += number(trade.profitLoss);
      peak = Math.max(peak, equity);
      currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      points.push({
        date: parseTradeDate(trade),
        equity,
        drawdown: currentDrawdown,
      });
    }

    return { equity, maxDrawdown, currentDrawdown, points };
  };

  const calculateMetrics = () => {
    const trades = dateFilteredTrades();
    const allTrades = state.trades;
    const settings = state.settings;
    const startingBalance = Math.max(0, number(settings.startingBalance, 0));
    const equityData = buildEquityAndDrawdown(allTrades, startingBalance);
    const equity = equityData.equity;
    const safeEquity = Math.max(equity, startingBalance, 1);
    const todayKey = localDateKey(new Date());
    const todayTrades = allTrades.filter((trade) => localDateKey(parseTradeDate(trade)) === todayKey);
    const openTrades = allTrades.filter((trade) => resultOf(trade) === "open");

    const dailyRiskAmount = todayTrades.reduce((sum, trade) => sum + estimatedRiskAmount(trade), 0);
    const openRiskAmount = openTrades.reduce((sum, trade) => sum + estimatedRiskAmount(trade), 0);
    const dailyRiskPercent = (dailyRiskAmount / safeEquity) * 100;
    const openExposurePercent = (openRiskAmount / safeEquity) * 100;
    const dailyLimitPercent = Math.max(0.01, number(settings.maxDailyLoss, 3));
    const dailyLimitAmount = safeEquity * dailyLimitPercent / 100;
    const dailyRemainingAmount = Math.max(0, dailyLimitAmount - dailyRiskAmount);
    const riskPerTradeLimit = Math.max(0.01, number(settings.riskPerTrade, 1));
    const maxTradesToday = Math.max(1, number(settings.maxTradesPerDay, 3));

    const withStop = allTrades.filter((trade) => optionalNumber(trade.stopLoss) !== undefined).length;
    const withoutStop = Math.max(0, allTrades.length - withStop);
    const stopCompliance = allTrades.length ? (withStop / allTrades.length) * 100 : 0;

    const tradeRisks = trades.map((trade) => ({
      trade,
      amount: estimatedRiskAmount(trade),
      percent: (estimatedRiskAmount(trade) / safeEquity) * 100,
    }));
    const maxSingleRiskPercent = tradeRisks.reduce((max, item) => Math.max(max, item.percent), 0);
    const riskBreaches = tradeRisks.filter((item) => item.percent > riskPerTradeLimit + 0.001).length;

    const positionSizingScore = clamp(100 - (riskBreaches / Math.max(1, trades.length)) * 100, 0, 100);
    const exposureScore = clamp(100 - (openExposurePercent / OPEN_EXPOSURE_REFERENCE) * 45, 0, 100);
    const drawdownScore = clamp(100 - (equityData.maxDrawdown / DRAWDOWN_REFERENCE) * 55, 0, 100);
    const consistencyScore = clamp(
      (stopCompliance * 0.55) +
      (todayTrades.length <= maxTradesToday ? 30 : Math.max(0, 30 - (todayTrades.length - maxTradesToday) * 10)) +
      (dailyRiskPercent <= dailyLimitPercent ? 15 : 0),
      0,
      100
    );

    let score = Math.round(
      positionSizingScore * 0.28 +
      exposureScore * 0.24 +
      drawdownScore * 0.24 +
      consistencyScore * 0.24
    );
    if (!allTrades.length) score = 100;

    return {
      trades,
      allTrades,
      startingBalance,
      equity,
      safeEquity,
      dailyRiskAmount,
      dailyRiskPercent,
      dailyLimitPercent,
      dailyLimitAmount,
      dailyRemainingAmount,
      openTrades,
      openRiskAmount,
      openExposurePercent,
      maxDrawdown: equityData.maxDrawdown,
      currentDrawdown: equityData.currentDrawdown,
      drawdownPoints: equityData.points,
      withStop,
      withoutStop,
      stopCompliance,
      riskPerTradeLimit,
      maxTradesToday,
      maxSingleRiskPercent,
      riskBreaches,
      todayTradesCount: todayTrades.length,
      positionSizingScore,
      exposureScore,
      drawdownScore,
      consistencyScore,
      score,
      tradeRisks,
    };
  };

  const scoreLabel = (score) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 55) return "Moderate";
    return "Needs Attention";
  };

  const riskLevel = (score) => {
    if (score >= 80) return { overall: "Good", status: "Under Control" };
    if (score >= 60) return { overall: "Moderate", status: "Watch Closely" };
    return { overall: "High Risk", status: "Action Required" };
  };

  const setRing = (selector, percentage) => {
    const node = $(selector);
    if (node) node.style.setProperty("--ring-value", `${clamp(percentage, 0, 100) * 3.6}deg`);
  };

  const renderShell = () => {
    const metrics = state.metrics;
    const settings = state.settings;
    setText("#profileRole", settings.tradingRole || "Independent Trader");
    setText("#sidebarBalance", state.balanceHidden ? "••••••" : money(metrics.equity));
    setText("#sidebarEquity", state.balanceHidden ? "••••••" : money(metrics.equity));
    setText("#notificationCount", number(state.alertSummary?.unread));

    const accountInput = $("#calcAccountSize");
    if (accountInput && document.activeElement !== accountInput) accountInput.value = metrics.safeEquity.toFixed(2);
    const riskInput = $("#calcRiskPercent");
    if (riskInput && document.activeElement !== riskInput) riskInput.value = metrics.riskPerTradeLimit.toFixed(2);
  };

  const renderTopCards = () => {
    const m = state.metrics;
    setText("#riskScoreValue", `${m.score}/100`);
    setText("#riskScoreLabel", scoreLabel(m.score));
    setText("#dailyRiskValue", percent(m.dailyRiskPercent));
    setText("#dailyRiskLimitText", `of ${percent(m.dailyLimitPercent)} limit`);
    $("#dailyRiskBar").style.width = `${clamp((m.dailyRiskPercent / m.dailyLimitPercent) * 100, 0, 100)}%`;
    setText("#openExposureValue", percent(m.openExposurePercent));
    setText("#openExposureLabel", `${m.openTrades.length} open trade${m.openTrades.length === 1 ? "" : "s"}`);
    $("#openExposureBar").style.width = `${clamp((m.openExposurePercent / OPEN_EXPOSURE_REFERENCE) * 100, 0, 100)}%`;
    setText("#drawdownValue", percent(m.maxDrawdown));
    setText("#drawdownLabel", m.maxDrawdown <= DRAWDOWN_REFERENCE ? "Controlled" : "Above reference");
    $("#drawdownBar").style.width = `${clamp((m.maxDrawdown / DRAWDOWN_REFERENCE) * 100, 0, 100)}%`;
  };

  const renderBudget = () => {
    const m = state.metrics;
    const usedPercent = clamp((m.dailyRiskAmount / Math.max(m.dailyLimitAmount, 0.000001)) * 100, 0, 100);
    setRing("#dailyRiskRing", usedPercent);
    setText("#dailyRiskRingValue", percent(m.dailyRiskPercent));
    setText("#dailyLimitValue", percent(m.dailyLimitPercent));
    setText("#dailyRemainingValue", money(m.dailyRemainingAmount));
  };

  const renderPositionCalculator = () => {
    const account = Math.max(0, number($("#calcAccountSize")?.value, state.metrics?.safeEquity || 0));
    const riskPercent = Math.max(0, number($("#calcRiskPercent")?.value, state.metrics?.riskPerTradeLimit || 0));
    const entry = number($("#calcEntry")?.value);
    const stop = number($("#calcStop")?.value);
    const riskAmount = account * riskPercent / 100;
    const priceRisk = Math.abs(entry - stop);
    const quantity = priceRisk > 0 ? riskAmount / priceRisk : 0;
    setText("#calcRiskAmount", money(riskAmount));
    setText("#calcPositionSize", quantity > 0 ? quantity.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—");
    setText("#calcPriceRisk", priceRisk > 0 ? priceRisk.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—");
  };

  const renderScore = () => {
    const m = state.metrics;
    setRing("#riskScoreRing", m.score);
    setText("#riskScoreRingValue", m.score);
    const rows = [
      ["Position Sizing", m.positionSizingScore],
      ["Risk Exposure", m.exposureScore],
      ["Drawdown", m.drawdownScore],
      ["Consistency", m.consistencyScore],
    ];
    $("#riskBreakdown").innerHTML = rows.map(([label, value]) => `
      <div class="risk-breakdown-item">
        <span>${escapeHtml(label)}</span>
        <div class="risk-breakdown-track"><i style="width:${clamp(value, 0, 100)}%"></i></div>
        <strong>${Math.round(value)}%</strong>
      </div>`).join("");
  };

  const renderAi = () => {
    const m = state.metrics;
    const level = riskLevel(m.score);
    let suggestion = "Keep recording stop-loss and position-size data for every trade.";
    let focus = "Consistency";

    if (m.dailyRiskPercent > m.dailyLimitPercent) {
      suggestion = "Daily estimated risk is above your configured daily limit. Pause new exposure and review today's trades.";
      focus = "Daily Risk Control";
    } else if (m.openExposurePercent > OPEN_EXPOSURE_REFERENCE) {
      suggestion = "Open exposure is above the 5% journal reference. Reduce or hedge open position risk.";
      focus = "Open Exposure";
    } else if (m.stopCompliance < 80 && m.allTrades.length) {
      suggestion = "Improve stop-loss documentation. Several trades do not contain a recorded stop-loss.";
      focus = "Stop-Loss Discipline";
    } else if (m.maxDrawdown > DRAWDOWN_REFERENCE * 0.7) {
      suggestion = "Drawdown is approaching the 15% reference level. Consider reducing risk per trade.";
      focus = "Drawdown Control";
    } else if (m.todayTradesCount > m.maxTradesToday) {
      suggestion = "Today's trade count is above your configured maximum. Avoid overtrading.";
      focus = "Trade Frequency";
    }

    setText("#aiOverall", level.overall);
    setText("#aiRiskStatus", level.status);
    setText("#aiSummary", m.allTrades.length
      ? `Your risk score is ${m.score}/100 based on recorded trades, stop-loss usage, exposure, drawdown and saved risk settings.`
      : "No trades are recorded yet. Your score starts at 100 until journal risk data is available.");
    setText("#aiSuggestion", suggestion);
    setText("#aiFocus", focus);
  };

  const renderLimits = () => {
    const m = state.metrics;
    const rows = [
      ["Daily Loss Limit", m.dailyRiskPercent, m.dailyLimitPercent, percent(m.dailyLimitPercent)],
      ["Single Trade Limit", m.maxSingleRiskPercent, m.riskPerTradeLimit, percent(m.riskPerTradeLimit)],
      ["Max Trades / Day", m.todayTradesCount, m.maxTradesToday, String(m.maxTradesToday)],
      ["Default R Target", number(state.settings.defaultRR, 2), number(state.settings.defaultRR, 2), `${number(state.settings.defaultRR, 2).toFixed(1)}R`],
    ];
    $("#riskLimitsList").innerHTML = rows.map(([label, current, limit, display], index) => {
      const usage = index === 3 ? 100 : clamp((number(current) / Math.max(number(limit), 0.000001)) * 100, 0, 100);
      return `<div class="limit-row"><span>${escapeHtml(label)}</span><div class="limit-track"><i style="width:${usage}%"></i></div><strong>${escapeHtml(display)}</strong></div>`;
    }).join("");
  };

  const renderOpenRisk = () => {
    const m = state.metrics;
    const largest = m.openTrades.reduce((max, trade) => Math.max(max, estimatedRiskAmount(trade)), 0);
    const average = m.openTrades.length ? m.openRiskAmount / m.openTrades.length : 0;
    $("#openRiskList").innerHTML = [
      ["Total Open Risk", `${money(m.openRiskAmount)} (${percent(m.openExposurePercent)})`],
      ["Largest Position Risk", money(largest)],
      ["Average Position Risk", money(average)],
      ["Active Positions", String(m.openTrades.length)],
    ].map(([label, value]) => `<p><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>`).join("");
  };

  const renderStopLoss = () => {
    const m = state.metrics;
    setRing("#stopRing", m.stopCompliance);
    setText("#stopComplianceValue", percent(m.stopCompliance, 0));
    setText("#withStopCount", m.withStop);
    setText("#withoutStopCount", m.withoutStop);
    setText("#stopTotalCount", m.allTrades.length);
    setText("#stopMessage", m.stopCompliance >= 90
      ? "Keep it up! High compliance protects your capital."
      : m.stopCompliance >= 70
        ? "Good progress. Record a stop-loss on every trade."
        : "Stop-loss compliance needs attention.");
  };

  const renderHeatmap = () => {
    const m = state.metrics;
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const buckets = Array.from({ length: 7 }, () => Array(12).fill(0));
    let maxValue = 0;

    for (const item of m.tradeRisks) {
      const date = parseTradeDate(item.trade);
      if (!date) continue;
      const jsDay = date.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      const entryTime = String(item.trade.entryTime || "");
      const hour = /^\d{2}:\d{2}/.test(entryTime) ? Number(entryTime.slice(0, 2)) : date.getHours();
      const bucket = clamp(Math.floor(hour / 2), 0, 11);
      buckets[dayIndex][bucket] += item.percent;
      maxValue = Math.max(maxValue, buckets[dayIndex][bucket]);
    }

    let html = "";
    days.forEach((day, dayIndex) => {
      html += `<span class="heat-label">${day}</span>`;
      buckets[dayIndex].forEach((value) => {
        const ratio = maxValue > 0 ? value / maxValue : 0;
        const level = ratio >= .8 ? 4 : ratio >= .55 ? 3 : ratio >= .25 ? 2 : ratio > 0 ? 1 : 0;
        html += `<span class="heat-cell" data-level="${level}" title="Estimated risk ${percent(value, 2)}"></span>`;
      });
    });
    $("#riskHeatmap").innerHTML = html;
  };

  const canvasSize = (canvas) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  };

  const chartColors = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    return {
      grid: dark ? "rgba(148,177,210,.12)" : "rgba(92,118,143,.15)",
      text: dark ? "#9badc2" : "#617387",
      red: "#ff5045",
      purple: "#9664ff",
      green: "#2cc963",
    };
  };

  const drawLineChart = () => {
    const canvas = $("#drawdownCanvas");
    if (!canvas) return;
    const { ctx, width, height } = canvasSize(canvas);
    const colors = chartColors();
    ctx.clearRect(0, 0, width, height);
    const pad = { l: 35, r: 10, t: 12, b: 24 };
    const chartW = Math.max(1, width - pad.l - pad.r);
    const chartH = Math.max(1, height - pad.t - pad.b);

    [0, .25, .5, .75, 1].forEach((ratio) => {
      const y = pad.t + chartH * ratio;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(width - pad.r, y);
      ctx.stroke();
    });

    const points = state.metrics.drawdownPoints;
    const values = points.length ? points.map((point) => -point.drawdown) : [0, 0];
    const min = Math.min(-1, ...values);
    const max = 0;
    const xFor = (index) => pad.l + chartW * (values.length <= 1 ? .5 : index / (values.length - 1));
    const yFor = (value) => pad.t + ((max - value) / Math.max(1, max - min)) * chartH;

    ctx.fillStyle = colors.text;
    ctx.font = "8px Inter, sans-serif";
    ctx.textAlign = "right";
    [0, .25, .5, .75, 1].forEach((ratio) => {
      const value = max - (max - min) * ratio;
      ctx.fillText(`${value.toFixed(0)}%`, pad.l - 5, pad.t + chartH * ratio + 3);
    });

    const gradient = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
    gradient.addColorStop(0, "rgba(255,80,69,.32)");
    gradient.addColorStop(1, "rgba(255,80,69,.02)");

    ctx.beginPath();
    values.forEach((value, index) => {
      const x = xFor(index);
      const y = yFor(value);
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(values.length - 1), pad.t + chartH);
    ctx.lineTo(xFor(0), pad.t + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    values.forEach((value, index) => {
      const x = xFor(index);
      const y = yFor(value);
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colors.red;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = colors.text;
    const labels = points.length ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
    [...new Set(labels)].forEach((index) => {
      const date = points[index]?.date;
      const label = date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No data";
      ctx.fillText(label, xFor(index), height - 6);
    });
  };

  const drawScatter = () => {
    const canvas = $("#riskScatterCanvas");
    if (!canvas) return;
    const { ctx, width, height } = canvasSize(canvas);
    const colors = chartColors();
    ctx.clearRect(0, 0, width, height);
    const pad = { l: 34, r: 10, t: 12, b: 27 };
    const chartW = Math.max(1, width - pad.l - pad.r);
    const chartH = Math.max(1, height - pad.t - pad.b);
    const data = state.metrics.tradeRisks
      .filter((item) => item.percent > 0)
      .map((item) => ({ x: item.percent, y: (number(item.trade.profitLoss) / state.metrics.safeEquity) * 100 }));
    const xMax = Math.max(1, ...data.map((p) => p.x)) * 1.1;
    const yAbs = Math.max(1, ...data.map((p) => Math.abs(p.y))) * 1.15;
    const xFor = (value) => pad.l + (value / xMax) * chartW;
    const yFor = (value) => pad.t + ((yAbs - value) / (2 * yAbs)) * chartH;

    [0, .25, .5, .75, 1].forEach((ratio) => {
      const x = pad.l + chartW * ratio;
      const y = pad.t + chartH * ratio;
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + chartH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + chartW, y); ctx.stroke();
    });

    ctx.fillStyle = colors.text;
    ctx.font = "8px Inter, sans-serif";
    ctx.textAlign = "center";
    [0, .5, 1].forEach((ratio) => ctx.fillText(`${(xMax * ratio).toFixed(1)}%`, pad.l + chartW * ratio, height - 8));
    ctx.save();
    ctx.translate(9, pad.t + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("P&L (% equity)", 0, 0);
    ctx.restore();
    ctx.fillText("Estimated Risk (%)", pad.l + chartW / 2, height - 1);

    if (data.length >= 2) {
      const meanX = data.reduce((s, p) => s + p.x, 0) / data.length;
      const meanY = data.reduce((s, p) => s + p.y, 0) / data.length;
      const numerator = data.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
      const denominator = data.reduce((s, p) => s + (p.x - meanX) ** 2, 0) || 1;
      const slope = numerator / denominator;
      const intercept = meanY - slope * meanX;
      ctx.beginPath();
      ctx.moveTo(xFor(0), yFor(intercept));
      ctx.lineTo(xFor(xMax), yFor(slope * xMax + intercept));
      ctx.strokeStyle = colors.purple;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    data.forEach((point) => {
      ctx.beginPath();
      ctx.arc(xFor(point.x), yFor(clamp(point.y, -yAbs, yAbs)), 2.4, 0, Math.PI * 2);
      ctx.fillStyle = colors.purple;
      ctx.fill();
    });
  };

  const renderFooter = () => {
    const m = state.metrics;
    setText("#footerTotalTrades", m.allTrades.length);
    setText("#footerOpenTrades", m.openTrades.length);
    setText("#footerStopCompliance", percent(m.stopCompliance, 0));
    setText("#footerDrawdown", percent(m.currentDrawdown));
  };

  const renderAll = () => {
    state.metrics = calculateMetrics();
    renderShell();
    renderTopCards();
    renderBudget();
    renderPositionCalculator();
    renderScore();
    renderAi();
    renderLimits();
    renderOpenRisk();
    renderStopLoss();
    renderHeatmap();
    renderFooter();
    requestAnimationFrame(() => {
      drawLineChart();
      drawScatter();
    });
  };

  const apiJson = async (url, options = {}) => {
    const headers = new Headers(options.headers || undefined);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await window.fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    return body;
  };

  const toast = (title, message = "") => {
    const stack = $("#toastStack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    stack.appendChild(node);
    window.setTimeout(() => node.remove(), 3500);
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

  const showInfo = (title, text) => {
    setText("#infoTitle", title);
    setText("#infoSubtitle", "How this widget is calculated");
    $("#infoBody").innerHTML = `<p>${escapeHtml(text)}</p>`;
    openModal("infoModal");
  };

  const applyTheme = async (theme, save = false) => {
    const normalized = ["Dark", "Light", "System"].includes(theme) ? theme : "Dark";
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const dark = normalized === "Dark" || (normalized === "System" && systemDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    setText("#themeLabel", normalized === "System" ? `System - ${dark ? "Dark" : "Light"}` : `${normalized} Mode`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#06111f" : "#f5f9fc");
    if (save) {
      try {
        const body = await apiJson(ENDPOINTS.settings, { method: "PUT", body: JSON.stringify({ theme: normalized }) });
        state.settings = body.data || state.settings;
      } catch (error) {
        toast("Theme not saved", error.message);
      }
    }
    requestAnimationFrame(() => { drawLineChart(); drawScatter(); });
  };

  const loadData = async () => {
    setStatus("Connecting to ProTrade backend…");
    try {
      await window.ProTradeAuth?.ready;
      const [tradesBody, settingsBody, alertBody] = await Promise.all([
        apiJson(ENDPOINTS.trades),
        apiJson(ENDPOINTS.settings),
        apiJson(ENDPOINTS.alertSummary).catch(() => ({ data: { unread: 0 } })),
      ]);
      state.trades = Array.isArray(tradesBody.data) ? tradesBody.data : [];
      state.settings = settingsBody.data || {};
      state.alertSummary = alertBody.data || alertBody || { unread: 0 };
      await applyTheme(state.settings.theme || "Dark", false);
      renderAll();
      setStatus(`${state.trades.length} trades synced from MongoDB.`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not load risk data.", "error");
      toast("Risk data unavailable", error.message || "Please retry after the backend wakes up.");
    }
  };

  const payloadFromForm = (form) => {
    const data = new FormData(form);
    const entryPrice = optionalNumber(data.get("entryPrice"));
    return {
      tradeDate: data.get("tradeDate"),
      symbol: String(data.get("symbol") || "").trim().toUpperCase(),
      direction: data.get("direction") || "Long",
      session: data.get("session") || "Other",
      model: String(data.get("model") || "").trim(),
      protocol: String(data.get("protocol") || "").trim(),
      entryTime: String(data.get("entryTime") || ""),
      exitTime: String(data.get("exitTime") || ""),
      entryPrice,
      exitPrice: optionalNumber(data.get("exitPrice")),
      stopLoss: optionalNumber(data.get("stopLoss")),
      takeProfit: optionalNumber(data.get("takeProfit")),
      quantity: optionalNumber(data.get("quantity")) ?? 1,
      commission: optionalNumber(data.get("commission")) ?? 0,
      profitLoss: optionalNumber(data.get("profitLoss")) ?? 0,
      rr: optionalNumber(data.get("rr")) ?? 0,
      result: data.get("result") || "Open",
      rating: optionalNumber(data.get("rating")),
      notes: String(data.get("notes") || ""),
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
    return lines.slice(1).map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
  };

  const normalizeImportTrade = (raw) => {
    const pnl = optionalNumber(raw.profitLoss ?? raw.pnl ?? raw["Net P&L"] ?? raw["P&L"]);
    const sessionRaw = String(raw.session || "Other").toLowerCase();
    const session = sessionRaw.includes("london") ? "London" : sessionRaw.includes("new york") || sessionRaw === "ny" ? "New York" : sessionRaw.includes("asia") || sessionRaw.includes("tokyo") ? "Asian" : "Other";
    const directionRaw = String(raw.direction || raw.side || "Long").toLowerCase();
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
    };
  };

  const importTrades = async (file) => {
    const text = await file.text();
    let rows;
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    } else {
      rows = parseCsv(text);
    }
    const valid = rows.slice(0, 100).map(normalizeImportTrade).filter((trade) => trade.tradeDate && trade.symbol && trade.entryPrice !== undefined);
    if (!valid.length) throw new Error("No valid rows found. Required: date, symbol and entry price.");
    let saved = 0;
    for (const trade of valid) {
      await apiJson(ENDPOINTS.trades, { method: "POST", body: JSON.stringify(trade) });
      saved += 1;
    }
    toast("Import complete", `${saved} trades saved to MongoDB.`);
    await loadData();
  };

  const updateResetTimer = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const ms = Math.max(0, midnight - now);
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    setText("#riskResetTimer", `Resets in ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
  };

  const setupEvents = () => {
    $$(".nav-item[data-route]").forEach((button) => button.addEventListener("click", () => { window.location.href = button.dataset.route; }));
    $("#mobileMenuBtn")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));

    $("#profileBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#profilePopover").hidden = !$("#profilePopover").hidden;
      $("#accountPopover").hidden = true;
      $("#dateRangePopover").hidden = true;
    });
    $$('[data-profile-action]').forEach((button) => button.addEventListener("click", async () => {
      $("#profilePopover").hidden = true;
      if (button.dataset.profileAction === "logout") { await window.ProTradeAuth?.logout?.(); return; }
      window.location.href = "settings.html";
    }));

    $("#themeSwitch")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "Light" : "Dark", true));
    $("#balanceVisibilityBtn")?.addEventListener("click", () => { state.balanceHidden = !state.balanceHidden; renderShell(); });

    $("#dateRangeBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#dateRangePopover").hidden = !$("#dateRangePopover").hidden;
      $("#accountPopover").hidden = true;
      $("#profilePopover").hidden = true;
    });
    $$('[data-range-days]').forEach((button) => button.addEventListener("click", () => {
      state.rangeDays = number(button.dataset.rangeDays);
      setText("#dateRangeLabel", state.rangeDays ? `Last ${state.rangeDays} Days` : "All Time");
      $("#dateRangePopover").hidden = true;
      renderAll();
    }));

    $("#accountSelectorBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#accountPopover").hidden = !$("#accountPopover").hidden;
      $("#dateRangePopover").hidden = true;
      $("#profilePopover").hidden = true;
    });
    $$('[data-account]').forEach((button) => button.addEventListener("click", () => {
      $("#accountPopover").hidden = true;
      toast("All Accounts", "Current backend does not have separate trading-account records yet.");
    }));

    $("#notificationBtn")?.addEventListener("click", () => {
      showInfo("Security Alerts", `${number(state.alertSummary?.unread)} unread security alert(s). Open Settings → Security Alerts for full details.`);
    });

    $("#newTradeBtn")?.addEventListener("click", () => {
      $("#tradeDate").value = localDateKey(new Date());
      openModal("tradeModal");
    });
    $("#tradeForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const body = await apiJson(ENDPOINTS.trades, { method: "POST", body: JSON.stringify(payloadFromForm(event.currentTarget)) });
        state.trades.unshift(body.data);
        closeModal("tradeModal");
        event.currentTarget.reset();
        renderAll();
        toast("Trade saved", "Trade saved to MongoDB successfully.");
      } catch (error) {
        toast("Trade not saved", error.message);
      } finally {
        button.disabled = false;
      }
    });

    $("#importTradesBtn")?.addEventListener("click", () => $("#importTradesInput")?.click());
    $("#importTradesInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try { await importTrades(file); } catch (error) { toast("Import failed", error.message); }
    });

    ["#calcAccountSize", "#calcRiskPercent", "#calcEntry", "#calcStop"].forEach((selector) => $(selector)?.addEventListener("input", renderPositionCalculator));
    $$('[data-close]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    $$(".modal-backdrop").forEach((node) => node.addEventListener("click", (event) => { if (event.target === node) closeModal(node.id); }));
    $$('[data-info]').forEach((button) => button.addEventListener("click", () => {
      const info = {
        heatmap: "Uses recorded trade date, entry time and estimated risk percentage. Darker/red cells indicate higher estimated risk concentration.",
        drawdown: "Calculated from starting balance plus recorded closed-trade P&L. It does not use live broker equity.",
        scatter: "Compares estimated risk percentage with recorded P&L as a percentage of journal equity.",
      };
      showInfo(button.closest("article")?.querySelector("h3")?.textContent || "Risk metric", info[button.dataset.info] || "Calculated from journal data.");
    }));

    document.addEventListener("click", () => {
      if ($("#profilePopover")) $("#profilePopover").hidden = true;
      if ($("#accountPopover")) $("#accountPopover").hidden = true;
      if ($("#dateRangePopover")) $("#dateRangePopover").hidden = true;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      $$(".modal-backdrop:not([hidden])").forEach((node) => closeModal(node.id));
    });
    window.addEventListener("resize", () => { drawLineChart(); drawScatter(); });
  };

  const init = async () => {
    setupEvents();
    updateResetTimer();
    window.setInterval(updateResetTimer, 1000);
    await loadData();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
