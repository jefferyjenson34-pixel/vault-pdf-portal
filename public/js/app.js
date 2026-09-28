/* ═══════════════════════════════════════════════════════════════
   VAULT — User-Facing App Logic
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Log visitor IP ───────────────────────────────────────────
  async function logVisit() {
    try {
      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: window.location.pathname })
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ─── Format file size ────────────────────────────────────────
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  // ─── Format date ─────────────────────────────────────────────
  function formatDate(iso) {
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ─── Create document card HTML ───────────────────────────────
  function createDocCard(file, index) {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.style.animationDelay = `${index * 0.08}s`;
    card.setAttribute('data-name', file.originalName.toLowerCase());

    card.innerHTML = `
      <div class="doc-card-header">
        <div class="doc-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="9" y1="17" x2="13" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="doc-info">
          <div class="doc-name">${escapeHtml(file.originalName)}</div>
          <div class="doc-meta">
            <span class="doc-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              PDF
            </span>
            <span class="doc-meta-item">${formatSize(file.size)}</span>
          </div>
        </div>
      </div>
      <div class="doc-card-footer">
        <span class="doc-date">${formatDate(file.uploadedAt)}</span>
        <button class="doc-download-btn" onclick="event.stopPropagation(); window.location.href='/api/download/${encodeURIComponent(file.filename)}'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 15V19A2 2 0 0119 21H5A2 2 0 013 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Download
        </button>
      </div>
    `;

    // Card click also downloads
    card.addEventListener('click', () => {
      window.location.href = '/api/download/' + encodeURIComponent(file.filename);
    });

    return card;
  }

  // ─── Escape HTML ──────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Load documents ──────────────────────────────────────────
  async function loadDocuments() {
    const grid = document.getElementById('documents-grid');
    const loading = document.getElementById('loading-state');
    const empty = document.getElementById('empty-state');
    const statFiles = document.getElementById('stat-files');

    try {
      const res = await fetch('/api/pdfs');
      const files = await res.json();

      loading.style.display = 'none';

      if (files.length === 0) {
        empty.style.display = 'block';
        statFiles.textContent = '0';
        return;
      }

      statFiles.textContent = files.length;
      grid.innerHTML = '';

      files.forEach((file, index) => {
        grid.appendChild(createDocCard(file, index));
      });
    } catch (e) {
      loading.style.display = 'none';
      empty.style.display = 'block';
    }
  }

  // ─── Search ───────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('search-input');
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.doc-card');
      let visibleCount = 0;

      cards.forEach(card => {
        const name = card.getAttribute('data-name');
        if (name.includes(query)) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      const empty = document.getElementById('empty-state');
      const grid = document.getElementById('documents-grid');
      if (visibleCount === 0 && grid.children.length > 0) {
        empty.style.display = 'block';
        empty.querySelector('h3').textContent = 'No matches found';
        empty.querySelector('p').textContent = 'Try a different search term.';
      } else {
        empty.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    });
  }

  // ─── Navbar scroll effect ────────────────────────────────────
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // ─── Initialize ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    logVisit();
    loadDocuments();
    initSearch();
    initNavbar();
  });
})();
