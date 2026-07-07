(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const state = {
    theme: localStorage.getItem("protrade-fixed-theme") || "light",
    balanceHidden: false,
    totalTrades: 229,
    netProfit: 12914.75,
    page: 1,
    pageSize: 5,
    sortDesc: true,
    selectedRow: null
  };

  function toast(title, message = "") {
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
    $("#toastStack").appendChild(node);
    setTimeout(() => node.remove(), 3300);
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

  function info(title, subtitle, html) {
    $("#infoTitle").textContent = title;
    $("#infoSubtitle").textContent = subtitle;
    $("#infoBody").innerHTML = html;
    openModal("infoModal");
  }

  function money(value, sign = false) {
    const prefix = sign && value >= 0 ? "+" : value < 0 ? "-" : "";
    return `${prefix}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("protrade-fixed-theme", theme);
    $("#themeLabel").textContent = theme === "dark" ? "Dark Mode" : "Light Mode";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#06111f" : "#f5f9fc");
    requestAnimationFrame(drawEquitySpark);
  }

  function setupTheme() {
    applyTheme(state.theme);
    $("#themeSwitch").addEventListener("click", () => {
      applyTheme(state.theme === "dark" ? "light" : "dark");
      toast("Theme updated", `${state.theme === "dark" ? "Dark" : "Light"} mode enabled.`);
    });
  }

  function setupSidebar() {
    $$(".nav-item[data-page]").forEach(btn => btn.addEventListener("click", () => {
      const route = btn.dataset.route;

      if (route) {
        window.location.href = route;
        return;
      }

      if (btn.dataset.page === "Trades") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast("Trades", "You are already on the Trades page.");
      } else {
        toast(btn.dataset.page, `${btn.dataset.page} page is not included in this Trades-only file.`);
      }

      document.body.classList.remove("sidebar-open");
    }));
    $("#mobileMenuBtn").addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay").addEventListener("click", () => document.body.classList.remove("sidebar-open"));

    $("#profileBtn").addEventListener("click", e => {
      e.stopPropagation();
      $("#profilePopover").hidden = !$("#profilePopover").hidden;
      $("#accountPopover").hidden = true;
    });
    $$("[data-profile-action]").forEach(btn => btn.addEventListener("click", () => {
      $("#profilePopover").hidden = true;
      const action = btn.dataset.profileAction;
      if (action === "logout") return toast("Demo action", "Sign out is disabled in this frontend demo.");
      info(action === "profile" ? "Trader Profile" : "Account Settings", "ProTrade account information", `<p><strong>Trader:</strong> Arjun Trader</p><p><strong>Plan:</strong> Elite Trader</p><p><strong>Broker:</strong> IC Markets</p>`);
    }));

    $("#balanceVisibilityBtn").addEventListener("click", () => {
      state.balanceHidden = !state.balanceHidden;
      $("#sidebarBalance").textContent = state.balanceHidden ? "••••••••" : "$12,540.00";
      $("#sidebarEquity").textContent = state.balanceHidden ? "••••••••" : "$13,214.75";
      toast(state.balanceHidden ? "Balance hidden" : "Balance visible");
    });

    $("#importTradesBtn").addEventListener("click", () => $("#importTradesInput").click());
    $("#importTradesInput").addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) toast("Import selected", `${file.name} is ready for backend upload.`);
      e.target.value = "";
    });
  }

  function setupHeader() {
    $("#dateRangeBtn").addEventListener("click", () => openModal("dateModal"));
    $("#dateForm").addEventListener("submit", e => {
      e.preventDefault();
      const start = new Date($("#startDate").value + "T00:00:00");
      const end = new Date($("#endDate").value + "T00:00:00");
      if (start > end) return toast("Invalid date range", "Start date must be before end date.");
      const f = new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric"});
      $("#dateRangeLabel").textContent = `${f.format(start)} - ${f.format(end)}`;
      closeModal("dateModal");
      toast("Date range updated");
    });

    $("#accountSelectorBtn").addEventListener("click", e => {
      e.stopPropagation();
      $("#accountPopover").hidden = !$("#accountPopover").hidden;
      $("#profilePopover").hidden = true;
    });
    $$("[data-account]").forEach(btn => btn.addEventListener("click", () => {
      $("#accountLabel").textContent = btn.dataset.account;
      $("#accountPopover").hidden = true;
      toast("Account changed", btn.dataset.account);
    }));

    $("#notificationBtn").addEventListener("click", () => info("Notifications", "Latest trading updates", "<ul><li>Monthly performance report is ready.</li><li>One trade is waiting for review.</li><li>Daily risk is within your limit.</li></ul>"));
    $("#newTradeBtn").addEventListener("click", () => openModal("tradeModal"));
  }

  function setupContentActions() {
    $("#filterBtn").addEventListener("click", () => openModal("filterModal"));
    $("#filterForm").addEventListener("submit", e => { e.preventDefault(); applyFilters(); closeModal("filterModal"); });
    $("#clearFilterBtn").addEventListener("click", () => { $("#filterSymbol").value = "all"; $("#filterResult").value = "all"; applyFilters(); closeModal("filterModal"); });
    $("#groupBtn").addEventListener("click", () => info("Group Trades", "Current grouping preview", "<p>Trades are grouped by <strong>Strategy</strong> in this demo.</p><ul><li>London Breakout: 1</li><li>Supply Reversal: 1</li><li>Trend Continuation: 1</li><li>Breakout: 1</li><li>Liquidity Sweep: 1</li></ul>"));
    $("#sortBtn").addEventListener("click", toggleSort);
    $("#moreBtn").addEventListener("click", () => info("More Actions", "Additional table actions", "<ul><li>Export CSV</li><li>Save current view</li><li>Duplicate workspace</li><li>Archive selected trade</li></ul>"));
document.addEventListener("click", () => { $("#accountPopover").hidden = true; $("#profilePopover").hidden = true; });
  }

  function applyFilters() {
    const symbol = $("#filterSymbol").value;
    const result = $("#filterResult").value;
    $$("#tradeBody tr").forEach(row => {
      const rowSymbol = row.children[2].textContent.trim();
      const rowResult = row.children[10].textContent.trim();
      row.classList.toggle("filtered-out", (symbol !== "all" && rowSymbol !== symbol) || (result !== "all" && rowResult !== result));
    });
    toast("Filters applied", `${symbol === "all" ? "All symbols" : symbol}, ${result === "all" ? "all results" : result}`);
  }

  function toggleSort() {
    state.sortDesc = !state.sortDesc;
    const body = $("#tradeBody");
    const rows = $$("tr", body).sort((a,b) => {
      const parse = t => new Date(t.replace(/(\d{2}) (\w{3}) (\d{4})/, "$2 $1, $3")).getTime();
      const av = parse(a.children[1].textContent.trim());
      const bv = parse(b.children[1].textContent.trim());
      return state.sortDesc ? bv-av : av-bv;
    });
    rows.forEach(r => body.appendChild(r));
    toast("Sorted", state.sortDesc ? "Newest first" : "Oldest first");
  }

  function setupTabsAndTable() {
    $$("#tradeTabs button").forEach(btn => btn.addEventListener("click", () => {
      $$("#tradeTabs button").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$("#tradeBody tr").forEach(row => {
        let show = true;
        if (tab === "open") show = row.dataset.status === "open";
        if (tab === "closed") show = row.dataset.status === "closed";
        if (tab === "unreviewed") show = row.dataset.reviewed === "false";
        row.classList.toggle("filtered-out", !show);
      });
      toast("Tab changed", btn.textContent.trim());
    }));
    $("#dateSortBtn").addEventListener("click", toggleSort);

    $("#tradeBody").addEventListener("click", e => {
      const tool = e.target.closest("[data-row-tool]");
      if (tool) { e.stopPropagation(); return toast("Row action", `${tool.dataset.rowTool} action clicked.`); }
      const star = e.target.closest(".stars button");
      if (star) {
        e.stopPropagation();
        const wrap = star.parentElement;
        const buttons = [...wrap.children];
        const rating = buttons.indexOf(star) + 1;
        buttons.forEach((b,i) => b.textContent = i < rating ? "★" : "☆");
        toast("Review rating updated", `${rating} star${rating > 1 ? "s" : ""}`);
        return;
      }
      const row = e.target.closest("tr");
      if (!row) return;
      $$("#tradeBody tr").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      state.selectedRow = row;
      toast("Trade selected", row.children[0].textContent.trim());
    });
  }

  function setupPagination() {
    $("#pagination").addEventListener("click", e => {
      const btn = e.target.closest("button"); if (!btn) return;
      const p = btn.dataset.page;
      if (p === "prev") state.page = Math.max(1, state.page - 1);
      else if (p === "next") state.page = Math.min(46, state.page + 1);
      else state.page = Number(p);
      $$("#pagination button").forEach(x => x.classList.toggle("active", Number(x.dataset.page) === state.page));
      const start = (state.page - 1) * state.pageSize + 1;
      $("#visibleFrom").textContent = start;
      $("#visibleTo").textContent = Math.min(start + state.pageSize - 1, state.totalTrades);
      toast("Page changed", `Page ${state.page}`);
    });
    $("#pageSizeSelect").addEventListener("change", e => {
      state.pageSize = Number(e.target.value); state.page = 1;
      $("#visibleFrom").textContent = "1"; $("#visibleTo").textContent = String(Math.min(state.pageSize,state.totalTrades));
      toast("Rows per page", `${state.pageSize} rows`);
    });
  }

  function setupMetricsAndDetails() {
    $$("[data-metric]").forEach(btn => btn.addEventListener("click", () => info(btn.dataset.metric, "Metric detail", `<p>${btn.dataset.metric} card selected.</p><p>Connect this card to the detailed analytics module or backend endpoint.</p>`)));
    $("#backToTradesBtn").addEventListener("click", () => $(".trade-section").scrollIntoView({behavior:"smooth",block:"start"}));
    $("#editTradeBtn").addEventListener("click", () => openModal("editModal"));
    $("#editForm").addEventListener("submit", e => { e.preventDefault(); closeModal("editModal"); toast("Trade updated", "Changes saved in the frontend demo."); });
    $("#exportTradeBtn").addEventListener("click", () => {
      const blob = new Blob(["Trade ID,Symbol,Direction,Net P&L,R Multiple\nTRD-2026-000145,EURUSD,Long,119.00,2.38R\n"], {type:"text/csv"});
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="protrade-trade-detail.csv"; a.click(); URL.revokeObjectURL(url); toast("Export complete", "CSV downloaded.");
    });
    $("#shareTradeBtn").addEventListener("click", async () => {
      const text = "ProTrade: EURUSD Long, +$119.00, 2.38R";
      try { if (navigator.share) await navigator.share({title:"ProTrade Trade",text}); else await navigator.clipboard.writeText(text); toast("Share ready", navigator.share ? "Share sheet opened." : "Trade summary copied."); }
      catch { toast("Share cancelled"); }
    });
    $$(".screenshot").forEach(btn => btn.addEventListener("click", () => info(`Screenshot ${btn.dataset.shot}`, "Trade chart preview", `<img src="assets/chart-${btn.dataset.shot}.jpg" style="width:100%;border-radius:10px" alt="Screenshot preview" />`)));
    $("#addScreenshotBtn").addEventListener("click", () => $("#screenshotInput").click());
    $("#screenshotInput").addEventListener("change", e => { const file=e.target.files[0]; if(file) toast("Screenshot selected", file.name); e.target.value=""; });
  }

  function setupTradeForm() {
    $("#tradeForm").addEventListener("submit", e => {
      e.preventDefault();
      const d = new FormData(e.currentTarget);
      const pnl = Number(d.get("pnl"));
      const row = document.createElement("tr");
      const rawDate = new Date(String(d.get("date")) + "T00:00:00");
      const date = new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(rawDate);
      const direction = String(d.get("direction"));
      row.dataset.status = "closed"; row.dataset.reviewed = "false";
      row.innerHTML = `<td>${d.get("tradeId")}</td><td>${date}</td><td><span class="tag symbol eur">${String(d.get("symbol")).toUpperCase()}</span></td><td><span class="tag ${direction.toLowerCase()}">${direction}</span></td><td>${d.get("strategy")}</td><td>${d.get("session")}</td><td>${d.get("entry")}</td><td>${d.get("exit")}</td><td class="${pnl>=0?"positive":"negative"}">${money(pnl,true)}</td><td class="${pnl>=0?"positive":"negative"}">${d.get("rMultiple")}</td><td class="${pnl>=0?"positive":"negative"}">${pnl>=0?"Win":"Loss"}</td><td><div class="row-tools"><button data-row-tool="image">▧</button><button data-row-tool="camera">▣</button><button data-row-tool="link">⌁</button><button data-row-tool="comment">○</button></div></td>`;
      $("#tradeBody").prepend(row);
      state.totalTrades += 1; state.netProfit += pnl;
      ["#totalTradeCount","#metricTotalTrades","#footerTotalTrades"].forEach(id => $(id).textContent=String(state.totalTrades));
      $("#metricNetProfit").textContent = money(state.netProfit,true);
      closeModal("tradeModal");
      toast("Trade added", `${d.get("tradeId")} saved successfully.`);
      e.currentTarget.reset();
    });
  }

  function setupModalClose() {
    $$("[data-close]").forEach(btn => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
    $$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", e => { if(e.target===backdrop) closeModal(backdrop.id); }));
  }

  function drawEquitySpark() {
    const canvas = $("#equitySpark"); if(!canvas) return;
    const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1,Math.round(rect.width*dpr)); canvas.height = Math.max(1,Math.round(rect.height*dpr));
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
    const vals=[7,9,8,11,13,10,9,12,11,14,12,15,13,17,16,20,18,22,19,24,21,26,23,28,27];
    const min=Math.min(...vals), max=Math.max(...vals), pad=3;
    const pts=vals.map((v,i)=>[pad+i/(vals.length-1)*(rect.width-pad*2),rect.height-pad-(v-min)/(max-min)*(rect.height-pad*2)]);
    ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--green").trim(); ctx.lineWidth=1.7; ctx.lineJoin="round"; ctx.lineCap="round"; ctx.stroke();
    ctx.lineTo(pts.at(-1)[0],rect.height); ctx.lineTo(pts[0][0],rect.height); ctx.closePath();
    const g=ctx.createLinearGradient(0,0,0,rect.height); g.addColorStop(0,"rgba(32,173,96,.20)"); g.addColorStop(1,"rgba(32,173,96,0)"); ctx.fillStyle=g; ctx.fill();
  }

  function init() {
    setupTheme(); setupSidebar(); setupHeader(); setupContentActions(); setupTabsAndTable(); setupPagination(); setupMetricsAndDetails(); setupTradeForm(); setupModalClose(); drawEquitySpark();
    window.addEventListener("resize", () => { clearTimeout(window.__sparkTimer); window.__sparkTimer=setTimeout(drawEquitySpark,100); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
