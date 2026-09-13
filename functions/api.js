// XG THUNDER EMOTE — Netlify Function backend
// Replaces server.py for the Netlify environment.
// Access codes are stored in Netlify Blobs; sessions are stateless signed tokens.
const crypto = require("crypto");

// Admin credentials — override via Netlify environment variables for production
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "xgthunder2.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "9125@braj";
const AUTH_SECRET = process.env.AUTH_SECRET || "xgthunder-emote-local-secret-change-me";
const SESSION_TTL_SEC = 60 * 60 * 24; // 24 hours

const EMOTE_ORIGIN = "https://godjexar-bangladesh-emote-bot-api.vercel.app/play_emote";
const BLOB_NAME = "xgthunder-data";
const BLOB_KEY = "access_codes";

// ---------- store (Netlify Blobs with in-memory fallback) ----------
let memory = { codes: {} };
let blobStore = null;

function getBlob() {
  if (blobStore !== null) return blobStore;
  try {
    const { getStore } = require("@netlify/blobs");
    blobStore = getStore({ name: BLOB_NAME });
  } catch (e) {
    blobStore = false;
  }
  return blobStore;
}

async function loadCodes() {
  let data = null;
  const blob = getBlob();
  if (blob) {
    try {
      const raw = await blob.get(BLOB_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
  }
  if (!data || !data.codes) data = memory;
  if (!data.codes) data = { codes: {} };
  if (!data.codes["EXE"]) {
    data.codes["EXE"] = {
      code: "EXE",
      created: Date.now() / 1000,
      expires: null,
      max_uses: null,
      used: 0,
      enabled: true,
      note: "Master code — type EXE and press Enter to unlock.",
    };
  }
  return data;
}

async function saveCodes(data) {
  memory = data;
  const blob = getBlob();
  if (blob) {
    try {
      await blob.setJSON(BLOB_KEY, data);
    } catch (e) {
      // in-memory only this run
    }
  }
}

// ---------- stateless signed tokens ----------
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(parts[0]).digest("base64url");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
  return payload;
}

function requireAdmin(event) {
  const payload = authPayload(event);
  return payload && payload.k === "admin" ? payload : null;
}
function requireUser(event) {
  const payload = authPayload(event);
  return payload && payload.k === "user" ? payload : null;
}
function authPayload(event) {
  const h = headers(event);
  const auth = h["authorization"] || h["Authorization"] || "";
  let token = "";
  if (typeof auth === "string" && auth.startsWith("Bearer ")) token = auth.slice(7).trim();
  if (!token && event.queryStringParameters && event.queryStringParameters.token) {
    token = event.queryStringParameters.token;
  }
  return verifyToken(token);
}

function headers(event) {
  return event.headers || {};
}

// ---------- code validity ----------
function codeIsValid(entry) {
  if (!entry || !entry.enabled) return "disabled";
  if (entry.expires && Date.now() / 1000 > entry.expires) return "expired";
  if (entry.max_uses && (entry.used || 0) >= entry.max_uses) return "used_up";
  return "ok";
}

// ---------- response helpers ----------
function ok(data, status) {
  return { statusCode: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
}

function bodyOf(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// ---------- emote sender (mirrors server.py) ----------
async function sendEmote(event) {
  const user = requireUser(event);
  if (!user) return ok({ ok: false, error: "Unauthorized. Unlock first." }, 401);

  const data = bodyOf(event);
  const teamCode = String(data.teamCode || "").trim();
  const uids = Array.isArray(data.uids) ? data.uids : [];
  const emoteId = String(data.emoteId || "").trim();
  const server = String(data.server || "ind").trim();

  if (!teamCode) return ok({ ok: false, error: "Team code is required" }, 400);
  if (!uids.length) return ok({ ok: false, error: "At least one UID is required" }, 400);
  if (!emoteId) return ok({ ok: false, error: "Invalid emote id" }, 400);

  const params = new URLSearchParams({ region: server, teamcode: teamCode, emote: emoteId });
  uids.forEach((uid, i) => params.set(i === 0 ? "uid" : "uid" + (i + 1), String(uid)));

  let lastError = "Failed to reach emote service.";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(EMOTE_ORIGIN + "?" + params.toString(), { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      if (resp.status === 200) {
        const text = await resp.text();
        try {
          return ok({ ok: true, data: JSON.parse(text), _status: 200 });
        } catch (e) {
          return ok({ ok: true, data: { message: text.slice(0, 200) }, _status: 200 });
        }
      }
      if (resp.status === 429) lastError = "Emote service temporarily busy.";
      else lastError = "Emote service returned " + resp.status + ".";
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return ok({ ok: false, error: lastError, _status: 502 }, 502);
}

// ---------- admin code management ----------
async function listCodes() {
  const store = await loadCodes();
  const codes = Object.values(store.codes).map((e) => ({
    code: e.code,
    created: e.created,
    expires: e.expires,
    max_uses: e.max_uses,
    used: e.used || 0,
    enabled: e.enabled !== false,
    note: e.note || "",
    valid: codeIsValid(e),
  }));
  codes.sort((a, b) => (a.created || 0) - (b.created || 0));
  return ok({ success: true, codes });
}

async function createCode(event) {
  const store = await loadCodes();
  const data = bodyOf(event);
  let code = String(data.code || "").trim().toUpperCase();
  if (!code) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rnd = "";
    for (let i = 0; i < 6; i++) rnd += chars[crypto.randomInt(chars.length)];
    code = "EXE-" + rnd;
  }
  if (!/^[A-Z0-9\-]{2,24}$/.test(code)) return ok({ success: false, message: "Code must be 2-24 chars (A-Z, 0-9, dash)." }, 400);
  if (store.codes[code]) return ok({ success: false, message: "That code already exists." }, 409);

  let maxUses = null;
  if (data.max_uses !== undefined && data.max_uses !== null) {
    const n = parseInt(data.max_uses, 10);
    if (!isNaN(n) && n >= 1) maxUses = n;
  }
  let expires = null;
  if (data.expires) {
    const n = parseInt(data.expires, 10);
    if (!isNaN(n) && n > 0) expires = Math.floor(Date.now() / 1000) + n;
  }

  store.codes[code] = {
    code,
    created: Date.now() / 1000,
    expires,
    max_uses: maxUses,
    used: 0,
    enabled: true,
    note: String(data.note || "").trim(),
  };
  await saveCodes(store);
  return ok({ success: true, message: "Access code created: " + code, code });
}

async function updateCode(event, code) {
  const store = await loadCodes();
  code = code.toUpperCase();
  if (!store.codes[code]) return ok({ success: false, message: "Code not found." }, 404);
  const entry = store.codes[code];
  const data = bodyOf(event);

  if ("enabled" in data) entry.enabled = !!data.enabled;
  if ("note" in data) entry.note = String(data.note || "").trim();
  if ("max_uses" in data) {
    const n = parseInt(data.max_uses, 10);
    entry.max_uses = !isNaN(n) && n >= 1 ? n : null;
  }
  if (data.clear_expires) entry.expires = null;
  else if (data.expires_delta && parseInt(data.expires_delta, 10)) {
    entry.expires = Math.floor(Date.now() / 1000) + parseInt(data.expires_delta, 10);
  }
  await saveCodes(store);
  return ok({ success: true, message: code + " updated." });
}

async function deleteCode(code) {
  const store = await loadCodes();
  code = code.toUpperCase();
  if (!store.codes[code]) return ok({ success: false, message: "Code not found." }, 404);
  delete store.codes[code];
  await saveCodes(store);
  return ok({ success: true, message: code + " deleted." });
}

async function toggleCode(code) {
  const store = await loadCodes();
  code = code.toUpperCase();
  if (!store.codes[code]) return ok({ success: false, message: "Code not found." }, 404);
  const entry = store.codes[code];
  entry.enabled = !(entry.enabled !== false);
  await saveCodes(store);
  const state = entry.enabled ? "enabled" : "disabled";
  return ok({ success: true, message: code + " " + state + ".", enabled: entry.enabled });
}

async function resetCode(code) {
  const store = await loadCodes();
  code = code.toUpperCase();
  if (!store.codes[code]) return ok({ success: false, message: "Code not found." }, 404);
  store.codes[code].used = 0;
  await saveCodes(store);
  return ok({ success: true, message: code + " usage counter reset." });
}

// ---------- user unlock / session ----------
async function unlock(event) {
  const data = bodyOf(event);
  const code = String(data.code || "").trim().toUpperCase();
  if (!code) return ok({ success: false, message: "Access code is empty." }, 400);

  const store = await loadCodes();
  const entry = store.codes[code];
  const status = codeIsValid(entry);
  if (status !== "ok") {
    const msg = {
      disabled: "This access code has been disabled by admin.",
      expired: "This access code has expired.",
      used_up: "This access code has reached its usage limit.",
    }[status] || "Invalid access code.";
    return ok({ success: false, message: msg }, 403);
  }

  entry.used = (entry.used || 0) + 1;
  await saveCodes(store);

  const token = signToken({ k: "user", c: code, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC });
  return ok({ success: true, message: "Unlocked! Welcome to XG THUNDER 2.0.", token, code });
}

function me(event) {
  const user = requireUser(event);
  if (!user) return ok({ success: false, message: "Session invalid." }, 401);
  return ok({ success: true, code: user.c });
}

function logout() {
  return ok({ success: true });
}

async function adminLogin(event) {
  const data = bodyOf(event);
  const username = String(data.username || "").trim();
  const password = String(data.password || "");
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = signToken({ k: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC });
    return ok({ success: true, token, message: "Admin login successful." });
  }
  return ok({ success: false, message: "Invalid admin username or password." }, 401);
}

// ---------- router ----------
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" }, body: "" };
  }

  const segs = (event.path || "").split("/").filter(Boolean); // e.g. ['api','admin','codes']
  if (segs[0] !== "api") return ok({ success: false, message: "Not found." }, 404);
  const r = segs.slice(1);

  try {
    // user endpoints
    if (r.length === 1 && r[0] === "unlock" && event.httpMethod === "POST") return await unlock(event);
    if (r.length === 1 && r[0] === "me" && event.httpMethod === "GET") return me(event);
    if (r.length === 1 && r[0] === "logout" && event.httpMethod === "POST") return logout();
    if (r.length === 1 && r[0] === "status" && event.httpMethod === "GET") {
      return requireUser(event) ? ok({ online: true, service: "netlify-blob-backend" }) : ok({ online: false });
    }
    if (r.length === 1 && r[0] === "send" && event.httpMethod === "POST") return await sendEmote(event);

    // admin login (no token yet — handled before auth gate)
    if (r.length === 2 && r[0] === "admin" && r[1] === "login" && event.httpMethod === "POST") {
      return await adminLogin(event);
    }

    // all remaining admin endpoints require an admin token
    if (!requireAdmin(event)) return ok({ success: false, message: "Unauthorized." }, 401);

    if (r.length === 2 && r[0] === "admin" && r[1] === "codes" && event.httpMethod === "GET") return await listCodes();
    if (r.length === 2 && r[0] === "admin" && r[1] === "codes" && event.httpMethod === "POST") return await createCode(event);
    if (r.length === 3 && r[0] === "admin" && r[1] === "codes") {
      if (event.httpMethod === "PATCH") return await updateCode(event, r[2]);
      if (event.httpMethod === "DELETE") return await deleteCode(r[2]);
    }
    if (r.length === 4 && r[0] === "admin" && r[1] === "codes" && event.httpMethod === "POST") {
      if (r[3] === "toggle") return await toggleCode(r[2]);
      if (r[3] === "reset") return await resetCode(r[2]);
    }
  } catch (e) {
    return ok({ success: false, message: "Server error: " + String(e && e.message ? e.message : e) }, 500);
  }

  return ok({ success: false, message: "Not found." }, 404);
};