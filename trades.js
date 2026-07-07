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

  const state = {
    trades: [],
    settings: {},
    selectedId: null,
    activeTab: "all",
    sortDescending: true,
    groupBy: "none",
    page: 1,
    pageSize: 10,
    balanceHidden: false,
    alertSummary: null,
    filters: {
      search: "",
      symbol: "",
      session: "",
      result: "",
      direction: "",
      dateFrom: "",
      dateTo: "",
      minPnl: "",
      maxPnl: "",
    },
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

  const setText = (selector, value) => {
    const node = typeof selector === "string" ? $(selector) : selector;
    if (node) node.textContent = value;
  };

  const setStatus = (message, stateName = "loading") => {
    const node = $("#tradesStatus");
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
    if (!response.ok || body.success === false) throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    return body;
  };

  const currency = () => state.settings.currency || "USD";

  const money = (value, signed = false) => {
    const amount = number(value);
    let formatted;
    try {
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency(),
        maximumFractionDigits: currency() === "JPY" ? 0 : 2,
      }).format(Math.abs(amount));
    } catch {
      formatted = `$${Math.abs(amount).toFixed(2)}`;
    }
    return signed ? `${amount >= 0 ? "+" : "-"}${formatted}` : formatted;
  };

  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—";
  };

  const formatDateInput = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatPrice = (value) => value === undefined || value === null || value === "" ? "—" : number(value).toLocaleString("en-US", { maximumFractionDigits: 8 });

  const displayTradeId = (trade) => {
    const year = new Date(trade.tradeDate || trade.createdAt || Date.now()).getFullYear();
    return `TRD-${year}-${String(trade._id || "NEW").slice(-6).toUpperCase()}`;
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
    const avgRR = list.length ? list.reduce((sum, trade) => sum + number(trade.rr), 0) / list.length : 0;
    return { total:list.length, wins, losses, breakeven, open, closed, net, grossProfit, grossLoss, profitFactor, winRate, avgRR };
  };

  const selectedTrade = () => state.trades.find((trade) => trade._id === state.selectedId) || null;

  const filteredTrades = () => {
    const f = state.filters;
    const search = f.search.trim().toLowerCase();
    const from = f.dateFrom ? new Date(`${f.dateFrom}T00:00:00`).getTime() : null;
    const to = f.dateTo ? new Date(`${f.dateTo}T23:59:59`).getTime() : null;
    const minPnl = f.minPnl === "" ? null : Number(f.minPnl);
    const maxPnl = f.maxPnl === "" ? null : Number(f.maxPnl);

    const list = state.trades.filter((trade) => {
      const result = String(trade.result || "Open");
      if (state.activeTab === "open" && result !== "Open") return false;
      if (state.activeTab === "closed" && result === "Open") return false;
      if (state.activeTab === "unreviewed" && (trade.rating || String(trade.notes || "").trim())) return false;

      if (search) {
        const haystack = [trade.symbol, trade.model, trade.protocol, trade.session, trade.direction, trade.notes, ...safeArray(trade.mistakeTags)].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (f.symbol && !String(trade.symbol || "").toLowerCase().includes(f.symbol.toLowerCase())) return false;
      if (f.session && trade.session !== f.session) return false;
      if (f.result && result !== f.result) return false;
      if (f.direction && trade.direction !== f.direction) return false;

      const time = new Date(trade.tradeDate || trade.createdAt).getTime();
      if (from && time < from) return false;
      if (to && time > to) return false;
      const pnl = number(trade.profitLoss);
      if (minPnl !== null && Number.isFinite(minPnl) && pnl < minPnl) return false;
      if (maxPnl !== null && Number.isFinite(maxPnl) && pnl > maxPnl) return false;
      return true;
    });

    list.sort((a, b) => {
      const av = new Date(a.tradeDate || a.createdAt).getTime();
      const bv = new Date(b.tradeDate || b.createdAt).getTime();
      return state.sortDescending ? bv - av : av - bv;
    });
    return list;
  };

  const updateProfile = () => {
    const user = window.ProTradeAuth?.getUser?.() || {};
    const name = state.settings.fullName || user.name || "Trader";
    const role = state.settings.tradingRole || "Independent Trader";
    $$(".auth-user-name").forEach((node) => { node.textContent = name; });
    setText("#profileRole", role);
  };

  const applyTheme = (theme, saveRemote = false) => {
    const normalized = String(theme || "").toLowerCase() === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = normalized;
    setText("#themeLabel", normalized === "dark" ? "Dark Mode" : "Light Mode");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", normalized === "dark" ? "#06111f" : "#f5f9fc");
    window.localStorage.setItem("protrade-theme", normalized);
    requestAnimationFrame(drawEquitySpark);
    if (saveRemote) {
      apiJson(ENDPOINTS.settings, { method:"PUT", body:JSON.stringify({ theme: normalized === "dark" ? "Dark" : "Light" }) })
        .catch((error) => toast("Theme not synced", error.message));
    }
  };

  const updateBalances = () => {
    const stats = calculateStats(state.trades);
    const total = number(state.settings.startingBalance) + stats.net;
    const shown = state.balanceHidden ? "••••••••" : money(total);
    setText("#sidebarBalance", shown);
    setText("#sidebarEquity", shown);
  };

  const renderMetrics = (trades) => {
    const stats = calculateStats(trades);
    setText("#metricTotalTrades", String(stats.total));
    setText("#metricWinRate", `${stats.winRate.toFixed(1)}%`);
    setText("#metricNetProfit", money(stats.net, true));
    const netNode = $("#metricNetProfit");
    netNode?.classList.toggle("positive", stats.net >= 0);
    netNode?.classList.toggle("negative", stats.net < 0);
    setText("#metricProfitFactor", Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞");
    setText("#metricAvgRR", `${stats.avgRR.toFixed(2)}R`);
    setText("#footerTotalTrades", String(stats.total));
    setText("#footerWins", `${stats.wins} (${stats.closed ? ((stats.wins / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerLosses", `${stats.losses} (${stats.closed ? ((stats.losses / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    setText("#footerBreakeven", `${stats.breakeven} (${stats.closed ? ((stats.breakeven / stats.closed) * 100).toFixed(1) : "0.0"}%)`);
    updateBalances();
  };

  const renderPagination = (total) => {
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, pages);
    const wrap = $("#pagination");
    if (!wrap) return;
    const values = new Set([1, pages, state.page, state.page - 1, state.page + 1]);
    const pageNumbers = [...values].filter((page) => page >= 1 && page <= pages).sort((a, b) => a - b);
    let previous = 0;
    const parts = [`<button type="button" data-page="prev" ${state.page <= 1 ? "disabled" : ""}>‹</button>`];
    for (const page of pageNumbers) {
      if (previous && page - previous > 1) parts.push("<span>…</span>");
      parts.push(`<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`);
      previous = page;
    }
    parts.push(`<button type="button" data-page="next" ${state.page >= pages ? "disabled" : ""}>›</button>`);
    wrap.innerHTML = parts.join("");
  };

  const ratingButtons = (trade) => {
    const rating = number(trade.rating);
    return `<div class="stars" data-id="${escapeHtml(trade._id)}">${[1,2,3,4,5].map((value) => `<button type="button" data-rating="${value}" aria-label="Set ${value} star rating">${value <= rating ? "★" : "☆"}</button>`).join("")}</div>`;
  };

  const renderTable = () => {
    const all = filteredTrades();
    renderMetrics(all);
    renderPagination(all.length);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = all.slice(start, start + state.pageSize);
    setText("#visibleFrom", all.length ? String(start + 1) : "0");
    setText("#visibleTo", String(Math.min(start + state.pageSize, all.length)));
    setText("#totalTradeCount", String(all.length));

    const tbody = $("#tradeBody");
    if (!tbody) return;
    if (!pageRows.length) {
      tbody.innerHTML = '<tr><td class="empty-row" colspan="12">No trades match the selected filters.</td></tr>';
      return;
    }

    const rows = [];
    let lastGroup = null;
    for (const trade of pageRows) {
      let groupValue = null;
      if (state.groupBy === "session") groupValue = trade.session || "Other";
      if (state.groupBy === "symbol") groupValue = trade.symbol || "Unknown";
      if (state.groupBy === "result") groupValue = trade.result || "Open";
      if (groupValue !== null && groupValue !== lastGroup) {
        rows.push(`<tr class="group-row"><td colspan="12">${escapeHtml(state.groupBy)}: ${escapeHtml(groupValue)}</td></tr>`);
        lastGroup = groupValue;
      }
      const pnl = number(trade.profitLoss);
      const result = trade.result || "Open";
      rows.push(`<tr data-id="${escapeHtml(trade._id)}" data-status="${result === "Open" ? "open" : "closed"}" class="${trade._id === state.selectedId ? "selected" : ""}">
        <td>${displayTradeId(trade)}</td>
        <td>${formatDate(trade.tradeDate)}</td>
        <td><span class="tag symbol">${escapeHtml(trade.symbol)}</span></td>
        <td><span class="tag ${String(trade.direction || "").toLowerCase()}">${escapeHtml(trade.direction || "—")}</span></td>
        <td>${escapeHtml(trade.model || "—")}</td>
        <td>${escapeHtml(trade.session || "Other")}</td>
        <td>${formatPrice(trade.entryPrice)}</td>
        <td>${formatPrice(trade.exitPrice)}</td>
        <td class="${pnl >= 0 ? "positive" : "negative"}">${money(pnl, true)}</td>
        <td class="${number(trade.rr) >= 0 ? "positive" : "negative"}">${number(trade.rr).toFixed(2)}R</td>
        <td class="${result === "Win" ? "positive" : result === "Loss" ? "negative" : ""}">${escapeHtml(result)}</td>
        <td>${ratingButtons(trade)}</td>
      </tr>`);
    }
    tbody.innerHTML = rows.join("");
  };

  const detailValueRows = (pairs) => pairs.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`).join("");

  const safeImageUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };

  const holdingTime = (trade) => {
    if (!trade.entryTime || !trade.exitTime) return "Not tracked";
    const [eh, em] = trade.entryTime.split(":").map(Number);
    const [xh, xm] = trade.exitTime.split(":").map(Number);
    if (![eh, em, xh, xm].every(Number.isFinite)) return "Not tracked";
    let minutes = xh * 60 + xm - (eh * 60 + em);
    if (minutes < 0) minutes += 24 * 60;
    return `${minutes} min`;
  };

  const renderDetails = () => {
    const trade = selectedTrade();
    const infoList = $("#tradeInfoList");
    const entryExit = $("#tradeEntryExit");
    const resultGrid = $("#tradeResultGrid");
    const riskList = $("#tradeRiskList");
    const screenshotGrid = $("#tradeScreenshotGrid");
    if (!trade) {
      if (infoList) infoList.innerHTML = '<div class="detail-empty">Select a trade to view details.</div>';
      if (entryExit) entryExit.innerHTML = '<div class="detail-empty">No trade selected.</div>';
      if (resultGrid) resultGrid.innerHTML = '<div class="detail-empty">No trade selected.</div>';
      if (riskList) riskList.innerHTML = '<div class="detail-empty">No trade selected.</div>';
      if (screenshotGrid) screenshotGrid.innerHTML = '<button id="addScreenshotBtn" class="add-screenshot" type="button">＋ Add Screenshot URL</button>';
      return;
    }

    const result = trade.result || "Open";
    if (infoList) infoList.innerHTML = detailValueRows([
      ["Trade ID", displayTradeId(trade)], ["Symbol", escapeHtml(trade.symbol)], ["Direction", escapeHtml(trade.direction)],
      ["Date", formatDate(trade.tradeDate)], ["Session", escapeHtml(trade.session || "Other")], ["Strategy", escapeHtml(trade.model || "—")],
      ["Protocol", escapeHtml(trade.protocol || "—")], ["Status", `<span class="status-badge">${escapeHtml(result)}</span>`],
      ["Time", escapeHtml(`${trade.entryTime || "—"} – ${trade.exitTime || "—"}`)], ["Account", "All Accounts"], ["Data Source", "MongoDB"],
    ]);

    if (entryExit) entryExit.innerHTML = `
      <strong>Entry</strong><p><span>• ${formatPrice(trade.entryPrice)} (${number(trade.quantity, 1).toFixed(2)})</span><b>${escapeHtml(trade.entryTime || "—")}</b></p>
      <strong>Exit</strong><p><span>• ${formatPrice(trade.exitPrice)}</span><b>${escapeHtml(trade.exitTime || "—")}</b></p>
      <strong>Notes</strong><p><span>${escapeHtml(trade.notes || "No notes recorded.")}</span></p>`;

    const pnl = number(trade.profitLoss);
    const startingBalance = number(state.settings.startingBalance);
    const pnlPercent = startingBalance ? pnl / startingBalance * 100 : 0;
    if (resultGrid) resultGrid.innerHTML = `
      <div><span>Net P&L</span><strong class="${pnl >= 0 ? "positive" : "negative"}">${money(pnl, true)}</strong></div>
      <div><span>R Multiple</span><strong>${number(trade.rr).toFixed(2)}R</strong></div>
      <div><span>P&L %</span><strong>${pnlPercent.toFixed(2)}%</strong></div>
      <div><span>Holding Time</span><strong>${escapeHtml(holdingTime(trade))}</strong></div>
      <div><span>Rating</span><strong>${trade.rating ? `${trade.rating}/5` : "Not reviewed"}</strong></div>
      <div><span>Commission</span><strong>${money(number(trade.commission))}</strong></div>`;

    const riskAmount = trade.stopLoss === undefined || trade.stopLoss === null ? null : Math.abs(number(trade.entryPrice) - number(trade.stopLoss)) * number(trade.quantity, 1);
    if (riskList) riskList.innerHTML = detailValueRows([
      ["Stop Loss", formatPrice(trade.stopLoss)], ["Take Profit", formatPrice(trade.takeProfit)],
      ["Risk Amount", riskAmount === null ? "Not tracked" : money(riskAmount)],
      ["Risk %", riskAmount === null || !startingBalance ? "Not tracked" : `${(riskAmount / startingBalance * 100).toFixed(2)}%`],
      ["Lot / Quantity", number(trade.quantity, 1).toFixed(2)], ["Rule Violation", "Not tracked in current schema"],
    ]);

    if (screenshotGrid) {
      const image = safeImageUrl(trade.screenshotUrl);
      screenshotGrid.innerHTML = `${image ? `<button class="trade-shot-card" type="button" data-open-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt="Trade screenshot" /></button>` : '<div class="detail-empty">No screenshot URL saved.</div>'}<button id="addScreenshotBtn" class="add-screenshot" type="button">＋ Add Screenshot URL</button>`;
    }
  };

  const drawEquitySpark = () => {
    const canvas = $("#equitySpark");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const ordered = [...state.trades].sort((a, b) => new Date(a.tradeDate || a.createdAt) - new Date(b.tradeDate || b.createdAt));
    let balance = number(state.settings.startingBalance);
    const values = [balance];
    for (const trade of ordered) { balance += number(trade.profitLoss); values.push(balance); }
    if (values.length === 1) values.push(balance);
    const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1; const pad = 3;
    const points = values.map((value, index) => [pad + index / (values.length - 1) * (rect.width - pad * 2), rect.height - pad - (value - min) / span * (rect.height - pad * 2)]);
    ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#20ad60";
    ctx.lineWidth = 1.7; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    ctx.lineTo(points.at(-1)[0], rect.height); ctx.lineTo(points[0][0], rect.height); ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height); gradient.addColorStop(0, "rgba(32,173,96,.20)"); gradient.addColorStop(1, "rgba(32,173,96,0)"); ctx.fillStyle = gradient; ctx.fill();
  };

  const renderAll = () => {
    renderTable();
    renderDetails();
    drawEquitySpark();
  };

  const loadData = async () => {
    setStatus("Loading protected ProTrade data…", "loading");
    try {
      await window.ProTradeAuth.ready;
      const [tradesBody, settingsBody, alertBody] = await Promise.all([
        apiJson(ENDPOINTS.trades),
        apiJson(ENDPOINTS.settings),
        apiJson(ENDPOINTS.alertSummary).catch(() => ({ data: { unread:0, latest:null } })),
      ]);
      state.trades = Array.isArray(tradesBody.data) ? tradesBody.data : [];
      state.settings = settingsBody.data || {};
      state.alertSummary = alertBody.data || { unread:0, latest:null };
      if (!state.selectedId || !state.trades.some((trade) => trade._id === state.selectedId)) state.selectedId = state.trades[0]?._id || null;
      updateProfile();
      applyTheme(state.settings.theme || window.localStorage.getItem("protrade-theme") || "Dark", false);
      setText("#notificationCount", number(state.alertSummary.unread) ? String(state.alertSummary.unread) : "");
      renderAll();
      setStatus(`${state.trades.length} trades synced from MongoDB.`, "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message, "error");
      toast("Trades could not load", error.message);
    }
  };

  const payloadFromForm = (form) => {
    const data = new FormData(form);
    const payload = {
      tradeDate: data.get("tradeDate"), symbol: String(data.get("symbol") || "").trim().toUpperCase(),
      direction: data.get("direction"), session: data.get("session") || "Other", model: String(data.get("model") || "").trim(),
      protocol: String(data.get("protocol") || "").trim(), entryTime: String(data.get("entryTime") || "").trim(), exitTime: String(data.get("exitTime") || "").trim(),
      entryPrice: optionalNumber(data.get("entryPrice")), exitPrice: optionalNumber(data.get("exitPrice")), stopLoss: optionalNumber(data.get("stopLoss")), takeProfit: optionalNumber(data.get("takeProfit")),
      quantity: optionalNumber(data.get("quantity")) ?? 1, commission: optionalNumber(data.get("commission")) ?? 0, profitLoss: optionalNumber(data.get("profitLoss")) ?? 0,
      rr: optionalNumber(data.get("rr")) ?? 0, result: data.get("result") || "Open", rating: optionalNumber(data.get("rating")),
      notes: String(data.get("notes") || "").trim(), screenshotUrl: String(data.get("screenshotUrl") || "").trim(),
    };
    for (const [key, value] of Object.entries(payload)) if (value === undefined || value === "") delete payload[key];
    return payload;
  };

  const fillEditForm = (trade) => {
    if (!trade) return;
    const values = {
      tradeDate: formatDateInput(trade.tradeDate), symbol: trade.symbol || "", direction: trade.direction || "Long", session: trade.session || "Other", model: trade.model || "", protocol: trade.protocol || "",
      entryTime: trade.entryTime || "", exitTime: trade.exitTime || "", entryPrice: trade.entryPrice ?? "", exitPrice: trade.exitPrice ?? "", stopLoss: trade.stopLoss ?? "", takeProfit: trade.takeProfit ?? "",
      quantity: trade.quantity ?? 1, commission: trade.commission ?? 0, profitLoss: trade.profitLoss ?? 0, rr: trade.rr ?? 0, result: trade.result || "Open", rating: trade.rating ?? "",
      screenshotUrl: trade.screenshotUrl || "", notes: trade.notes || "",
    };
    for (const [key, value] of Object.entries(values)) {
      const node = document.getElementById(`edit-${key}`);
      if (node) node.value = value;
    }
  };

  const downloadFile = (name, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

  const exportTradesCsv = (trades, name = "protrade-trades.csv") => {
    const fields = ["tradeDate","symbol","direction","session","model","protocol","entryTime","exitTime","entryPrice","exitPrice","stopLoss","takeProfit","quantity","commission","profitLoss","rr","result","rating","notes","screenshotUrl"];
    const csv = [fields.join(","), ...trades.map((trade) => fields.map((field) => csvEscape(trade[field])).join(","))].join("\n");
    downloadFile(name, csv, "text/csv;charset=utf-8");
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const parseLine = (line) => {
      const values = []; let value = ""; let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
        else value += char;
      }
      values.push(value.trim()); return values;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) => { const values = parseLine(line); return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])); });
  };

  const normalizeImportTrade = (raw) => {
    const pnl = optionalNumber(raw.profitLoss ?? raw.pnl ?? raw["Net P&L"] ?? raw["P&L"]);
    const sessionRaw = String(raw.session || "Other").toLowerCase();
    const session = sessionRaw.includes("london") ? "London" : sessionRaw.includes("new york") || sessionRaw === "ny" ? "New York" : sessionRaw.includes("asia") || sessionRaw.includes("tokyo") ? "Asian" : "Other";
    const directionRaw = String(raw.direction || "Long").toLowerCase();
    const direction = directionRaw.includes("short") || directionRaw.includes("sell") ? "Short" : "Long";
    const resultRaw = String(raw.result || "").toLowerCase();
    const result = ["win","loss","breakeven","open"].includes(resultRaw) ? resultRaw[0].toUpperCase() + resultRaw.slice(1) : pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";
    return {
      tradeDate: raw.tradeDate || raw.date, symbol: String(raw.symbol || raw.pair || "").trim().toUpperCase(), direction, session,
      model: raw.model || raw.strategy || "", protocol: raw.protocol || "", entryTime: raw.entryTime || "", exitTime: raw.exitTime || "",
      entryPrice: optionalNumber(raw.entryPrice ?? raw.entry), exitPrice: optionalNumber(raw.exitPrice ?? raw.exit), stopLoss: optionalNumber(raw.stopLoss), takeProfit: optionalNumber(raw.takeProfit),
      commission: optionalNumber(raw.commission) ?? 0, quantity: optionalNumber(raw.quantity ?? raw.lotSize) ?? 1, profitLoss: pnl ?? 0,
      rr: optionalNumber(raw.rr ?? raw.rMultiple) ?? 0, result, rating: optionalNumber(raw.rating), notes: String(raw.notes || ""), screenshotUrl: String(raw.screenshotUrl || ""),
    };
  };

  const importTrades = async (file) => {
    const text = await file.text();
    let rows;
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    } else rows = parseCsv(text);
    const valid = rows.slice(0, 100).map(normalizeImportTrade).filter((trade) => trade.tradeDate && trade.symbol && trade.entryPrice !== undefined);
    if (!valid.length) throw new Error("No valid rows found. Required: tradeDate/date, symbol/pair and entryPrice/entry.");
    let saved = 0;
    for (const trade of valid) { await apiJson(ENDPOINTS.trades, { method:"POST", body:JSON.stringify(trade) }); saved += 1; }
    toast("Import complete", `${saved} trades saved to MongoDB.`);
    await loadData();
  };

  const setupEvents = () => {
    $$(".nav-item[data-route]").forEach((button) => button.addEventListener("click", () => { window.location.href = button.dataset.route; }));
    $("#mobileMenuBtn")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    $("#profileBtn")?.addEventListener("click", (event) => { event.stopPropagation(); $("#profilePopover").hidden = !$("#profilePopover").hidden; $("#accountPopover").hidden = true; });
    $$('[data-profile-action]').forEach((button) => button.addEventListener("click", async () => {
      $("#profilePopover").hidden = true;
      if (button.dataset.profileAction === "logout") { await window.ProTradeAuth?.logout?.(); return; }
      window.location.href = "settings.html";
    }));

    $("#themeSwitch")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "Light" : "Dark", true));
    $("#balanceVisibilityBtn")?.addEventListener("click", () => { state.balanceHidden = !state.balanceHidden; updateBalances(); });
    $("#accountSelectorBtn")?.addEventListener("click", (event) => { event.stopPropagation(); $("#accountPopover").hidden = !$("#accountPopover").hidden; });
    $$('[data-account]').forEach((button) => button.addEventListener("click", () => { setText("#accountLabel", "All Accounts"); $("#accountPopover").hidden = true; toast("All Accounts", "Separate broker accounts are not in the current backend schema."); }));
    $("#notificationBtn")?.addEventListener("click", () => {
      const latest = state.alertSummary?.latest;
      info("Security Alerts", `${number(state.alertSummary?.unread)} unread alert(s)`, latest ? `<p><strong>${escapeHtml(latest.title)}</strong></p><p>${escapeHtml(latest.message)}</p><p><a href="settings.html">Open Security Settings</a></p>` : "<p>No security alerts are currently available.</p>");
    });

    $("#newTradeBtn")?.addEventListener("click", () => { const node = $("#tradeDate"); if (node && !node.value) node.value = formatDateInput(new Date()); openModal("tradeModal"); });
    $("#tradeForm")?.addEventListener("submit", async (event) => {
      event.preventDefault(); const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true;
      try {
        const body = await apiJson(ENDPOINTS.trades, { method:"POST", body:JSON.stringify(payloadFromForm(event.currentTarget)) });
        state.trades.unshift(body.data); state.selectedId = body.data._id; closeModal("tradeModal"); event.currentTarget.reset(); renderAll(); toast("Trade saved", "Trade saved to MongoDB successfully.");
      } catch (error) { toast("Trade not saved", error.message); } finally { submit.disabled = false; }
    });

    $("#tradeBody")?.addEventListener("click", async (event) => {
      const ratingButton = event.target.closest('[data-rating]');
      if (ratingButton) {
        event.stopPropagation();
        const id = ratingButton.closest('.stars')?.dataset.id;
        if (!id) return;
        try {
          const body = await apiJson(`${ENDPOINTS.trades}/${encodeURIComponent(id)}`, { method:"PUT", body:JSON.stringify({ rating:Number(ratingButton.dataset.rating) }) });
          const index = state.trades.findIndex((trade) => trade._id === id); if (index >= 0) state.trades[index] = body.data;
          renderAll(); toast("Rating saved", `${ratingButton.dataset.rating} star review saved to MongoDB.`);
        } catch (error) { toast("Rating not saved", error.message); }
        return;
      }
      const row = event.target.closest('tr[data-id]');
      if (!row) return;
      state.selectedId = row.dataset.id; renderAll(); $(".detail-shell")?.scrollIntoView({ behavior:"smooth", block:"start" });
    });

    $$("#tradeTabs button").forEach((button) => button.addEventListener("click", () => {
      $$("#tradeTabs button").forEach((node) => node.classList.remove("active")); button.classList.add("active"); state.activeTab = button.dataset.tab; state.page = 1; renderTable();
    }));
    $("#tradeSearch")?.addEventListener("input", (event) => { state.filters.search = event.target.value; state.page = 1; renderTable(); });
    $("#sortBtn")?.addEventListener("click", () => { state.sortDescending = !state.sortDescending; state.page = 1; renderTable(); toast("Sort changed", state.sortDescending ? "Newest first" : "Oldest first"); });
    $("#dateSortBtn")?.addEventListener("click", () => $("#sortBtn")?.click());
    $("#groupBtn")?.addEventListener("click", () => {
      const modes = ["none","session","symbol","result"]; state.groupBy = modes[(modes.indexOf(state.groupBy) + 1) % modes.length]; renderTable(); toast("Grouping changed", state.groupBy === "none" ? "Grouping disabled" : `Grouped by ${state.groupBy}`);
    });
    $("#moreBtn")?.addEventListener("click", () => { downloadFile("protrade-trades.json", JSON.stringify(filteredTrades(), null, 2), "application/json"); toast("Export complete", "Filtered trades exported as JSON."); });

    $("#filterBtn")?.addEventListener("click", () => openModal("filterModal"));
    $("#filterForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.filters.symbol = $("#filterSymbol").value.trim(); state.filters.session = $("#filterSession").value; state.filters.result = $("#filterResult").value; state.filters.direction = $("#filterDirection").value;
      state.filters.dateFrom = $("#filterDateFrom").value; state.filters.dateTo = $("#filterDateTo").value; state.filters.minPnl = $("#filterMinPnl").value; state.filters.maxPnl = $("#filterMaxPnl").value;
      state.page = 1; closeModal("filterModal"); renderTable();
    });
    $("#clearFilterBtn")?.addEventListener("click", () => {
      ["filterSymbol","filterSession","filterResult","filterDirection","filterDateFrom","filterDateTo","filterMinPnl","filterMaxPnl"].forEach((id) => { const node = document.getElementById(id); if (node) node.value = ""; });
      Object.assign(state.filters, { symbol:"",session:"",result:"",direction:"",dateFrom:"",dateTo:"",minPnl:"",maxPnl:"" }); state.page = 1; closeModal("filterModal"); renderTable();
    });

    $("#pagination")?.addEventListener("click", (event) => {
      const button = event.target.closest('button[data-page]'); if (!button || button.disabled) return;
      const pages = Math.max(1, Math.ceil(filteredTrades().length / state.pageSize));
      if (button.dataset.page === "prev") state.page = Math.max(1, state.page - 1);
      else if (button.dataset.page === "next") state.page = Math.min(pages, state.page + 1);
      else state.page = Number(button.dataset.page) || 1;
      renderTable();
    });
    $("#pageSizeSelect")?.addEventListener("change", (event) => { state.pageSize = Number(event.target.value) || 10; state.page = 1; renderTable(); });

    $("#editTradeBtn")?.addEventListener("click", () => { const trade = selectedTrade(); if (!trade) return toast("Select a trade", "Choose a trade from the table first."); fillEditForm(trade); openModal("editModal"); });
    $("#editForm")?.addEventListener("submit", async (event) => {
      event.preventDefault(); const trade = selectedTrade(); if (!trade) return;
      const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true;
      try {
        const body = await apiJson(`${ENDPOINTS.trades}/${encodeURIComponent(trade._id)}`, { method:"PUT", body:JSON.stringify(payloadFromForm(event.currentTarget)) });
        const index = state.trades.findIndex((item) => item._id === trade._id); if (index >= 0) state.trades[index] = body.data;
        closeModal("editModal"); renderAll(); toast("Trade updated", "Changes saved to MongoDB.");
      } catch (error) { toast("Trade not updated", error.message); } finally { submit.disabled = false; }
    });

    $("#deleteTradeBtn")?.addEventListener("click", async () => {
      const trade = selectedTrade(); if (!trade) return toast("Select a trade", "Choose a trade first.");
      if (!window.confirm(`Delete ${displayTradeId(trade)} permanently?`)) return;
      try {
        await apiJson(`${ENDPOINTS.trades}/${encodeURIComponent(trade._id)}`, { method:"DELETE" });
        state.trades = state.trades.filter((item) => item._id !== trade._id); state.selectedId = state.trades[0]?._id || null; renderAll(); toast("Trade deleted", "Trade removed from MongoDB.");
      } catch (error) { toast("Trade not deleted", error.message); }
    });

    $("#exportTradeBtn")?.addEventListener("click", () => { const trade = selectedTrade(); if (!trade) return toast("Select a trade"); exportTradesCsv([trade], `${displayTradeId(trade)}.csv`); });
    $("#shareTradeBtn")?.addEventListener("click", async () => {
      const trade = selectedTrade(); if (!trade) return toast("Select a trade");
      const text = `ProTrade: ${trade.symbol} ${trade.direction}, ${money(number(trade.profitLoss), true)}, ${number(trade.rr).toFixed(2)}R`;
      try { if (navigator.share) await navigator.share({ title:"ProTrade Trade", text }); else await navigator.clipboard.writeText(text); toast("Share ready", navigator.share ? "Share sheet opened." : "Trade summary copied."); }
      catch { toast("Share cancelled"); }
    });
    $("#backToTradesBtn")?.addEventListener("click", () => $(".trade-section")?.scrollIntoView({ behavior:"smooth", block:"start" }));
    $("#tradeScreenshotGrid")?.addEventListener("click", (event) => {
      const image = event.target.closest('[data-open-image]'); if (image) { window.open(image.dataset.openImage, "_blank", "noopener,noreferrer"); return; }
      if (event.target.closest('#addScreenshotBtn')) { const trade = selectedTrade(); if (!trade) return toast("Select a trade"); fillEditForm(trade); openModal("editModal"); $("#edit-screenshotUrl")?.focus(); }
    });

    $("#importTradesBtn")?.addEventListener("click", () => $("#importTradesInput")?.click());
    $("#importTradesInput")?.addEventListener("change", async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { await importTrades(file); } catch (error) { toast("Import failed", error.message); } });

    $("#dateRangeBtn")?.addEventListener("click", () => openModal("dateModal"));
    $("#dateForm")?.addEventListener("submit", (event) => {
      event.preventDefault(); const start = $("#startDate").value; const end = $("#endDate").value;
      if (!start || !end || start > end) return toast("Invalid date range", "Start date must be before end date.");
      state.filters.dateFrom = start; state.filters.dateTo = end; $("#filterDateFrom").value = start; $("#filterDateTo").value = end;
      setText("#dateRangeLabel", `${formatDate(`${start}T00:00:00`)} - ${formatDate(`${end}T00:00:00`)}`); state.page = 1; closeModal("dateModal"); renderTable();
    });

    $$('[data-metric]').forEach((button) => button.addEventListener("click", () => {
      const stats = calculateStats(filteredTrades());
      info(button.dataset.metric, "Calculated from current MongoDB trades and filters", `<p>Total: <strong>${stats.total}</strong></p><p>Net P&L: <strong>${money(stats.net, true)}</strong></p><p>Win rate: <strong>${stats.winRate.toFixed(2)}%</strong></p>`);
    }));

    $$('[data-close]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    $$('.modal-backdrop').forEach((node) => node.addEventListener("click", (event) => { if (event.target === node) closeModal(node.id); }));
    document.addEventListener("click", () => { if ($("#profilePopover")) $("#profilePopover").hidden = true; if ($("#accountPopover")) $("#accountPopover").hidden = true; });
    window.addEventListener("resize", () => { clearTimeout(window.__tradeResize); window.__tradeResize = setTimeout(drawEquitySpark, 120); });
  };

  const init = async () => {
    setupEvents();
    applyTheme(window.localStorage.getItem("protrade-theme") || "Dark", false);
    const today = new Date(); const start = new Date(today.getTime() - 29 * 86400000);
    $("#startDate").value = formatDateInput(start); $("#endDate").value = formatDateInput(today); $("#tradeDate").value = formatDateInput(today);
    await loadData();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
