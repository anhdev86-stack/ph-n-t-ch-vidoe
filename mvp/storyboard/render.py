"""Render kết quả JSON → trang HTML 2 tab giống Kaloclip."""
import html
import json


def _fmt(t):
    return f"{int(t)}s"


def render_html(result: dict, out_path: str):
    sb = result.get("storyboard", [])
    sa = result.get("success_analysis", {})

    rows = ""
    for s in sb:
        rows += f"""<div class="row">
  <div class="c1"><div class="nm">{html.escape(s.get('section_name',''))}</div>
    <span class="ts">{_fmt(s.get('start',0))} – {_fmt(s.get('end',0))}</span></div>
  <div class="c2"><span class="shot">{html.escape(s.get('shot_type',''))}</span>
    <div class="vd">{html.escape(s.get('visual_desc',''))}</div></div>
  <div class="c3">{html.escape(s.get('transcript',''))}</div>
</div>"""

    points = "".join(f"<li>{html.escape(p)}</li>" for p in sa.get("points", []))
    tech = html.escape(sa.get("filming_technique", ""))

    doc = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storyboard</title><style>
body{{font-family:system-ui,sans-serif;margin:0;background:#0b0f14;color:#e7eef4}}
.wrap{{max-width:1000px;margin:0 auto;padding:24px}}
.tabs{{display:flex;gap:0;border-bottom:1px solid #22303c;margin-bottom:16px}}
.tab{{padding:10px 18px;cursor:pointer;font-weight:600;color:#93a0ac;border-bottom:2px solid transparent}}
.tab.on{{color:#e7eef4;border-bottom-color:#38c8d4}}
.pane{{display:none}} .pane.on{{display:block}}
.head,.row{{display:grid;grid-template-columns:200px 1fr 1fr;gap:0}}
.head>div{{font-size:12px;text-transform:uppercase;color:#657482;padding:10px 14px;background:#0f151d}}
.row{{border-top:1px solid #22303c}}
.row>div{{padding:12px 14px;font-size:13px;border-right:1px solid #22303c}}
.row>div:last-child{{border-right:0}}
.nm{{font-weight:650}} .ts{{font-family:monospace;font-size:12px;color:#38c8d4}}
.shot{{display:inline-block;font-family:monospace;font-size:11px;border:1px solid #31434f;border-radius:5px;padding:1px 7px;margin-bottom:6px}}
.vd{{color:#93a0ac;font-size:12.5px}}
h3{{color:#38c8d4}} li{{margin:6px 0;line-height:1.5}}
</style></head><body><div class="wrap">
<div class="tabs">
  <div class="tab on" onclick="sw(0)">Kịch bản video</div>
  <div class="tab" onclick="sw(1)">Giải thích điểm thành công</div>
</div>
<div class="pane on">
  <div class="head"><div>Phân cảnh</div><div>Mô tả hình ảnh</div><div>Kịch bản âm thanh</div></div>
  {rows}
</div>
<div class="pane">
  <h3>✨ Giải thích điểm thành công</h3><ol>{points}</ol>
  <h3>🎬 Kỹ thuật quay phim</h3><p>{tech}</p>
</div>
</div><script>
function sw(i){{document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',i==j));
document.querySelectorAll('.pane').forEach((p,j)=>p.classList.toggle('on',i==j));}}
</script></body></html>"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)
    return out_path


def save_json(result: dict, out_path: str):
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return out_path
