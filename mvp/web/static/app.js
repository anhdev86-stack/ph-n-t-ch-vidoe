// Viewer Kaloclip-style. Nạp dữ liệu từ /api/storyboard, video từ /api/video.
const $ = (s) => document.querySelector(s);

let segments = []; // [{start,end,text,name}] để đồng bộ caption theo thời gian

function parseTs(ts) {
  // "15~25s" -> [15,25]
  const m = (ts || "").match(/(\d+)\D+(\d+)/);
  return m ? [+m[1], +m[2]] : [0, 0];
}
function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function load() {
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
      <div><span class="shot"><span class="cam">📷</span>${esc(r.co_canh)}</span><div class="vd">${esc(r.mo_ta_hinh_anh)}</div></div>
      <div class="script">${esc(r.kich_ban_am_thanh)}</div>`;
    el.addEventListener("click", () => {
      const v = $("#video");
      v.currentTime = a + 0.1;
      selectRow(i);
    });
    box.appendChild(el);
  });
}

function renderSuccess(sa) {
  const ol = $("#points");
  ol.innerHTML = "";
  (sa.points || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    ol.appendChild(li);
  });
  $("#tech").textContent = sa.ky_thuat_quay_phim || "";
}

function selectRow(i) {
  document.querySelectorAll(".trow").forEach((r) => r.classList.toggle("sel", +r.dataset.i === i));
}

function setupVideo() {
  const v = $("#video");
  v.src = "/api/video";
  const big = $("#bigPlay"), playBtn = $("#playBtn"), cap = $("#caption");

  const toggle = () => (v.paused ? v.play() : v.pause());
  big.addEventListener("click", toggle);
  playBtn.addEventListener("click", toggle);
  v.addEventListener("play", () => { big.classList.add("hidden"); playBtn.textContent = "⏸"; });
  v.addEventListener("pause", () => { big.classList.remove("hidden"); playBtn.textContent = "▶"; });
  v.addEventListener("loadedmetadata", () => ($("#dur").textContent = fmt(v.duration)));
  v.addEventListener("timeupdate", () => {
    $("#cur").textContent = fmt(v.currentTime);
    $("#scrubFill").style.width = (v.currentTime / (v.duration || 1)) * 100 + "%";
    // caption + highlight theo đoạn hiện tại
    const seg = segments.find((s) => v.currentTime >= s.start && v.currentTime < s.end);
    cap.textContent = seg ? seg.text : "";
    if (seg) selectRow(seg.i);
  });
  $("#muteBtn").addEventListener("click", () => {
    v.muted = !v.muted;
    $("#muteBtn").textContent = v.muted ? "🔇" : "🔊";
  });
  $("#fsBtn").addEventListener("click", () => v.requestFullscreen && v.requestFullscreen());
  document.querySelector(".scrub").addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * (v.duration || 0);
  });
}

// TABS
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    $("#pane-script").classList.toggle("hidden", t.dataset.tab !== "script");
    $("#pane-success").classList.toggle("hidden", t.dataset.tab !== "success");
  });
});

// COPY
$("#copyAll").addEventListener("click", () => {
  const txt = segments.map((s) => s.text).join("\n\n");
  navigator.clipboard?.writeText(txt);
  $("#copyAll").textContent = "✓ Đã sao chép";
  setTimeout(() => ($("#copyAll").textContent = "⧉ Sao chép"), 1500);
});

function esc(s) {
  return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

load();
