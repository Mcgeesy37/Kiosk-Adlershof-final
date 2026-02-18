/**
 * KIOSK Max Premium Static Site
 * Edit only STORE + HOURS.
 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const THEME_KEY = "kiosk_theme_max";

  const STORE = {
    name: "KIOSK Adlershof",
    address: "Rudower Chaussee 5B, 12489 Berlin",
    mapsQuery: "Rudower%20Chaussee%205B,%2012489%20Berlin",
    timezone: "Europe/Berlin",

    // Wenn Nummer noch nicht aktiv: showPhone=false
    phone: "+493067819265",
    showPhone: true,
    whatsapp: "+4915213317375",
  };

  // 0=Mo ... 6=So
  const HOURS = [
    [["08:00", "00:00"]], // Mo
    [["08:00", "00:00"]], // Di
    [["08:00", "00:00"]], // Mi
    [["08:00", "00:00"]], // Do
    [["08:00", "00:00"]], // Fr
    [["10:00", "00:00"]], // Sa
    [["10:00", "00:00"]], // So
  ];

  const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // ---------- Theme ----------
  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);

    const label = $('[data-theme-toggle] .theme__label');
    if (label) label.textContent = theme === "light" ? "Light" : "Dark";

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f7f8fb" : "#0b0f19");
  };

  const initTheme = () => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return setTheme(stored);

    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
    setTheme(prefersLight ? "light" : "dark");
  };

  const initThemeToggle = () => {
    const btn = $("[data-theme-toggle]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === "light" ? "dark" : "light");
    });
  };

  // ---------- Nav ----------
  const initNav = () => {
    const toggle = $("[data-nav-toggle]");
    const menu = $("[data-nav-menu]");
    if (!toggle || !menu) return;

    let lastFocus = null;

    const openMenu = () => {
      lastFocus = document.activeElement;
      toggle.setAttribute("aria-expanded", "true");
      menu.dataset.open = "true";
      menu.querySelector("a,button")?.focus?.();
    };

    const closeMenu = () => {
      toggle.setAttribute("aria-expanded", "false");
      menu.dataset.open = "false";
      lastFocus?.focus?.();
    };

    toggle.addEventListener("click", () => {
      const open = menu.dataset.open === "true";
      open ? closeMenu() : openMenu();
    });

    $$('a[href^="#"]', menu).forEach((a) => a.addEventListener("click", closeMenu));

    document.addEventListener("click", (e) => {
      if (menu.dataset.open !== "true") return;
      if (!menu.contains(e.target) && !toggle.contains(e.target)) closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (menu.dataset.open !== "true") return;
      if (e.key === "Escape") closeMenu();
    });
  };

  // ---------- Time helpers ----------
  const parseTimeToMinutes = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };

  const getBerlinParts = () => {
    const parts = new Intl.DateTimeFormat("de-DE", {
      timeZone: STORE.timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(new Date());

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const hh = map.hour ?? "00";
    const mm = map.minute ?? "00";
    const weekday = (map.weekday ?? "Mo").toLowerCase();

    const minutes = Number(hh) * 60 + Number(mm);

    const dayIndex = (() => {
      if (weekday.startsWith("mo")) return 0;
      if (weekday.startsWith("di")) return 1;
      if (weekday.startsWith("mi")) return 2;
      if (weekday.startsWith("do")) return 3;
      if (weekday.startsWith("fr")) return 4;
      if (weekday.startsWith("sa")) return 5;
      return 6;
    })();

    return { minutes, dayIndex };
  };

  const normalizeEnd = (start, end) => {
    if (end === "00:00" && start !== "00:00") return 24 * 60;
    return parseTimeToMinutes(end);
  };

  const isOpenNow = () => {
    const { minutes: now, dayIndex } = getBerlinParts();
    const intervals = HOURS[dayIndex] || [];

    for (const [start, end] of intervals) {
      const s = parseTimeToMinutes(start);
      const e = normalizeEnd(start, end);
      if (s === null || e === null) continue;
      if (now >= s && now < e) return true;
    }
    return false;
  };

  const nextChangeText = () => {
    const { minutes: now, dayIndex } = getBerlinParts();
    const fmt = (dIdx, hhmm) => `${DAYS[dIdx]} ${hhmm}`;

    const candidates = [];
    for (let offset = 0; offset < 8; offset++) {
      const dIdx = (dayIndex + offset) % 7;
      for (const [start, end] of HOURS[dIdx]) {
        const s = parseTimeToMinutes(start);
        const e = normalizeEnd(start, end);
        if (s === null || e === null) continue;

        if (offset === 0) {
          if (now < s) candidates.push({ offset, t: s, label: fmt(dIdx, start) });
          if (now < e) candidates.push({ offset, t: e, label: fmt(dIdx, end) });
        } else {
          candidates.push({ offset, t: s, label: fmt(dIdx, start) });
          candidates.push({ offset, t: e, label: fmt(dIdx, end) });
        }
      }
    }
    candidates.sort((a, b) => (a.offset - b.offset) || (a.t - b.t));
    return candidates[0]?.label ?? null;
  };

  // ---------- Render hours ----------
  const renderHoursTable = () => {
    const rootEl = $("[data-hours]");
    if (!rootEl) return;

    rootEl.innerHTML = "";
    const today = getBerlinParts().dayIndex;

    for (let i = 0; i < 7; i++) {
      const row = document.createElement("div");
      row.className = "hours__row";
      row.setAttribute("role", "row");
      if (i === today) row.style.outline = "2px solid rgba(124,58,237,.35)";

      const day = document.createElement("div");
      day.className = "hours__day";
      day.textContent = DAYS[i];

      const time = document.createElement("div");
      time.className = "hours__time";
      const intervals = HOURS[i] || [];
      time.textContent = intervals.length ? intervals.map(([s, e]) => `${s} – ${e}`).join(" · ") : "geschlossen";

      row.appendChild(day);
      row.appendChild(time);
      rootEl.appendChild(row);
    }
  };

  // ---------- Open badge ----------
  const initOpenBadge = () => {
    const badgeText = $("[data-open-badge] .badge__text");
    const dot = $("[data-open-badge] .badge__dot");
    const openText = $("[data-open-text]");
    if (!badgeText || !dot) return;

    const open = isOpenNow();
    const next = nextChangeText();

    if (open) {
      badgeText.textContent = next ? `Geöffnet – nächster Wechsel: ${next}` : "Geöffnet";
      dot.style.background = "rgba(34,197,94,.95)";
      dot.style.boxShadow = "0 0 0 4px rgba(34,197,94,.18)";
      if (openText) openText.textContent = next ? `Aktuell geöffnet · nächster Wechsel: ${next}` : "Aktuell geöffnet";
    } else {
      badgeText.textContent = next ? `Geschlossen – nächster Wechsel: ${next}` : "Geschlossen";
      dot.style.background = "rgba(244,63,94,.95)";
      dot.style.boxShadow = "0 0 0 4px rgba(244,63,94,.18)";
      if (openText) openText.textContent = next ? `Aktuell geschlossen · nächster Wechsel: ${next}` : "Aktuell geschlossen";
    }
  };

  const initStatusTicker = () => {
    initOpenBadge();
    setInterval(initOpenBadge, 60_000);
  };

  // ---------- Lightbox ----------
  const initLightbox = () => {
    const dialog = $("[data-lightbox]");
    const img = $("[data-lightbox] .lightbox__img");
    if (!dialog || !img) return;

    $$("[data-gallery] [data-shot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        img.src = btn.getAttribute("data-shot") || "";
        img.alt = btn.querySelector("img")?.alt || "Bild";
        dialog.showModal();
      });
    });

    dialog.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const inDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.bottom &&
        rect.left <= e.clientX &&
        e.clientX <= rect.right;
      if (!inDialog) dialog.close();
    });
  };

  // ---------- Map consent ----------
  const initMapConsent = () => {
    const mapRoot = $("[data-map]");
    const btn = $("[data-map-load]");
    if (!mapRoot || !btn) return;

    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.title = `Karte: ${STORE.address}`;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.src = `https://www.google.com/maps?q=${STORE.mapsQuery}&output=embed`;

      mapRoot.innerHTML = "";
      mapRoot.appendChild(iframe);
    });
  };

  // ---------- Copy address ----------
  const initCopyAddress = () => {
    const buttons = $$("[data-copy-address]");
    const note = $("[data-copy-note]");

    const msg = (t) => {
      if (!note) return;
      note.textContent = t;
      setTimeout(() => (note.textContent = ""), 2200);
    };

    buttons.forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(STORE.address);
          msg("Adresse kopiert ✅");
        } catch {
          msg("Kopieren nicht möglich – bitte manuell markieren.");
        }
      })
    );
  };

  // ---------- Route / Call / WhatsApp ----------
  const initLinks = () => {
    const routeUrl = `https://www.google.com/maps?q=${STORE.mapsQuery}`;
    $$("[data-route-link]").forEach((a) => a.setAttribute("href", routeUrl));

    const waDigits = String(STORE.whatsapp || "").replace(/[^\d]/g, "");
    const waUrl = waDigits ? `https://wa.me/${waDigits}` : "#";
    $$("[data-whatsapp-link]").forEach((a) => a.setAttribute("href", waUrl));

    const callUrl = STORE.phone ? `tel:${STORE.phone}` : "#";
    $$("[data-call-link]").forEach((a) => a.setAttribute("href", STORE.showPhone ? callUrl : "#"));

    const callText = $("[data-call-text]");
    if (callText) callText.textContent = STORE.showPhone ? STORE.phone.replace("+49", "+49 ") : "Telefon folgt";
  };

  // ---------- Reveal on scroll ----------
  const initReveal = () => {
    const items = $$("[data-reveal]");
    if (!items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );

    items.forEach((el) => io.observe(el));
  };

  // ---------- Year ----------
  const initYear = () => {
    const y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());
  };

  // Boot
  initTheme();
  initThemeToggle();
  initNav();
  initLinks();
  initCopyAddress();

  renderHoursTable();
  initStatusTicker();
  initLightbox();
  initMapConsent();
  initYear();
  initReveal();
})();
