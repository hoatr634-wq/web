// ==UserScript==
// @name         Discord Auto Register - EmailCT Manual Verify
// @version      8.3
// @description  Auto grab email + Manual verify + Save All Tokens
// @match        https://discord.com/register*
// @match        https://discord.com/channels/*
// @match        https://discord.com/app*
// @match        https://discord.com/verify*
// @match        https://click.discord.com/*
// @match        http://emailct.com/mailbox*
// @match        https://emailct.com/mailbox*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// ==/UserScript==

(async () => {
  'use strict';

  const DISCORD_SERVER_LINK = "https://discord.gg/GhpB7emrFh";

  let currentEmail = GM_getValue('discord_current_email', '');
  let currentUsername = GM_getValue('discord_current_username', '');
  let currentToken = GM_getValue('discord_current_token', '');

  const notify = (msg, type = 'success') => {
    const n = document.createElement('div');
    n.textContent = msg;
    const colors = {
      success: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      info: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      error: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    n.style.cssText = `position:fixed;top:20px;right:20px;padding:15px 20px;background:${colors[type]};color:white;border-radius:12px;z-index:999999;font-size:14px;box-shadow:0 8px 16px rgba(0,0,0,0.3);animation:slideIn 0.3s ease-out;font-weight:500`;
    if (!document.querySelector('#notif-style')) {
      const s = document.createElement('style');
      s.id = 'notif-style';
      s.textContent = '@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => n.remove(), 300);
    }, 3000);
  };

  // ============================================
  // TOKEN STORAGE FUNCTIONS - NEW
  // ============================================

  const saveTokenToList = (token, email, username) => {
    if (!token) return;
    // Lưu vào danh sách đầy đủ (object) cho popup xem
    let tokenList = GM_getValue('saved_tokens_list', '[]');
    try { tokenList = JSON.parse(tokenList); } catch (e) { tokenList = []; }
    const tokenData = { token, email: email || 'Unknown', username: username || 'Unknown', savedAt: new Date().toISOString(), timestamp: Date.now() };
    const existingIndex = tokenList.findIndex(t => t.token === token);
    if (existingIndex === -1) {
      tokenList.unshift(tokenData);
      GM_setValue('saved_tokens_list', JSON.stringify(tokenList));
      // Đồng thời lưu vào danh sách token-only
      let tokenOnly = GM_getValue('saved_tokens_only', '');
      const lines = tokenOnly ? tokenOnly.split('\n').filter(Boolean) : [];
      if (!lines.includes(token)) {
        lines.unshift(token);
        GM_setValue('saved_tokens_only', lines.join('\n'));
      }
      console.log('Token saved:', token);
      return true;
    }
    return false;
  };

  const getAllSavedTokens = () => {
    let tokenList = GM_getValue('saved_tokens_list', '[]');
    try {
      return JSON.parse(tokenList);
    } catch (e) {
      return [];
    }
  };

  const deleteAllTokens = () => {
    GM_setValue('saved_tokens_list', '[]');
    GM_setValue('saved_tokens_only', '');
    notify("🗑️ Đã xóa tất cả token!", 'success');
  };

  // ── CHECK LIVE TOKEN ──
  const checkTokenLive = async (tk) => {
    tk = tk.trim();
    if (!tk) return 'die';
    const hd = { "Authorization": tk, "Content-Type": "application/json" };
    try {
      // Check phone lock
      const rRel = await fetch("https://discord.com/api/v9/users/@me/relationships", { headers: hd });
      if (rRel.status === 403) {
        try {
          const j = await rRel.json();
          if (j.code === 40002) return 'plock';
        } catch(_) {}
      }
      // Check main
      const r = await fetch("https://discord.com/api/v9/users/@me", { headers: hd });
      if (r.status === 200) {
        const d = await r.json();
        const verified = d.verified;
        const un = d.username + (d.discriminator ? '#' + d.discriminator : '');
        return verified ? 'live' : 'unverified';
      } else if (r.status === 403) {
        try {
          const j = await r.json();
          if (j.code === 40002) return 'plock';
        } catch(_) {}
        return 'die';
      } else {
        return 'die';
      }
    } catch(e) {
      return 'die';
    }
  };

  const runCheckLive = async () => {
    let tokenList = getAllSavedTokens();
    if (tokenList.length === 0) {
      notify('❌ Chưa có token nào!', 'error');
      return;
    }

    notify(`🔍 Đang check ${tokenList.length} token...`, 'info');

    // Hiện progress popup
    let prog = document.querySelector('#check-live-prog');
    if (prog) prog.remove();
    prog = document.createElement('div');
    prog.id = 'check-live-prog';
    prog.style.cssText = 'position:fixed;bottom:20px;right:20px;background:linear-gradient(135deg,#1e293b,#0f172a);color:white;padding:20px 24px;border-radius:16px;z-index:1000003;box-shadow:0 10px 40px rgba(0,0,0,0.7);min-width:280px;border:2px solid rgba(74,222,128,0.3);font-size:13px';
    prog.innerHTML = `
      <div style="font-weight:bold;margin-bottom:10px;color:#4ade80">🔍 Đang Check Live...</div>
      <div id="prog-status" style="opacity:0.8;margin-bottom:8px">0 / ${tokenList.length}</div>
      <div style="background:rgba(255,255,255,0.1);border-radius:6px;height:6px;overflow:hidden">
        <div id="prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4ade80,#22c55e);transition:width 0.3s ease;border-radius:6px"></div>
      </div>
      <div id="prog-result" style="margin-top:10px;font-size:12px;opacity:0.7"></div>
    `;
    document.body.appendChild(prog);

    const statusEl = prog.querySelector('#prog-status');
    const barEl    = prog.querySelector('#prog-bar');
    const resultEl = prog.querySelector('#prog-result');

    let live = [], dead = [], plock = [], unverified = [];

    for (let i = 0; i < tokenList.length; i++) {
      const item = tokenList[i];
      statusEl.textContent = `${i + 1} / ${tokenList.length}`;
      barEl.style.width = ((i + 1) / tokenList.length * 100) + '%';
      resultEl.textContent = `✅ Live: ${live.length}  ❌ Die: ${dead.length}  🔒 Plock: ${plock.length}`;

      const status = await checkTokenLive(item.token);
      if (status === 'live' || status === 'unverified') {
        live.push(item);
        if (status === 'unverified') unverified.push(item.token);
      } else if (status === 'plock') {
        plock.push(item);
        live.push(item); // giữ lại plock
      } else {
        dead.push(item);
      }

      // Delay nhỏ tránh rate limit
      await new Promise(r => setTimeout(r, 400));
    }

    // Cập nhật danh sách – xóa token die
    GM_setValue('saved_tokens_list', JSON.stringify(live));
    // Cập nhật token-only
    const liveOnly = live.map(t => t.token).join('\n');
    GM_setValue('saved_tokens_only', liveOnly);

    prog.remove();

    notify(`✅ Xong! Live: ${live.length} | Die đã xóa: ${dead.length} | Plock: ${plock.length}`, 'success');

    // Refresh panel
    setTimeout(() => showInfo(), 500);
  };

  const showAllTokensPopup = () => {
    const tokenList = getAllSavedTokens();

    if (tokenList.length === 0) {
      notify("❌ Chưa có token nào được lưu!", 'error');
      return;
    }

    let popup = document.querySelector('#all-tokens-popup');
    if (popup) popup.remove();

    popup = document.createElement('div');
    popup.id = 'all-tokens-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);color:white;padding:30px;border-radius:20px;z-index:1000001;box-shadow:0 20px 60px rgba(0,0,0,0.7);min-width:600px;max-width:90vw;max-height:80vh;backdrop-filter:blur(10px);border:2px solid rgba(255,255,255,0.1);overflow:hidden;display:flex;flex-direction:column';

    // Tạo nội dung danh sách token
    let tokenListHTML = '';
    tokenList.forEach((item, index) => {
      const date = new Date(item.savedAt);
      const dateStr = date.toLocaleString('vi-VN');
      tokenListHTML += `
        <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.1)">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
            <div style="font-size:14px;font-weight:bold;color:#4ade80">#${index + 1}</div>
            <div style="font-size:11px;opacity:0.7">${dateStr}</div>
          </div>
          <div style="margin-bottom:8px">
            <div style="font-size:11px;opacity:0.7;margin-bottom:4px">EMAIL:</div>
            <div style="font-size:12px;color:#60a5fa;word-break:break-all">${item.email}</div>
          </div>
          <div style="margin-bottom:8px">
            <div style="font-size:11px;opacity:0.7;margin-bottom:4px">USERNAME:</div>
            <div style="font-size:12px;color:#fbbf24">${item.username}</div>
          </div>
          <div>
            <div style="font-size:11px;opacity:0.7;margin-bottom:4px">TOKEN:</div>
            <div style="font-size:11px;color:#4ade80;word-break:break-all;font-family:monospace;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px">${item.token}</div>
          </div>
        </div>
      `;
    });

    popup.innerHTML = `
      <div style="font-weight:bold;font-size:18px;margin-bottom:20px;text-align:center;letter-spacing:1px">
        📋 TẤT CẢ TOKEN ĐÃ LƯU (${tokenList.length})
      </div>

      <div style="flex:1;overflow-y:auto;margin-bottom:20px;padding-right:10px">
        ${tokenListHTML}
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="copy-all-tokens-btn" style="flex:1;min-width:120px;padding:14px;background:linear-gradient(135deg, #4ade80 0%, #22c55e 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(74,222,128,0.4)">
          📋 Copy All
        </button>
        <button id="save-file-tokens-btn" style="flex:1;min-width:120px;padding:14px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(245,158,11,0.4)">
          💾 Lưu File
        </button>
        <button id="delete-all-tokens-btn" style="flex:1;min-width:120px;padding:14px;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(239,68,68,0.4)">
          🗑️ Xóa All
        </button>
        <button id="close-all-tokens-btn" style="flex:1;min-width:120px;padding:14px;background:linear-gradient(135deg, #64748b 0%, #475569 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(100,116,139,0.4)">
          ❌ Đóng
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    // Copy All button
    const copyAllBtn = popup.querySelector('#copy-all-tokens-btn');
    copyAllBtn.addEventListener('click', async () => {
      let allTokensText = `=== DANH SÁCH ${tokenList.length} TOKEN ===\n\n`;
      tokenList.forEach((item, index) => {
        allTokensText += `#${index + 1}\n`;
        allTokensText += `Email: ${item.email}\n`;
        allTokensText += `Username: ${item.username}\n`;
        allTokensText += `Token: ${item.token}\n`;
        allTokensText += `Saved: ${new Date(item.savedAt).toLocaleString('vi-VN')}\n`;
        allTokensText += `\n${'='.repeat(80)}\n\n`;
      });

      const success = await copyToClipboard(allTokensText);
      if (success) {
        notify(`✅ Đã copy ${tokenList.length} token!`, 'success');
        copyAllBtn.textContent = '✓ Đã Copy!';
        setTimeout(() => {
          copyAllBtn.innerHTML = '📋 Copy All';
        }, 2000);
      } else {
        notify("⚠️ Không thể copy tự động!", 'error');
      }
    });

    // Save File button – hỏi tên file rồi tải xuống chỉ token thuần
    const saveFileBtn = popup.querySelector('#save-file-tokens-btn');
    saveFileBtn.addEventListener('click', () => {
      // Hiện modal hỏi tên file
      let nameModal = document.querySelector('#save-name-modal');
      if (nameModal) nameModal.remove();
      nameModal = document.createElement('div');
      nameModal.id = 'save-name-modal';
      nameModal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#1e3a5f,#0f172a);color:white;padding:28px;border-radius:18px;z-index:1000002;box-shadow:0 20px 60px rgba(0,0,0,0.8);min-width:340px;border:2px solid rgba(245,158,11,0.4);backdrop-filter:blur(12px)';
      nameModal.innerHTML = `
        <div style="font-weight:bold;font-size:16px;margin-bottom:6px;color:#f59e0b">💾 Lưu Token ra File</div>
        <div style="font-size:12px;opacity:0.7;margin-bottom:16px">Chỉ lưu <b>token</b> thuần, mỗi dòng 1 token</div>
        <input id="save-filename-input" type="text" placeholder="Nhập tên file (vd: tokens)" value="tokens"
          style="width:100%;padding:12px 14px;border-radius:10px;border:2px solid rgba(245,158,11,0.5);background:rgba(0,0,0,0.4);color:white;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:6px">
        <div style="font-size:11px;opacity:0.5;margin-bottom:16px">Tên file sẽ là: <span id="filename-preview" style="color:#f59e0b">tokens.txt</span></div>
        <div style="display:flex;gap:10px">
          <button id="confirm-save-btn" style="flex:1;padding:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px">
            ✅ Tải Xuống
          </button>
          <button id="cancel-save-btn" style="flex:1;padding:12px;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px">
            ❌ Hủy
          </button>
        </div>
      `;
      document.body.appendChild(nameModal);

      // Cập nhật preview tên file
      const fnInput = nameModal.querySelector('#save-filename-input');
      const fnPreview = nameModal.querySelector('#filename-preview');
      fnInput.addEventListener('input', () => {
        const name = fnInput.value.trim() || 'tokens';
        fnPreview.textContent = name + '.txt';
      });
      fnInput.focus();
      fnInput.select();

      // Xử lý tải xuống
      const confirmBtn = nameModal.querySelector('#confirm-save-btn');
      confirmBtn.addEventListener('click', () => {
        const fileName = (fnInput.value.trim() || 'tokens') + '.txt';
        // Chỉ lấy token thuần – mỗi dòng 1 token
        const tokenOnly = GM_getValue('saved_tokens_only', '');
        let tokenLines;
        if (tokenOnly) {
          tokenLines = tokenOnly.split('\n').filter(Boolean);
        } else {
          // Fallback: lấy từ danh sách object nếu chưa có token-only
          tokenLines = tokenList.map(t => t.token);
        }
        const content = tokenLines.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        nameModal.remove();
        notify(`✅ Đã lưu ${tokenLines.length} token vào "${fileName}"!`, 'success');
      });

      // Hủy
      nameModal.querySelector('#cancel-save-btn').addEventListener('click', () => nameModal.remove());

      // Enter để xác nhận
      fnInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmBtn.click(); });
    });

    // Delete All button
    const deleteAllBtn = popup.querySelector('#delete-all-tokens-btn');
    deleteAllBtn.addEventListener('click', () => {
      if (confirm(`Bạn có chắc muốn xóa tất cả ${tokenList.length} token?`)) {
        deleteAllTokens();
        GM_setValue('saved_tokens_only', '');
        popup.remove();
      }
    });

    // Close button
    const closeBtn = popup.querySelector('#close-all-tokens-btn');
    closeBtn.addEventListener('click', () => {
      popup.remove();
    });
  };

  // ============================================
// JOIN SERVER - TỰ ĐỘNG CLICK & ĐIỀN LINK
// ============================================

const joinServer = async () => {
  notify("🔗 Đang tìm nút 'Tham gia máy chủ'...", 'info');

  // Bước 1: Tìm và click nút "Tham gia máy chủ" hoặc "Bạn đã nhận được lời mời rồi? Tham gia máy chủ"
  const findJoinButton = () => {
    const allButtons = document.querySelectorAll('button, a, div[role="button"]');
    for (const btn of allButtons) {
      const text = btn.textContent.trim();
      if (text.includes('Tham gia máy chủ') || text.includes('tham gia máy chủ')) {
        return btn;
      }
    }

    // Tìm theo text content trong các element
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length === 0) { // Chỉ lấy text node
        const text = el.textContent.trim();
        if (text.includes('Tham gia máy chủ') || text.includes('tham gia máy chủ')) {
          // Tìm element cha có thể click
          let parent = el.parentElement;
          while (parent) {
            if (parent.tagName === 'BUTTON' || parent.tagName === 'A' || parent.getAttribute('role') === 'button') {
              return parent;
            }
            parent = parent.parentElement;
          }
          return el;
        }
      }
    }
    return null;
  };

  const joinBtn = findJoinButton();
  if (!joinBtn) {
    notify("❌ Không tìm thấy nút 'Tham gia máy chủ'!", 'error');
    return;
  }

  // Click nút "Tham gia máy chủ"
  joinBtn.click();
  notify("✅ Đã click 'Tham gia máy chủ', đợi popup...", 'info');

  // Bước 2: Đợi popup hiện ra và tìm input "Liên kết mời"
  await new Promise(resolve => setTimeout(resolve, 1000));

  const findInviteInput = () => {
    // Tìm input có placeholder hoặc aria-label liên quan đến "liên kết", "invite", "link"
    const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (const input of inputs) {
      const placeholder = (input.placeholder || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const value = (input.value || '').toLowerCase();

      if (placeholder.includes('liên kết') ||
          placeholder.includes('invite') ||
          placeholder.includes('link') ||
          ariaLabel.includes('liên kết') ||
          ariaLabel.includes('invite') ||
          value.includes('discord.gg')) {
        return input;
      }
    }

    // Nếu không tìm thấy, lấy input đầu tiên trong popup
    const modal = document.querySelector('[role="dialog"], [class*="modal"]');
    if (modal) {
      const input = modal.querySelector('input[type="text"], input:not([type])');
      if (input) return input;
    }

    return null;
  };

  const inviteInput = findInviteInput();
  if (!inviteInput) {
    notify("❌ Không tìm thấy ô nhập 'Liên kết mời'!", 'error');
    return;
  }

  // Bước 3: Điền link vào input
  setVal(inviteInput, DISCORD_SERVER_LINK);
  notify("✅ Đã điền link server!", 'success');

  // Bước 4: Tìm và click nút "Tham gia"
  await new Promise(resolve => setTimeout(resolve, 500));

  const findSubmitButton = () => {
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'tham gia' || text === 'join' || text.includes('tham gia')) {
        // Kiểm tra nút không bị disabled
        if (!btn.disabled && !btn.hasAttribute('disabled')) {
          return btn;
        }
      }
    }
    return null;
  };

  const submitBtn = findSubmitButton();
  if (!submitBtn) {
    notify("⚠️ Không tìm thấy nút 'Tham gia', vui lòng click tay!", 'error');
    return;
  }

  submitBtn.click();
  notify("🎉 Đã click 'Tham gia'! Xong!", 'success');
};

  // ============================================
  // EMAILCT.COM - AUTO GRAB EMAIL & SHOW BOX
  // ============================================

  if (window.location.href.includes('emailct.com/mailbox')) {
    console.log('EmailCT: Page loaded');
    notify("📧 EmailCT - Đang tự động lấy email...", 'info');

    // Check if we should close this tab (after verify)
    const shouldClose = GM_getValue('close_emailct_tabs', 'false');
    console.log('EmailCT: shouldClose =', shouldClose);

    if (shouldClose === 'true') {
      console.log('EmailCT: Closing tab after verify');
      notify("✅ Verify thành công! Đang quay Discord...", 'success');
      GM_setValue('close_emailct_tabs', 'false');
      setTimeout(() => {
        console.log('EmailCT: Redirecting to Discord channels');
        window.location.href = 'https://discord.com/channels/@me';
      }, 1500);
      return;
    }

    // Monitor for close signal
    setInterval(() => {
      const shouldClose = GM_getValue('close_emailct_tabs', 'false');
      if (shouldClose === 'true') {
        console.log('EmailCT: Received close signal');
        notify("✅ Verify thành công! Đang quay Discord...", 'success');
        GM_setValue('close_emailct_tabs', 'false');
        setTimeout(() => {
          console.log('EmailCT: Redirecting to Discord channels');
          window.location.href = 'https://discord.com/channels/@me';
        }, 1500);
      }
    }, 1000);

    // Auto grab email from page
    const grabEmail = () => {
      // Tìm email trong page
      const allElements = document.querySelectorAll('*');
      let foundEmail = null;

      for (const el of allElements) {
        const text = el.textContent || '';
        // Tìm text có format email
        const emailMatch = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/);
        if (emailMatch && emailMatch[0]) {
          foundEmail = emailMatch[0].trim();
          break;
        }
      }

      if (foundEmail) {
        GM_setValue('discord_current_email', foundEmail);
        currentEmail = foundEmail;
        notify(`✅ Đã lưu email: ${foundEmail}`, 'success');
        console.log('EmailCT: Auto grabbed email:', foundEmail);
        showEmailBox(foundEmail);
      } else {
        notify("⚠️ Chưa tìm thấy email, đợi 2s...", 'info');
        setTimeout(grabEmail, 2000);
      }
    };

    // Hiển thị email box lớn để dễ copy
    const showEmailBox = (email) => {
      let box = document.querySelector('#emailct-info');
      if (box) box.remove();

      box = document.createElement('div');
      box.id = 'emailct-info';
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:30px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-radius:16px;z-index:999999;font-size:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);min-width:400px;max-width:90vw;backdrop-filter:blur(10px);border:2px solid rgba(255,255,255,0.1)';

      box.innerHTML = `
        <div style="font-weight:bold;margin-bottom:20px;font-size:18px;text-align:center;letter-spacing:1px">📧 EMAIL MỚI</div>
        <div style="background:rgba(255,255,255,0.15);padding:20px;border-radius:12px;margin-bottom:20px;border:2px solid rgba(255,255,255,0.3);cursor:text;user-select:all" onclick="this.select()">
          <div style="font-size:16px;word-break:break-all;text-align:center;font-weight:500;font-family:monospace;letter-spacing:0.5px">${email}</div>
        </div>
        <div style="text-align:center;font-size:12px;opacity:0.9;margin-bottom:15px">
          👆 Click vào email để bôi đen, sau đó Ctrl+C để copy
        </div>
        <div style="text-align:center;font-size:11px;opacity:0.8;margin-bottom:15px;color:#fbbf24">
          ⚡ Copy xong sẽ tự động đóng tab này và quay lại Discord
        </div>
        <button id="close-box-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(239,68,68,0.4)">
          Đóng
        </button>
      `;

      document.body.appendChild(box);

      // Close button
      const closeBtn = box.querySelector('#close-box-btn');
      closeBtn.addEventListener('click', () => {
        box.remove();
      });

      // Auto select text when clicking email
      const emailDisplay = box.querySelector('[onclick]');
      emailDisplay.addEventListener('click', () => {
        const range = document.createRange();
        range.selectNodeContents(emailDisplay);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        notify("✅ Đã bôi đen! Bấm Ctrl+C để copy.", 'info');
      });

      // Listen for copy event
      let copyDetected = false;
      document.addEventListener('copy', () => {
        if (!copyDetected) {
          copyDetected = true;
          console.log('EmailCT: Copy event detected!');
          notify("✅ Đã copy email! Đang quay lại Discord...", 'success');

          // Always redirect to Discord after copying
          setTimeout(() => {
            console.log('EmailCT: Redirecting to Discord...');
            window.location.href = 'https://discord.com/register';
          }, 1500);
        }
      });
    };

    // Auto grab sau 1.5s để page load xong
    setTimeout(grabEmail, 1500);

    // Hiển thị email cũ nếu có
    const savedEmail = GM_getValue('discord_current_email', '');
    if (savedEmail) {
      setTimeout(() => showEmailBox(savedEmail), 500);
    }

    return;
  }

  // ============================================
  // DISCORD HANDLERS
  // ============================================

  const getVerifyStatus = () => {
    const url = window.location.href;
    if (url.includes('/channels/') || url.includes('/app')) {
      return { text: "Đã verify ✅", color: "#4ade80" };
    } else if (url.includes('/verify')) {
      return { text: "Đang verify...", color: "#60a5fa" };
    } else if (url.includes('/register')) {
      return { text: "Chưa verify ⚠️", color: "#fbbf24" };
    }
    return { text: "Chưa verify", color: "#fbbf24" };
  };

  const showInfo = () => {
    let box = document.querySelector('#discord-info-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'discord-info-box';
      box.style.cssText = 'position:fixed;top:20px;left:20px;padding:20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-radius:16px;z-index:999999;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.4);min-width:280px;max-width:380px;backdrop-filter:blur(10px);transition:all 0.3s ease';
      document.body.appendChild(box);
    }

    // Update current values from storage
    currentEmail = GM_getValue('discord_current_email', '');
    currentUsername = GM_getValue('discord_current_username', '');
    currentToken = GM_getValue('discord_current_token', '');

    // Check if box is hidden
    const isHidden = GM_getValue('info_box_hidden', 'false');

    if (isHidden === 'true') {
      // Show only toggle button
      box.style.cssText = 'position:fixed;top:20px;left:20px;z-index:999999;transition:all 0.3s ease';
      box.innerHTML = `
        <button id="toggle-info-btn" style="padding:12px 15px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,0.3);transition:all 0.3s ease">
          👁️ Hiện
        </button>
      `;

      const toggleBtn = box.querySelector('#toggle-info-btn');
      toggleBtn.addEventListener('click', () => {
        GM_setValue('info_box_hidden', 'false');
        showInfo();
      });

      return;
    }

    const verifyStatus = getVerifyStatus();

    // Đếm số token đã lưu
    const savedTokensCount = getAllSavedTokens().length;

    box.style.cssText = 'position:fixed;top:20px;left:20px;padding:20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-radius:16px;z-index:999999;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,0.4);min-width:280px;max-width:380px;backdrop-filter:blur(10px);transition:all 0.3s ease';

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-weight:bold;font-size:15px;letter-spacing:0.5px">
          🤖 DISCORD AUTO REG
        </div>
        <button id="hide-info-btn" style="padding:6px 10px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:11px;transition:all 0.3s ease" title="Ẩn bảng">
          👁️ Ẩn
        </button>
      </div>
      <div style="background:rgba(255,255,255,0.1);padding:12px;border-radius:10px;margin-bottom:10px">
        <div style="margin-bottom:8px">
          <span style="opacity:0.8;font-size:11px">EMAIL:</span><br>
          <span style="font-size:12px;word-break:break-all;font-weight:500;color:${currentEmail ? '#4ade80' : '#fbbf24'}">${currentEmail || 'Chưa có'}</span>
        </div>
        <div style="margin-bottom:8px">
          <span style="opacity:0.8;font-size:11px">USERNAME:</span><br>
          <span style="font-size:12px;font-weight:500;color:${currentUsername ? '#4ade80' : '#fbbf24'}">${currentUsername || 'Chưa tạo'}</span>
        </div>
        <div style="margin-bottom:8px">
          <span style="opacity:0.8;font-size:11px">TRẠNG THÁI:</span><br>
          <span style="font-size:12px;font-weight:500;color:${verifyStatus.color}">${verifyStatus.text}</span>
        </div>
        <div>
          <span style="opacity:0.8;font-size:11px">TOKEN:</span><br>
          <span style="font-size:12px;font-weight:500;color:${currentToken ? '#4ade80' : '#fbbf24'}">${currentToken ? 'Đã có ✅' : 'Chưa có'}</span>
        </div>
      </div>

      <button id="get-email-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(240,147,251,0.4);margin-bottom:10px">
        Lấy Email Mới
      </button>

      <button id="reset-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(251,191,36,0.4);margin-bottom:10px">
        Restart & Tạo Acc Mới
      </button>

      <button id="check-verify-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #ec4899 0%, #db2777 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(236,72,153,0.4);margin-bottom:10px">
        Check Email Verify
      </button>

      <button id="join-server-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(102,126,234,0.4);margin-bottom:10px">
        Join Server
      </button>

      <button id="show-token-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(132,250,176,0.4);margin-bottom:10px">
        Xem Token
      </button>

      <button id="show-all-tokens-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(167,139,250,0.4);position:relative;margin-bottom:10px">
        📋 Xem All Token (${savedTokensCount})
      </button>

      <button id="check-live-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(16,185,129,0.4)">
        🔍 Check Live Token (${savedTokensCount})
      </button>
    `;

    // Hide button handler
    const hideBtn = box.querySelector('#hide-info-btn');
    hideBtn.addEventListener('click', () => {
      GM_setValue('info_box_hidden', 'true');
      showInfo();
    });

    const getEmailBtn = box.querySelector('#get-email-btn');
    getEmailBtn.addEventListener('click', () => {
      notify("📧 Mở EmailCT - Email sẽ hiện popup to để copy!", 'info');
      window.open('http://emailct.com/mailbox', '_blank');
    });

    // RESET BUTTON - GIỐNG Y CHANG CODE MẪU
    const resetBtn = box.querySelector('#reset-btn');
    resetBtn.addEventListener('click', async () => {
      if (!currentEmail) {
        notify("❌ Chưa có email! Click 'Lấy Email Mới' trước.", 'error');
        return;
      }

      notify("🔄 Đang reset...", 'info');

      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach(c => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      if (window.indexedDB) {
        const dbs = await window.indexedDB.databases();
        dbs.forEach(db => db.name && window.indexedDB.deleteDatabase(db.name));
      }

      GM_deleteValue('discord_current_username');
      GM_deleteValue('discord_current_token');

      notify("✅ Đã reset! Đang reload...", 'success');

      setTimeout(() => {
        window.location.replace('https://discord.com/register');
      }, 1500);
    });

    const checkVerifyBtn = box.querySelector('#check-verify-btn');
    checkVerifyBtn.addEventListener('click', () => {
      if (!currentEmail) {
        notify("❌ Chưa có email!", 'error');
        return;
      }

      notify("📬 Mở EmailCT - Tự verify tay nhé!", 'info');
      window.open('http://emailct.com/mailbox', '_blank');
    });

    const joinBtn = box.querySelector('#join-server-btn');
    joinBtn.addEventListener('click', joinServer);

    const tokenBtn = box.querySelector('#show-token-btn');
    tokenBtn.addEventListener('click', showTokenPopup);

    // NEW: Show All Tokens button
    const allTokensBtn = box.querySelector('#show-all-tokens-btn');
    allTokensBtn.addEventListener('click', showAllTokensPopup);


    // Nút Check Live
    const checkLiveBtn = box.querySelector('#check-live-btn');
    checkLiveBtn.addEventListener('click', () => {
      if (confirm(`Check live ${getAllSavedTokens().length} token? Token die sẽ bị xóa khỏi danh sách.`)) {
        runCheckLive();
      }
    });
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}

    try {
      if (typeof GM_setClipboard !== 'undefined') {
        GM_setClipboard(text);
        return true;
      }
    } catch (e) {}

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (e) {
      return false;
    }
  };

  const showTokenPopup = () => {
    // LẤY TOKEN NHƯNG KHÔNG LÀM GÌ VỚI LOCALSTORAGE
    const token = localStorage.getItem('token')?.replace(/"/g, '') || currentToken;

    if (!token) {
      notify("❌ Chưa có token!", 'error');
      return;
    }

    let popup = document.querySelector('#token-popup');
    if (popup) popup.remove();

    popup = document.createElement('div');
    popup.id = 'token-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);color:white;padding:30px;border-radius:20px;z-index:1000000;box-shadow:0 20px 60px rgba(0,0,0,0.5);min-width:400px;max-width:90vw;backdrop-filter:blur(10px);border:2px solid rgba(255,255,255,0.1)';

    popup.innerHTML = `
      <div style="font-weight:bold;font-size:18px;margin-bottom:20px;text-align:center;letter-spacing:1px">🎫 TOKEN USER</div>
      <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:12px;margin-bottom:15px;border:1px solid rgba(255,255,255,0.1)">
        <div style="font-size:11px;opacity:0.7;margin-bottom:8px">EMAIL:</div>
        <div style="font-size:13px;word-break:break-all;margin-bottom:15px;color:#60a5fa">${currentEmail}</div>
        <div style="font-size:11px;opacity:0.7;margin-bottom:8px">TOKEN:</div>
        <textarea id="token-text" readonly style="width:100%;min-height:120px;background:rgba(0,0,0,0.3);color:#4ade80;border:1px solid rgba(74,222,128,0.3);border-radius:8px;padding:12px;font-size:12px;font-family:monospace;resize:vertical;line-height:1.5">${token}</textarea>
      </div>
      <div style="display:flex;gap:10px">
        <button id="copy-token-btn" style="flex:1;padding:12px;background:linear-gradient(135deg, #4ade80 0%, #22c55e 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(74,222,128,0.4)">Copy Token</button>
        <button id="close-popup-btn" style="flex:1;padding:12px;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:bold;font-size:13px;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(239,68,68,0.4)">Đóng</button>
      </div>
    `;

    document.body.appendChild(popup);

    const copyBtn = popup.querySelector('#copy-token-btn');
    copyBtn.addEventListener('click', async () => {
      const success = await copyToClipboard(token);
      if (success) {
        // CHỈ LƯU VÀO DANH SÁCH, KHÔNG ĐỤNG localStorage
        const saved = saveTokenToList(token, currentEmail, currentUsername);
        if (saved) {
          notify("✅ Đã copy & lưu token vào danh sách!", 'success');
        } else {
          notify("✅ Đã copy token!", 'success');
        }
        copyBtn.textContent = "✓ OK!";

        // Cập nhật số lượng token
        setTimeout(() => showInfo(), 500);
      } else {
        notify("⚠️ Copy thủ công!", 'error');
        const textarea = popup.querySelector('#token-text');
        textarea.focus();
        textarea.select();
      }
    });

    const closeBtn = popup.querySelector('#close-popup-btn');
    closeBtn.addEventListener('click', () => popup.remove());

    // LƯU TOKEN VÀO GM_STORAGE THÔI
    if (token && !currentToken) {
      currentToken = token;
      GM_setValue('discord_current_token', token);
    }
  };

  const setVal = (el, val) => {
    const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set;
    const proto = Object.getPrototypeOf(el);
    const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    (setter && setter !== protoSetter ? protoSetter : setter).call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const captureToken = () => {
    // CHỈ ĐỌC TOKEN RA, KHÔNG SỬA GÌ CẢ
    const token = localStorage.getItem('token');
    if (token) {
      const cleanToken = token.replace(/"/g, '');
      if (!currentToken || currentToken !== cleanToken) {
        currentToken = cleanToken;
        GM_setValue('discord_current_token', cleanToken);
        notify("✅ Đã phát hiện token!", 'success');
        showInfo();
      }
      return cleanToken;
    }
    return null;
  };

  const clickDropdown = async (sel, text) => {
    const dd = document.querySelector(sel);
    if (!dd) return false;
    dd.click();
    await new Promise(r => setTimeout(r, 500));
    const opts = Array.from(document.querySelectorAll('div[role="option"]'));
    const opt = opts.find(o => o.textContent.trim().toLowerCase() === text.toLowerCase());
    if (opt) {
      opt.click();
      return true;
    }
    return false;
  };

  const randomDOB = () => {
    const year = Math.floor(Math.random() * 18) + 1989;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return { year, month, day };
  };

  const fillDOB = async () => {
    const dob = randomDOB();
    await clickDropdown('div[aria-label="Ngày"]', dob.day.toString());
    await clickDropdown('div[aria-label="Tháng"]', "tháng " + dob.month);
    await clickDropdown('div[aria-label="Năm"]', dob.year.toString());
  };

  const fillForm = async () => {
    if (!currentEmail) {
      notify("❌ Chưa có email! Click 'Lấy Email Mới' trước.", 'error');
      return;
    }

    notify("⏳ Đang điền form...", 'info');

    const username = "nguyen" + Math.random().toString(36).slice(2, 7);
    currentUsername = username;
    GM_setValue('discord_current_username', username);

    const password = "phamnguyen2503";
    const displayName = "NTN";

    const emailInput = document.querySelector('input[type="email"][aria-label="Email"],input[name="email"]');
    if (!emailInput) {
      notify("Không tìm thấy email input", 'error');
      return;
    }
    setVal(emailInput, currentEmail);

    const displayNameInput = document.querySelector('input[aria-label="Tên hiển thị"]');
    const usernameInput = document.querySelector('input[aria-label="Tên đăng nhập"]');
    const passwordInput = document.querySelector('input[aria-label="Mật khẩu"]');
    const passwordConfirmInput = document.querySelector('input[aria-label="Xác nhận mật khẩu"]');

    if (displayNameInput) setVal(displayNameInput, displayName);
    if (usernameInput) setVal(usernameInput, username);
    if (passwordInput) setVal(passwordInput, password);
    if (passwordConfirmInput) setVal(passwordConfirmInput, password);

    await fillDOB();

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.checked && cb.labels?.[0] && /email/i.test(cb.labels[0].textContent)) cb.click();
    });

    // Update info box immediately
    showInfo();

    notify("✅ Xong! Bấm Submit rồi 'Check Email Verify' để verify tay", 'success');
  };

  const url = window.location.href;

  if (url.includes('/register')) {
    showInfo();

    const interval = setInterval(() => {
      const emailInput = document.querySelector('input[type="email"]');
      if (emailInput && currentEmail) {
        clearInterval(interval);
        fillForm();
      }
    }, 1000);
  }
  else if (url.includes('/channels/') || url.includes('/app')) {
    currentEmail = GM_getValue('discord_current_email', '');
    currentUsername = GM_getValue('discord_current_username', '');
    currentToken = GM_getValue('discord_current_token', '');

    showInfo();
    setInterval(() => showInfo(), 2000);

    setTimeout(() => captureToken(), 3000);

    // Check if just verified - close any EmailCT tabs
    const wasVerifying = GM_getValue('is_verifying', 'false');
    console.log('Discord Channels - wasVerifying:', wasVerifying);
    if (wasVerifying === 'true') {
      GM_setValue('is_verifying', 'false');
      GM_setValue('close_emailct_tabs', 'true');
      notify("🎉 Verify thành công! EmailCT sẽ tự chuyển về Discord.", 'success');
      console.log('Set close_emailct_tabs to true');

      // Reset after 5 seconds
      setTimeout(() => {
        GM_setValue('close_emailct_tabs', 'false');
      }, 5000);
    }
  }
  else if (url.includes('/verify')) {
    showInfo();
    setInterval(() => showInfo(), 2000);

    // Set flag that we're verifying
    GM_setValue('is_verifying', 'true');
    console.log('Set is_verifying to true');

    // Monitor for successful verification
    const checkVerified = setInterval(() => {
      const currentUrl = window.location.href;
      console.log('Checking URL:', currentUrl);

      // If URL changes to /channels or /app, we're verified
      if (currentUrl.includes('/channels/') || currentUrl.includes('/app')) {
        clearInterval(checkVerified);

        console.log('Verified! Setting close_emailct_tabs flag');

        // Signal to close EmailCT tabs via storage
        GM_setValue('close_emailct_tabs', 'true');
        notify("🎉 Đã verify! EmailCT sẽ tự động chuyển về Discord.", 'success');

        setTimeout(() => {
          GM_setValue('close_emailct_tabs', 'false');
        }, 5000);
      }
    }, 1000);
  }
  else if (url.includes('click.discord.com')) {
    // This is the verify link - just let it redirect
    notify("🔄 Đang verify...", 'info');
    GM_setValue('is_verifying', 'true');
    console.log('Click.discord.com - Set is_verifying to true');
  }

})();