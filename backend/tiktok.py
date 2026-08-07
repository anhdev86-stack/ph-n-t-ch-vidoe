"""Client TikTok Shop Partner API (v2) — Affiliate Seller + luồng OAuth token.

Port từ project AFF Order (NestTiktok) sang Python. Cơ chế ký & endpoint token
giống hệt bản đã chạy thật.

ENV cần:
    TTS_APP_KEY, TTS_APP_SECRET        (bắt buộc)
    TTS_SERVICE_ID                     (để tạo link ủy quyền /auth/tiktok/login)
    TTS_ACCESS_TOKEN, TTS_REFRESH_TOKEN(tùy chọn — bootstrap nếu đã có sẵn)
    TTS_SHOP_CIPHER                    (tùy chọn — bỏ trống sẽ tự lấy)
    TTS_TOKEN_FILE                     (nơi lưu token, mặc định web/.tts_token.json)

Ký (giống sign.ts): bỏ access_token+sign → sort → prepend pathname → +body(json)
→ bọc app_secret 2 đầu → HMAC-SHA256 hex. timestamp = giây.
"""
import hashlib
import hmac
import json
import os
import time

import httpx

SHOP_BASE = os.environ.get("TTS_BASE_URL", "https://open-api.tiktokglobalshop.com")
AUTH_BASE = "https://auth.tiktok-shops.com"
AUTHORIZE_BASE = "https://services.tiktokshops.com/open/authorize"

APP_KEY = os.environ.get("TTS_APP_KEY", "")
APP_SECRET = os.environ.get("TTS_APP_SECRET", "")
SERVICE_ID = os.environ.get("TTS_SERVICE_ID", "")
TOKEN_FILE = os.environ.get("TTS_TOKEN_FILE", os.path.join(os.path.dirname(__file__), ".tts_token.json"))

_shop_cipher_cache = os.environ.get("TTS_SHOP_CIPHER") or None


# ---------- token store ----------
def _load_store() -> dict:
    if os.path.exists(TOKEN_FILE):
        try:
            return json.load(open(TOKEN_FILE, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    # bootstrap từ env nếu chưa có file
    if os.environ.get("TTS_ACCESS_TOKEN"):
        return {
            "access_token": os.environ["TTS_ACCESS_TOKEN"],
            "refresh_token": os.environ.get("TTS_REFRESH_TOKEN", ""),
            "access_token_expire_at": 0,   # 0 = không rõ hạn, sẽ dùng tới khi 401 rồi refresh
            "refresh_token_expire_at": 0,
        }
    return {}


def _save_store(d: dict):
    try:
        json.dump(d, open(TOKEN_FILE, "w", encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print("⚠ không lưu được token file:", e)


def _abs_expiry(v) -> int:
    """TikTok trả expire_in có thể là epoch tuyệt đối hoặc số giây còn lại."""
    v = int(v or 0)
    return v if v > 1_000_000_000 else int(time.time()) + v


# ---------- ký & gọi ----------
def _sign(pathname: str, query: dict, body: str) -> str:
    keys = sorted(k for k in query if k not in ("access_token", "sign"))
    base = pathname + "".join(f"{k}{query[k]}" for k in keys) + (body or "")
    base = f"{APP_SECRET}{base}{APP_SECRET}"
    return hmac.new(APP_SECRET.encode(), base.encode(), hashlib.sha256).hexdigest()


def _request(method: str, base: str, path: str, query: dict, json_body: dict | None = None,
             access_token: str | None = None) -> dict:
    if not (APP_KEY and APP_SECRET):
        raise RuntimeError("Thiếu TTS_APP_KEY / TTS_APP_SECRET.")
    q = {k: str(v) for k, v in query.items() if v is not None}
    q.setdefault("app_key", APP_KEY)
    q["timestamp"] = str(int(time.time()))
    body = json.dumps(json_body, separators=(",", ":"), ensure_ascii=False) if json_body else ""
    q["sign"] = _sign(path, q, body)
    headers = {"content-type": "application/json"}
    if access_token:
        headers["x-tts-access-token"] = access_token
    resp = httpx.request(method, base + path, params=q,
                         content=body.encode() if body else None, headers=headers, timeout=30)
    data = resp.json()
    if data.get("code") not in (0, None):
        raise RuntimeError(f"TikTok API lỗi {data.get('code')}: {data.get('message')} (request_id={data.get('request_id')})")
    return data


# ---------- OAuth ----------
def authorize_url(state: str = "kaloclip") -> str:
    if not SERVICE_ID:
        raise RuntimeError("Thiếu TTS_SERVICE_ID để tạo link ủy quyền.")
    return f"{AUTHORIZE_BASE}?service_id={SERVICE_ID}&state={state}"


def get_access_token(auth_code: str) -> dict:
    """Đổi auth_code -> access_token/refresh_token (token/get) rồi lưu store."""
    data = _request("GET", AUTH_BASE, "/api/v2/token/get", {
        "auth_code": auth_code, "app_key": APP_KEY, "app_secret": APP_SECRET,
        "grant_type": "authorized_code",
    })
    return _store_token(data.get("data") or {})


def refresh_access_token() -> str:
    """Làm mới access_token bằng refresh_token đã lưu."""
    store = _load_store()
    rt = store.get("refresh_token")
    if not rt:
        raise RuntimeError("Chưa có refresh_token — cần ủy quyền lại (/auth/tiktok/login).")
    data = _request("GET", AUTH_BASE, "/api/v2/token/refresh", {
        "refresh_token": rt, "app_key": APP_KEY, "app_secret": APP_SECRET,
        "grant_type": "refresh_token",
    })
    return _store_token(data.get("data") or {})["access_token"]


def _store_token(d: dict) -> dict:
    store = {
        "access_token": d.get("access_token", ""),
        "refresh_token": d.get("refresh_token", ""),
        "access_token_expire_at": _abs_expiry(d.get("access_token_expire_in")),
        "refresh_token_expire_at": _abs_expiry(d.get("refresh_token_expire_in")),
        "seller_name": d.get("seller_name", ""),
    }
    _save_store(store)
    return store


def ensure_access_token() -> str:
    """Trả access_token còn hạn; tự refresh nếu sắp/đã hết hạn."""
    store = _load_store()
    at = store.get("access_token")
    exp = store.get("access_token_expire_at", 0)
    if at and (exp == 0 or exp - 300 > time.time()):
        return at
    if store.get("refresh_token"):
        return refresh_access_token()
    if at:
        return at
    raise RuntimeError("Chưa có access_token — vào /auth/tiktok/login để ủy quyền shop.")


# ---------- Shop API ----------
def get_shop_cipher() -> str:
    global _shop_cipher_cache
    if _shop_cipher_cache:
        return _shop_cipher_cache
    data = _request("GET", SHOP_BASE, "/authorization/202309/shops", {},
                    access_token=ensure_access_token())
    shops = (data.get("data") or {}).get("shops") or []
    if not shops:
        raise RuntimeError("Không có shop nào đã ủy quyền cho token này.")
    _shop_cipher_cache = shops[0].get("cipher")
    return _shop_cipher_cache


def get_affiliate_videos(page_size: int = 20, page_token: str | None = None) -> dict:
    """Video creator gắn sản phẩm shop (open collaboration creator content)."""
    query = {"shop_cipher": get_shop_cipher(), "page_size": page_size}
    if page_token:
        query["page_token"] = page_token
    return _request("GET", SHOP_BASE, "/affiliate_seller/202412/open_collaborations/creator_content_details",
                    query, access_token=ensure_access_token())
