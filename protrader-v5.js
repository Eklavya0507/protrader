
const qs = (s, p = document) => p.querySelector(s);
const qsa = (s, p = document) => [...p.querySelectorAll(s)];

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.16 });

qsa(".reveal").forEach((el) => observer.observe(el));

const topbar = qs("[data-topbar]");
window.addEventListener("scroll", () => {
  if (window.scrollY > 12) topbar.classList.add("scrolled");
  else topbar.classList.remove("scrolled");
}, { passive: true });

const toggle = qs("[data-menu-toggle]");
const mobileMenu = qs("[data-mobile-menu]");
if (toggle && mobileMenu) {
  toggle.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
  });
  qsa("a", mobileMenu).forEach((link) => {
    link.addEventListener("click", () => mobileMenu.classList.remove("open"));
  });
}

const heroStage = qs("[data-hero-stage]");
if (heroStage) {
  const layered = qsa("[data-depth]", heroStage);
  heroStage.addEventListener("pointermove", (event) => {
    const rect = heroStage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    layered.forEach((item) => {
      const depth = parseFloat(item.dataset.depth || "0.1");
      item.style.transform = `translate3d(${x * depth * 60}px, ${y * depth * 40}px, ${depth * 100}px)`;
    });

    heroStage.style.transform = `perspective(1600px) rotateX(${y * -3}deg) rotateY(${x * 5}deg)`;
  });

  heroStage.addEventListener("pointerleave", () => {
    layered.forEach((item) => item.style.transform = "");
    heroStage.style.transform = "";
  });
}

const chipStage = qs("[data-chip-stage]");
const chip = qs("[data-chip]");
if (chipStage && chip) {
  chipStage.addEventListener("pointermove", (event) => {
    const rect = chipStage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 1.6;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 1.6;
    chip.style.transform = `translate(-50%, -50%) rotateX(${16 - y * 11}deg) rotateY(${-18 + x * 16}deg)`;
  });

  chipStage.addEventListener("pointerleave", () => {
    chip.style.transform = "translate(-50%, -50%) rotateX(16deg) rotateY(-18deg)";
  });
}

qsa(".tilt").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateX(${y * -7}deg) rotateY(${x * 9}deg) translateY(-2px)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});

qsa("[data-count]").forEach((node) => {
  const target = Number(node.dataset.count || 0);
  let value = 0;
  const timer = setInterval(() => {
    value += Math.max(1, Math.ceil((target - value) / 8));
    if (value >= target) {
      value = target;
      clearInterval(timer);
    }
    node.textContent = `${value}%`;
  }, 45);
});

const canvas = qs("#ambientCanvas");
if (canvas) {
  const ctx = canvas.getContext("2d");
  const dots = [];
  const count = 48;

  const resize = () => {
    canvas.width = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
    canvas.height = window.innerHeight * Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(Math.min(window.devicePixelRatio || 1, 2), Math.min(window.devicePixelRatio || 1, 2));
  };

  const init = () => {
    dots.length = 0;
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: Math.random() * 1.6 + 0.8
      });
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const d of dots) {
      d.x += d.vx;
      d.y += d.vy;

      if (d.x < 0 || d.x > window.innerWidth) d.vx *= -1;
      if (d.y < 0 || d.y > window.innerHeight) d.vy *= -1;

      ctx.beginPath();
      ctx.fillStyle = "rgba(106, 180, 255, 0.35)";
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i];
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130) {
          ctx.strokeStyle = `rgba(90, 156, 255, ${0.09 * (1 - dist / 130)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  };

  resize();
  init();
  draw();
  window.addEventListener("resize", () => {
    resize();
    init();
  });
}

/* Production backend + existing ProTrade authentication integration */
(() => {
  "use strict";

  const DEFAULT_API_BASE = "https://protrader-backend-n8oj.onrender.com/api";
  const TOKEN_KEY = "protrade_auth_token";
  const REFRESH_TOKEN_KEY = "protrade_refresh_token";

  const auth = window.ProTradeAuth || null;
  const apiBase = String(auth?.API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");

  const hasManagedSession = () => {
    try {
      return Boolean(
        auth?.getToken?.() ||
        auth?.getRefreshToken?.() ||
        sessionStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem(REFRESH_TOKEN_KEY)
      );
    } catch {
      return false;
    }
  };

  const safeTarget = (target) => {
    const value = String(target || "dashboard.html").trim();
    return /^[a-z0-9-]+\.html$/i.test(value) ? value : "dashboard.html";
  };

  const appHref = (target = "dashboard.html") => {
    const page = safeTarget(target);
    return hasManagedSession()
      ? page
      : `login.html?next=${encodeURIComponent(page)}`;
  };

  const syncAuthState = () => {
    const signedIn = hasManagedSession();
    const user = auth?.getUser?.() || null;
    const displayName = String(
      user?.name || user?.fullName || user?.username || user?.email || "Signed in"
    ).trim();

    qsa("[data-primary-app-link]").forEach((link) => {
      link.href = appHref("dashboard.html");
    });

    qsa("[data-primary-label]").forEach((label) => {
      label.textContent = signedIn ? "Open Dashboard" : "Start Trading";
    });

    qsa("[data-protected-link]").forEach((link) => {
      link.href = appHref(link.dataset.protectedLink);
    });

    qsa("[data-auth-login-link]").forEach((link) => {
      link.href = signedIn ? "dashboard.html" : "login.html";
      link.textContent = signedIn ? "Dashboard" : "Sign In";
    });

    qsa("[data-auth-register-link]").forEach((link) => {
      link.hidden = signedIn;
    });

    qsa("[data-auth-chip]").forEach((chip) => {
      chip.hidden = !signedIn;
    });

    qsa("[data-auth-user]").forEach((node) => {
      node.textContent = displayName || "Signed in";
      node.title = displayName || "Signed in";
    });
  };

  const setBackendState = (state, title, detail) => {
    const meta = qs(".backend-meta");
    if (meta) {
      meta.classList.remove("is-online", "is-waking", "is-offline");
      meta.classList.add(`is-${state}`);
    }
    const status = qs("[data-backend-status]");
    const description = qs("[data-backend-detail]");
    if (status) status.textContent = title;
    if (description) description.textContent = detail;
  };

  const checkBackend = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${apiBase}/route-test`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json().catch(() => ({}));
      if (body.success === false) throw new Error("Backend health check failed");

      setBackendState("online", "Backend Online", "Secure production API connected");
    } catch (error) {
      const isTimeout = error?.name === "AbortError";
      setBackendState(
        isTimeout ? "waking" : "offline",
        isTimeout ? "Backend Waking" : "Connection Retry",
        isTimeout ? "Render is starting; login remains available" : "Secure API will retry automatically"
      );

      window.setTimeout(checkBackend, isTimeout ? 12000 : 20000);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  syncAuthState();
  checkBackend();

  auth?.ready?.then(syncAuthState).catch(() => syncAuthState());
  window.addEventListener("pageshow", syncAuthState);
  window.addEventListener("storage", syncAuthState);
})();
