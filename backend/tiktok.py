"""Client TikTok Shop Partner API (v2) — Affiliate Seller + OAuth, ĐA SHOP.

Mỗi shop có bộ credentials + token riêng, lưu trong danh sách store["shops"].
Ký + endpoint token giống bản đã chạy thật (sign.ts).

Store file: TTS_TOKEN_FILE (mặc định backend/.tts_token.json) — đã gitignore.
"""
import hashlib
import hmac
import json
import os
import time
import uuid

import httpx

SHOP_BASE = os.environ.get("TTS_BASE_URL", "https://open-api.tiktokglobalshop.com")
AUTH_BASE = "https://auth.tiktok-shops.com"
TOKEN_FILE = os.environ.get("TTS_TOKEN_FILE", os.path.join(os.path.dirname(__file__), ".tts_token.json"))


# ---------- store (danh sách shop) ----------
def _load() -> dict:
    if os.path.exists(TOKEN_FILE):
        try:
            d = json.load(open(TOKEN_FILE, encoding="utf-8"))
            if isinstance(d, dict) and "shops" in d:
                return d
        except Exception:  # noqa: BLE001
            pass
    return {"shops": []}


def _save(d: dict):
    try:
        json.dump(d, open(TOKEN_FILE, "w", encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print("⚠ không lưu được token file:", e)


def _abs_expiry(v) -> int:
    v = int(v or 0)
    return v if v > 1_000_000_000 else (int(time.time()) + v if v else 0)


def _sanitize(s: dict) -> dict:
    """Trả field công khai (KHÔNG lộ app_secret / token)."""
    return {
        "id": s.get("id"),
        "shop_name": s.get("shop_name", "") or s.get("seller_name", ""),
        "seller_name": s.get("seller_name", ""),
        "service_id": s.get("service_id", ""),
        "market": s.get("market", "global"),
        "connected": bool(s.get("access_token")),
        "created_at": s.get("created_at"),
    }


def list_shops() -> list[dict]:
    return [_sanitize(s) for s in _load()["shops"]]


def status() -> dict:
    shops = _load()["shops"]
    return {"connected": bool(shops), "count": len(shops)}


def _find(shop_id: str | None) -> dict:
    shops = _load()["shops"]
    if not shops:
        raise RuntimeError("Chưa có shop nào được ủy quyền — vào tab 'Kết nối TikTok'.")
    if shop_id:
        for s in shops:
            if s.get("id") == shop_id:
                return s
        raise RuntimeError("Không tìm thấy shop.")
    return shops[0]


# ---------- ký & gọi ----------
def _sign(pathname: str, query: dict, body: str, app_secret: str) -> str:
    keys = sorted(k for k in query if k not in ("access_token", "sign"))
    base = pathname + "".join(f"{k}{query[k]}" for k in keys) + (body or "")
    base = f"{app_secret}{base}{app_secret}"
    return hmac.new(app_secret.encode(), base.encode(), hashlib.sha256).hexdigest()


def _request(method, base, path, query, app_key, app_secret, access_token=None) -> dict:
    q = {k: str(v) for k, v in query.items() if v is not None}
    q.setdefault("app_key", app_key)
    q["timestamp"] = str(int(time.time()))
    q["sign"] = _sign(path, q, "", app_secret)
    headers = {"content-type": "application/json"}
    if access_token:
        headers["x-tts-access-token"] = access_token
    resp = httpx.request(method, base + path, params=q, headers=headers, timeout=30)
    data = resp.json()
    if data.get("code") not in (0, None):
        raise RuntimeError(f"TikTok API lỗi {data.get('code')}: {data.get('message')} (request_id={data.get('request_id')})")
    return data


# ---------- OAuth (thêm / xoá shop) ----------
def add_shop(auth_code: str, app_key: str, app_secret: str,
             service_id: str = "", shop_name: str = "", market: str = "global") -> dict:
    data = _request("GET", AUTH_BASE, "/api/v2/token/get", {
        "auth_code": auth_code, "app_key": app_key, "app_secret": app_secret,
        "grant_type": "authorized_code",
    }, app_key, app_secret)
    d = data.get("data") or {}
    shop = {
        "id": uuid.uuid4().hex[:12],
        "app_key": app_key, "app_secret": app_secret,
        "service_id": service_id, "shop_name": shop_name, "market": market,
        "access_token": d.get("access_token", ""),
        "refresh_token": d.get("refresh_token", ""),
        "access_token_expire_at": _abs_expiry(d.get("access_token_expire_in")),
        "refresh_token_expire_at": _abs_expiry(d.get("refresh_token_expire_in")),
        "seller_name": d.get("seller_name", "") or shop_name,
        "shop_cipher": "",
        "created_at": int(time.time()),
    }
    store = _load()
    store["shops"].append(shop)
    _save(store)
    return _sanitize(shop)


def remove_shop(shop_id: str) -> bool:
    store = _load()
    n = len(store["shops"])
    store["shops"] = [s for s in store["shops"] if s.get("id") != shop_id]
    _save(store)
    return len(store["shops"]) < n


# ---------- token per-shop ----------
def _ensure_token(shop: dict) -> str:
    at, exp = shop.get("access_token"), shop.get("access_token_expire_at", 0)
    if at and (exp == 0 or exp - 300 > time.time()):
        return at
    rt = shop.get("refresh_token")
    if not rt:
        if at:
            return at
        raise RuntimeError("Shop chưa có token hợp lệ — ủy quyền lại.")
    data = _request("GET", AUTH_BASE, "/api/v2/token/refresh", {
        "refresh_token": rt, "app_key": shop["app_key"], "app_secret": shop["app_secret"],
        "grant_type": "refresh_token",
    }, shop["app_key"], shop["app_secret"])
    d = data.get("data") or {}
    shop["access_token"] = d.get("access_token", at)
    shop["refresh_token"] = d.get("refresh_token", rt)
    shop["access_token_expire_at"] = _abs_expiry(d.get("access_token_expire_in"))
    _save_shop(shop)
    return shop["access_token"]


def _save_shop(shop: dict):
    store = _load()
    store["shops"] = [shop if s.get("id") == shop.get("id") else s for s in store["shops"]]
    _save(store)


def _get_cipher(shop: dict) -> str:
    if shop.get("shop_cipher"):
        return shop["shop_cipher"]
    data = _request("GET", SHOP_BASE, "/authorization/202309/shops", {},
                    shop["app_key"], shop["app_secret"], access_token=_ensure_token(shop))
    shops = (data.get("data") or {}).get("shops") or []
    if not shops:
        raise RuntimeError("Không có shop nào đã ủy quyền cho token này.")
    shop["shop_cipher"] = shops[0].get("cipher")
    _save_shop(shop)
    return shop["shop_cipher"]


# ---------- Shop API ----------
def get_affiliate_videos(shop_id: str | None = None, page_size: int = 20, page_token: str | None = None) -> dict:
    shop = _find(shop_id)
    query = {"shop_cipher": _get_cipher(shop), "page_size": page_size}
    if page_token:
        query["page_token"] = page_token
    return _request("GET", SHOP_BASE, "/affiliate_seller/202412/open_collaborations/creator_content_details",
                    query, shop["app_key"], shop["app_secret"], access_token=_ensure_token(shop))
