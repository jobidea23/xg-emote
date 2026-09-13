# ============================================
#  XG THUNDER 2.0 — EXE EMOTE PORTAL (Backend)
# ============================================
#  RUN:  python server.py
#  OPEN: http://localhost:8080   (main site w/ access code)
#  ADMIN: http://localhost:8080/admin
# ============================================

import os
import json
import hashlib
import secrets
import time
import re
import requests
from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_FILE = os.path.join(BASE_DIR, "access_codes.json")
EMOTE_ORIGIN = "https://godjexar-bangladesh-emote-bot-api.vercel.app/play_emote"  # legacy, not used

# Live emote backends (same ones used by ffemote.pro — works as of 2026)
SERVER_MAP = {
    "ind": {"key": "india", "base": "https://emote.thory.in"},
    "india": {"key": "india", "base": "https://emote.thory.in"},
    "bd": {"key": "bangladesh", "base": "https://emote.goodbyydosto.workers.dev/bd"},
    "bangladesh": {"key": "bangladesh", "base": "https://emote.goodbyydosto.workers.dev/bd"},
    "pk": {"key": "pakistan", "base": "https://emote.goodbyydosto.workers.dev/pk"},
    "pakistan": {"key": "pakistan", "base": "https://emote.goodbyydosto.workers.dev/pk"},
    "id": {"key": "indonesia", "base": "https://emote.goodbyydosto.workers.dev/id"},
    "indonesia": {"key": "indonesia", "base": "https://emote.goodbyydosto.workers.dev/id"},
    "br": {"key": "brazil", "base": "https://emote.goodbyydosto.workers.dev/br"},
    "brazil": {"key": "brazil", "base": "https://emote.goodbyydosto.workers.dev/br"},
    "tw": {"key": "taiwan", "base": "https://emote.goodbyydosto.workers.dev/tw"},
    "taiwan": {"key": "taiwan", "base": "https://emote.goodbyydosto.workers.dev/tw"},
    "vn": {"key": "vietnam", "base": "https://emote.goodbyydosto.workers.dev/vn"},
    "vietnam": {"key": "vietnam", "base": "https://emote.goodbyydosto.workers.dev/vn"},
}
PROXY_ORIGIN = "https://ffemote.pro/api/join"
SESSION_TTL = 60 * 60 * 24  # 24 hours

# ── Admin credentials ─────────────────────────────
ADMIN_USERNAME = "xgthunder2.0"
ADMIN_PASSWORD = "9125@braj"
ADMIN_PASSWORD_HASH = hashlib.sha256(ADMIN_PASSWORD.encode("utf-8")).hexdigest()

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")

@app.after_request
def no_cache_web_assets(resp):
    if request.path.endswith((".html", ".js", ".css")):
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp

# token -> {"kind": "user"|"admin", "code": ..., "created": ..., "expires": ...}
sessions = {}

# ============================================
# DATA STORE (access codes)
# ============================================
def load_codes():
    data = {"codes": {}}
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {"codes": {}}
    if "codes" not in data:
        data["codes"] = {}
    return data


def save_codes(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def ensure_default_codes():
    data = load_codes()
    changed = False
    if "EXE" not in data["codes"]:
        data["codes"]["EXE"] = {
            "code": "EXE",
            "created": time.time(),
            "expires": None,
            "max_uses": None,
            "used": 0,
            "enabled": True,
            "note": "Master code — type EXE and press Enter to unlock.",
        }
        changed = True
    if "codes" in data and changed:
        save_codes(data)


# ============================================
# SESSION HELPERS
# ============================================
def new_session(kind, code=None):
    token = secrets.token_hex(24)
    now = time.time()
    sessions[token] = {
        "kind": kind,
        "code": code,
        "created": now,
        "expires": now + SESSION_TTL,
    }
    return token


def clean_sessions():
    now = time.time()
    for token in list(sessions.keys()):
        if sessions[token]["expires"] < now:
            del sessions[token]


def get_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.args.get("token", "").strip()


def require_admin():
    clean_sessions()
    token = get_token()
    sess = sessions.get(token)
    if not sess or sess["kind"] != "admin":
        return False
    return sess


def require_user():
    clean_sessions()
    token = get_token()
    sess = sessions.get(token)
    if not sess or sess["kind"] != "user":
        return False
    return sess


# ============================================
# ACCESS CODE LOGIC
# ============================================
def code_is_valid(entry):
    if not entry or not entry.get("enabled", True):
        return "disabled"
    if entry.get("expires"):
        if time.time() > entry["expires"]:
            return "expired"
    mx = entry.get("max_uses")
    if mx is not None and entry.get("used", 0) >= mx:
        return "used_up"
    return "ok"


# ============================================
# ROUTES — FRONTEND
# ============================================
@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def serve_admin():
    return send_from_directory(BASE_DIR, "admin.html")


# ============================================
# API — USER (ACCESS CODE LOGIN)
# ============================================
@app.route("/api/unlock", methods=["POST"])
def api_unlock():
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip().upper()

    if not code:
        return jsonify({"success": False, "message": "Access code is empty."}), 400

    store = load_codes()
    entry = store["codes"].get(code)

    status = code_is_valid(entry)
    if status != "ok":
        msg = {
            "disabled": "This access code has been disabled by admin.",
            "expired": "This access code has expired.",
            "used_up": "This access code has reached its usage limit.",
        }.get(status, "Invalid access code.")
        return jsonify({"success": False, "message": msg}), 403

    # record usage
    entry["used"] = entry.get("used", 0) + 1
    save_codes(store)

    token = new_session("user", code=code)
    return jsonify({
        "success": True,
        "message": "Unlocked! Welcome to XG THUNDER 2.0.",
        "token": token,
        "code": code,
    })


@app.route("/api/me", methods=["GET"])
def api_me():
    sess = require_user()
    if not sess:
        return jsonify({"success": False, "message": "Session invalid."}), 401
    return jsonify({
        "success": True,
        "code": sess.get("code"),
        "expires": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(sess["expires"])),
    })


@app.route("/api/logout", methods=["POST"])
def api_logout():
    token = get_token()
    if token in sessions:
        del sessions[token]
    return jsonify({"success": True})


# ============================================
# API — ADMIN AUTH
# ============================================
@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    pw_ok = hashlib.sha256(password.encode("utf-8")).hexdigest() == ADMIN_PASSWORD_HASH
    if username == ADMIN_USERNAME and pw_ok:
        token = new_session("admin")
        return jsonify({"success": True, "token": token, "message": "Admin login successful."})
    return jsonify({"success": False, "message": "Invalid admin username or password."}), 401


# ============================================
# API — ADMIN CODE MANAGEMENT
# ============================================
def generate_code(prefix="EXE"):
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return prefix + "-" + "".join(secrets.choice(chars) for _ in range(6))


@app.route("/api/admin/codes", methods=["GET"])
def api_admin_list_codes():
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    store = load_codes()
    codes = []
    for entry in store["codes"].values():
        codes.append({
            "code": entry.get("code"),
            "created": entry.get("created"),
            "expires": entry.get("expires"),
            "max_uses": entry.get("max_uses"),
            "used": entry.get("used", 0),
            "enabled": entry.get("enabled", True),
            "note": entry.get("note", ""),
            "valid": code_is_valid(entry),
        })
    codes.sort(key=lambda c: c.get("created") or 0)
    return jsonify({"success": True, "codes": codes})


@app.route("/api/admin/codes", methods=["POST"])
def api_admin_create_code():
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    data = request.get_json(silent=True) or {}
    store = load_codes()

    code = str(data.get("code", "")).strip().upper()
    if not code:
        code = generate_code()
    if not re.fullmatch(r"[A-Z0-9\-]{2,24}", code):
        return jsonify({"success": False, "message": "Code must be 2-24 chars (A-Z, 0-9, dash)."}), 400
    if code in store["codes"]:
        return jsonify({"success": False, "message": "That code already exists."}), 409

    max_uses = data.get("max_uses")
    if max_uses is not None:
        try:
            max_uses = int(max_uses)
            if max_uses < 1:
                max_uses = None
        except Exception:
            max_uses = None

    expires = data.get("expires")
    exp_ts = None
    if expires:
        try:
            exp_ts = int(time.time()) + int(expires)
        except Exception:
            exp_ts = None

    store["codes"][code] = {
        "code": code,
        "created": time.time(),
        "expires": exp_ts,
        "max_uses": max_uses,
        "used": 0,
        "enabled": True,
        "note": str(data.get("note", "")).strip(),
    }
    save_codes(store)
    return jsonify({"success": True, "message": f"Access code created: {code}", "code": code})


@app.route("/api/admin/codes/<code>/toggle", methods=["POST"])
def api_admin_toggle_code(code):
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    store = load_codes()
    code = code.upper()
    if code not in store["codes"]:
        return jsonify({"success": False, "message": "Code not found."}), 404
    store["codes"][code]["enabled"] = not store["codes"][code].get("enabled", True)
    save_codes(store)
    state = "enabled" if store["codes"][code]["enabled"] else "disabled"
    return jsonify({"success": True, "message": f"{code} {state}.", "enabled": store["codes"][code]["enabled"]})


@app.route("/api/admin/codes/<code>/reset", methods=["POST"])
def api_admin_reset_code(code):
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    store = load_codes()
    code = code.upper()
    if code not in store["codes"]:
        return jsonify({"success": False, "message": "Code not found."}), 404
    store["codes"][code]["used"] = 0
    save_codes(store)
    return jsonify({"success": True, "message": f"{code} usage counter reset."})


@app.route("/api/admin/codes/<code>", methods=["PATCH"])
def api_admin_update_code(code):
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    store = load_codes()
    code = code.upper()
    if code not in store["codes"]:
        return jsonify({"success": False, "message": "Code not found."}), 404
    data = request.get_json(silent=True) or {}
    entry = store["codes"][code]

    if "enabled" in data:
        entry["enabled"] = bool(data.get("enabled"))
    if "note" in data:
        entry["note"] = str(data.get("note", "")).strip()
    mu = data.get("max_uses")
    if "max_uses" in data:
        try:
            mu = int(mu)
            entry["max_uses"] = mu if mu >= 1 else None
        except Exception:
            entry["max_uses"] = None
    if data.get("clear_expires"):
        entry["expires"] = None
    elif data.get("expires_delta"):
        try:
            entry["expires"] = int(time.time()) + int(data["expires_delta"])
        except Exception:
            pass

    save_codes(store)
    return jsonify({"success": True, "message": f"{code} updated."})


@app.route("/api/admin/codes/<code>", methods=["DELETE"])
def api_admin_delete_code(code):
    if not require_admin():
        return jsonify({"success": False, "message": "Unauthorized."}), 401
    store = load_codes()
    code = code.upper()
    if code not in store["codes"]:
        return jsonify({"success": False, "message": "Code not found."}), 404
    defunc = store["codes"].pop(code)
    save_codes(store)
    if code == "EXE" and not defunc.get("enabled", True):
        pass
    return jsonify({"success": True, "message": f"{code} deleted."})


# ============================================
# API — EMOTE SENDER
# ============================================
@app.route("/api/status", methods=["GET"])
def api_status():
    if not require_user():
        return jsonify({"online": False})
    return jsonify({"online": True, "service": "original-backend"})


@app.route("/api/send", methods=["POST"])
def api_send():
    if not require_user():
        return jsonify({"ok": False, "error": "Unauthorized. Unlock first."}), 401

    data = request.get_json(silent=True) or {}
    team_code = str(data.get("teamCode", "")).strip()
    uids = data.get("uids", []) or []
    emote_id = str(data.get("emoteId", "")).strip()
    server = str(data.get("server", "ind")).strip()

    if not team_code:
        return jsonify({"ok": False, "error": "Team code is required"}), 400
    if not isinstance(uids, list) or len(uids) == 0:
        return jsonify({"ok": False, "error": "At least one UID is required"}), 400
    if not emote_id:
        return jsonify({"ok": False, "error": "Invalid emote id"}), 400

    cfg = SERVER_MAP.get(server.lower())
    if not cfg:
        return jsonify({"ok": False, "error": "Server '%s' is not supported." % server}), 400

    params = {"tc": team_code, "emote_id": emote_id, "server": cfg["key"]}
    for i, uid in enumerate(uids):
        params["uid%d" % (i + 1)] = str(uid)

    attempts = [
        cfg["base"] + "/join",
        PROXY_ORIGIN,
    ]
    hdrs = {"Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    last_error = "Emote service is unreachable right now. Try again in a few seconds."

    for url in attempts:
        try:
            resp = requests.get(url, params=params, headers=hdrs, timeout=25)
            try:
                j = resp.json()
            except Exception:
                j = {}
            if resp.status_code == 200 and j.get("status") == "success":
                fallback = j.get("_note") == "Fallback response"
                return jsonify({
                    "ok": True,
                    "message": (j.get("message") or "Emote sent successfully!") if not fallback else
                               "Emote request accepted. Service is temporary slow — check in game in a few seconds.",
                    "fallback": fallback,
                })
            if j.get("error"):
                last_error = str(j.get("error"))
            else:
                last_error = "Emote service responded with status %d." % resp.status_code
        except Exception as exc:
            last_error = str(exc)

    return jsonify({"ok": False, "error": last_error}), 502


# ============================================
# MAIN
# ============================================
if __name__ == "__main__":
    ensure_default_codes()

    print("")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║      XG THUNDER 2.0 — EXE EMOTE PORTAL                   ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print("║  SITE    http://localhost:8080                           ║")
    print("║  ADMIN   http://localhost:8080/admin                     ║")
    print("║  Unlock  Type EXE and press Enter                        ║")
    print("║  Admin   xgthunder2.0 / 9125@braj                       ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("")
    app.run(host="0.0.0.0", port=8080, debug=True)