"""Client TikTok Shop Partner API (v2) — Affiliate Seller + OAuth.

Credentials (app_key/app_secret/service_id) nhập từ form "Kết nối TikTok" và lưu
vào token store; env chỉ là fallback bootstrap. Ký + endpoint token giống hệt
bản đã chạy thật ở project order (sign.ts).

Store file: TTS_TOKEN_FILE (mặc định backend/.tts_token.json) — đã gitignore.
"""
import hashlib
import hmac
import json
import os
import time

import httpx

SHOP_BASE = os.environ.get("TTS_BASE_URL", "https://open-api.tiktokglobalshop.com")
AUTH_BASE = "https://auth.tiktok-shops.com"
TOKEN_FILE = os.environ.get("TTS_TOKEN_FILE", os.path.join(os.path.dirname(__file__), ".tts_token.json"))


# ---------- token store ----------
def _load_store() -> dict:
    if os.path.exists(TOKEN_FILE):
        try:
            return json.load(open(TOKEN_FILE, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    s = {}
    if os.environ.get("TTS_APP_KEY"):
        s["app_key"] = os.environ["TTS_APP_KEY"]
    if os.environ.get("TTS_APP_SECRET"):
        s["app_secret"] = os.environ["TTS_APP_SECRET"]
    if os.environ.get("TTS_ACCESS_TOKEN"):
        s["access_token"] = os.environ["TTS_ACCESS_TOKEN"]
        s["refresh_token"] = os.environ.get("TTS_REFRESH_TOKEN", "")
        s["access_token_expire_at"] = 0
    if os.environ.get("TTS_SHOP_CIPHER"):
        s["shop_cipher"] = os.environ["TTS_SHOP_CIPHER"]
    return s


def _save_store(d: dict):
    try:
        json.dump(d, open(TOKEN_FILE, "w", encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print("⚠ không lưu được token file:", e)


def _abs_expiry(v) -> int:
    v = int(v or 0)
    return v if v > 1_000_000_000 else (int(time.time()) + v if v else 0)


def _creds() -> tuple[str, str]:
    s = _load_store()
    ak, sk = s.get("app_key"), s.get("app_secret")
    if not (ak and sk):
        raise RuntimeError("Chưa có app_key/app_secret — vào tab 'Kết nối TikTok' để nhập & ủy quyền.")
    return ak, sk


# ---------- ký & gọi ----------
def _sign(pathname: str, query: dict, body: str, app_secret: str) -> str:
    keys = sorted(k for k in query if k not in ("access_token", "sign"))
    base = pathname + "".join(f"{k}{query[k]}" for k in keys) + (body or "")
    base = f"{app_secret}{base}{app_secret}"
    return hmac.new(app_secret.encode(), base.encode(), hashlib.sha256).hexdigest()


def _request(method, base, path, query, app_key, app_secret,
             json_body=None, access_token=None) -> dict:
    q = {k: str(v) for k, v in query.items() if v is not None}
    q.setdefault("app_key", app_key)
    q["timestamp"] = str(int(time.time()))
    body = json.dumps(json_body, separators=(",", ":"), ensure_ascii=False) if json_body else ""
    q["sign"] = _sign(path, q, body, app_secret)
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
def connect(auth_code: str, app_key: str, app_secret: str,
            service_id: str = "", shop_name: str = "", market: str = "global") -> dict:
    """Đổi auth_code -> token bằng app_key/app_secret vừa nhập, lưu tất cả vào store."""
    data = _request("GET", AUTH_BASE, "/api/v2/token/get", {
        "auth_code": auth_code, "app_key": app_key, "app_secret": app_secret,
        "grant_type": "authorized_code",
    }, app_key, app_secret)
    d = data.get("data") or {}
    store = {
        "app_key": app_key, "app_secret": app_secret,
        "service_id": service_id, "shop_name": shop_name, "market": market,
        "access_token": d.get("access_token", ""),
        "refresh_token": d.get("refresh_token", ""),
        "access_token_expire_at": _abs_expiry(d.get("access_token_expire_in")),
        "refresh_token_expire_at": _abs_expiry(d.get("refresh_token_expire_in")),
        "seller_name": d.get("seller_name", "") or shop_name,
    }
    _save_store(store)
    return store


def refresh_access_token() -> str:
    s = _load_store()
    ak, sk, rt = s.get("app_key"), s.get("app_secret"), s.get("refresh_token")
    if not (ak and sk and rt):
        raise RuntimeError("Chưa đủ thông tin để refresh — cần ủy quyền lại.")
    data = _request("GET", AUTH_BASE, "/api/v2/token/refresh", {
        "refresh_token": rt, "app_key": ak, "app_secret": sk, "grant_type": "refresh_token",
    }, ak, sk)
    d = data.get("data") or {}
    s["access_token"] = d.get("access_token", s.get("access_token", ""))
    s["refresh_token"] = d.get("refresh_token", rt)
    s["access_token_expire_at"] = _abs_expiry(d.get("access_token_expire_in"))
    _save_store(s)
    return s["access_token"]


def ensure_access_token() -> str:
    s = _load_store()
    at, exp = s.get("access_token"), s.get("access_token_expire_at", 0)
    if at and (exp == 0 or exp - 300 > time.time()):
        return at
    if s.get("refresh_token"):
        return refresh_access_token()
    if at:
        return at
    raise RuntimeError("Chưa ủy quyền TikTok Shop — vào tab 'Kết nối TikTok'.")


def status() -> dict:
    s = _load_store()
    return {"connected": bool(s.get("access_token")),
            "seller_name": s.get("seller_name", "") or s.get("shop_name", ""),
            "service_id": s.get("service_id", ""), "market": s.get("market", "global")}


# ---------- Shop API ----------
def get_shop_cipher() -> str:
    s = _load_store()
    if s.get("shop_cipher"):
        return s["shop_cipher"]
    ak, sk = _creds()
    data = _request("GET", SHOP_BASE, "/authorization/202309/shops", {}, ak, sk,
                    access_token=ensure_access_token())
    shops = (data.get("data") or {}).get("shops") or []
    if not shops:
        raise RuntimeError("Không có shop nào đã ủy quyền cho token này.")
    s["shop_cipher"] = shops[0].get("cipher")
    _save_store(s)
    return s["shop_cipher"]


def get_affiliate_videos(page_size: int = 20, page_token: str | None = None) -> dict:
    ak, sk = _creds()
    query = {"shop_cipher": get_shop_cipher(), "page_size": page_size}
    if page_token:
        query["page_token"] = page_token
    return _request("GET", SHOP_BASE, "/affiliate_seller/202412/open_collaborations/creator_content_details",
                    query, ak, sk, access_token=ensure_access_token())
