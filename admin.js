(function () {
  "use strict";

  var ADMIN_KEY = "xgthunder_admin_token";

  var loginScreen = document.getElementById("admin-login-screen");
  var dashboardEl = document.getElementById("admin-dashboard");
  var usernameEl = document.getElementById("admin-username");
  var passwordEl = document.getElementById("admin-password");
  var toggleBtn = document.getElementById("toggle-password");
  var btnLogin = document.getElementById("btn-admin-login");
  var loginError = document.getElementById("admin-login-error");
  var btnLogout = document.getElementById("btn-admin-logout");
  var btnRefresh = document.getElementById("btn-refresh");
  var btnCreate = document.getElementById("btn-create-code");
  var toastContainer = document.getElementById("toast-container");

  /* ─────────────── password show/hide toggle ─────────────── */
  toggleBtn.addEventListener("click", function () {
    var isHidden = passwordEl.type === "password";
    passwordEl.type = isHidden ? "text" : "password";
    toggleBtn.classList.toggle("revealed", isHidden);
    passwordEl.focus();
  });

  /* ─────────────── token helpers ─────────────── */
  function getToken() {
    try { return window.localStorage.getItem(ADMIN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { window.localStorage.setItem(ADMIN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try { window.localStorage.removeItem(ADMIN_KEY); } catch (e) {}
  }

  function authHeaders(extra) {
    var h = { "Authorization": "Bearer " + getToken() };
    if (extra) Object.assign(h, extra);
    return h;
  }

  /* ─────────────── toast ─────────────── */
  function showToast(message, type) {
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" x2="9" y1="9" y2="15"></line><line x1="9" x2="15" y1="9" y2="15"></line></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>',
    };
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    toast.innerHTML = '<div class="toast-title">' + (icons[type] || icons.info) + "<span>" + (message || "") + "</span></div>";
    toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("hide");
      setTimeout(function () { toast.remove(); }, 350);
    }, 3500);
  }

  /* ─────────────── login / logout ─────────────── */
  function doLogin() {
    var username = usernameEl.value.trim();
    var password = passwordEl.value;

    if (!username || !password) {
      loginError.textContent = "Username aur password dono bharo.";
      loginError.hidden = false;
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "VERIFYING...";

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          setToken(data.token);
          showToast("Admin login successful.", "success");
          showDashboard();
        } else {
          loginError.textContent = (data && data.message) || "Invalid credentials.";
          loginError.hidden = false;
        }
      })
      .catch(function () {
        loginError.textContent = "Server unreachable.";
        loginError.hidden = false;
      })
      .finally(function () {
        btnLogin.disabled = false;
        btnLogin.textContent = "SIGN IN";
      });
  }

  function doLogout() {
    var token = getToken();
    if (token) {
      fetch("/api/logout", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
      }).catch(function () {});
    }
    clearToken();
    showToast("Logged out.", "info");
    showLogin();
  }

  btnLogin.addEventListener("click", doLogin);
  usernameEl.addEventListener("keydown", function (e) { if (e.key === "Enter") passwordEl.focus(); });
  passwordEl.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
  btnLogout.addEventListener("click", doLogout);
  btnRefresh.addEventListener("click", loadCodes);

  /* ─────────────── view switching ─────────────── */
  function showLogin() {
    loginScreen.hidden = false;
    dashboardEl.hidden = true;
    loginError.hidden = true;
    passwordEl.type = "password";
    toggleBtn.classList.remove("revealed");
    passwordEl.value = "";
    usernameEl.value = "";
    usernameEl.focus();
  }
  function showDashboard() {
    loginScreen.hidden = true;
    dashboardEl.hidden = false;
    loadCodes();
  }

  /* ─────────────── session check ─────────────── */
  function checkSession() {
    fetch("/api/admin/codes", { method: "GET", headers: authHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) showDashboard();
        else { clearToken(); showLogin(); }
      })
      .catch(function () {
        clearToken();
        showLogin();
      });
  }
  checkSession();

  /* ─────────────── helpers ─────────────── */
  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }
  function fmtTime(ts) {
    if (!ts) return "Never";
    return new Date(ts * 1000).toLocaleString();
  }

  function statusTag(valid) {
    if (valid === "ok") return '<span class="tag tag-ok">ACTIVE</span>';
    if (valid === "disabled") return '<span class="tag tag-off">DISABLED</span>';
    if (valid === "expired") return '<span class="tag tag-expired">EXPIRED</span>';
    if (valid === "used_up") return '<span class="tag tag-used">USED UP</span>';
    return '<span class="tag tag-off">' + esc(valid) + "</span>";
  }

  /* ─────────────── copy helper ─────────────── */
  function copyText(text, label) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      showToast((label || "Code") + " copied!", "success");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast((label || "Code") + " copied!", "success");
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ─────────────── load codes list ─────────────── */
  function loadCodes() {
    var body = document.getElementById("codes-body");
    var countEl = document.getElementById("code-count");
    body.innerHTML = '<tr><td colspan="6" class="emote-loading">Loading...</td></tr>';

    fetch("/api/admin/codes", { method: "GET", headers: authHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success) {
          clearToken();
          showLogin();
          return;
        }
        var codes = data.codes || [];
        countEl.textContent = codes.length + " codes";
        if (codes.length === 0) {
          body.innerHTML = '<tr><td colspan="6" class="emote-empty">No codes yet — create one above.</td></tr>';
          return;
        }
        var rows = codes.map(function (c) {
          var used = c.used || 0;
          var max = c.max_uses;
          var usedStr = max ? used + " / " + max : String(used) + " / ∞";
          var note = c.note || "—";
          return '<tr>' +
            '<td><span class="code-cell">' + esc(c.code) +
            '<button class="copy-btn" data-copy="' + esc(c.code) + '" title="Copy">⧉</button></span></td>' +
            '<td>' + statusTag(c.valid) + "</td>" +
            '<td class="used-text"><b>' + used + "</b> / " + (max ? esc(max) : "∞") + "</td>" +
            '<td class="exp-cell">' + (c.expires ? fmtTime(c.expires) : "No expiry") + "</td>" +
            '<td class="note-cell">' + esc(note) + "</td>" +
            '<td><div class="action-btns">' +
            '<button class="btn ' + (c.enabled ? 'btn-toggle-off' : 'btn-toggle-on') + '" data-toggle="' + esc(c.code) + '">' +
            (c.enabled ? "Disable" : "Enable") + "</button>" +
            '<button class="btn btn-ghost" data-reset="' + esc(c.code) + '">Reset</button>' +
            '<button class="btn btn-danger" data-del="' + esc(c.code) + '">Delete</button>' +
            "</div></td></tr>";
        });
        body.innerHTML = rows.join("");

        body.querySelectorAll("[data-copy]").forEach(function (b) {
          b.addEventListener("click", function () { copyText(b.getAttribute("data-copy")); });
        });
        body.querySelectorAll("[data-toggle]").forEach(function (b) {
          b.addEventListener("click", function () { toggleCode(b.getAttribute("data-toggle"), b); });
        });
        body.querySelectorAll("[data-reset]").forEach(function (b) {
          b.addEventListener("click", function () { resetCode(b.getAttribute("data-reset")); });
        });
        body.querySelectorAll("[data-del]").forEach(function (b) {
          b.addEventListener("click", function () { deleteCode(b.getAttribute("data-del")); });
        });
      })
      .catch(function () {
        body.innerHTML = '<tr><td colspan="6" class="emote-empty">Failed to load codes.</td></tr>';
      });
  }

  /* ─────────────── create code ─────────────── */
  btnCreate.addEventListener("click", function () {
    var code = document.getElementById("new-code").value.trim().toUpperCase();
    var maxUses = document.getElementById("new-max-uses").value.trim();
    var expires = document.getElementById("new-expires").value.trim();
    var note = document.getElementById("new-note").value.trim();
    var resultBox = document.getElementById("create-result");

    var body = { code: code, note: note };
    if (maxUses) body.max_uses = parseInt(maxUses, 10) || undefined;
    if (expires) body.expires = parseInt(expires, 10) || undefined;

    fetch("/api/admin/codes", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          showToast("Access code created!", "success");
          resultBox.hidden = false;
          resultBox.innerHTML =
            '<span>New code:</span> <code>' + esc(data.code) + "</code>" +
            '<button class="copy-new-btn" type="button">Copy</button>';
          resultBox.querySelector(".copy-new-btn").addEventListener("click", function () {
            copyText(data.code, "Code");
          });
          document.getElementById("new-code").value = "";
          document.getElementById("new-max-uses").value = "";
          document.getElementById("new-expires").value = "";
          document.getElementById("new-note").value = "";
          loadCodes();
        } else {
          showToast((data && data.message) || "Failed to create code", "error");
        }
      })
      .catch(function () {
        showToast("Server unreachable.", "error");
      });
  });

  /* ─────────────── toggle / reset / delete ─────────────── */
  function toggleCode(code, btn) {
    fetch("/api/admin/codes/" + encodeURIComponent(code) + "/toggle", {
      method: "POST",
      headers: authHeaders(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        showToast((data && data.message) || "Updated.", data && data.success ? "success" : "error");
        loadCodes();
      })
      .catch(function () { showToast("Server unreachable.", "error"); });
  }

  function resetCode(code) {
    fetch("/api/admin/codes/" + encodeURIComponent(code) + "/reset", {
      method: "POST",
      headers: authHeaders(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        showToast((data && data.message) || "Reset.", data && data.success ? "success" : "error");
        loadCodes();
      })
      .catch(function () { showToast("Server unreachable.", "error"); });
  }

  function deleteCode(code) {
    if (!window.confirm("Delete access code \"" + code + "\"? Iska use turant band ho jayega.")) return;
    fetch("/api/admin/codes/" + encodeURIComponent(code), {
      method: "DELETE",
      headers: authHeaders(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        showToast((data && data.message) || "Deleted.", data && data.success ? "success" : "error");
        loadCodes();
      })
      .catch(function () { showToast("Server unreachable.", "error"); });
  }

})();