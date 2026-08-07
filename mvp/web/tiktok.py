"""Client TikTok Shop Partner API (v2) — module Affiliate Seller.

Chỉ cần các biến môi trường:
    TTS_APP_KEY, TTS_APP_SECRET, TTS_ACCESS_TOKEN
    TTS_SHOP_CIPHER   (tùy chọn — nếu bỏ trống sẽ tự lấy qua Get Authorized Shops)
    TTS_BASE_URL      (mặc định https://open-api.tiktokglobalshop.com)

Cơ chế ký (sign) theo chuẩn TikTok Shop Open API v2:
  1. Lấy toàn bộ query param, BỎ 'sign' và 'access_token'.
  2. Sắp xếp key tăng dần, nối "{key}{value}" liền nhau.
  3. Prepend đường dẫn API (path đầy đủ có /category/version/endpoint).
  4. Nếu có body JSON (không phải multipart) thì nối raw body vào cuối.
  5. Bọc app_secret ở 2 đầu: app_secret + chuỗi + app_secret.
  6. HMAC-SHA256 (key = app_secret) -> hex thường.
  timestamp tính bằng GIÂY; access_token đặt ở header x-tts-access-token.
"""
import hashlib
import hmac
import json
import os
import time

import httpx

BASE = os.environ.get("TTS_BASE_URL", "https://open-api.tiktokglobalshop.com")
APP_KEY = os.environ.get("TTS_APP_KEY", "")
APP_SECRET = os.environ.get("TTS_APP_SECRET", "")
ACCESS_TOKEN = os.environ.get("TTS_ACCESS_TOKEN", "")

_shop_cipher_cache = os.environ.get("TTS_SHOP_CIPHER") or None


def _sign(path: str, query: dict, body: str) -> str:
    keys = sorted(k for k in query if k not in ("sign", "access_token"))
    base = path + "".join(f"{k}{query[k]}" for k in keys) + (body or "")
    base = f"{APP_SECRET}{base}{APP_SECRET}"
    return hmac.new(APP_SECRET.encode(), base.encode(), hashlib.sha256).hexdigest()


def call(method: str, path: str, query: dict | None = None, json_body: dict | None = None) -> dict:
    """Gọi 1 endpoint TikTok Shop. `path` phải đầy đủ, vd
    '/affiliate_seller/202412/open_collaborations/creator_content_details'.
    """
    if not (APP_KEY and APP_SECRET and ACCESS_TOKEN):
        raise RuntimeError("Thiếu TTS_APP_KEY / TTS_APP_SECRET / TTS_ACCESS_TOKEN trong môi trường.")

    q = {k: str(v) for k, v in (query or {}).items() if v is not None}
    q["app_key"] = APP_KEY
    q["timestamp"] = str(int(time.time()))
    body = json.dumps(json_body, separators=(",", ":"), ensure_ascii=False) if json_body is not None else ""
    q["sign"] = _sign(path, q, body)

    headers = {"x-tts-access-token": ACCESS_TOKEN, "content-type": "application/json"}
    resp = httpx.request(method, BASE + path, params=q,
                         content=body.encode() if body else None,
                         headers=headers, timeout=30)
    data = resp.json()
    if data.get("code") not in (0, None):
        raise RuntimeError(f"TikTok API lỗi {data.get('code')}: {data.get('message')} (request_id={data.get('request_id')})")
    return data


def get_shop_cipher() -> str:
    """Tự lấy shop_cipher của shop đã ủy quyền (cache lại)."""
    global _shop_cipher_cache
    if _shop_cipher_cache:
        return _shop_cipher_cache
    data = call("GET", "/authorization/202309/shops")
    shops = (data.get("data") or {}).get("shops") or []
    if not shops:
        raise RuntimeError("Không tìm thấy shop nào đã ủy quyền cho access_token này.")
    _shop_cipher_cache = shops[0].get("cipher")
    return _shop_cipher_cache


def get_affiliate_videos(page_size: int = 20, page_token: str | None = None) -> dict:
    """Lấy list video creator gắn sản phẩm shop (open collaboration creator content).

    Trả về nguyên `data` của TikTok để app map field. Có phân trang qua next_page_token.
    """
    query = {"shop_cipher": get_shop_cipher(), "page_size": page_size}
    if page_token:
        query["page_token"] = page_token
    return call("GET", "/affiliate_seller/202412/open_collaborations/creator_content_details", query=query)
