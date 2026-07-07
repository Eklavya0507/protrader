(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = window.ProTradeAuth?.API_BASE || "https://protrader-backend-n8oj.onrender.com/api";
  const ENDPOINTS = {
    settings: `${API_BASE}/settings`,
    trades: `${API_BASE}/trades`,
    alertSummary: `${API_BASE}/security/alerts/summary`,
    me: `${API_BASE}/auth/me`,
    password: `${API_BASE}/auth/change-password`,
    sessions: `${API_BASE}/auth/sessions`,
    logoutOthers: `${API_BASE}/auth/sessions/logout-others`,
    accountExport: `${API_BASE}/account/export`,
    accountDelete: `${API_BASE}/account`,
    emailChange: `${API_BASE}/account/email-change`,
  };

  const state = {
    settings: {},
    trades: [],
    sessions: [],
    user: null,
    alertSummary: null,
    activeView: localStorage.getItem("protrade-settings-view") || "account",
    theme: localStorage.getItem("protrade-theme") || "dark",
    accent: localStorage.getItem("protrade-accent") || "green",
    density: localStorage.getItem("protrade-density") || "balanced",
    balanceHidden: false,
    systemThemeQuery: window.matchMedia("(prefers-color-scheme: dark)"),
  };

  const viewKeywords = {
    account: "profile name email timezone role account",
    preferences: "preferences language region date currency compact",
    appearance: "appearance theme light dark system accent density",
    notifications: "notifications email reminders weekly summary",
    trading: "trading defaults balance target risk daily loss session rr",
    connections: "connections brokers metatrader tradingview drive sync",
    subscription: "subscription billing plan price invoices",
    security: "security password two factor sessions devices alerts activity",
    data: "data privacy export import reset backup delete account",
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const optionalNumber = (value) => value === "" || value == null ? undefined : (Number.isFinite(Number(value)) ? Number(value) : undefined);
  const formatDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const resultOf = (trade) => {
    const result = String(trade?.result || "").toLowerCase();
    if (["win","loss","breakeven","open"].includes(result)) return result;
    return number(trade?.profitLoss) > 0 ? "win" : number(trade?.profitLoss) < 0 ? "loss" : "breakeven";
  };
  const initials = (name) => String(name || "Trader").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "T";

  const toast = (title, message = "") => {
    const stack = $("#toastStack"); if (!stack) return;
    const node = document.createElement("div"); node.className = "toast";
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    stack.appendChild(node); setTimeout(() => node.remove(), 3500);
  };
  const openModal = (id) => { const node=document.getElementById(id); if(!node)return; node.hidden=false; document.body.style.overflow="hidden"; };
  const closeModal = (id) => { const node=document.getElementById(id); if(!node)return; node.hidden=true; if(!$$('.modal-backdrop:not([hidden])').length) document.body.style.overflow=""; };
  const showInfo = (title, subtitle, html) => { $("#infoModalTitle").textContent=title; $("#infoModalSubtitle").textContent=subtitle; $("#infoModalBody").innerHTML=html; openModal("infoModal"); };
  const setText = (selector, value) => { const node=typeof selector==="string"?$(selector):selector; if(node) node.textContent=value; };
  const setBusy = (button, busy, label="Working…") => { if(!button)return; if(busy){button.dataset.oldText=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.oldText||button.textContent;button.disabled=false;} };

  const apiJson = async (url, options = {}) => {
    const headers = new Headers(options.headers || undefined);
    headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await window.fetch(url, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.message || `Request failed with HTTP ${response.status}`);
    return body;
  };

  const resolveTheme = (choice) => choice === "system" ? (state.systemThemeQuery.matches ? "dark" : "light") : choice === "light" ? "light" : "dark";
  const applyTheme = (choice, animate = false, saveRemote = false) => {
    choice = String(choice || "dark").toLowerCase();
    if (!["dark","light","system"].includes(choice)) choice = "dark";
    state.theme = choice;
    const resolved = resolveTheme(choice);
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem("protrade-theme", choice);
    setText("#sidebarThemeLabel", choice === "system" ? `System · ${resolved === "dark" ? "Dark" : "Light"}` : resolved === "dark" ? "Dark Mode" : "Light Mode");
    setText("#headerThemeLabel", choice === "system" ? "Auto" : resolved === "dark" ? "Dark" : "Light");
    $$('[data-theme-toggle]').forEach(b => { b.setAttribute("aria-checked", String(resolved === "dark")); b.setAttribute("aria-label", resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"); });
    $$('[data-theme-choice]').forEach(b => b.classList.toggle("selected", b.dataset.themeChoice === choice));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#06111f" : "#f5f9fc");
    if (animate) { const flash=$("#themeTransitionFlash"); if(flash){flash.classList.remove("animate");void flash.offsetWidth;flash.classList.add("animate");setTimeout(()=>flash.classList.remove("animate"),650);} }
    if (saveRemote) apiJson(ENDPOINTS.settings,{method:"PUT",body:JSON.stringify({theme:choice==="system"?"System":resolved==="dark"?"Dark":"Light"})}).then(b=>{state.settings=b.data||state.settings;}).catch(e=>toast("Theme not synced",e.message));
  };
  const applyAccent = (accent) => { state.accent=accent; document.documentElement.dataset.accent=accent==="green"?"":accent; localStorage.setItem("protrade-accent",accent); $$('[data-accent]').forEach(b=>b.classList.toggle("selected",b.dataset.accent===accent)); };
  const applyDensity = (density) => { state.density=density; document.documentElement.dataset.density=density; localStorage.setItem("protrade-density",density); $$('[data-density]').forEach(b=>b.classList.toggle("active",b.dataset.density===density)); $("#compactModeToggle") && ($("#compactModeToggle").checked=density==="compact"); };

  const activateSettingsView = (view, remember = true) => {
    if (!viewKeywords[view]) return;
    state.activeView=view; if(remember)localStorage.setItem("protrade-settings-view",view);
    $$(".settings-nav-item").forEach(b=>b.classList.toggle("active",b.dataset.settingsView===view));
    $$(".settings-view").forEach(p=>p.classList.toggle("active",p.dataset.view===view));
    $("#settingsEmpty").hidden=true;
    $(".settings-content-panel")?.scrollTo({top:0,behavior:"smooth"});
  };

  const money = (value) => {
    const currency=state.settings.currency||"USD";
    try{return new Intl.NumberFormat("en-US",{style:"currency",currency,minimumFractionDigits:currency==="JPY"?0:2,maximumFractionDigits:currency==="JPY"?0:2}).format(number(value));}
    catch{return `$${number(value).toFixed(2)}`;}
  };
  const calculateStats = () => {
    const wins=state.trades.filter(t=>resultOf(t)==="win").length;
    const losses=state.trades.filter(t=>resultOf(t)==="loss").length;
    const breakeven=state.trades.filter(t=>resultOf(t)==="breakeven").length;
    const net=state.trades.reduce((s,t)=>s+number(t.profitLoss),0);
    return {total:state.trades.length,wins,losses,breakeven,net};
  };

  const updateHeaderAndSummary = () => {
    const user=state.user||window.ProTradeAuth?.getUser?.()||{};
    const name=state.settings.fullName||user.name||"Trader";
    const role=state.settings.tradingRole||"Independent Trader";
    $$(".auth-user-name").forEach(n=>n.textContent=name);
    $$(".auth-user-initials").forEach(n=>n.textContent=initials(name));
    setText("#profileRole",role);
    setText("#settingsMiniEmail",user.email || state.settings.email || "Signed-in account");
    setText("#profileAvatarPreview",initials(name));
    if(user.avatarUrl){ const p=$("#profileAvatarPreview"); p.style.backgroundImage=`url("${String(user.avatarUrl).replaceAll('"','%22')}")`; p.textContent=""; }
    const stats=calculateStats();
    const balance=number(state.settings.startingBalance)+stats.net;
    if(!state.balanceHidden){setText("#sidebarBalance",money(balance));setText("#sidebarEquity",money(balance));}
    setText("#footerTotalTrades",stats.total);
    setText("#footerWins",`${stats.wins} (${stats.total?(stats.wins/stats.total*100).toFixed(1):"0.0"}%)`);
    setText("#footerLosses",`${stats.losses} (${stats.total?(stats.losses/stats.total*100).toFixed(1):"0.0"}%)`);
    setText("#footerBreakeven",`${stats.breakeven} (${stats.total?(stats.breakeven/stats.total*100).toFixed(1):"0.0"}%)`);
    setText("#notificationBadge",number(state.alertSummary?.unread));
  };

  const fillForms = () => {
    const user=state.user||{}; const s=state.settings||{};
    $("#fullNameInput").value=s.fullName||user.name||"Trader";
    $("#emailInput").value=user.email||s.email||"";
    $("#timezoneSelect").value=s.timezone||"Asia/Kolkata";
    if(!$("#timezoneSelect").value){ const o=document.createElement("option");o.value=s.timezone;o.textContent=s.timezone;$("#timezoneSelect").append(o);$("#timezoneSelect").value=s.timezone; }
    $("#tradingRoleInput").value=s.tradingRole||"Independent Trader";
    $("#dateFormatSelect").value=s.dateFormat||"DD MMM YYYY";
    $("#currencySelect").value=s.currency||"USD";
    $("#tradeRemindersToggle").checked=s.tradeReminders!==false;
    $("#weeklySummaryToggle").checked=s.weeklySummary!==false;
    $("#emailNotificationsToggle").checked=s.emailNotifications===true;
    const form=$("#tradingDefaultsForm");
    ["startingBalance","targetBalance","riskPerTrade","maxDailyLoss","maxTradesPerDay","defaultRR","preferredSession"].forEach(k=>{if(form.elements[k])form.elements[k].value=s[k]??"";});
    setText("#profileSaveState","Profile synced with backend"); setText("#preferencesSaveState","Preferences synced"); setText("#tradingSaveState","Trading defaults loaded");
  };

  const renderSessions = () => {
    const list=$("#sessionList"); if(!list)return; list.innerHTML="";
    if(!state.sessions.length){list.innerHTML='<div class="session-row"><span class="device-icon">▣</span><div><strong>No active managed sessions</strong><p>Refresh the page once if this is a legacy session.</p></div></div>';return;}
    for(const session of state.sessions){
      const row=document.createElement("div"); row.className=`session-row${session.isCurrent?" current":""}`;
      const last=session.lastActiveAt?new Date(session.lastActiveAt).toLocaleString():"Unknown";
      row.innerHTML=`<span class="device-icon">${session.deviceType==="mobile"?"▯":"▣"}</span><div><strong>${escapeHtml(session.operatingSystem||"Unknown OS")} · ${escapeHtml(session.browser||"Unknown browser")}</strong><p>${escapeHtml(session.approximateLocation||session.timezone||"Location unavailable")} · Last active ${escapeHtml(last)}</p></div><div class="session-actions"></div>`;
      const actions=$(".session-actions",row);
      if(session.isCurrent){const badge=document.createElement("span");badge.className="status-pill success";badge.textContent="Current";actions.append(badge);} else {
        const trust=document.createElement("button");trust.type="button";trust.textContent=session.isTrusted?"Untrust":"Trust";trust.addEventListener("click",()=>setSessionTrust(session,!session.isTrusted));actions.append(trust);
        const revoke=document.createElement("button");revoke.type="button";revoke.className="danger";revoke.textContent="Revoke";revoke.addEventListener("click",()=>revokeSession(session));actions.append(revoke);
      }
      list.append(row);
    }
  };

  const loadEmailChangeStatus = async () => {
    try{
      const body=await apiJson(`${ENDPOINTS.emailChange}/status`);
      const pending=body.pending===true; setText("#emailChangeStatus",pending?"Pending approval":"No pending request");
      $("#emailChangeStatus").className=`status-pill ${pending?"warning":"success"}`;
      $("#cancelEmailChangeBtn").hidden=!pending;
    }catch(e){setText("#emailChangeStatus","Unavailable");}
  };

  const loadData = async () => {
    try{
      await window.ProTradeAuth?.ready;
      state.user=window.ProTradeAuth?.getUser?.()||null;
      const [settingsBody,tradesBody,alertsBody,sessionsBody]=await Promise.all([
        apiJson(ENDPOINTS.settings),apiJson(ENDPOINTS.trades),apiJson(ENDPOINTS.alertSummary).catch(()=>({data:{unread:0}})),apiJson(ENDPOINTS.sessions).catch(()=>({data:[]})),
      ]);
      state.settings=settingsBody.data||{}; state.trades=Array.isArray(tradesBody.data)?tradesBody.data:[]; state.alertSummary=alertsBody.data||alertsBody.summary||alertsBody||{}; state.sessions=Array.isArray(sessionsBody.data)?sessionsBody.data:[];
      applyTheme(state.settings.theme||state.theme,false,false); fillForms(); updateHeaderAndSummary(); renderSessions(); await loadEmailChangeStatus();
    }catch(error){toast("Settings could not load",error.message); setText("#profileSaveState","Backend connection failed");}
  };

  const setSessionTrust = async (session, trusted) => {
    try{await apiJson(`${ENDPOINTS.sessions}/${encodeURIComponent(session.id)}/trust`,{method:"PATCH",body:JSON.stringify({trusted})});session.isTrusted=trusted;renderSessions();toast("Device updated",trusted?"Device marked trusted.":"Device trust removed.");}
    catch(e){toast("Device not updated",e.message);}
  };
  const revokeSession = async (session) => {
    if(!confirm(`Sign out ${session.deviceName||session.browser||"this device"}?`))return;
    try{await apiJson(`${ENDPOINTS.sessions}/${encodeURIComponent(session.id)}`,{method:"DELETE"});state.sessions=state.sessions.filter(s=>s.id!==session.id);renderSessions();toast("Session revoked","The selected device was signed out.");}
    catch(e){toast("Session not revoked",e.message);}
  };

  const parseCsv = (text) => {
    const lines=text.split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2)return[];
    const parseLine=(line)=>{const a=[];let v="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&q){v+='"';i++;}else if(c==='"')q=!q;else if(c===","&&!q){a.push(v.trim());v="";}else v+=c;}a.push(v.trim());return a;};
    const h=parseLine(lines[0]);return lines.slice(1).map(l=>{const v=parseLine(l);return Object.fromEntries(h.map((x,i)=>[x,v[i]??""]));});
  };
  const normalizeImportTrade = (raw) => {
    const pnl=optionalNumber(raw.profitLoss??raw.pnl??raw["Net P&L"]??raw["P&L"]);const sr=String(raw.session||"Other").toLowerCase();
    const session=sr.includes("london")?"London":sr.includes("new york")||sr==="ny"?"New York":sr.includes("asia")||sr.includes("tokyo")?"Asian":"Other";
    const dr=String(raw.direction||raw.side||"Long").toLowerCase();const direction=dr.includes("short")||dr.includes("sell")?"Short":"Long";
    const rr=String(raw.result||"").toLowerCase();const result=["win","loss","breakeven","open"].includes(rr)?rr[0].toUpperCase()+rr.slice(1):(pnl>0?"Win":pnl<0?"Loss":"Breakeven");
    return {tradeDate:raw.tradeDate||raw.date,symbol:String(raw.symbol||raw.pair||"").trim().toUpperCase(),direction,session,model:raw.model||raw.strategy||"",protocol:raw.protocol||"",entryTime:raw.entryTime||"",exitTime:raw.exitTime||"",entryPrice:optionalNumber(raw.entryPrice??raw.entry),exitPrice:optionalNumber(raw.exitPrice??raw.exit),stopLoss:optionalNumber(raw.stopLoss),takeProfit:optionalNumber(raw.takeProfit),commission:optionalNumber(raw.commission)??0,quantity:optionalNumber(raw.quantity??raw.lotSize)??1,profitLoss:pnl??0,rr:optionalNumber(raw.rr??raw.rMultiple)??0,result,rating:optionalNumber(raw.rating),notes:String(raw.notes||""),screenshotUrl:String(raw.screenshotUrl||"")};
  };
  const importTrades = async (file) => {
    const text=await file.text();let rows;if(file.name.toLowerCase().endsWith(".json")){const p=JSON.parse(text);rows=Array.isArray(p)?p:Array.isArray(p.data)?p.data:[]}else rows=parseCsv(text);
    const valid=rows.slice(0,100).map(normalizeImportTrade).filter(t=>t.tradeDate&&t.symbol&&t.entryPrice!==undefined);if(!valid.length)throw new Error("No valid rows found. Required: tradeDate/date, symbol/pair and entryPrice/entry.");
    let saved=0;for(const trade of valid){await apiJson(ENDPOINTS.trades,{method:"POST",body:JSON.stringify(trade)});saved++;}toast("Import complete",`${saved} trades saved to MongoDB.`);await loadData();
  };

  const setupNavigationAndShell = () => {
    $$("[data-route]").forEach(b=>b.addEventListener("click",()=>{window.location.href=b.dataset.route;}));
    $$(".settings-nav-item").forEach(b=>b.addEventListener("click",()=>activateSettingsView(b.dataset.settingsView)));
    activateSettingsView(state.activeView,false);
    $("#mobileMenuBtn")?.addEventListener("click",()=>document.body.classList.add("sidebar-open"));
    $("#sidebarOverlay")?.addEventListener("click",()=>document.body.classList.remove("sidebar-open"));
    $("#profileBtn")?.addEventListener("click",e=>{e.stopPropagation();$("#profilePopover").hidden=!$("#profilePopover").hidden;$("#accountSelectorPopover").hidden=true;});
    $$('[data-profile-action]').forEach(b=>b.addEventListener("click",async()=>{ $("#profilePopover").hidden=true; if(b.dataset.profileAction==="logout"){await window.ProTradeAuth?.logout?.();return;} activateSettingsView("account"); }));
    $("#accountSelectorBtn")?.addEventListener("click",e=>{e.stopPropagation();$("#accountSelectorPopover").hidden=!$("#accountSelectorPopover").hidden;});
    $$('[data-account]').forEach(b=>b.addEventListener("click",()=>{$("#accountSelectorPopover").hidden=true;toast("All Accounts","Separate broker accounts are not in the current backend schema.");}));
    $("#balanceVisibilityBtn")?.addEventListener("click",()=>{state.balanceHidden=!state.balanceHidden;if(state.balanceHidden){setText("#sidebarBalance","••••••••");setText("#sidebarEquity","••••••••");}else updateHeaderAndSummary();});
    $("#notificationBtn")?.addEventListener("click",()=>activateSettingsView("security"));
    $("#newTradeBtn")?.addEventListener("click",()=>openModal("tradeModal"));
    $("#importTradesBtn")?.addEventListener("click",()=>$("#importTradesInput").click());
    $("#importTradesInput")?.addEventListener("change",async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{await importTrades(f);}catch(err){toast("Import failed",err.message);}});
    $("#dateRangeBtn")?.addEventListener("click",()=>openModal("dateModal"));
    $("#settingsSearchInput")?.addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();if(!q){activateSettingsView(state.activeView,false);return;}const hit=Object.entries(viewKeywords).find(([,v])=>v.includes(q));if(hit)activateSettingsView(hit[0],false);else{$$(".settings-view").forEach(p=>p.classList.remove("active"));$("#settingsEmpty").hidden=false;}});
    $("#clearSearchBtn")?.addEventListener("click",()=>{$("#settingsSearchInput").value="";activateSettingsView(state.activeView,false);});
    document.addEventListener("click",()=>{$("#profilePopover")&&($("#profilePopover").hidden=true);$("#accountSelectorPopover")&&($("#accountSelectorPopover").hidden=true);});
  };

  const setupForms = () => {
    $("#profileForm")?.addEventListener("input",()=>setText("#profileSaveState","Unsaved changes"));
    $("#profileForm")?.addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Saving…");try{const fd=new FormData(e.currentTarget);const fullName=String(fd.get("fullName")||"").trim();const [userBody,settingsBody]=await Promise.all([apiJson(ENDPOINTS.me,{method:"PUT",body:JSON.stringify({name:fullName})}),apiJson(ENDPOINTS.settings,{method:"PUT",body:JSON.stringify({fullName,timezone:fd.get("timezone"),tradingRole:fd.get("tradingRole")})})]);state.user=userBody.data||state.user;state.settings=settingsBody.data||state.settings;if(window.ProTradeAuth?.USER_KEY)sessionStorage.setItem(window.ProTradeAuth.USER_KEY,JSON.stringify(state.user));fillForms();updateHeaderAndSummary();toast("Profile saved","Name, timezone and trading role updated.");}catch(err){toast("Profile not saved",err.message);}finally{setBusy(button,false);}});
    $("#emailChangeForm")?.addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Sending approvals…");try{const fd=new FormData(e.currentTarget);const body=await apiJson(`${ENDPOINTS.emailChange}/request`,{method:"POST",body:JSON.stringify({newEmail:fd.get("newEmail"),currentPassword:fd.get("currentPassword")})});toast("Email change requested",body.message);e.currentTarget.reset();await loadEmailChangeStatus();}catch(err){toast("Request failed",err.message);}finally{setBusy(button,false);}});
    $("#cancelEmailChangeBtn")?.addEventListener("click",async()=>{if(!confirm("Cancel the pending email change request?"))return;try{const b=await apiJson(`${ENDPOINTS.emailChange}/cancel`,{method:"POST"});toast("Email change",b.message);await loadEmailChangeStatus();}catch(e){toast("Could not cancel",e.message);}});
    $("#savePreferencesBtn")?.addEventListener("click",async()=>{const b=$("#savePreferencesBtn");setBusy(b,true,"Saving…");try{const body=await apiJson(ENDPOINTS.settings,{method:"PUT",body:JSON.stringify({dateFormat:$("#dateFormatSelect").value,currency:$("#currencySelect").value})});state.settings=body.data||state.settings;setText("#preferencesSaveState","Preferences saved to MongoDB");updateHeaderAndSummary();toast("Preferences saved","Date format and currency updated.");}catch(e){toast("Preferences not saved",e.message);}finally{setBusy(b,false);}});
    $("#compactModeToggle")?.addEventListener("change",e=>applyDensity(e.target.checked?"compact":"balanced"));
    $$("[data-theme-toggle]").forEach(b=>b.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark",true,true)));
    $$("[data-theme-choice]").forEach(b=>b.addEventListener("click",()=>{applyTheme(b.dataset.themeChoice,true,true);toast("Theme updated",b.dataset.themeChoice==="system"?"Following your device theme.":`${b.dataset.themeChoice} mode enabled.`);}));
    $$("[data-accent]").forEach(b=>b.addEventListener("click",()=>{applyAccent(b.dataset.accent);toast("Accent updated","Saved on this device.");}));
    $$("[data-density]").forEach(b=>b.addEventListener("click",()=>{applyDensity(b.dataset.density);toast("Density updated","Saved on this device.");}));
    for(const [id,field] of [["tradeRemindersToggle","tradeReminders"],["weeklySummaryToggle","weeklySummary"],["emailNotificationsToggle","emailNotifications"]]){$(`#${id}`)?.addEventListener("change",async e=>{try{const body=await apiJson(ENDPOINTS.settings,{method:"PUT",body:JSON.stringify({[field]:e.target.checked})});state.settings=body.data||state.settings;toast("Notification preference saved",e.target.checked?"Enabled":"Disabled");}catch(err){e.target.checked=!e.target.checked;toast("Preference not saved",err.message);}});}
    $("#testNotificationBtn")?.addEventListener("click",()=>toast("Test notification","In-app notification display is working. No email was sent."));
    $("#tradingDefaultsForm")?.addEventListener("input",()=>setText("#tradingSaveState","Unsaved changes"));
    $("#tradingDefaultsForm")?.addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Saving…");try{const fd=new FormData(e.currentTarget);const payload={startingBalance:number(fd.get("startingBalance")),targetBalance:number(fd.get("targetBalance")),riskPerTrade:number(fd.get("riskPerTrade")),maxDailyLoss:number(fd.get("maxDailyLoss")),maxTradesPerDay:number(fd.get("maxTradesPerDay")),defaultRR:number(fd.get("defaultRR")),preferredSession:fd.get("preferredSession")};const body=await apiJson(ENDPOINTS.settings,{method:"PUT",body:JSON.stringify(payload)});state.settings=body.data||state.settings;setText("#tradingSaveState","Trading defaults saved to MongoDB");updateHeaderAndSummary();toast("Trading defaults saved","Dashboard and Calendar will use the new values.");}catch(err){toast("Defaults not saved",err.message);}finally{setBusy(button,false);}});
    $("#passwordForm")?.addEventListener("submit",async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');const fd=new FormData(e.currentTarget);if(fd.get("newPassword")!==fd.get("confirmPassword"))return toast("Password mismatch","New password and confirmation do not match.");setBusy(button,true,"Changing…");try{const body=await apiJson(ENDPOINTS.password,{method:"PUT",body:JSON.stringify(Object.fromEntries(fd.entries()))});if(body.token)await window.ProTradeAuth?.upgradeToken?.(body.token,body.data||null);toast("Password changed",body.message);e.currentTarget.reset();await loadData();}catch(err){toast("Password not changed",err.message);}finally{setBusy(button,false);}});
    $("#revokeAllBtn")?.addEventListener("click",async()=>{if(!confirm("Sign out all other devices?"))return;try{const body=await apiJson(ENDPOINTS.logoutOthers,{method:"POST"});toast("Other sessions revoked",body.message);await loadData();}catch(e){toast("Sessions not revoked",e.message);}});
  };

  const setupDataAndModals = () => {
    $("#exportDataBtn")?.addEventListener("click",async()=>{const b=$("#exportDataBtn");setBusy(b,true,"Exporting…");try{const response=await window.fetch(ENDPOINTS.accountExport,{headers:{Accept:"application/json"}});if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(e.message||`Export failed with HTTP ${response.status}`);}const blob=await response.blob();const disposition=response.headers.get("content-disposition")||"";const name=disposition.match(/filename="?([^";]+)"?/i)?.[1]||`protrade-account-data-${formatDateInput(new Date())}.json`;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Account data exported","Secure JSON archive downloaded.");}catch(e){toast("Export failed",e.message);}finally{setBusy(b,false);}});
    $("#importDataBtn")?.addEventListener("click",()=>$("#importDataInput").click());
    $("#importDataInput")?.addEventListener("change",async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{await importTrades(f);}catch(err){toast("Import failed",err.message);}});
    $("#resetSettingsBtn")?.addEventListener("click",async()=>{if(!confirm("Reset workspace settings to backend defaults? Trades will remain unchanged."))return;try{const body=await apiJson(`${ENDPOINTS.settings}/reset`,{method:"POST"});state.settings=body.data||{};applyTheme(state.settings.theme||"Dark",true,false);fillForms();updateHeaderAndSummary();toast("Settings reset",body.message);}catch(e){toast("Reset failed",e.message);}});
    $("#deleteAccountBtn")?.addEventListener("click",()=>{$("#deleteConfirmInput").value="";$("#deleteEmailInput").value=state.user?.email||"";$("#deletePasswordInput").value="";$("#confirmDeleteBtn").disabled=true;openModal("deleteModal");});
    $("#deleteConfirmInput")?.addEventListener("input",e=>{$("#confirmDeleteBtn").disabled=e.target.value!=="DELETE";});
    $("#deleteForm")?.addEventListener("submit",async e=>{e.preventDefault();if($("#deleteConfirmInput").value!=="DELETE")return;const b=$("#confirmDeleteBtn");setBusy(b,true,"Deleting…");try{const body=await apiJson(ENDPOINTS.accountDelete,{method:"DELETE",body:JSON.stringify({confirmationText:"DELETE",emailConfirmation:$("#deleteEmailInput").value,currentPassword:$("#deletePasswordInput").value})});toast("Account deleted",body.message);window.ProTradeAuth?.clearSession?.();setTimeout(()=>window.location.replace("register.html?deleted=1"),800);}catch(err){toast("Account not deleted",err.message);setBusy(b,false);}});
    $("#tradeForm")?.addEventListener("submit",async e=>{e.preventDefault();const b=e.currentTarget.querySelector('[type="submit"]');setBusy(b,true,"Saving…");try{const fd=new FormData(e.currentTarget);const payload={tradeDate:fd.get("tradeDate"),symbol:String(fd.get("symbol")||"").trim().toUpperCase(),direction:fd.get("direction"),session:fd.get("session"),entryPrice:number(fd.get("entryPrice")),exitPrice:optionalNumber(fd.get("exitPrice")),profitLoss:number(fd.get("profitLoss")),rr:number(fd.get("rr")),result:fd.get("result"),quantity:number(fd.get("quantity"),1),model:String(fd.get("model")||""),protocol:String(fd.get("protocol")||""),notes:String(fd.get("notes")||"")};await apiJson(ENDPOINTS.trades,{method:"POST",body:JSON.stringify(payload)});closeModal("tradeModal");e.currentTarget.reset();e.currentTarget.elements.tradeDate.value=formatDateInput(new Date());toast("Trade saved",`${payload.symbol} saved to MongoDB.`);await loadData();}catch(err){toast("Trade not saved",err.message);}finally{setBusy(b,false);}});
    $("#dateForm")?.addEventListener("submit",e=>{e.preventDefault();const a=$("#startDate").value,b=$("#endDate").value;if(!a||!b||a>b)return toast("Invalid range","Start date must be before end date.");const fmt=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"});setText("#dateRangeLabel",`${fmt.format(new Date(a+"T00:00:00"))} - ${fmt.format(new Date(b+"T00:00:00"))}`);closeModal("dateModal");});
    $$("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));
    $$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id);}));
    $$(".connect-btn,.connection-menu-btn,#addConnectionBtn,[data-plan],[data-invoice],#managePlanBtn").forEach(b=>b.addEventListener("click",()=>showInfo("Backend feature unavailable","No fake connection was created","<p>The current ProTrade backend does not include broker connections, subscriptions or billing routes. A backend model, controller, routes and provider integration are required.</p>")));
  };

  const init = async () => {
    applyTheme(state.theme,false,false);applyAccent(state.accent);applyDensity(state.density);
    setupNavigationAndShell();setupForms();setupDataAndModals();
    state.systemThemeQuery.addEventListener("change",()=>{if(state.theme==="system")applyTheme("system",false,false);});
    const today=new Date(),start=new Date(today.getTime()-29*86400000);$("#startDate").value=formatDateInput(start);$("#endDate").value=formatDateInput(today);$("#dateRangeLabel").textContent=`${start.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} - ${today.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}`;$("#tradeForm").elements.tradeDate.value=formatDateInput(today);
    document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#settingsSearchInput").focus();}if(e.key==="Escape"){$$(".modal-backdrop:not([hidden])").forEach(m=>closeModal(m.id));document.body.classList.remove("sidebar-open");}});
    await loadData();
  };
  document.addEventListener("DOMContentLoaded",init);
})();
