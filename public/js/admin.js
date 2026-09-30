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
    loadStats();
    loadFiles();
    loadInquiries();
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
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        loadStats();
        if (tab.getAttribute('data-tab') === 'files') loadFiles();
        if (tab.getAttribute('data-tab') === 'inquiries') loadInquiries();
        if (tab.getAttribute('data-tab') === 'visitors') loadVisitors();
        if (tab.getAttribute('data-tab') === 'secret') checkSoundStatus();
      });
    });

    const refreshInquiriesBtn = document.getElementById('refresh-inquiries');
    if (refreshInquiriesBtn) {
      refreshInquiriesBtn.addEventListener('click', loadInquiries);
    }
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

  // ─── Load Analytics Stats ───────────────────────────────────
  async function loadStats() {
    try {
      const res = await authFetch('/api/stats');
      if (!res.ok) return;
      const data = await res.json();

      const filesVal = document.getElementById('stat-files-val');
      const downloadsVal = document.getElementById('stat-downloads-val');
      const sizeVal = document.getElementById('stat-size-val');
      const visitorsVal = document.getElementById('stat-visitors-val');
      const contactsVal = document.getElementById('stat-contacts-val');
      const badge = document.getElementById('inquiries-badge');

      if (filesVal) filesVal.textContent = data.totalFiles || 0;
      if (downloadsVal) downloadsVal.textContent = data.totalDownloads || 0;
      if (sizeVal) sizeVal.textContent = formatSize(data.totalSize || 0);
      if (visitorsVal) visitorsVal.textContent = data.totalVisitors || 0;
      if (contactsVal) contactsVal.textContent = data.totalContacts || 0;

      if (badge) {
        if (data.unreadContacts > 0) {
          badge.style.display = 'inline-block';
          badge.textContent = data.unreadContacts;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      // non-blocking
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
            <div class="admin-file-meta">
              <span>${formatSize(file.size)}</span>
              <span>&bull;</span>
              <span>${formatRelative(file.uploadedAt)}</span>
              <span>&bull;</span>
              <span style="color:#818cf8; font-weight:600;">${file.downloads || 0} downloads</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <select class="admin-category-select" onchange="updateFileCategory('${escapeHtml(file.filename)}', this.value)" style="background:var(--bg-glass-strong); border:1px solid var(--border-medium); color:var(--text-primary); border-radius:8px; padding:6px 10px; font-size:0.78rem; outline:none; cursor:pointer;" title="Assign Document Category">
              <option value="general" ${(file.category || 'general') === 'general' ? 'selected' : ''}>General</option>
              <option value="legal" ${file.category === 'legal' ? 'selected' : ''}>Legal &amp; Contracts</option>
              <option value="reports" ${file.category === 'reports' ? 'selected' : ''}>Reports &amp; Financials</option>
              <option value="academic" ${file.category === 'academic' ? 'selected' : ''}>Academic &amp; Records</option>
              <option value="invoices" ${file.category === 'invoices' ? 'selected' : ''}>Invoices &amp; Receipts</option>
            </select>
            <button class="admin-file-delete" onclick="deleteFile('${escapeHtml(file.filename)}')" title="Delete File">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M19 6V20A2 2 0 0117 22H7A2 2 0 015 20V6M8 6V4A2 2 0 0110 2H14A2 2 0 0116 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');

    } catch (e) {
      showToast('Failed to load files', 'error');
    }
  }

  // ─── Update File Category (global) ───────────────────────────
  window.updateFileCategory = async function (filename, category) {
    try {
      const res = await authFetch('/api/pdfs/' + encodeURIComponent(filename) + '/category', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      if (res.ok) {
        showToast('Category updated successfully', 'success');
      } else {
        showToast('Failed to update category', 'error');
      }
    } catch {
      showToast('Category update failed', 'error');
    }
  };

  // ─── Load & Render Inquiries ─────────────────────────────────
  async function loadInquiries() {
    const listEl = document.getElementById('inquiries-list');
    const emptyEl = document.getElementById('inquiries-empty');
    const countEl = document.getElementById('inquiry-count');
    if (!listEl) return;

    try {
      const res = await authFetch('/api/contacts');
      if (res.status === 401) {
        adminToken = null;
        localStorage.removeItem('vault_admin_token');
        showLogin();
        return;
      }
      const contacts = await res.json();
      if (countEl) countEl.textContent = contacts.length;

      if (!contacts || contacts.length === 0) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';
      listEl.innerHTML = contacts.map(c => `
        <div style="background:var(--bg-card); border:1px solid ${c.read ? 'var(--border-subtle)' : 'rgba(129,140,248,0.45)'}; border-radius:14px; padding:18px 20px; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:12px; flex-wrap:wrap;">
            <div>
              <span style="font-weight:700; color:var(--text-primary); font-size:1rem;">${escapeHtml(c.name)}</span>
              <a href="mailto:${escapeHtml(c.email)}" style="color:#818cf8; font-size:0.85rem; margin-left:8px; text-decoration:underline;">${escapeHtml(c.email)}</a>
              ${!c.read ? '<span style="background:#ec4899; color:#fff; font-size:0.68rem; font-weight:700; padding:2px 7px; border-radius:10px; margin-left:8px;">NEW</span>' : ''}
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted);">${formatDate(c.timestamp)}</div>
          </div>
          ${c.subject ? `<div style="font-weight:600; color:var(--accent-violet); font-size:0.9rem; margin-bottom:6px;">Subject: ${escapeHtml(c.subject)}</div>` : ''}
          <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:12px; white-space:pre-wrap;">${escapeHtml(c.message)}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:10px;">
            <span>IP: ${escapeHtml(c.ip || 'Unknown')}</span>
            <div style="display:flex; gap:8px;">
              ${!c.read ? `<button onclick="markInquiryRead('${c.id}')" style="background:var(--bg-glass-strong); border:1px solid var(--border-medium); color:#34d399; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.78rem;">Mark Read</button>` : ''}
              <button onclick="deleteInquiry('${c.id}')" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:0.78rem;">Delete</button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      showToast('Failed to load inquiries', 'error');
    }
  }

  // ─── Mark Inquiry as Read ────────────────────────────────────
  window.markInquiryRead = async function (id) {
    try {
      const res = await authFetch('/api/contacts/' + id + '/read', { method: 'PUT' });
      if (res.ok) {
        showToast('Marked inquiry as read', 'success');
        loadInquiries();
        loadStats();
      }
    } catch {
      showToast('Failed to update inquiry', 'error');
    }
  };

  // ─── Delete Inquiry ──────────────────────────────────────────
  window.deleteInquiry = async function (id) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await authFetch('/api/contacts/' + id, { method: 'DELETE' });
      if (res.ok) {
        showToast('Message deleted', 'success');
        loadInquiries();
        loadStats();
      }
    } catch {
      showToast('Failed to delete message', 'error');
    }
  };

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
        loadStats();
      } else {
        showToast('Delete failed', 'error');
      }
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  // ─── Permanent Visitor Logs & Date Sorting ──────────────────
  let allVisitors = [];
  let currentVisitorSort = 'desc';
  let currentVisitorSearch = '';

  function renderVisitorsTable() {
    const tbody = document.getElementById('visitors-tbody');
    const emptyEl = document.getElementById('visitors-empty');
    const countEl = document.getElementById('visitor-count');
    const tableWrapper = document.querySelector('.visitors-table-wrapper');
    if (!tbody) return;

    let filtered = allVisitors.slice();

    // 1. Search Filter
    if (currentVisitorSearch) {
      const q = currentVisitorSearch.toLowerCase();
      filtered = filtered.filter(v => {
        const ip = (v.ip || '').toLowerCase();
        const page = (v.page || '').toLowerCase();
        const browser = parseBrowser(v.userAgent).toLowerCase();
        const dateStr = formatDate(v.timestamp).toLowerCase();
        return ip.includes(q) || page.includes(q) || browser.includes(q) || dateStr.includes(q);
      });
    }

    // 2. Date Sort (Newest vs Oldest)
    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return currentVisitorSort === 'asc' ? timeA - timeB : timeB - timeA;
    });

    if (countEl) {
      if (currentVisitorSearch) {
        countEl.textContent = `${filtered.length} of ${allVisitors.length}`;
      } else {
        countEl.textContent = `${allVisitors.length} total`;
      }
    }

    if (filtered.length === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        const p = emptyEl.querySelector('p');
        if (p) p.textContent = currentVisitorSearch ? 'No logs match your search filter.' : 'Activity will appear here when users visit the site.';
      }
      return;
    }

    if (tableWrapper) tableWrapper.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    tbody.innerHTML = filtered.map(v => `
      <tr>
        <td><span class="ip-badge">${escapeHtml(v.ip)}</span></td>
        <td><span class="page-badge">${escapeHtml(v.page || '/')}</span></td>
        <td>${escapeHtml(parseBrowser(v.userAgent))}</td>
        <td style="font-weight:500; color:var(--text-primary);">${formatDate(v.timestamp)}</td>
      </tr>
    `).join('');
  }

  async function loadVisitors() {
    try {
      const res = await authFetch('/api/visitors');
      if (res.status === 401) {
        adminToken = null;
        localStorage.removeItem('vault_admin_token');
        showLogin();
        return;
      }
      allVisitors = await res.json();
      if (!Array.isArray(allVisitors)) allVisitors = [];
      renderVisitorsTable();
    } catch (e) {
      showToast('Failed to load visitor data', 'error');
    }
  }

  // ─── Export Visitors to CSV ──────────────────────────────────
  function exportVisitorsCSV() {
    if (!allVisitors || allVisitors.length === 0) {
      showToast('No visitor logs to export', 'error');
      return;
    }

    const headers = ['IP Address', 'Page / Action', 'Browser', 'User Agent', 'Timestamp (ISO)', 'Local Date'];
    const rows = allVisitors.map(v => [
      `"${(v.ip || '').replace(/"/g, '""')}"`,
      `"${(v.page || '/').replace(/"/g, '""')}"`,
      `"${parseBrowser(v.userAgent)}"`,
      `"${(v.userAgent || '').replace(/"/g, '""')}"`,
      `"${v.timestamp || ''}"`,
      `"${formatDate(v.timestamp)}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vault_visitor_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${allVisitors.length} visitor records to CSV`, 'success');
  }

  // ─── Visitor Controls ────────────────────────────────────────
  function initVisitorControls() {
    const refreshBtn = document.getElementById('refresh-visitors');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadVisitors();
        showToast('Visitor logs refreshed', 'success');
      });
    }

    const sortSelect = document.getElementById('visitor-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentVisitorSort = sortSelect.value;
        renderVisitorsTable();
      });
    }

    const searchInput = document.getElementById('visitor-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        currentVisitorSearch = searchInput.value.trim();
        renderVisitorsTable();
      });
    }

    const exportBtn = document.getElementById('export-visitors');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportVisitorsCSV);
    }
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
