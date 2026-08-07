"""Quản lý tài khoản + phân quyền (không cần DB).

Lưu ở analysis_cache/users.json (đã mount volume nên bền qua redeploy).
Role: 'admin' (full quyền) | 'staff' (mọi chức năng trừ uỷ quyền TikTok & quản lý tài khoản).
Bootstrap: nếu chưa có file, seed admin từ ENV ADMIN_USERNAME/ADMIN_PASSWORD.
"""
import hashlib
import json
import os
import time

HERE = os.path.dirname(__file__)
USERS_FILE = os.environ.get("USERS_FILE", os.path.join(HERE, "analysis_cache", "users.json"))
_ITER = 200_000


def _hash(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITER)
    return dk.hex()


def _make_hash(password: str) -> str:
    salt = os.urandom(16).hex()
    return f"pbkdf2${_ITER}${salt}${_hash(password, salt)}"


def _verify(password: str, stored: str) -> bool:
    try:
        _algo, _iter, salt, h = stored.split("$")
        return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(_iter)).hex() == h
    except Exception:  # noqa: BLE001
        return False


def _load() -> dict:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, encoding="utf-8") as f:
                data = json.load(f)
            if data:
                return data
        except Exception:  # noqa: BLE001
            pass
    # Bootstrap: tài khoản admin gốc từ ENV
    admin_user = os.environ.get("ADMIN_USERNAME", "admin")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
    data = {admin_user: {"password": _make_hash(admin_pass), "role": "admin",
                         "active": True, "created_at": int(time.time())}}
    _save(data)
    return data


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def authenticate(username: str, password: str):
    """Trả về dict user (kèm role) nếu đúng & đang active, ngược lại None."""
    u = _load().get(username)
    if not u or not u.get("active", True):
        return None
    if not _verify(password, u["password"]):
        return None
    return {"username": username, "role": u.get("role", "staff")}


def get_role(username: str) -> str | None:
    u = _load().get(username)
    return u.get("role") if u else None


def list_users() -> list[dict]:
    data = _load()
    return [{"username": k, "role": v.get("role", "staff"), "active": v.get("active", True),
             "created_at": v.get("created_at")} for k, v in sorted(data.items())]


def create_user(username: str, password: str, role: str = "staff") -> dict:
    username = username.strip()
    if not username or not password:
        raise ValueError("Thiếu tên đăng nhập hoặc mật khẩu")
    if role not in ("admin", "staff"):
        raise ValueError("Role không hợp lệ")
    data = _load()
    if username in data:
        raise ValueError("Tên đăng nhập đã tồn tại")
    data[username] = {"password": _make_hash(password), "role": role,
                      "active": True, "created_at": int(time.time())}
    _save(data)
    return {"username": username, "role": role, "active": True}


def update_user(username: str, password: str | None = None,
                role: str | None = None, active: bool | None = None) -> dict:
    data = _load()
    if username not in data:
        raise ValueError("Không tìm thấy tài khoản")
    u = data[username]
    if password:
        u["password"] = _make_hash(password)
    if role is not None:
        if role not in ("admin", "staff"):
            raise ValueError("Role không hợp lệ")
        # Không hạ cấp admin cuối cùng
        if u.get("role") == "admin" and role != "admin" and _count_active_admins(data, exclude=username) == 0:
            raise ValueError("Phải còn ít nhất 1 admin")
        u["role"] = role
    if active is not None:
        if not active and u.get("role") == "admin" and _count_active_admins(data, exclude=username) == 0:
            raise ValueError("Phải còn ít nhất 1 admin đang hoạt động")
        u["active"] = active
    _save(data)
    return {"username": username, "role": u.get("role"), "active": u.get("active", True)}


def delete_user(username: str) -> bool:
    data = _load()
    if username not in data:
        return False
    if data[username].get("role") == "admin" and _count_active_admins(data, exclude=username) == 0:
        raise ValueError("Không thể xoá admin cuối cùng")
    del data[username]
    _save(data)
    return True


def _count_active_admins(data: dict, exclude: str = "") -> int:
    return sum(1 for k, v in data.items()
               if k != exclude and v.get("role") == "admin" and v.get("active", True))
