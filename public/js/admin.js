/* ═══════════════════════════════════════════════════════════════
   VAULT — Admin Panel Logic
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

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

  // ─── Tabs ────────────────────────────────────────────────────
  function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active from all tabs and panels
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

        // Activate clicked tab and panel
        tab.classList.add('active');
        const panelId = 'panel-' + tab.getAttribute('data-tab');
        document.getElementById(panelId).classList.add('active');

        // Refresh data when switching tabs
        if (tab.getAttribute('data-tab') === 'files') loadFiles();
        if (tab.getAttribute('data-tab') === 'visitors') loadVisitors();
      });
    });
  }

  // ─── File Upload ─────────────────────────────────────────────
  function initUpload() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    // Browse button
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    zone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => uploadFile(file));
      fileInput.value = '';
    });

    // Drag & Drop
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
      // Use XMLHttpRequest for progress tracking
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
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      showToast(`"${file.name}" uploaded successfully!`, 'success');
      loadFiles();

      // Reset progress after delay
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
      const res = await fetch('/api/pdfs/' + encodeURIComponent(filename), { method: 'DELETE' });
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
      const res = await fetch('/api/visitors');
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
        await fetch('/api/visitors/clear', { method: 'POST' });
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

  // ─── Init ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUpload();
    initVisitorControls();
    loadFiles();
  });
})();
