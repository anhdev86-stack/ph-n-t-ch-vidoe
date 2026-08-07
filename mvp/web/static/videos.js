// Grid video affiliate. Nạp từ /api/videos (TikTok Shop). Icon dùng chung style line.
const $ = (s) => document.querySelector(s);
const Sv = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const Fv = 'viewBox="0 0 24 24" fill="currentColor" stroke="none"';
const ICONS = {
  brand: `<svg ${Fv}><path d="M8 5v14l11-7z"/></svg>`,
  video: `<svg ${Sv}><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`,
  clapper: `<svg ${Sv}><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.4-2.5l13.4-4c1.1-.3 2.2.3 2.5 1.4Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>`,
  pen: `<svg ${Sv}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  share: `<svg ${Sv}><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
  folder: `<svg ${Sv}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  gem: `<svg ${Sv}><path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20"/><path d="m12 21 4-12-2-6"/><path d="m12 21-4-12 2-6"/></svg>`,
  chevron: `<svg ${Sv}><path d="m6 9 6 6 6-6"/></svg>`,
  play: `<svg ${Fv}><path d="M8 5v14l11-7z"/></svg>`,
  eye: `<svg ${Sv}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  cart: `<svg ${Sv}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>`,
  tag: `<svg ${Sv}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`,
};
function injectIcons(root = document) { root.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || "")); }
function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function num(n) { if (n == null) return "—"; n = +n; return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n); }

let nextToken = null;

function card(v) {
  const cover = v.cover
    ? `<img src="${esc(v.cover)}" loading="lazy" alt="">`
    : `<div class="ph"><span data-icon="play"></span></div>`;
  const prod = v.product ? `<span class="chip"><span class="ci" data-icon="tag"></span>${esc(v.product)}</span>` : "";
  return `<a class="vcard" ${v.video_url ? `href="${esc(v.video_url)}" target="_blank" rel="noopener"` : ""}>
    <div class="cover">${cover}<span class="pin" data-icon="play"></span></div>
    <div class="meta">
      <div class="vtitle">${esc(v.title) || "(không tiêu đề)"}</div>
      ${v.creator ? `<div class="creator">@${esc(v.creator)}</div>` : ""}
      ${prod}
      <div class="stats">
        <span><span class="si" data-icon="eye"></span>${num(v.views)}</span>
        <span><span class="si" data-icon="cart"></span>${num(v.sales)}</span>
        ${v.gmv != null ? `<span class="gmv">${esc(v.gmv)}</span>` : ""}
      </div>
    </div>
  </a>`;
}

async function loadVideos(reset = true) {
  const grid = $("#grid"), banner = $("#banner");
  if (reset) { grid.innerHTML = "<div class='loading'>Đang tải video affiliate…</div>"; nextToken = null; }
  const url = "/api/videos?page_size=20" + (nextToken ? "&page_token=" + encodeURIComponent(nextToken) : "");
  let res;
  try { res = await (await fetch(url)).json(); }
  catch (e) { return showError("Không gọi được /api/videos: " + e); }

  if (res.error) return showError(res.error);
  banner.classList.add("hidden");
  if (reset) grid.innerHTML = "";
  const vids = res.videos || [];
  if (reset && !vids.length) { grid.innerHTML = "<div class='loading'>Chưa có video affiliate nào.</div>"; }
  grid.insertAdjacentHTML("beforeend", vids.map(card).join(""));
  injectIcons(grid);
  nextToken = res.next_page_token || null;
  $("#more-wrap").classList.toggle("hidden", !nextToken);
  if (res.raw_sample) console.log("raw_sample (gửi lại để chốt mapping):", res.raw_sample);
}

function showError(msg) {
  $("#grid").innerHTML = "";
  const b = $("#banner");
  b.classList.remove("hidden");
  b.innerHTML = `<b>Chưa lấy được video.</b> ${esc(msg)}<br>
    <span class="hint">Kiểm tra biến môi trường TTS_APP_KEY / TTS_APP_SECRET / TTS_ACCESS_TOKEN
    (và shop đã ủy quyền). Xem README mục "TikTok Shop".</span>`;
}

$("#reload").addEventListener("click", () => loadVideos(true));
$("#more").addEventListener("click", () => loadVideos(false));
injectIcons();
loadVideos(true);
