(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const API_BASE = window.ProTradeAuth?.API_BASE || "https://protrader-backend-n8oj.onrender.com/api";
  const TRADES_API = `${API_BASE}/trades`;
  const SETTINGS_API = `${API_BASE}/settings`;

  const state = {
    trades: [],
    settings: {},
    selectedId: null,
    editingId: null,
    activeTab: "all",
    sortDescending: true,
    groupBy: "none",
    currentPage: 1,
    pageSize: 10,
    theme: localStorage.getItem("protrade-theme") || "light",
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

  const numberOr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const optionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const safeArray = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

  function toast(title, message, type = "info") {
    const wrap = $("#toastWrap");
    if (!wrap) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    wrap.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    window.setTimeout(() => {
      item.classList.remove("show");
      window.setTimeout(() => item.remove(), 250);
    }, 3400);
  }

  function setStatus(message, type = "info") {
    const target = $("#apiStatus");
    if (!target) return;
    target.textContent = message;
    target.dataset.type = type;
  }

  async function apiJson(url, options = {}) {
    const requestOptions = { ...options };
    const headers = new Headers(requestOptions.headers || undefined);
    headers.set("Accept", "application/json");
    if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    requestOptions.headers = headers;

    const response = await window.fetch(url, requestOptions);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    }
    return body;
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
    if (!$$('.modal-backdrop:not([hidden])').length) document.body.style.overflow = "";
  }

  function openInfo(title, subtitle, html) {
    $("#infoModalTitle").textContent = title;
    $("#infoModalSubtext").textContent = subtitle;
    $("#infoModalBody").innerHTML = html;
    openModal("infoModal");
  }

  function currencyCode() {
    return state.settings.currency || "USD";
  }

  function formatMoney(value) {
    const amount = numberOr(value, 0);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode(),
        maximumFractionDigits: currencyCode() === "JPY" ? 0 : 2,
      }).format(amount);
    } catch {
      return `${amount >= 0 ? "+" : "-"}$${Math.abs(amount).toFixed(2)}`;
    }
  }

  function formatPrice(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    return parsed.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function resultClass(result) {
    return String(result || "open").toLowerCase();
  }

  function pnlClass(value) {
    return numberOr(value) > 0 ? "positive" : numberOr(value) < 0 ? "negative" : "";
  }

  function displayTradeId(trade) {
    const year = new Date(trade.tradeDate || trade.createdAt || Date.now()).getFullYear();
    const suffix = String(trade._id || "NEW").slice(-6).toUpperCase();
    return `TRD-${year}-${suffix}`;
  }

  function normalizeSession(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw.includes("london")) return "London";
    if (raw.includes("new york") || raw === "ny") return "New York";
    if (raw.includes("asia") || raw.includes("tokyo")) return "Asian";
    return "Other";
  }

  function normalizeDirection(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["short", "sell", "s"].includes(raw)) return "Short";
    return "Long";
  }

  function normalizeResult(value, pnl) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "win" || raw === "won") return "Win";
    if (raw === "loss" || raw === "lost") return "Loss";
    if (["breakeven", "break even", "be"].includes(raw)) return "Breakeven";
    if (raw === "open") return "Open";
    const amount = Number(pnl);
    if (Number.isFinite(amount)) return amount > 0 ? "Win" : amount < 0 ? "Loss" : "Breakeven";
    return "Open";
  }

  function isSafeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function applyTheme(theme, saveRemote = false) {
    state.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem("protrade-theme", state.theme);
    $("#themeText").textContent = state.theme === "dark" ? "Dark Mode" : "Light Mode";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.theme === "dark" ? "#06111f" : "#f5f7fb");
    window.setTimeout(drawEquityCurve, 0);
    if (saveRemote) {
      apiJson(SETTINGS_API, {
        method: "PUT",
        body: JSON.stringify({ theme: state.theme === "dark" ? "Dark" : "Light" }),
      }).catch((error) => toast("Theme saved locally", error.message, "error"));
    }
  }

  function updateProfile() {
    const user = window.ProTradeAuth?.getUser?.() || {};
    const name = state.settings.fullName || user.name || "Trader";
    const role = state.settings.tradingRole || "Independent Trader";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "T";
    $$(".auth-user-name").forEach((node) => { node.textContent = name; });
    $$(".auth-user-initials").forEach((node) => { node.textContent = initials; });
    $("#profileRole").textContent = role;
  }

  function filteredTrades() {
    const f = state.filters;
    const search = f.search.trim().toLowerCase();
    const symbol = f.symbol.trim().toLowerCase();
    const fromTime = f.dateFrom ? new Date(`${f.dateFrom}T00:00:00`).getTime() : null;
    const toTime = f.dateTo ? new Date(`${f.dateTo}T23:59:59`).getTime() : null;
    const minPnl = f.minPnl === "" ? null : Number(f.minPnl);
    const maxPnl = f.maxPnl === "" ? null : Number(f.maxPnl);

    const list = state.trades.filter((trade) => {
      const result = trade.result || "Open";
      if (state.activeTab === "open" && result !== "Open") return false;
      if (state.activeTab === "closed" && result === "Open") return false;
      if (state.activeTab === "unreviewed" && (trade.rating || String(trade.notes || "").trim())) return false;

      if (search) {
        const haystack = [trade.symbol, trade.model, trade.protocol, trade.session, trade.notes, ...(trade.mistakeTags || [])].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (symbol && !String(trade.symbol || "").toLowerCase().includes(symbol)) return false;
      if (f.session && trade.session !== f.session) return false;
      if (f.result && result !== f.result) return false;
      if (f.direction && trade.direction !== f.direction) return false;

      const tradeTime = new Date(trade.tradeDate || trade.createdAt).getTime();
      if (fromTime && tradeTime < fromTime) return false;
      if (toTime && tradeTime > toTime) return false;

      const pnl = numberOr(trade.profitLoss);
      if (minPnl !== null && Number.isFinite(minPnl) && pnl < minPnl) return false;
      if (maxPnl !== null && Number.isFinite(maxPnl) && pnl > maxPnl) return false;
      return true;
    });

    list.sort((a, b) => {
      const aTime = new Date(a.tradeDate || a.createdAt).getTime();
      const bTime = new Date(b.tradeDate || b.createdAt).getTime();
      return state.sortDescending ? bTime - aTime : aTime - bTime;
    });
    return list;
  }

  function renderMetrics(list) {
    const closed = list.filter((trade) => (trade.result || "Open") !== "Open");
    const wins = closed.filter((trade) => trade.result === "Win").length;
    const grossProfit = list.reduce((sum, trade) => sum + Math.max(0, numberOr(trade.profitLoss)), 0);
    const grossLoss = Math.abs(list.reduce((sum, trade) => sum + Math.min(0, numberOr(trade.profitLoss)), 0));
    const totalPnl = list.reduce((sum, trade) => sum + numberOr(trade.profitLoss), 0);
    const rrValues = list.map((trade) => Number(trade.rr)).filter(Number.isFinite);
    const averageR = rrValues.length ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    $("#totalTradesMetric").textContent = String(list.length);
    $("#winRateMetric").textContent = `${closed.length ? ((wins / closed.length) * 100).toFixed(1) : "0.0"}%`;
    $("#totalNetProfitMetric").textContent = formatMoney(totalPnl);
    $("#totalNetProfitMetric").className = pnlClass(totalPnl);
    $("#profitFactorMetric").textContent = Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞";
    $("#averageRMetric").textContent = `${averageR.toFixed(2)}R`;
    drawEquityCurve(list);
  }

  function groupKey(trade) {
    if (state.groupBy === "session") return trade.session || "Other";
    if (state.groupBy === "symbol") return trade.symbol || "Unknown";
    if (state.groupBy === "result") return trade.result || "Open";
    return "";
  }

  function reviewHtml(trade) {
    const stars = [1, 2, 3, 4, 5].map((rating) => `<button class="rating-star ${numberOr(trade.rating) >= rating ? "active" : ""}" type="button" data-action="rate" data-id="${escapeHtml(trade._id)}" data-rating="${rating}" aria-label="Rate ${rating} stars">★</button>`).join("");
    const screenshot = isSafeHttpUrl(trade.screenshotUrl)
      ? `<button class="screenshot-link" type="button" data-action="screenshot" data-id="${escapeHtml(trade._id)}" title="Open screenshot">🖼</button>`
      : `<button class="screenshot-link" type="button" data-action="details" data-id="${escapeHtml(trade._id)}" title="Open details">◌</button>`;
    return `<div class="review-icons star-icons">${stars}${screenshot}</div>`;
  }

  function tradeRowHtml(trade) {
    const pnl = numberOr(trade.profitLoss);
    const rr = numberOr(trade.rr);
    const selected = trade._id === state.selectedId ? " selected-row" : "";
    return `<tr class="trade-row${selected}" data-id="${escapeHtml(trade._id)}">
      <td>${escapeHtml(displayTradeId(trade))}</td>
      <td>${escapeHtml(formatDate(trade.tradeDate || trade.createdAt))}</td>
      <td><span class="symbol-tag blue">${escapeHtml(trade.symbol || "—")}</span></td>
      <td><span class="direction-tag ${trade.direction === "Short" ? "short" : "long"}">${escapeHtml(trade.direction || "—")}</span></td>
      <td>${escapeHtml(trade.model || "—")}</td>
      <td>${escapeHtml(trade.session || "Other")}</td>
      <td>${escapeHtml(formatPrice(trade.entryPrice))}</td>
      <td>${escapeHtml(formatPrice(trade.exitPrice))}</td>
      <td class="${pnlClass(pnl)}">${escapeHtml(formatMoney(pnl))}</td>
      <td class="${pnlClass(rr)}">${rr.toFixed(2)}R</td>
      <td class="${pnlClass(pnl)}"><span class="status-chip ${resultClass(trade.result)}">${escapeHtml(trade.result || "Open")}</span></td>
      <td>${reviewHtml(trade)}</td>
    </tr>`;
  }

  function renderPagination(totalPages) {
    const wrap = $("#paginationWrap");
    wrap.innerHTML = "";
    if (totalPages <= 1) return;

    const addButton = (label, page, disabled = false, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-btn${active ? " active" : ""}`;
      button.textContent = label;
      button.disabled = disabled;
      button.dataset.page = String(page);
      wrap.appendChild(button);
    };

    addButton("‹", state.currentPage - 1, state.currentPage <= 1);
    const pages = new Set([1, totalPages, state.currentPage - 1, state.currentPage, state.currentPage + 1]);
    const ordered = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
    let last = 0;
    ordered.forEach((page) => {
      if (page - last > 1) {
        const dots = document.createElement("span");
        dots.className = "page-dots";
        dots.textContent = "…";
        wrap.appendChild(dots);
      }
      addButton(String(page), page, false, page === state.currentPage);
      last = page;
    });
    addButton("›", state.currentPage + 1, state.currentPage >= totalPages);
  }

  function renderTable() {
    const list = filteredTrades();
    const totalPages = Math.max(1, Math.ceil(list.length / state.pageSize));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    const start = (state.currentPage - 1) * state.pageSize;
    const pageItems = list.slice(start, start + state.pageSize);
    const body = $("#tradeTableBody");

    if (!pageItems.length) {
      body.innerHTML = `<tr><td colspan="12" class="table-message">No matching trades found. “New Trade” se MongoDB entry create karo.</td></tr>`;
    } else if (state.groupBy === "none") {
      body.innerHTML = pageItems.map(tradeRowHtml).join("");
    } else {
      let currentGroup = null;
      const rows = [];
      pageItems.forEach((trade) => {
        const key = groupKey(trade);
        if (key !== currentGroup) {
          currentGroup = key;
          rows.push(`<tr class="group-heading"><td colspan="12">${escapeHtml(key)}</td></tr>`);
        }
        rows.push(tradeRowHtml(trade));
      });
      body.innerHTML = rows.join("");
    }

    const end = Math.min(start + state.pageSize, list.length);
    $("#tradeRangeLabel").innerHTML = list.length ? `Showing <strong>${start + 1}</strong> to <strong>${end}</strong> of <strong>${list.length}</strong> trades` : "Showing 0 trades";
    renderPagination(totalPages);
    renderMetrics(list);
  }

  function activeFilterCount() {
    return Object.values(state.filters).filter((value) => String(value).trim() !== "").length;
  }

  function updateFilterBar() {
    const count = activeFilterCount();
    $("#activeFilterBar").hidden = count === 0;
    $("#activeFilterText").textContent = `${count} filter${count === 1 ? "" : "s"} active`;
  }

  function renderAll() {
    updateFilterBar();
    renderTable();
  }

  function drawEquityCurve(list = filteredTrades()) {
    const canvas = $("#equitySpark");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const ordered = [...list].sort((a, b) => new Date(a.tradeDate || a.createdAt) - new Date(b.tradeDate || b.createdAt));
    let balance = numberOr(state.settings.startingBalance, 0);
    const values = [balance];
    ordered.forEach((trade) => {
      balance += numberOr(trade.profitLoss);
      values.push(balance);
    });
    if (values.length === 1) values.push(balance);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = 7;
    const points = values.map((value, index) => [
      padding + (index / Math.max(1, values.length - 1)) * (rect.width - padding * 2),
      rect.height - padding - ((value - min) / (max - min || 1)) * (rect.height - padding * 2),
    ]);

    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#27b36b";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.lineTo(points.at(-1)[0], rect.height - padding);
    ctx.lineTo(points[0][0], rect.height - padding);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, "rgba(39,179,107,.28)");
    gradient.addColorStop(1, "rgba(39,179,107,.02)");
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function selectedTrade() {
    return state.trades.find((trade) => trade._id === state.selectedId) || null;
  }

  function setDetailText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value ?? "—";
  }

  function chipsHtml(values, bad = false) {
    const list = safeArray(values);
    if (!list.length) return bad ? "No mistake tags." : "No checklist items.";
    return list.map((item) => `<span class="data-chip${bad ? " bad" : ""}">${escapeHtml(item)}</span>`).join("");
  }

  function renderDetails(trade) {
    if (!trade) {
      $("#tradeDetailSection").hidden = true;
      $("#emptyDetailState").hidden = false;
      return;
    }

    $("#emptyDetailState").hidden = true;
    $("#tradeDetailSection").hidden = false;
    setDetailText("#detailHeading", displayTradeId(trade));
    setDetailText("#detailSymbol", trade.symbol || "—");
    setDetailText("#detailDirection", trade.direction || "—");
    $("#detailDirection").className = trade.direction === "Short" ? "negative" : "positive";
    setDetailText("#detailDate", formatDate(trade.tradeDate || trade.createdAt));
    setDetailText("#detailSession", trade.session || "Other");
    setDetailText("#detailModel", trade.model || "—");
    setDetailText("#detailStatus", trade.result || "Open");
    $("#detailStatus").className = `status-chip ${resultClass(trade.result)}`;
    setDetailText("#detailTime", `${trade.entryTime || "—"} – ${trade.exitTime || "—"}`);
    setDetailText("#detailProtocol", trade.protocol || "—");
    setDetailText("#detailRating", trade.rating ? `${trade.rating}/5` : "Not reviewed");
    setDetailText("#detailUpdated", formatDateTime(trade.updatedAt || trade.createdAt));

    setDetailText("#detailEntryPrice", formatPrice(trade.entryPrice));
    setDetailText("#detailEntryTime", trade.entryTime || "—");
    setDetailText("#detailExitPrice", formatPrice(trade.exitPrice));
    setDetailText("#detailExitTime", trade.exitTime || "—");

    const pnl = numberOr(trade.profitLoss);
    setDetailText("#detailPnl", formatMoney(pnl));
    $("#detailPnl").className = pnlClass(pnl);
    setDetailText("#detailRR", `${numberOr(trade.rr).toFixed(2)}R`);
    $("#detailRR").className = pnlClass(numberOr(trade.rr));
    setDetailText("#detailResult", trade.result || "Open");
    setDetailText("#detailQuantity", formatPrice(trade.quantity));
    setDetailText("#detailCommission", formatMoney(trade.commission));
    setDetailText("#detailChecklistCount", String(safeArray(trade.checklist).length));

    setDetailText("#detailStopLoss", formatPrice(trade.stopLoss));
    setDetailText("#detailTakeProfit", formatPrice(trade.takeProfit));
    setDetailText("#detailRiskQuantity", formatPrice(trade.quantity));
    setDetailText("#detailRiskCommission", formatMoney(trade.commission));
    setDetailText("#detailMistakeCount", String(safeArray(trade.mistakeTags).length));
    const reviewed = Boolean(trade.rating || String(trade.notes || "").trim());
    setDetailText("#detailReviewStatus", reviewed ? "Reviewed" : "Pending");
    $("#detailReviewStatus").className = reviewed ? "good-chip" : "status-chip breakeven";

    $("#detailChecklist").innerHTML = chipsHtml(trade.checklist, false);
    $("#detailMistakes").innerHTML = chipsHtml(trade.mistakeTags, true);
    setDetailText("#detailNotes", trade.notes || "No notes added.");

    const screenshotUrl = isSafeHttpUrl(trade.screenshotUrl);
    const preview = $("#screenshotPreviewBtn");
    preview.dataset.url = screenshotUrl;
    preview.classList.toggle("has-image", Boolean(screenshotUrl));
    preview.style.backgroundImage = screenshotUrl ? `linear-gradient(rgba(0,0,0,.08), rgba(0,0,0,.08)), url("${screenshotUrl.replaceAll('"', "%22")}")` : "";
    setDetailText("#screenshotPreviewText", screenshotUrl ? "Open screenshot" : "No screenshot URL");
  }

  function selectTrade(id, scroll = true) {
    state.selectedId = id;
    const trade = selectedTrade();
    renderTable();
    renderDetails(trade);
    if (scroll && trade) $("#tradeDetailSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadTrades(showToast = false) {
    setStatus("Loading trades from MongoDB…");
    try {
      const body = await apiJson(TRADES_API);
      state.trades = Array.isArray(body.data) ? body.data : [];
      if (state.selectedId && !state.trades.some((trade) => trade._id === state.selectedId)) state.selectedId = null;
      renderAll();
      renderDetails(selectedTrade());
      setStatus(`${state.trades.length} trades synced from MongoDB`, "success");
      if (showToast) toast("Refreshed", "Latest trades MongoDB se load ho gaye.", "success");
    } catch (error) {
      state.trades = [];
      renderAll();
      setStatus(`Could not load trades: ${error.message}`, "error");
      toast("Trade load failed", error.message, "error");
    }
  }

  async function loadSettings() {
    try {
      const body = await apiJson(SETTINGS_API);
      state.settings = body.data || {};
      const remoteTheme = String(state.settings.theme || "").toLowerCase();
      if (["dark", "light"].includes(remoteTheme)) state.theme = remoteTheme;
      applyTheme(state.theme, false);
      updateProfile();
    } catch (error) {
      applyTheme(state.theme, false);
      updateProfile();
      console.warn("Settings load failed:", error.message);
    }
  }

  function openTradeForm(trade = null) {
    state.editingId = trade?._id || null;
    const form = $("#tradeForm");
    form.reset();
    $("#tradeModalTitle").textContent = trade ? "Edit Trade" : "Add New Trade";
    $("#saveTradeText").textContent = trade ? "Update Trade" : "Save Trade";
    $("#tradeDate").value = trade?.tradeDate ? String(trade.tradeDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    $("#tradeSymbol").value = trade?.symbol || "";
    $("#tradeDirection").value = trade?.direction || "Long";
    $("#tradeResult").value = trade?.result || "Open";
    $("#tradeSession").value = trade?.session || normalizeSession(state.settings.preferredSession);
    $("#tradeModel").value = trade?.model || "";
    $("#tradeProtocol").value = trade?.protocol || "";
    $("#entryTime").value = trade?.entryTime || "";
    $("#exitTime").value = trade?.exitTime || "";
    $("#entryPrice").value = trade?.entryPrice ?? "";
    $("#exitPrice").value = trade?.exitPrice ?? "";
    $("#stopLoss").value = trade?.stopLoss ?? "";
    $("#takeProfit").value = trade?.takeProfit ?? "";
    $("#quantity").value = trade?.quantity ?? 1;
    $("#commission").value = trade?.commission ?? 0;
    $("#tradePnl").value = trade?.profitLoss ?? 0;
    $("#tradeRR").value = trade?.rr ?? state.settings.defaultRR ?? 0;
    $("#tradeRating").value = trade?.rating ?? "";
    $("#screenshotUrl").value = trade?.screenshotUrl || "";
    $("#tradeChecklist").value = safeArray(trade?.checklist).join(", ");
    $("#tradeMistakeTags").value = safeArray(trade?.mistakeTags).join(", ");
    $("#tradeNotes").value = trade?.notes || "";
    openModal("tradeModal");
  }

  function splitTags(value) {
    return String(value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
  }

  function buildTradePayload() {
    return {
      tradeDate: $("#tradeDate").value,
      symbol: $("#tradeSymbol").value.trim().toUpperCase(),
      direction: $("#tradeDirection").value,
      result: $("#tradeResult").value,
      session: $("#tradeSession").value,
      model: $("#tradeModel").value.trim(),
      protocol: $("#tradeProtocol").value.trim(),
      entryTime: $("#entryTime").value || undefined,
      exitTime: $("#exitTime").value || undefined,
      entryPrice: optionalNumber($("#entryPrice").value),
      exitPrice: optionalNumber($("#exitPrice").value),
      stopLoss: optionalNumber($("#stopLoss").value),
      takeProfit: optionalNumber($("#takeProfit").value),
      quantity: optionalNumber($("#quantity").value) ?? 1,
      commission: optionalNumber($("#commission").value) ?? 0,
      profitLoss: optionalNumber($("#tradePnl").value) ?? 0,
      rr: optionalNumber($("#tradeRR").value) ?? 0,
      rating: optionalNumber($("#tradeRating").value),
      screenshotUrl: $("#screenshotUrl").value.trim(),
      checklist: splitTags($("#tradeChecklist").value),
      mistakeTags: splitTags($("#tradeMistakeTags").value),
      notes: $("#tradeNotes").value.trim(),
    };
  }

  async function saveTrade(event) {
    event.preventDefault();
    const payload = buildTradePayload();
    if (!payload.symbol || !payload.tradeDate || !payload.direction || payload.entryPrice === undefined) {
      toast("Missing fields", "Date, symbol, direction aur entry price required hain.", "error");
      return;
    }

    const button = $("#saveTradeBtn");
    button.disabled = true;
    $("#saveTradeText").textContent = state.editingId ? "Updating…" : "Saving…";
    try {
      const body = await apiJson(state.editingId ? `${TRADES_API}/${state.editingId}` : TRADES_API, {
        method: state.editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const savedId = body.data?._id || state.editingId;
      closeModal("tradeModal");
      state.editingId = null;
      await loadTrades();
      if (savedId) selectTrade(savedId, false);
      toast("Trade saved", body.message || "Trade MongoDB mein save ho gaya.", "success");
    } catch (error) {
      toast("Could not save trade", error.message, "error");
    } finally {
      button.disabled = false;
      $("#saveTradeText").textContent = state.editingId ? "Update Trade" : "Save Trade";
    }
  }

  async function deleteSelectedTrade() {
    const trade = selectedTrade();
    if (!trade) return;
    if (!window.confirm(`Delete ${trade.symbol || "this"} trade permanently?`)) return;
    try {
      await apiJson(`${TRADES_API}/${trade._id}`, { method: "DELETE" });
      state.selectedId = null;
      await loadTrades();
      renderDetails(null);
      toast("Trade deleted", "Trade MongoDB se permanently delete ho gaya.", "success");
    } catch (error) {
      toast("Delete failed", error.message, "error");
    }
  }

  async function updateRating(id, rating) {
    try {
      await apiJson(`${TRADES_API}/${id}`, { method: "PUT", body: JSON.stringify({ rating }) });
      const trade = state.trades.find((item) => item._id === id);
      if (trade) trade.rating = rating;
      renderAll();
      if (state.selectedId === id) renderDetails(trade);
      toast("Review saved", `${rating}/5 rating MongoDB mein updated.`, "success");
    } catch (error) {
      toast("Rating failed", error.message, "error");
    }
  }

  function parseCsv(text) {
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
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
      } else value += char;
    }
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  }

  function findField(record, candidates) {
    const entries = Object.entries(record || {});
    for (const candidate of candidates) {
      const match = entries.find(([key]) => key.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "") === candidate.toLowerCase().replaceAll(/[^a-z0-9]/g, ""));
      if (match) return match[1];
    }
    return undefined;
  }

  function importPayload(record) {
    const pnl = optionalNumber(findField(record, ["profitLoss", "pnl", "netPnl", "profit"]));
    const rawDate = findField(record, ["tradeDate", "date"]);
    const date = rawDate ? new Date(rawDate) : null;
    return {
      symbol: String(findField(record, ["symbol", "pair", "asset"]) || "").trim().toUpperCase(),
      tradeDate: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "",
      direction: normalizeDirection(findField(record, ["direction", "side", "type"])),
      result: normalizeResult(findField(record, ["result", "status"]), pnl),
      session: normalizeSession(findField(record, ["session"])),
      model: String(findField(record, ["model", "strategy", "setup"]) || "").trim(),
      protocol: String(findField(record, ["protocol", "plan"]) || "").trim(),
      entryTime: String(findField(record, ["entryTime"]) || "").trim() || undefined,
      exitTime: String(findField(record, ["exitTime"]) || "").trim() || undefined,
      entryPrice: optionalNumber(findField(record, ["entryPrice", "entry"])),
      exitPrice: optionalNumber(findField(record, ["exitPrice", "exit"])),
      stopLoss: optionalNumber(findField(record, ["stopLoss", "sl"])),
      takeProfit: optionalNumber(findField(record, ["takeProfit", "tp"])),
      quantity: optionalNumber(findField(record, ["quantity", "qty", "lotSize", "lots"])) ?? 1,
      commission: optionalNumber(findField(record, ["commission", "fees"])) ?? 0,
      profitLoss: pnl ?? 0,
      rr: optionalNumber(findField(record, ["rr", "rMultiple", "riskReward"])) ?? 0,
      rating: optionalNumber(findField(record, ["rating"])),
      notes: String(findField(record, ["notes", "comment"]) || "").trim(),
      screenshotUrl: String(findField(record, ["screenshotUrl", "screenshot"]) || "").trim(),
    };
  }

  async function importTrades(file) {
    const text = await file.text();
    let records;
    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
    } else {
      records = parseCsv(text);
    }
    if (!records.length) throw new Error("File mein valid trade rows nahi mile.");

    const payloads = records.slice(0, 100).map(importPayload);
    let imported = 0;
    let skipped = 0;
    const failures = [];

    for (let index = 0; index < payloads.length; index += 1) {
      const payload = payloads[index];
      if (!payload.symbol || !payload.tradeDate || payload.entryPrice === undefined) {
        skipped += 1;
        continue;
      }
      try {
        await apiJson(TRADES_API, { method: "POST", body: JSON.stringify(payload) });
        imported += 1;
      } catch (error) {
        failures.push(`Row ${index + 2}: ${error.message}`);
      }
    }

    await loadTrades();
    openInfo("Import complete", `${file.name} processed`, `<p><strong>${imported}</strong> trades imported.</p><p><strong>${skipped}</strong> invalid rows skipped.</p><p><strong>${failures.length}</strong> rows failed.</p>${failures.length ? `<details><summary>Failure details</summary><pre>${escapeHtml(failures.slice(0, 10).join("\n"))}</pre></details>` : ""}<p>Maximum 100 rows per import. Same file dobara upload karne par duplicates create ho sakte hain.</p>`);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv() {
    const headers = ["tradeDate", "symbol", "direction", "result", "session", "model", "protocol", "entryTime", "exitTime", "entryPrice", "exitPrice", "stopLoss", "takeProfit", "quantity", "commission", "profitLoss", "rr", "rating", "notes", "screenshotUrl"];
    const rows = state.trades.map((trade) => headers.map((header) => csvEscape(header === "tradeDate" ? String(trade.tradeDate || "").slice(0, 10) : trade[header])).join(","));
    downloadFile(`protrade-trades-${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
  }

  function exportJson() {
    downloadFile(`protrade-trades-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.trades, null, 2), "application/json");
  }

  async function shareSelected() {
    const trade = selectedTrade();
    if (!trade) return;
    const text = `${displayTradeId(trade)} — ${trade.symbol} ${trade.direction}\n${formatDate(trade.tradeDate)} | ${trade.result} | ${formatMoney(trade.profitLoss)} | ${numberOr(trade.rr).toFixed(2)}R`;
    try {
      if (navigator.share) await navigator.share({ title: "ProTrade Trade Summary", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied", "Trade summary clipboard mein copy ho gaya.", "success");
      }
    } catch (error) {
      if (error.name !== "AbortError") toast("Share failed", error.message, "error");
    }
  }

  function populateFilterForm() {
    $("#filterSearch").value = state.filters.search;
    $("#filterSymbol").value = state.filters.symbol;
    $("#filterSession").value = state.filters.session;
    $("#filterResult").value = state.filters.result;
    $("#filterDirection").value = state.filters.direction;
    $("#filterDateFrom").value = state.filters.dateFrom;
    $("#filterDateTo").value = state.filters.dateTo;
    $("#filterMinPnl").value = state.filters.minPnl;
    $("#filterMaxPnl").value = state.filters.maxPnl;
  }

  function applyFilterForm(event) {
    event.preventDefault();
    state.filters = {
      search: $("#filterSearch").value,
      symbol: $("#filterSymbol").value,
      session: $("#filterSession").value,
      result: $("#filterResult").value,
      direction: $("#filterDirection").value,
      dateFrom: $("#filterDateFrom").value,
      dateTo: $("#filterDateTo").value,
      minPnl: $("#filterMinPnl").value,
      maxPnl: $("#filterMaxPnl").value,
    };
    state.currentPage = 1;
    closeModal("filterModal");
    renderAll();
  }

  function clearFilters() {
    state.filters = { search: "", symbol: "", session: "", result: "", direction: "", dateFrom: "", dateTo: "", minPnl: "", maxPnl: "" };
    state.currentPage = 1;
    populateFilterForm();
    renderAll();
  }

  function setupEvents() {
    $("#mobileMenuBtn")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    $$(".side-nav a").forEach((link) => link.addEventListener("click", () => document.body.classList.remove("sidebar-open")));

    $("#themeToggle")?.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark", true));
    $("#openSettingsBtn")?.addEventListener("click", () => { window.location.href = "settings.html"; });
    $("#profileCard")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const popover = $("#profilePopover");
      popover.hidden = !popover.hidden;
      $("#profileCard").setAttribute("aria-expanded", String(!popover.hidden));
    });

    $("#filterBtn")?.addEventListener("click", () => { populateFilterForm(); openModal("filterModal"); });
    $("#clearFiltersBtn")?.addEventListener("click", clearFilters);
    $("#filterForm")?.addEventListener("submit", applyFilterForm);
    $("#resetFilterFormBtn")?.addEventListener("click", () => {
      $("#filterForm").reset();
    });

    $("#groupBtn")?.addEventListener("click", () => {
      const order = ["none", "session", "symbol", "result"];
      state.groupBy = order[(order.indexOf(state.groupBy) + 1) % order.length];
      $("#groupLabel").textContent = state.groupBy === "none" ? "Group" : `By ${state.groupBy}`;
      renderTable();
    });

    const toggleSort = () => {
      state.sortDescending = !state.sortDescending;
      $("#sortLabel").textContent = state.sortDescending ? "Newest" : "Oldest";
      state.currentPage = 1;
      renderTable();
    };
    $("#sortBtn")?.addEventListener("click", toggleSort);
    $("#dateSortBtn")?.addEventListener("click", toggleSort);

    $("#newTradeBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#newTradeMenu").hidden = !$("#newTradeMenu").hidden;
      $("#moreMenu").hidden = true;
    });
    $("#moreBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      $("#moreMenu").hidden = !$("#moreMenu").hidden;
      $("#newTradeMenu").hidden = true;
    });
    $$('[data-trade-action="add"]').forEach((button) => button.addEventListener("click", () => { $("#newTradeMenu").hidden = true; openTradeForm(); }));
    $$('[data-trade-action="import"]').forEach((button) => button.addEventListener("click", () => $("#importTradesInput").click()));
    $("#importTradesBtn")?.addEventListener("click", () => $("#importTradesInput").click());
    $("#importTradesInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        setStatus(`Importing ${file.name}…`);
        await importTrades(file);
        setStatus(`${state.trades.length} trades synced from MongoDB`, "success");
      } catch (error) {
        setStatus(`Import failed: ${error.message}`, "error");
        toast("Import failed", error.message, "error");
      }
    });

    $("#tradeTabs")?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab) return;
      $$("#tradeTabs .trade-tab").forEach((button) => button.classList.remove("active"));
      tab.classList.add("active");
      state.activeTab = tab.dataset.tab;
      state.currentPage = 1;
      renderAll();
    });

    $("#pageSizeSelect")?.addEventListener("change", (event) => {
      state.pageSize = Number(event.target.value) || 10;
      state.currentPage = 1;
      renderTable();
    });
    $("#paginationWrap")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-page]");
      if (!button || button.disabled) return;
      state.currentPage = Number(button.dataset.page) || 1;
      renderTable();
      $("#tradesTable").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("#tradeTableBody")?.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]");
      if (action) {
        event.stopPropagation();
        const id = action.dataset.id;
        if (action.dataset.action === "rate") await updateRating(id, Number(action.dataset.rating));
        else if (action.dataset.action === "screenshot") {
          const trade = state.trades.find((item) => item._id === id);
          const url = isSafeHttpUrl(trade?.screenshotUrl);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } else selectTrade(id);
        return;
      }
      const row = event.target.closest("tr[data-id]");
      if (row) selectTrade(row.dataset.id);
    });

    $("#tradeForm")?.addEventListener("submit", saveTrade);
    $("#editBtn")?.addEventListener("click", () => { const trade = selectedTrade(); if (trade) openTradeForm(trade); });
    $("#deleteBtn")?.addEventListener("click", deleteSelectedTrade);
    $("#backBtn")?.addEventListener("click", () => { $("#tradesTable").scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#shareBtn")?.addEventListener("click", shareSelected);
    $("#exportSelectedBtn")?.addEventListener("click", () => {
      const trade = selectedTrade();
      if (trade) downloadFile(`${displayTradeId(trade)}.json`, JSON.stringify(trade, null, 2), "application/json");
    });
    $("#screenshotPreviewBtn")?.addEventListener("click", () => {
      const url = $("#screenshotPreviewBtn").dataset.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast("No screenshot", "Edit Trade mein screenshot URL add karo.");
    });
    $("#addScreenshotBtn")?.addEventListener("click", () => {
      const trade = selectedTrade();
      if (trade) {
        openTradeForm(trade);
        window.setTimeout(() => $("#screenshotUrl")?.focus(), 80);
      }
    });

    $("#exportCsvBtn")?.addEventListener("click", exportCsv);
    $("#exportJsonBtn")?.addEventListener("click", exportJson);
    $("#refreshTradesBtn")?.addEventListener("click", () => loadTrades(true));

    $$('[data-close-modal]').forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
    $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(backdrop.id); }));

    document.addEventListener("click", () => {
      $("#newTradeMenu").hidden = true;
      $("#moreMenu").hidden = true;
      $("#profilePopover").hidden = true;
      $("#profileCard")?.setAttribute("aria-expanded", "false");
    });
    $$(".dropdown, .profile-menu-wrap").forEach((element) => element.addEventListener("click", (event) => event.stopPropagation()));

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => drawEquityCurve(), 120);
    });
  }

  async function init() {
    applyTheme(state.theme, false);
    setupEvents();
    try {
      await (window.ProTradeAuth?.ready || Promise.resolve());
      await Promise.all([loadSettings(), loadTrades()]);
    } catch (error) {
      setStatus(`Authentication failed: ${error.message}`, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
