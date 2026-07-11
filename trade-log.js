(() => {
  "use strict";

  const config = {
    apiBaseUrl: "",
    accountSize: 15000,
    startingBalance: 15000,
    currency: "USD",
    settings: null
  };

  const symbolMultipliers = {
    XAUUSD: 100,
    EURUSD: 100000,
    GBPUSD: 100000,
    USDJPY: 1000,
    NAS100: 1,
    US30: 1,
    BTCUSD: 1
  };

  const query = new URLSearchParams(window.location.search);
  const isEmbedded = query.get("embed") === "1";
  const requestedReturn = String(query.get("return") || "dashboard.html");
  const returnPage = /^[a-z0-9-]+\.html$/i.test(requestedReturn)
    ? requestedReturn
    : "dashboard.html";

  const state = {
    status: "Executed",
    direction: "Long",
    emotion: "Calm",
    tags: ["ICT", "Breaker", "Gold"],
    uploads: {
      entryScreenshot: null,
      managementScreenshot: null,
      exitScreenshot: null
    },
    activeUploadId: "entryScreenshot",
    settingsLoaded: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    modal: $("#tradeModal"),
    form: $("#tradeForm"),
    closeModal: $("#closeModal"),
    cancelButton: $("#cancelButton"),
    reopenButton: $("#reopenTradeLog"),
    submitButton: $("#submitButton"),
    submitText: $(".button-text"),
    submitLoader: $(".button-loader"),
    session: $("#session"),
    tradeDate: $("#tradeDate"),
    entryTime: $("#entryTime"),
    exitTime: $("#exitTime"),
    symbol: $("#symbol"),
    setup: $("#setup"),
    entryPrice: $("#entryPrice"),
    exitPrice: $("#exitPrice"),
    stopLoss: $("#stopLoss"),
    takeProfit: $("#takeProfit"),
    contracts: $("#contracts"),
    commission: $("#commission"),
    pnlOverride: $("#pnlOverride"),
    disciplineScore: $("#disciplineScore"),
    disciplineValue: $("#disciplineValue"),
    disciplineText: $("#disciplineText"),
    disciplineMessage: $("#disciplineMessage"),
    emotionNote: $("#emotionNote"),
    analysis: $("#analysis"),
    confidenceScore: $("#confidenceScore"),
    confidenceRing: $("#confidenceRing"),
    confidenceValue: $("#confidenceValue"),
    confidenceLabel: $("#confidenceLabel"),
    confidenceDescription: $("#confidenceDescription"),
    notes: $("#notes"),
    screenshotUrl: $("#screenshotUrl"),
    backendConnection: $("#backendConnection"),
    tagList: $("#tagList"),
    showTagInput: $("#showTagInput"),
    tagInput: $("#tagInput"),
    ruleList: $("#ruleList"),
    showRuleInput: $("#showRuleInput"),
    ruleInput: $("#ruleInput"),
    riskAmount: $("#riskAmount"),
    riskPercent: $("#riskPercent"),
    rewardAmount: $("#rewardAmount"),
    rewardPercent: $("#rewardPercent"),
    riskReward: $("#riskReward"),
    rrQuality: $("#rrQuality"),
    estimatedPnl: $("#estimatedPnl"),
    estimatedPnlPercent: $("#estimatedPnlPercent"),
    footerPnl: $("#footerPnl"),
    footerRr: $("#footerRr"),
    toastRegion: $("#toastRegion")
  };

  function numberValue(input) {
    if (!input || String(input.value ?? "").trim() === "") return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
  }

  function money(value) {
    const safeValue = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: safeValue === 0 ? "never" : "auto"
    }).format(safeValue);
  }

  function percent(value) {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `${safeValue.toFixed(2)}%`;
  }

  function setPositiveNegative(element, value) {
    element.style.color = value < 0 ? "var(--red)" : value > 0 ? "var(--green)" : "#c3ccd2";
  }

  function calculateMetrics() {
    const entry = numberValue(elements.entryPrice);
    const exit = numberValue(elements.exitPrice);
    const stop = numberValue(elements.stopLoss);
    const target = numberValue(elements.takeProfit);
    const contracts = Math.max(numberValue(elements.contracts) || 0, 0);
    const commission = Math.max(numberValue(elements.commission) || 0, 0);
    const override = numberValue(elements.pnlOverride);
    const multiplier = symbolMultipliers[elements.symbol.value] || 1;

    let risk = 0;
    let reward = 0;
    let pnl = 0;

    if (entry !== null && stop !== null && contracts > 0) {
      risk = Math.abs(entry - stop) * contracts * multiplier;
    }

    if (entry !== null && target !== null && contracts > 0) {
      const rewardDistance = state.direction === "Long" ? target - entry : entry - target;
      reward = Math.max(rewardDistance, 0) * contracts * multiplier;
    }

    if (override !== null) {
      pnl = override;
    } else if (entry !== null && exit !== null && contracts > 0) {
      const pnlDistance = state.direction === "Long" ? exit - entry : entry - exit;
      pnl = pnlDistance * contracts * multiplier - commission;
    }

    const rr = risk > 0
      ? (reward > 0 ? reward / risk : Math.abs(pnl) > 0 ? Math.abs(pnl) / risk : null)
      : null;

    renderMetrics({ risk, reward, pnl, rr });
    validatePriceLogic({ entry, exit, stop, target });

    return { risk, reward, pnl, rr, multiplier, commission };
  }

  function renderMetrics({ risk, reward, pnl, rr }) {
    elements.riskAmount.textContent = money(risk);
    elements.rewardAmount.textContent = money(reward);
    elements.estimatedPnl.textContent = money(pnl);
    elements.footerPnl.textContent = money(pnl);

    elements.riskPercent.textContent = `${percent((risk / config.accountSize) * 100)} of account`;
    elements.rewardPercent.textContent = `${percent((reward / config.accountSize) * 100)} of account`;
    elements.estimatedPnlPercent.textContent = percent((pnl / config.accountSize) * 100);

    setPositiveNegative(elements.estimatedPnl, pnl);
    setPositiveNegative(elements.estimatedPnlPercent, pnl);
    setPositiveNegative(elements.footerPnl, pnl);

    if (rr === null || !Number.isFinite(rr)) {
      elements.riskReward.textContent = "—";
      elements.footerRr.textContent = "—";
      elements.rrQuality.textContent = "Waiting for prices";
      elements.rrQuality.style.color = "#89959e";
      return;
    }

    elements.riskReward.textContent = `1 : ${rr.toFixed(2)}`;
    elements.footerRr.textContent = `1 : ${rr.toFixed(2)}`;

    if (rr >= 3) {
      elements.rrQuality.textContent = "Excellent";
      elements.rrQuality.style.color = "var(--green)";
    } else if (rr >= 2) {
      elements.rrQuality.textContent = "Strong setup";
      elements.rrQuality.style.color = "var(--green)";
    } else if (rr >= 1) {
      elements.rrQuality.textContent = "Acceptable";
      elements.rrQuality.style.color = "#f0c96a";
    } else {
      elements.rrQuality.textContent = "Low reward";
      elements.rrQuality.style.color = "var(--red)";
    }
  }

  function validatePriceLogic({ entry, stop, target }) {
    [elements.stopLoss, elements.takeProfit].forEach((input) => input.classList.remove("invalid"));

    if (entry === null) return;

    if (stop !== null) {
      const invalidStop = state.direction === "Long" ? stop >= entry : stop <= entry;
      elements.stopLoss.classList.toggle("invalid", invalidStop);
    }

    if (target !== null) {
      const invalidTarget = state.direction === "Long" ? target <= entry : target >= entry;
      elements.takeProfit.classList.toggle("invalid", invalidTarget);
    }
  }

  function updateRangeFill(input, value, min, max) {
    const progress = ((value - min) / (max - min)) * 100;
    input.style.setProperty("--range-progress", `${progress}%`);
  }

  function renderDiscipline() {
    const score = Number(elements.disciplineScore.value);
    elements.disciplineValue.value = `${score} / 10`;
    elements.disciplineValue.textContent = `${score} / 10`;
    updateRangeFill(elements.disciplineScore, score, 1, 10);

    if (score >= 9) {
      elements.disciplineText.textContent = "Elite Discipline";
      elements.disciplineMessage.textContent = "Professional execution ✦";
    } else if (score >= 7) {
      elements.disciplineText.textContent = "Good Discipline";
      elements.disciplineMessage.textContent = "Keep it up! 🚀";
    } else if (score >= 5) {
      elements.disciplineText.textContent = "Average Discipline";
      elements.disciplineMessage.textContent = "Review your rules";
    } else {
      elements.disciplineText.textContent = "Needs Improvement";
      elements.disciplineMessage.textContent = "Slow down and reset";
    }
  }

  function renderConfidence() {
    const score = Number(elements.confidenceScore.value);
    elements.confidenceRing.style.setProperty("--progress", score);
    elements.confidenceValue.textContent = `${score}%`;
    updateRangeFill(elements.confidenceScore, score, 0, 100);

    if (score >= 80) {
      elements.confidenceLabel.textContent = "Very High Confidence";
      elements.confidenceDescription.textContent = "You had strong conviction in this setup.";
    } else if (score >= 65) {
      elements.confidenceLabel.textContent = "High Confidence";
      elements.confidenceDescription.textContent = "You felt good about this trade.";
    } else if (score >= 40) {
      elements.confidenceLabel.textContent = "Moderate Confidence";
      elements.confidenceDescription.textContent = "The setup had some uncertainty.";
    } else {
      elements.confidenceLabel.textContent = "Low Confidence";
      elements.confidenceDescription.textContent = "The entry may have lacked confirmation.";
    }
  }

  function bindStatusButtons() {
    $$(".status-option").forEach((button) => {
      button.addEventListener("click", () => {
        state.status = button.dataset.status;
        $$(".status-option").forEach((item) => item.classList.toggle("active", item === button));
      });
    });
  }

  function bindDirectionButtons() {
    $$(".direction-option").forEach((button) => {
      button.addEventListener("click", () => {
        state.direction = button.dataset.direction;
        $$(".direction-option").forEach((item) => item.classList.toggle("active", item === button));
        calculateMetrics();
      });
    });
  }

  function bindEmotionChips() {
    $$(".choice-chip").forEach((button) => {
      button.addEventListener("click", () => {
        state.emotion = button.dataset.emotion;
        $$(".choice-chip").forEach((item) => item.classList.toggle("active", item === button));
      });
    });
  }

  function renderTags() {
    elements.tagList.replaceChildren();

    state.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-pill";
      button.dataset.tag = tag;
      button.setAttribute("aria-label", `Remove ${tag} tag`);
      button.append(document.createTextNode(`${tag} `));

      const close = document.createElement("span");
      close.textContent = "×";
      button.append(close);

      button.addEventListener("click", () => {
        state.tags = state.tags.filter((item) => item !== tag);
        renderTags();
      });

      elements.tagList.append(button);
    });
  }

  function addTag(rawTag) {
    const tag = rawTag.trim().replace(/\s+/g, " ");
    if (!tag) return;

    if (state.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      showToast("Tag already added", `${tag} is already in the trade tags.`, true);
      return;
    }

    if (state.tags.length >= 8) {
      showToast("Tag limit reached", "A maximum of 8 tags is allowed.", true);
      return;
    }

    state.tags.push(tag);
    renderTags();
    elements.tagInput.value = "";
  }

  function bindTagControls() {
    elements.showTagInput.addEventListener("click", () => {
      elements.showTagInput.hidden = true;
      elements.tagInput.hidden = false;
      elements.tagInput.focus();
    });

    elements.tagInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(elements.tagInput.value);
      }
      if (event.key === "Escape") {
        elements.tagInput.hidden = true;
        elements.showTagInput.hidden = false;
      }
    });

    elements.tagInput.addEventListener("blur", () => {
      if (elements.tagInput.value.trim()) addTag(elements.tagInput.value);
      elements.tagInput.hidden = true;
      elements.showTagInput.hidden = false;
    });
  }

  function addRule(rawRule) {
    const rule = rawRule.trim().replace(/\s+/g, " ");
    if (!rule) return;

    const label = document.createElement("label");
    label.className = "check-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = rule;

    const text = document.createElement("span");
    text.textContent = rule;

    label.append(checkbox, text);
    elements.ruleList.append(label);
    elements.ruleInput.value = "";
  }

  function bindRuleControls() {
    elements.showRuleInput.addEventListener("click", () => {
      elements.showRuleInput.hidden = true;
      elements.ruleInput.hidden = false;
      elements.ruleInput.focus();
    });

    elements.ruleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addRule(elements.ruleInput.value);
      }
      if (event.key === "Escape") {
        elements.ruleInput.hidden = true;
        elements.showRuleInput.hidden = false;
      }
    });

    elements.ruleInput.addEventListener("blur", () => {
      if (elements.ruleInput.value.trim()) addRule(elements.ruleInput.value);
      elements.ruleInput.hidden = true;
      elements.showRuleInput.hidden = false;
    });
  }

  function validateUpload(file) {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Unsupported image", "Use PNG, JPG, JPEG, or WEBP.", true);
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image too large", "Maximum file size is 5MB.", true);
      return false;
    }

    return true;
  }

  function renderUpload(uploadId, file) {
    const box = $(`.upload-box[data-upload="${uploadId}"]`);
    const placeholder = $(".upload-placeholder", box);
    const preview = $(".upload-preview", box);

    if (!file) {
      state.uploads[uploadId] = null;
      preview.replaceChildren();
      preview.hidden = true;
      placeholder.hidden = false;
      return;
    }

    if (!validateUpload(file)) return;

    state.uploads[uploadId] = file;
    const objectUrl = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = objectUrl;
    image.alt = `${uploadId.replace("Screenshot", "")} chart preview`;
    image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-upload";
    removeButton.setAttribute("aria-label", "Remove screenshot");
    removeButton.textContent = "×";
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const input = $(`#${uploadId}`);
      input.value = "";
      renderUpload(uploadId, null);
    });

    preview.replaceChildren(image, removeButton);
    preview.hidden = false;
    placeholder.hidden = true;
  }

  function bindUploads() {
    $$(".upload-box").forEach((box) => {
      const uploadId = box.dataset.upload;
      const input = $(`#${uploadId}`);

      box.addEventListener("click", () => {
        state.activeUploadId = uploadId;
        input.click();
      });

      box.addEventListener("focus", () => {
        state.activeUploadId = uploadId;
      });

      input.addEventListener("change", () => {
        const [file] = input.files;
        if (file) renderUpload(uploadId, file);
      });

      ["dragenter", "dragover"].forEach((eventName) => {
        box.addEventListener(eventName, (event) => {
          event.preventDefault();
          state.activeUploadId = uploadId;
          box.classList.add("drag-over");
        });
      });

      ["dragleave", "drop"].forEach((eventName) => {
        box.addEventListener(eventName, (event) => {
          event.preventDefault();
          box.classList.remove("drag-over");
        });
      });

      box.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (file) renderUpload(uploadId, file);
      });
    });

    $$(".replace-button").forEach((button) => {
      button.addEventListener("click", () => {
        const uploadId = button.dataset.replace;
        state.activeUploadId = uploadId;
        $(`#${uploadId}`).click();
      });
    });

    document.addEventListener("paste", (event) => {
      const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (file) renderUpload(state.activeUploadId, file);
    });
  }

  async function apiJson(path, options = {}) {
    if (!window.ProTradeAuth?.apiFetch || !window.ProTradeAuth?.API_BASE) {
      throw new Error("ProTrade authentication is not available. Check auth.js.");
    }

    const response = await window.ProTradeAuth.apiFetch(
      `${window.ProTradeAuth.API_BASE}${path}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      }
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      throw new Error(body.message || `Request failed with status ${response.status}.`);
    }
    return body;
  }

  function applyTheme(theme) {
    const requested = String(theme || "Dark");
    const dark = requested === "System"
      ? window.matchMedia?.("(prefers-color-scheme: dark)")?.matches !== false
      : requested !== "Light";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  async function loadBackendContext() {
    elements.backendConnection.className = "backend-connection is-loading";
    elements.backendConnection.textContent = "Connecting…";

    try {
      await window.ProTradeAuth?.ready;
      config.apiBaseUrl = window.ProTradeAuth.API_BASE;

      const [settingsBody, tradesBody] = await Promise.all([
        apiJson("/settings"),
        apiJson("/trades")
      ]);

      const settings = settingsBody.data || {};
      const trades = Array.isArray(tradesBody.data) ? tradesBody.data : [];
      const startingBalance = Number(settings.startingBalance);
      const recordedPnl = trades.reduce(
        (sum, trade) => sum + (Number(trade.profitLoss) || 0),
        0
      );

      config.settings = settings;
      config.startingBalance = Number.isFinite(startingBalance) ? startingBalance : 15000;
      config.accountSize = Math.max(config.startingBalance + recordedPnl, 1);
      config.currency = ["USD", "INR", "EUR", "GBP", "JPY"].includes(settings.currency)
        ? settings.currency
        : "USD";
      state.settingsLoaded = true;

      applyTheme(settings.theme);

      const preferred = settings.preferredSession === "Asia"
        ? "Asian"
        : settings.preferredSession;
      if (["Asian", "London", "New York", "Other"].includes(preferred)) {
        elements.session.value = preferred;
      }

      elements.backendConnection.className = "backend-connection is-online";
      elements.backendConnection.textContent = "MongoDB Connected";
      calculateMetrics();
    } catch (error) {
      console.error("Trade Log backend initialization failed:", error);
      elements.backendConnection.className = "backend-connection is-error";
      elements.backendConnection.textContent = "Connection failed";
      showToast("Backend connection failed", error.message, true);
      throw error;
    }
  }

  function getRules() {
    return $$(".check-row input", elements.ruleList).map((input) => ({
      name: input.value,
      followed: input.checked
    }));
  }

  function buildPayload() {
    const metrics = calculateMetrics();
    const rules = getRules();
    const followedRules = rules.filter((item) => item.followed).map((item) => item.name);
    const violatedRules = rules.filter((item) => !item.followed).map((item) => item.name);
    const negativeEmotion = ["FOMO", "Fearful", "Revenge", "Overconfident"].includes(state.emotion);
    const screenshotUrl = elements.screenshotUrl.value.trim();

    let result = "Open";
    if (state.status === "Executed") {
      const hasExit = numberValue(elements.exitPrice) !== null;
      const hasOverride = numberValue(elements.pnlOverride) !== null;
      if (metrics.pnl > 0) result = "Win";
      else if (metrics.pnl < 0) result = "Loss";
      else if (hasExit || hasOverride) result = "Breakeven";
    }

    const noteSections = [
      elements.notes.value.trim(),
      `Trade Status: ${state.status}`,
      `Emotional State: ${state.emotion}`,
      `Discipline Score: ${Number(elements.disciplineScore.value)}/10`,
      `Confidence Score: ${Number(elements.confidenceScore.value)}%`,
      elements.emotionNote.value.trim() ? `Emotion Note: ${elements.emotionNote.value.trim()}` : "",
      elements.analysis.value.trim() ? `Analysis: ${elements.analysis.value.trim()}` : "",
      state.tags.length ? `Trade Tags: ${state.tags.join(", ")}` : "",
      violatedRules.length ? `Rules / Mistakes: ${violatedRules.join(", ")}` : "",
      Object.values(state.uploads).some(Boolean)
        ? "Local screenshot previews were selected but were not uploaded because the current backend stores URL only."
        : ""
    ].filter(Boolean);

    const mistakeTags = [
      ...(negativeEmotion ? [state.emotion] : []),
      ...violatedRules
    ].filter((value, index, values) => values.indexOf(value) === index);

    return {
      symbol: elements.symbol.value.trim().toUpperCase(),
      tradeDate: elements.tradeDate.value,
      entryTime: elements.entryTime.value || "",
      exitTime: elements.exitTime.value || "",
      session: elements.session.value,
      model: elements.setup.value,
      protocol: state.status,
      direction: state.direction,
      entryPrice: numberValue(elements.entryPrice),
      exitPrice: numberValue(elements.exitPrice),
      stopLoss: numberValue(elements.stopLoss),
      takeProfit: numberValue(elements.takeProfit),
      commission: metrics.commission,
      quantity: Math.max(numberValue(elements.contracts) || 1, 0),
      profitLoss: metrics.pnl,
      rr: Number.isFinite(metrics.rr) ? Number(metrics.rr.toFixed(4)) : 0,
      result,
      rating: Math.max(1, Math.min(5, Math.round(Number(elements.disciplineScore.value) / 2))),
      checklist: followedRules,
      mistakeTags,
      notes: noteSections.join("\n\n").slice(0, 5000),
      screenshotUrl
    };
  }

  function validateForm() {
    let isValid = true;
    const requiredInputs = [elements.tradeDate, elements.symbol, elements.entryPrice, elements.contracts];

    requiredInputs.forEach((input) => {
      const empty = input.value.trim() === "";
      input.classList.toggle("invalid", empty);
      if (empty) isValid = false;
    });

    const entry = numberValue(elements.entryPrice);
    const stop = numberValue(elements.stopLoss);
    const target = numberValue(elements.takeProfit);
    const quantity = numberValue(elements.contracts);
    const screenshotUrl = elements.screenshotUrl.value.trim();

    if (quantity === null || quantity <= 0) {
      elements.contracts.classList.add("invalid");
      isValid = false;
    }

    if (screenshotUrl && !/^https?:\/\//i.test(screenshotUrl)) {
      elements.screenshotUrl.classList.add("invalid");
      isValid = false;
      showToast("Check screenshot URL", "Use a complete http:// or https:// URL.", true);
    } else {
      elements.screenshotUrl.classList.remove("invalid");
    }

    if (entry !== null && stop !== null) {
      const stopInvalid = state.direction === "Long" ? stop >= entry : stop <= entry;
      if (stopInvalid) {
        elements.stopLoss.classList.add("invalid");
        isValid = false;
        showToast("Check stop loss", `${state.direction} trade stop is on the wrong side of entry.`, true);
      }
    }

    if (entry !== null && target !== null) {
      const targetInvalid = state.direction === "Long" ? target <= entry : target >= entry;
      if (targetInvalid) {
        elements.takeProfit.classList.add("invalid");
        isValid = false;
        showToast("Check target", `${state.direction} trade target is on the wrong side of entry.`, true);
      }
    }

    if (!isValid) {
      const firstInvalid = $(".invalid");
      firstInvalid?.focus();
    }

    return isValid;
  }

  async function submitTrade(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = buildPayload();
    setSubmitting(true);

    try {
      await window.ProTradeAuth?.ready;
      const result = await apiJson("/trades", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast("Trade logged", result.message || "Trade saved to MongoDB successfully.");
      elements.backendConnection.className = "backend-connection is-online";
      elements.backendConnection.textContent = "Saved to MongoDB";

      window.setTimeout(() => {
        if (isEmbedded && window.parent !== window) {
          window.parent.postMessage(
            { type: "protrade:trade-created", trade: result.data || null },
            window.location.origin
          );
          return;
        }

        window.location.assign(returnPage);
      }, 700);
    } catch (error) {
      console.error(error);
      elements.backendConnection.className = "backend-connection is-error";
      elements.backendConnection.textContent = "Save failed";
      showToast("Could not save trade", error.message || "Please check the backend and try again.", true);
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    elements.submitButton.disabled = isSubmitting;
    elements.submitText.hidden = isSubmitting;
    elements.submitLoader.hidden = !isSubmitting;
  }

  function showToast(title, message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;

    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("span");
    copy.textContent = message;

    toast.append(heading, copy);
    elements.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function closeTradeModal() {
    if (isEmbedded && window.parent !== window) {
      window.parent.postMessage(
        { type: "protrade:trade-log-close" },
        window.location.origin
      );
      return;
    }

    elements.modal.classList.add("is-closing");
    window.setTimeout(() => window.location.assign(returnPage), 180);
  }

  function openTradeModal() {
    elements.reopenButton.hidden = true;
    elements.modal.hidden = false;
    elements.modal.animate(
      [
        { opacity: 0, transform: "translateY(14px) scale(.99)" },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      { duration: 260, easing: "cubic-bezier(.2,.85,.25,1)" }
    );
  }

  function setTodayIfEmpty() {
    if (elements.tradeDate.value) return;
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60_000;
    elements.tradeDate.value = new Date(today.getTime() - offset).toISOString().slice(0, 10);
  }

  function bindCalculationInputs() {
    [
      elements.entryPrice,
      elements.exitPrice,
      elements.stopLoss,
      elements.takeProfit,
      elements.contracts,
      elements.commission,
      elements.pnlOverride,
      elements.symbol
    ].forEach((input) => input.addEventListener("input", calculateMetrics));
  }

  function bindEvents() {
    bindStatusButtons();
    bindDirectionButtons();
    bindEmotionChips();
    bindTagControls();
    bindRuleControls();
    bindUploads();
    bindCalculationInputs();

    elements.disciplineScore.addEventListener("input", renderDiscipline);
    elements.confidenceScore.addEventListener("input", renderConfidence);
    elements.form.addEventListener("submit", submitTrade);
    elements.closeModal.addEventListener("click", closeTradeModal);
    elements.cancelButton.addEventListener("click", closeTradeModal);
    elements.reopenButton.addEventListener("click", openTradeModal);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.modal.hidden) closeTradeModal();
    });
  }

  async function init() {
    if (isEmbedded) {
      document.documentElement.classList.add("is-embedded");
      document.body.classList.add("is-embedded");
    }

    setTodayIfEmpty();
    renderTags();
    renderDiscipline();
    renderConfidence();
    calculateMetrics();
    bindEvents();

    try {
      await loadBackendContext();
    } catch {
      // auth.js will redirect when the session is invalid.
    }
  }

  init();
})();
