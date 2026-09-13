(function () {
  "use strict";

  var TOKEN_KEY = "xgthunder_token";

  var unlockScreen = document.getElementById("unlock-screen");
  var dashboardEl = document.getElementById("dashboard");
  var accessInput = document.getElementById("access-code");
  var btnUnlock = document.getElementById("btn-unlock");
  var loginError = document.getElementById("login-error");
  var btnLogout = document.getElementById("btn-logout");
  var toastContainer = document.getElementById("toast-container");

  /* ---------------- token helpers ---------------- */
  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { window.localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try { window.localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  /* ---------------- toast (sonner-like) ---------------- */
  function showToast(title, desc, type) {
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" x2="9" y1="9" y2="15"></line><line x1="9" x2="15" y1="9" y2="15"></line></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>',
    };
    toast.innerHTML =
      '<div class="toast-title">' + (icons[type] || icons.info) + "<span>" + title + "</span></div>" +
      (desc ? '<div class="toast-desc">' + desc + "</div>" : "");
    toastContainer.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("hide");
      setTimeout(function () { toast.remove(); }, 350);
    }, 3500);
  }

  /* ---------------- view switching ---------------- */
  function showUnlock() {
    unlockScreen.hidden = false;
    dashboardEl.hidden = true;
    accessInput.value = "";
    loginError.hidden = true;
    if (!accessInput.disabled) accessInput.focus();
  }
  function showDashboard() {
    unlockScreen.hidden = true;
    dashboardEl.hidden = false;
    renderEmotes();
  }

  /* ---------------- unlock ---------------- */
  function doUnlock() {
    var code = accessInput.value.trim();
    if (!code) {
      loginError.textContent = "Please enter Access Code";
      loginError.hidden = false;
      accessInput.focus();
      return;
    }
    btnUnlock.disabled = true;
    btnUnlock.innerHTML = '<span class="spinner"></span>Logging in...';

    fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          setToken(data.token);
          showToast("Login Successful", "Welcome to EXE EMOTE Dashboard", "success");
          showDashboard(data.code || code.toUpperCase());
        } else {
          loginError.textContent = (data && data.message) || "Invalid Access Code";
          loginError.hidden = false;
        }
      })
      .catch(function () {
        loginError.textContent = "Server unreachable. Try again.";
        loginError.hidden = false;
      })
      .finally(function () {
        btnUnlock.disabled = false;
        btnUnlock.innerHTML = "LOGIN";
      });
  }

  btnUnlock.addEventListener("click", doUnlock);
  accessInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") doUnlock();
  });

  /* ---------------- logout ---------------- */
  btnLogout.addEventListener("click", function () {
    var token = getToken();
    if (token) {
      fetch("/api/logout", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
      }).catch(function () {});
    }
    clearToken();
    showToast("Logged Out", "You have been successfully logged out", "info");
    showUnlock();
  });

  /* ---------------- session check on load ---------------- */
  fetch("/api/me", {
    method: "GET",
    headers: { "Authorization": "Bearer " + getToken() },
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.success) showDashboard(data.code);
      else { clearToken(); showUnlock(); }
    })
    .catch(function () {
      clearToken();
      showUnlock();
    });

  /* ════════════════════════════════════════════════════
     UID MANAGEMENT (up to 4, add / remove, fade-in)
     ════════════════════════════════════════════════════ */
  var MAX_UIDS = 4;
  var uidValues = [""];
  var uidList = document.getElementById("uid-list");
  var btnAddUid = document.getElementById("btn-add-uid");

  function uidFieldKey(i) {
    return i === 0 ? "uid" : "uid" + (i + 1);
  }

  function renderUidRows() {
    uidList.innerHTML = "";
    uidValues.forEach(function (val, i) {
      var row = document.createElement("div");
      row.className = "uid-row";
      var inner = document.createElement("div");
      inner.className = "flex-1 space-y-2";

      var label = document.createElement("label");
      label.className = "form-label flex items-center gap-2";
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";
      var num = document.createElement("span");
      num.className = "uid-num";
      num.textContent = i + 1;
      label.appendChild(num);
      label.appendChild(document.createTextNode(" UID " + (i + 1)));
      inner.appendChild(label);

      var input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Enter UID " + (i + 1);
      input.value = val;
      input.className = "field-input secondary";
      input.inputMode = "numeric";
      input.maxLength = 10;
      input.setAttribute("autocomplete", "off");
      input.addEventListener("input", function () {
        uidValues[i] = input.value.trim();
      });
      inner.appendChild(input);

      row.appendChild(inner);

      if (uidValues.length > 1) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "btn-remove-uid";
        rm.setAttribute("title", "Remove UID " + (i + 1));
        rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>';
        rm.addEventListener("click", function () {
          uidValues.splice(i, 1);
          updateAddBtn();
          renderUidRows();
        });
        row.appendChild(rm);
      }

      uidList.appendChild(row);
    });
    updateAddBtn();
  }

  function updateAddBtn() {
    btnAddUid.disabled = uidValues.length >= MAX_UIDS;
  }

  btnAddUid.addEventListener("click", function () {
    if (uidValues.length < MAX_UIDS) {
      uidValues.push("");
      renderUidRows();
    }
  });

  /* ════════════════════════════════════════════════════
     EMOTE GRIDS
     ════════════════════════════════════════════════════ */
  function makeEmoteBtn(emote, variant) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emote-btn " + variant;

    var overlay = document.createElement("div");
    overlay.className = "overlay-g";
    btn.appendChild(overlay);

    var img = document.createElement("img");
    img.loading = "lazy";
    img.alt = emote.name;
    img.src = emote.image;
    img.onerror = function () {
      img.style.display = "none";
    };
    btn.appendChild(img);

    var name = document.createElement("span");
    name.textContent = emote.name;
    btn.appendChild(name);

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      sendEmote(emote.id, btn);
    });

    return btn;
  }

  function renderEmotes() {
    var evoGrid = document.getElementById("evo-grid");
    var normalGrid = document.getElementById("normal-grid");
    var rareGrid = document.getElementById("rare-grid");

    evoGrid.innerHTML = "";
    (window.EVO_EMOTES || []).forEach(function (emote) {
      evoGrid.appendChild(makeEmoteBtn(emote, "ep"));
    });

    normalGrid.innerHTML = "";
    (window.NORMAL_EMOTES || []).forEach(function (emote) {
      normalGrid.appendChild(makeEmoteBtn(emote, "es"));
    });

    rareGrid.innerHTML = "";
    (window.RARE_EMOTES || []).forEach(function (emote) {
      rareGrid.appendChild(makeEmoteBtn(emote, "er"));
    });
  }

  /* ════════════════════════════════════════════════════
     SEND EMOTE
     ════════════════════════════════════════════════════ */
  var teamCodeEl = document.getElementById("team-code");
  var emoteIdEl = document.getElementById("emote-id");
  var btnSend = document.getElementById("btn-send");
  var infoTextEl = document.getElementById("info-text");
  var sending = false;

  function validate() {
    var teamCode = teamCodeEl.value.trim();
    if (!teamCode) {
      showToast("Error", "Please enter a team code", "error");
      teamCodeEl.focus();
      return null;
    }
    var anyUid = uidValues.some(function (v) { return v; });
    if (!anyUid) {
      showToast("Error", "Please fill at least one UID field", "error");
      return null;
    }
    return teamCode;
  }

  function setBusy(busy) {
    sending = busy;
    btnSend.disabled = busy;
    var btns = document.querySelectorAll(".emote-btn");
    btns.forEach(function (b) { b.disabled = busy; });
    if (busy) {
      btnSend.innerHTML = '<span class="spinner"></span>Sending...';
    } else {
      btnSend.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; vertical-align: -5px; margin-right: 6px;"><line x1="22" x2="11" y1="2" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>Send';
    }
  }

  function sendEmote(emoteId, sourceBtn) {
    if (sending) return;
    var teamCode = validate();
    if (!teamCode) return;

    var uids = uidValues.slice();
    while (uids.length > 0 && !uids[uids.length - 1]) uids.pop();
    var emoteLabel = emoteId;

    setBusy(true);
    showToast("Processing", "Emote " + emoteId + " → team " + teamCode, "info");
    if (infoTextEl) infoTextEl.textContent = "Sending emote " + emoteId + " to " + uids.length + " UID(s)...";
    if (sourceBtn) {
      sourceBtn.classList.add("sent");
      setTimeout(function () { sourceBtn.classList.remove("sent"); }, 1200);
    }

    fetch("/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken(),
      },
      body: JSON.stringify({
        server: "ind",
        teamCode: teamCode,
        uids: uids,
        emoteId: emoteId,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok) {
          showToast("Success", "Emote processed successfully for all UIDs!", "success");
          if (infoTextEl) infoTextEl.textContent = "Emote " + emoteId + " sent to " + uids.length + " UID(s) ✅";
          emoteIdEl.value = "";
        } else {
          showToast("Error", (data && data.error) || "Failed to send emote", "error");
          if (infoTextEl) infoTextEl.textContent = (data && data.error) || "Emote send failed. Try again.";
        }
      })
      .catch(function () {
        showToast("Error", "Network error. Emote request sent!", "error");
      })
      .finally(function () {
        setBusy(false);
      });
  }

  btnSend.addEventListener("click", function () {
    var id = emoteIdEl.value.trim();
    if (!id) {
      showToast("Error", "Please select or enter an emote ID", "error");
      return;
    }
    sendEmote(id, null);
  });

  emoteIdEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var id = emoteIdEl.value.trim();
      if (id) sendEmote(id, null);
    }
  });

  /* ════════════════════════════════════════════════════
     ADMIN PANEL (in-dashboard, top-right compact)
     ════════════════════════════════════════════════════ */
  var ADMIN_KEY = "xgthunder_admin_token";
  var adminModal = document.getElementById("admin-modal");
  var btnAdminLogin = document.getElementById("btn-admin-login");
  var adminLoginView = document.getElementById("admin-login-view");
  var adminPanelView = document.getElementById("admin-panel-view");
  var adUsername = document.getElementById("ad-username");
  var adPassword = document.getElementById("ad-password");
  var adTogglePw = document.getElementById("ad-toggle-pw");
  var btnAdLogin = document.getElementById("btn-ad-login");
  var adLoginError = document.getElementById("ad-login-error");
  var btnAdRefresh = document.getElementById("btn-ad-refresh");
  var btnAdLogout = document.getElementById("btn-ad-logout");
  var btnAdCreate = document.getElementById("btn-ad-create");
  var editBox = document.getElementById("ad-edit-box");
  var editingCode = null;

  function getAdminToken() {
    try { return window.localStorage.getItem(ADMIN_KEY) || ""; } catch (e) { return ""; }
  }
  function setAdminToken(t) {
    try { window.localStorage.setItem(ADMIN_KEY, t); } catch (e) {}
  }
  function clearAdminToken() {
    try { window.localStorage.removeItem(ADMIN_KEY); } catch (e) {}
  }
  function adminHeaders(extra) {
    var h = { "Authorization": "Bearer " + getAdminToken() };
    if (extra) Object.assign(h, extra);
    return h;
  }
  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function renderAdminChip() {
    var logged = !!getAdminToken();
    btnAdminLogin.className = logged ? "admin-profile-chip" : "admin-mini-login";
    btnAdminLogin.title = logged ? "Open Admin Panel" : "Admin Login";
    if (logged) {
      btnAdminLogin.innerHTML =
        '<img src="assets/xg-logo.jpg" alt="Admin" />' +
        '<span>Admin Login</span>';
    } else {
      btnAdminLogin.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path></svg>';
    }
  }

  function openAdmin() {
    adminModal.hidden = false;
    editBox.hidden = true;
    editingCode = null;
    if (getAdminToken()) {
      adminLoginView.hidden = true;
      adminPanelView.hidden = false;
      loadAdminCodes();
    } else {
      adminLoginView.hidden = false;
      adminPanelView.hidden = true;
      adPassword.type = "password";
      adTogglePw.classList.remove("revealed");
      adUsername.focus();
    }
  }
  function closeAdmin() {
    adminModal.hidden = true;
  }

  btnAdminLogin.addEventListener("click", function () {
    if (adminModal.hidden) openAdmin();
    else closeAdmin();
  });
  document.querySelectorAll("[data-admin-close]").forEach(function (el) {
    el.addEventListener("click", closeAdmin);
  });

  /* admin login */
  adTogglePw.addEventListener("click", function () {
    var hidden = adPassword.type === "password";
    adPassword.type = hidden ? "text" : "password";
    adTogglePw.classList.toggle("revealed", hidden);
    adPassword.focus();
  });

  function doAdminLogin() {
    var user = adUsername.value.trim();
    var pass = adPassword.value;
    if (!user || !pass) {
      adLoginError.textContent = "Username aur password dono bharo.";
      adLoginError.hidden = false;
      return;
    }
    btnAdLogin.disabled = true;
    btnAdLogin.textContent = "VERIFYING...";
    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          setAdminToken(data.token);
          adLoginError.hidden = true;
          renderAdminChip();
          adminLoginView.hidden = true;
          adminPanelView.hidden = false;
          loadAdminCodes();
          showToast("Admin Login Successful", "Welcome, Super Admin.", "success");
        } else {
          adLoginError.textContent = (data && data.message) || "Invalid credentials.";
          adLoginError.hidden = false;
        }
      })
      .catch(function () {
        adLoginError.textContent = "Server unreachable.";
        adLoginError.hidden = false;
      })
      .finally(function () {
        btnAdLogin.disabled = false;
        btnAdLogin.textContent = "SIGN IN";
      });
  }
  btnAdLogin.addEventListener("click", doAdminLogin);
  adPassword.addEventListener("keydown", function (e) { if (e.key === "Enter") doAdminLogin(); });

  function doAdminLogout() {
    var t = getAdminToken();
    if (t) {
      fetch("/api/logout", { method: "POST", headers: { "Authorization": "Bearer " + t } }).catch(function () {});
    }
    clearAdminToken();
    renderAdminChip();
    closeAdmin();
    showToast("Admin Logged Out", "Admin session band ho gaya.", "info");
  }
  btnAdLogout.addEventListener("click", doAdminLogout);
  btnAdRefresh.addEventListener("click", loadAdminCodes);

  /* codes list */
  function fmtCodeTime(ts) {
    if (!ts) return "No expiry";
    return new Date(ts * 1000).toLocaleString();
  }
  function codeStatusTag(valid) {
    if (valid === "ok") return '<span class="tag tag-ok">ACTIVE</span>';
    if (valid === "disabled") return '<span class="tag tag-off">DISABLED</span>';
    if (valid === "expired") return '<span class="tag tag-expired">EXPIRED</span>';
    if (valid === "used_up") return '<span class="tag tag-used">USED UP</span>';
    return '<span class="tag tag-off"></span>';
  }

  function loadAdminCodes() {
    var list = document.getElementById("ad-codes-list");
    var count = document.getElementById("ad-code-count");
    list.innerHTML = '<p class="emote-loading" style="text-align:center;color:hsl(var(--muted-foreground));">Loading...</p>';
    fetch("/api/admin/codes", { method: "GET", headers: adminHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success) {
          clearAdminToken();
          renderAdminChip();
          adminPanelView.hidden = true;
          adminLoginView.hidden = false;
          return;
        }
        var codes = data.codes || [];
        count.textContent = codes.length + " codes";
        if (!codes.length) {
          list.innerHTML = '<p style="text-align:center;color:hsl(var(--muted-foreground));">Abhi koi code nahi — upar se banao.</p>';
          return;
        }
        list.innerHTML = codes.map(function (c) {
          var used = c.used || 0;
          var max = c.max_uses;
          return '<div class="ad-code-row">' +
            '<div class="ad-code-main">' +
            '<div class="code-val">' + esc(c.code) + '</div>' +
            '<div class="code-meta">' + used + " / " + (max ? esc(max) : "∞") + " · " + statusFromValid(c.valid) + '</div>' +
            "</div>" +
            '<div class="ad-code-note">' + esc(c.note || "—") + '</div>' +
            '<div class="ad-code-actions">' +
            '<button class="act-btn" data-copy="' + esc(c.code) + '">Copy</button>' +
            '<button class="act-btn act-edit" data-edit="' + esc(c.code) + '">Edit</button>' +
            '<button class="act-btn act-toggle" data-toggle="' + esc(c.code) + '">' + (c.enabled ? "Disable" : "Enable") + "</button>" +
            '<button class="act-btn act-del" data-del="' + esc(c.code) + '">Delete</button>' +
            "</div></div>";
        }).join("");

        list.querySelectorAll("[data-copy]").forEach(function (b) {
          b.addEventListener("click", function () { adminCopy(b.getAttribute("data-copy")); });
        });
        list.querySelectorAll("[data-toggle]").forEach(function (b) {
          b.addEventListener("click", function () { toggleAdminCode(b.getAttribute("data-toggle")); });
        });
        list.querySelectorAll("[data-edit]").forEach(function (b) {
          b.addEventListener("click", function () { openEdit(b.getAttribute("data-edit")); });
        });
        list.querySelectorAll("[data-del]").forEach(function (b) {
          b.addEventListener("click", function () { deleteAdminCode(b.getAttribute("data-del")); });
        });
      })
      .catch(function () {
        list.innerHTML = '<p style="text-align:center;color:hsl(var(--destructive));">Failed to load codes.</p>';
      });
  }

  function statusFromValid(v) {
    return { ok: "Active", disabled: "Disabled", expired: "Expired", used_up: "Used Up" }[v] || "—";
  }

  function adminCopy(text) {
    function fb() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      showToast("Copied", text, "success");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("Copied", text, "success");
      }).catch(fb);
    } else fb();
  }

  /* create code */
  btnAdCreate.addEventListener("click", function () {
    var body = {
      code: document.getElementById("ad-new-code").value.trim().toUpperCase(),
      note: document.getElementById("ad-new-note").value.trim(),
    };
    var uses = document.getElementById("ad-new-uses").value.trim();
    var exp = document.getElementById("ad-new-exp").value.trim();
    if (uses) body.max_uses = parseInt(uses, 10) || undefined;
    if (exp) body.expires = parseInt(exp, 10) || undefined;
    if (!body.code) delete body.code;

    fetch("/api/admin/codes", {
      method: "POST",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          showToast("Access Code Created", "New code: " + data.code, "success");
          var resBox = document.getElementById("ad-create-result");
          resBox.hidden = false;
          resBox.innerHTML = "<span>New code:</span> <code>" + esc(data.code) + "</code>" +
            '<button class="copy-new-btn" type="button">Copy</button>';
          resBox.querySelector(".copy-new-btn").addEventListener("click", function () { adminCopy(data.code); });
          document.getElementById("ad-new-code").value = "";
          document.getElementById("ad-new-uses").value = "";
          document.getElementById("ad-new-exp").value = "";
          document.getElementById("ad-new-note").value = "";
          loadAdminCodes();
        } else {
          showToast("Error", (data && data.message) || "Failed to create code", "error");
        }
      })
      .catch(function () {
        showToast("Error", "Server unreachable.", "error");
      });
  });

  /* toggle */
  function toggleAdminCode(code) {
    fetch("/api/admin/codes/" + encodeURIComponent(code) + "/toggle", {
      method: "POST",
      headers: adminHeaders(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) showToast("Updated", data.message, "success");
        else showToast("Error", (data && data.message) || "Failed", "error");
        loadAdminCodes();
      })
      .catch(function () { showToast("Error", "Server unreachable.", "error"); });
  }

  /* delete */
  function deleteAdminCode(code) {
    if (!window.confirm('Delete access code "' + code + '"? Isse ab login nahi ho sakega.')) return;
    fetch("/api/admin/codes/" + encodeURIComponent(code), {
      method: "DELETE",
      headers: adminHeaders(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) showToast("Deleted", data.message, "success");
        else showToast("Error", (data && data.message) || "Failed", "error");
        loadAdminCodes();
      })
      .catch(function () { showToast("Error", "Server unreachable.", "error"); });
  }

  /* edit */
  var currentCode = null;
  function openEdit(code) {
    currentCode = code;
    editingCode = code;
    var list = document.getElementById("ad-codes-list");
    var rows = list.querySelectorAll(".ad-code-row");
    rows.forEach(function (row) {
      row.style.display = row.querySelector(".code-val").textContent === code ? "" : "none";
    });
    editBox.hidden = false;
    document.getElementById("ad-edit-title").textContent = "Edit — " + code;
    document.getElementById("ad-edit-uses").value = "";
    document.getElementById("ad-edit-exp").value = "";
    document.getElementById("ad-edit-note").value = "";
    document.getElementById("ad-edit-note").focus();
  }
  function closeEdit() {
    editBox.hidden = true;
    editingCode = null;
    currentCode = null;
    loadAdminCodes();
  }
  function saveEdit() {
    if (!editingCode) return;
    var body = { note: document.getElementById("ad-edit-note").value.trim() };
    var uses = document.getElementById("ad-edit-uses").value.trim();
    var exp = document.getElementById("ad-edit-exp").value.trim();
    if (uses) body.max_uses = parseInt(uses, 10) || null;
    else body.max_uses = null;
    if (exp) body.expires_delta = parseInt(exp, 10) || 0;
    fetch("/api/admin/codes/" + encodeURIComponent(editingCode), {
      method: "PATCH",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) showToast("Updated", data.message, "success");
        else showToast("Error", (data && data.message) || "Failed", "error");
        closeEdit();
      })
      .catch(function () { showToast("Error", "Server unreachable.", "error"); });
  }
  document.getElementById("btn-ad-edit-save").addEventListener("click", saveEdit);
  document.getElementById("btn-ad-edit-cancel").addEventListener("click", closeEdit);

  /* ---------------- init ---------------- */
  renderUidRows();
  renderAdminChip();
})();