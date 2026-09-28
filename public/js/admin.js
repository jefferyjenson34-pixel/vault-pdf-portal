/* ═══════════════════════════════════════════════════════════════
   VAULT — Admin Panel Logic (with Authentication)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Auth State ──────────────────────────────────────────────
  let adminToken = localStorage.getItem('vault_admin_token') || null;

  function getAuthHeaders() {
    return { 'X-Admin-Token': adminToken };
  }

  function authFetch(url, options = {}) {
    options.headers = { ...options.headers, ...getAuthHeaders() };
    return fetch(url, options);
  }

  // ─── Toast notifications ─────────────────────────────────────
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Format helpers ──────────────────────────────────────────
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatRelative(iso) {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(iso);
  }

  function parseBrowser(ua) {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    return 'Other';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Login / Logout ──────────────────────────────────────────
  function showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
  }

  function showDashboard() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    loadFiles();
  }

  async function checkAuth() {
    if (!adminToken) {
      showLogin();
      return;
    }
    try {
      const res = await authFetch('/api/admin/check');
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
      } else {
        adminToken = null;
        localStorage.removeItem('vault_admin_token');
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  function initLogin() {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const errorText = document.getElementById('login-error-text');
    const loginBtn = document.getElementById('login-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';
      loginBtn.disabled = true;
      loginBtn.querySelector('span').textContent = 'Signing in...';

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          adminToken = data.token;
          localStorage.setItem('vault_admin_token', adminToken);
          showDashboard();
          showToast('Welcome back, admin!', 'success');
        } else {
          errorText.textContent = data.error || 'Invalid credentials';
          errorEl.style.display = 'flex';
          // Shake animation
          form.style.animation = 'none';
          form.offsetHeight; // Trigger reflow
          form.style.animation = 'shake 0.4s ease';
        }
      } catch {
        errorText.textContent = 'Connection error. Try again.';
        errorEl.style.display = 'flex';
      }

      loginBtn.disabled = false;
      loginBtn.querySelector('span').textContent = 'Sign In';
    });
  }

  function initLogout() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await authFetch('/api/admin/logout', { method: 'POST' });
      } catch { /* ignore */ }
      adminToken = null;
      localStorage.removeItem('vault_admin_token');
      showLogin();
      showToast('Logged out', 'success');
    });
  }

  // ─── Tabs ────────────────────────────────────────────────────
  function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const panelId = 'panel-' + tab.getAttribute('data-tab');
        document.getElementById(panelId).classList.add('active');

        if (tab.getAttribute('data-tab') === 'files') loadFiles();
        if (tab.getAttribute('data-tab') === 'visitors') loadVisitors();
        if (tab.getAttribute('data-tab') === 'secret') checkSoundStatus();
      });
    });
  }

  // ─── File Upload ─────────────────────────────────────────────
  function initUpload() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    zone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => uploadFile(file));
      fileInput.value = '';
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      if (files.length === 0) {
        showToast('Only PDF files are accepted', 'error');
        return;
      }
      files.forEach(file => uploadFile(file));
    });
  }

  async function uploadFile(file) {
    const progressEl = document.getElementById('upload-progress');
    const filenameEl = document.getElementById('progress-filename');
    const percentEl = document.getElementById('progress-percent');
    const fillEl = document.getElementById('progress-bar-fill');

    progressEl.classList.add('active');
    filenameEl.textContent = file.name;
    percentEl.textContent = '0%';
    fillEl.style.width = '0%';

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            percentEl.textContent = pct + '%';
            fillEl.style.width = pct + '%';
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else if (xhr.status === 401) {
            adminToken = null;
            localStorage.removeItem('vault_admin_token');
            showLogin();
            reject(new Error('Session expired'));
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('X-Admin-Token', adminToken);
        xhr.send(formData);
      });

      showToast(`"${file.name}" uploaded successfully!`, 'success');
      loadFiles();

      setTimeout(() => {
        progressEl.classList.remove('active');
        fillEl.style.width = '0%';
      }, 1500);

    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
      progressEl.classList.remove('active');
    }
  }

  // ─── Load & Render Files ─────────────────────────────────────
  async function loadFiles() {
    const listEl = document.getElementById('admin-files-list');
    const emptyEl = document.getElementById('files-empty');
    const countEl = document.getElementById('file-count');

    try {
      const res = await fetch('/api/pdfs');
      const files = await res.json();

      countEl.textContent = files.length + ' file' + (files.length !== 1 ? 's' : '');

      if (files.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
      }

      emptyEl.style.display = 'none';
      listEl.innerHTML = files.map(file => `
        <div class="admin-file-item">
          <div class="admin-file-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="admin-file-info">
            <div class="admin-file-name">${escapeHtml(file.originalName)}</div>
            <div class="admin-file-meta">${formatSize(file.size)} · ${formatRelative(file.uploadedAt)}</div>
          </div>
          <button class="admin-file-delete" onclick="deleteFile('${escapeHtml(file.filename)}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M19 6V20A2 2 0 0117 22H7A2 2 0 015 20V6M8 6V4A2 2 0 0110 2H14A2 2 0 0116 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      `).join('');

    } catch (e) {
      showToast('Failed to load files', 'error');
    }
  }

  // ─── Delete File (global) ────────────────────────────────────
  window.deleteFile = async function (filename) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const res = await authFetch('/api/pdfs/' + encodeURIComponent(filename), { method: 'DELETE' });
      if (res.status === 401) {
        adminToken = null;
        localStorage.removeItem('vault_admin_token');
        showLogin();
        return;
      }
      if (res.ok) {
        showToast('File deleted', 'success');
        loadFiles();
      } else {
        showToast('Delete failed', 'error');
      }
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  // ─── Load & Render Visitors ──────────────────────────────────
  async function loadVisitors() {
    const tbody = document.getElementById('visitors-tbody');
    const emptyEl = document.getElementById('visitors-empty');
    const countEl = document.getElementById('visitor-count');
    const tableWrapper = document.querySelector('.visitors-table-wrapper');

    try {
      const res = await authFetch('/api/visitors');
      if (res.status === 401) {
        adminToken = null;
        localStorage.removeItem('vault_admin_token');
        showLogin();
        return;
      }
      const visitors = await res.json();

      countEl.textContent = visitors.length;

      if (visitors.length === 0) {
        tableWrapper.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }

      tableWrapper.style.display = '';
      emptyEl.style.display = 'none';

      tbody.innerHTML = visitors.map(v => `
        <tr>
          <td><span class="ip-badge">${escapeHtml(v.ip)}</span></td>
          <td><span class="page-badge">${escapeHtml(v.page || '/')}</span></td>
          <td>${escapeHtml(parseBrowser(v.userAgent))}</td>
          <td>${formatDate(v.timestamp)}</td>
        </tr>
      `).join('');

    } catch (e) {
      showToast('Failed to load visitor data', 'error');
    }
  }

  // ─── Clear Visitors ──────────────────────────────────────────
  function initVisitorControls() {
    document.getElementById('clear-visitors').addEventListener('click', async () => {
      if (!confirm('Clear all visitor logs?')) return;
      try {
        const res = await authFetch('/api/visitors/clear', { method: 'POST' });
        if (res.status === 401) { showLogin(); return; }
        showToast('Visitor logs cleared', 'success');
        loadVisitors();
      } catch (e) {
        showToast('Failed to clear logs', 'error');
      }
    });

    document.getElementById('refresh-visitors').addEventListener('click', () => {
      loadVisitors();
      showToast('Refreshed', 'success');
    });
  }

  // ─── Secret Prank Sound Management ───────────────────────────
  let previewAudio = null;

  async function checkSoundStatus() {
    const badge = document.getElementById('sound-status-badge');
    const previewBtn = document.getElementById('test-sound-btn');
    if (!badge) return;

    try {
      const res = await fetch('/api/sound-status');
      const data = await res.json();
      if (data.exists) {
        badge.innerHTML = '✅ <strong style="color:#10b981;">Custom sound active</strong> (<code>/sound.mp3</code> loaded)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
        if (previewBtn) previewBtn.style.display = 'inline-flex';
      } else {
        badge.innerHTML = '⚠️ <strong style="color:#f59e0b;">No custom file yet</strong> (Using fallback screamer synthesizer)';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        badge.style.background = 'rgba(245, 158, 11, 0.1)';
        if (previewBtn) previewBtn.style.display = 'none';
      }
    } catch (e) {
      badge.textContent = 'Error checking sound file';
    }
  }

  function initSecretPrankSound() {
    const uploadBtn = document.getElementById('upload-sound-btn');
    const fileInput = document.getElementById('sound-file-input');
    const previewBtn = document.getElementById('test-sound-btn');
    const msgEl = document.getElementById('sound-upload-msg');

    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('sound', file);

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading sound...';

      try {
        const res = await authFetch('/api/upload-sound', {
          method: 'POST',
          body: formData
        });

        if (res.status === 401) {
          showLogin();
          return;
        }

        const data = await res.json();
        if (data.success) {
          showToast('Scary sound uploaded successfully!', 'success');
          if (msgEl) {
            msgEl.style.display = 'block';
            msgEl.style.color = '#10b981';
            msgEl.textContent = '✅ Sound file saved as sound.mp3 and is live!';
          }
          checkSoundStatus();
        } else {
          showToast(data.error || 'Upload failed', 'error');
        }
      } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Upload Scary Sound (.mp3 / .wav)</span>
        `;
        fileInput.value = '';
      }
    });

    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const icon = document.getElementById('test-sound-icon');
        const text = document.getElementById('test-sound-text');

        if (previewAudio && !previewAudio.paused) {
          previewAudio.pause();
          previewAudio.currentTime = 0;
          icon.textContent = '▶';
          text.textContent = 'Preview Sound';
        } else {
          previewAudio = new Audio('/sound.mp3?t=' + Date.now());
          previewAudio.play().then(() => {
            icon.textContent = '⏹';
            text.textContent = 'Stop Preview';
          }).catch(err => {
            showToast('Could not play sound: ' + err.message, 'error');
          });

          previewAudio.onended = () => {
            icon.textContent = '▶';
            text.textContent = 'Preview Sound';
          };
        }
      });
    }
  }

  // ─── Init ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initLogout();
    initTabs();
    initUpload();
    initVisitorControls();
    initSecretPrankSound();
    checkAuth(); // Check if already logged in
  });
})();
