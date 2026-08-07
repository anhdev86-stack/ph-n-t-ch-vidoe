// Viewer Kaloclip-style. Nạp dữ liệu từ /api/storyboard, video từ /api/video.
const $ = (s) => document.querySelector(s);

// --- Bộ icon line tối giản (kiểu Lucide) ---
const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const F = 'viewBox="0 0 24 24" fill="currentColor" stroke="none"';
const ICONS = {
  brand: `<svg ${F}><path d="M8 5v14l11-7z"/></svg>`,
  video: `<svg ${S}><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`,
  redo: `<svg ${S}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>`,
  clapper: `<svg ${S}><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.4-2.5l13.4-4c1.1-.3 2.2.3 2.5 1.4Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`,
  pen: `<svg ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  share: `<svg ${S}><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
  folder: `<svg ${S}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  gem: `<svg ${S}><path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20"/><path d="m12 21 4-12-2-6"/><path d="m12 21-4-12 2-6"/></svg>`,
  chevron: `<svg ${S}><path d="m6 9 6 6 6-6"/></svg>`,
  back: `<svg ${S}><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`,
  cam: `<svg ${S}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>`,
  copy: `<svg ${S}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  sparkle: `<svg ${S}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/></svg>`,
  download: `<svg ${S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  "play-fill": `<svg ${F}><path d="M6 4v16l14-8z"/></svg>`,
  "pause-fill": `<svg ${F}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  volume: `<svg ${S}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5.5a9 9 0 0 1 0 13"/></svg>`,
  mute: `<svg ${S}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`,
  fullscreen: `<svg ${S}><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
};
function setIcon(el, name) { if (el) el.innerHTML = ICONS[name] || ""; }
function injectIcons(root = document) { root.querySelectorAll("[data-icon]").forEach((el) => setIcon(el, el.dataset.icon)); }

let segments = [];
function parseTs(ts) { const m = (ts || "").match(/(\d+)\D+(\d+)/); return m ? [+m[1], +m[2]] : [0, 0]; }
function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return `${String((s / 60) | 0).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }

async function load() {
  injectIcons();
  const data = await (await fetch("/api/storyboard")).json();
  renderScript(data.kich_ban_video || []);
  renderSuccess(data.giai_thich_diem_thanh_cong || {});
  setupVideo();
}

function renderScript(rows) {
  const box = $("#rows");
  box.innerHTML = "";
  segments = [];
  rows.forEach((r, i) => {
    const [a, b] = parseTs(r.timestamp);
    segments.push({ start: a, end: b, text: r.kich_ban_am_thanh, i });
    const el = document.createElement("div");
    el.className = "trow";
    el.dataset.i = i;
    el.innerHTML = `
      <div class="c-name"><span class="nm">${esc(r.phan_canh)}</span><span class="ts">${esc(r.timestamp)}</span></div>
      <div><span class="shot"><span class="cam" data-icon="cam"></span>${esc(r.co_canh)}</span><div class="vd">${esc(r.mo_ta_hinh_anh)}</div></div>
      <div class="script">${esc(r.kich_ban_am_thanh)}</div>`;
    el.addEventListener("click", () => { $("#video").currentTime = a + 0.1; selectRow(i); });
    box.appendChild(el);
  });
  injectIcons(box);
}

function renderSuccess(sa) {
  const ol = $("#points");
  ol.innerHTML = "";
  (sa.points || []).forEach((p) => { const li = document.createElement("li"); li.textContent = p; ol.appendChild(li); });
  $("#tech").textContent = sa.ky_thuat_quay_phim || "";
}

function selectRow(i) { document.querySelectorAll(".trow").forEach((r) => r.classList.toggle("sel", +r.dataset.i === i)); }

function setupVideo() {
  const v = $("#video");
  v.src = "/api/video";
  const big = $("#bigPlay"), playBtn = $("#playBtn"), cap = $("#caption");

  const toggle = () => (v.paused ? v.play() : v.pause());
  big.addEventListener("click", toggle);
  playBtn.addEventListener("click", toggle);
  v.addEventListener("play", () => { big.classList.add("hidden"); setIcon(playBtn, "pause-fill"); });
  v.addEventListener("pause", () => { big.classList.remove("hidden"); setIcon(playBtn, "play-fill"); });
  v.addEventListener("loadedmetadata", () => ($("#dur").textContent = fmt(v.duration)));
  v.addEventListener("timeupdate", () => {
    $("#cur").textContent = fmt(v.currentTime);
    $("#scrubFill").style.width = (v.currentTime / (v.duration || 1)) * 100 + "%";
    const seg = segments.find((s) => v.currentTime >= s.start && v.currentTime < s.end);
    cap.textContent = seg ? seg.text : "";
    if (seg) selectRow(seg.i);
  });
  $("#muteBtn").addEventListener("click", () => { v.muted = !v.muted; setIcon($("#muteBtn"), v.muted ? "mute" : "volume"); });
  $("#fsBtn").addEventListener("click", () => v.requestFullscreen && v.requestFullscreen());
  document.querySelector(".scrub").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * (v.duration || 0);
  });
}

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    $("#pane-script").classList.toggle("hidden", t.dataset.tab !== "script");
    $("#pane-success").classList.toggle("hidden", t.dataset.tab !== "success");
  });
});

$("#copyAll").addEventListener("click", () => {
  navigator.clipboard?.writeText(segments.map((s) => s.text).join("\n\n"));
  const c = $("#copyAll");
  c.innerHTML = "✓ Đã sao chép";
  setTimeout(() => { c.innerHTML = `<span class="ic" data-icon="copy"></span> Sao chép`; injectIcons(c); }, 1500);
});

function esc(s) { return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

load();
