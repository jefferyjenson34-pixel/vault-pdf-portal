/* ═══════════════════════════════════════════════════════════════
   VAULT PDF PORTAL — Client App Logic
   Document loading, live search, scroll reveals, active spy
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── 1. Log visit to server analytics ──────────────────────────
  async function logVisit() {
    try {
      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: window.location.pathname || '/' })
      });
    } catch (e) {
      // Non-blocking silent catch
    }
  }

  // ─── 2. Format file size ───────────────────────────────────────
  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  // ─── 3. Format upload date ─────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return 'Recent';
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

  // ─── 4. Escape HTML helper ─────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ─── 5. Create modern document card HTML ───────────────────────
  function createDocCard(file, index) {
    const card = document.createElement('div');
    card.className = 'doc-card reveal-fade-up is-revealed';
    card.setAttribute('data-name', (file.originalName || '').toLowerCase());
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Document: ${file.originalName}`);

    card.innerHTML = `
      <div class="doc-card-header">
        <div class="doc-icon-badge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="doc-info">
          <h3 class="doc-name" title="${escapeHtml(file.originalName)}">${escapeHtml(file.originalName)}</h3>
          <div class="doc-meta">
            <span class="doc-tag pdf-tag">PDF</span>
            <span class="doc-size">${formatSize(file.size)}</span>
          </div>
        </div>
      </div>
      <div class="doc-card-footer">
        <div class="doc-date-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span class="doc-date">${formatDate(file.uploadedAt)}</span>
        </div>
        <button class="doc-download-btn" aria-label="Download ${escapeHtml(file.originalName)}" onclick="event.stopPropagation(); window.location.href='/api/download/${encodeURIComponent(file.filename)}'">
          <span>Download</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    `;

    // Click card to initiate download
    card.addEventListener('click', () => {
      window.location.href = '/api/download/' + encodeURIComponent(file.filename);
    });

    // Keyboard enter support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.location.href = '/api/download/' + encodeURIComponent(file.filename);
      }
    });

    return card;
  }

  // ─── 6. Fetch and render document library ─────────────────────
  async function loadDocuments() {
    const grid = document.getElementById('documents-grid');
    const loading = document.getElementById('loading-state');
    const empty = document.getElementById('empty-state');
    const statFiles = document.getElementById('stat-files');

    try {
      const res = await fetch('/api/pdfs');
      const files = await res.json();

      if (loading) loading.style.display = 'none';

      if (!files || files.length === 0) {
        if (empty) empty.style.display = 'block';
        if (statFiles) statFiles.textContent = '0';
        return;
      }

      if (statFiles) statFiles.textContent = files.length;
      if (empty) empty.style.display = 'none';
      if (grid) {
        grid.innerHTML = '';
        files.forEach((file, index) => {
          grid.appendChild(createDocCard(file, index));
        });
      }
    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (empty) empty.style.display = 'block';
    }
  }

  // ─── 7. Fast client-side search ───────────────────────────────
  function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.doc-card');
      let visibleCount = 0;

      cards.forEach((card) => {
        const name = card.getAttribute('data-name') || '';
        if (name.includes(query)) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      const empty = document.getElementById('empty-state');
      const grid = document.getElementById('documents-grid');
      if (empty) {
        if (visibleCount === 0 && grid && grid.children.length > 0) {
          empty.style.display = 'block';
          const h3 = empty.querySelector('h3');
          const p = empty.querySelector('p');
          if (h3) h3.textContent = 'No matching documents';
          if (p) p.textContent = 'Try adjusting your search query or check spelling.';
        } else if (visibleCount === 0 && (!grid || grid.children.length === 0)) {
          empty.style.display = 'block';
        } else {
          empty.style.display = 'none';
        }
      }
    });
  }

  // ─── 8. Sticky header & scroll observer ───────────────────────
  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      },
      { passive: true }
    );
  }

  // ─── 9. Mobile menu toggle ────────────────────────────────────
  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-toggle');
    const menu = document.querySelector('.nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('is-active');
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.remove('is-active');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ─── 10. Nav Scroll Spy: highlight Documents vs About ─────────
  function initScrollSpy() {
    const navDocs = document.getElementById('nav-link-docs');
    const navAbout = document.getElementById('nav-link-about');
    const docsSection = document.getElementById('documents');
    const aboutSection = document.getElementById('about');

    if (!docsSection || !aboutSection || !navDocs || !navAbout) return;

    window.addEventListener(
      'scroll',
      () => {
        const scrollPos = window.scrollY + 140;
        const aboutTop = aboutSection.offsetTop;

        if (scrollPos >= aboutTop) {
          navAbout.classList.add('active');
          navDocs.classList.remove('active');
        } else {
          navDocs.classList.add('active');
          navAbout.classList.remove('active');
        }
      },
      { passive: true }
    );
  }

  // ─── 11. Viewport Scroll Reveals (IntersectionObserver) ───────
  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal-fade-up').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    document.querySelectorAll('.reveal-fade-up').forEach((el) => {
      observer.observe(el);
    });
  }

  // ─── 12. Subtle 3D Tilt on Floating Hero Shield ───────────────
  function initHeroTilt() {
    const shield = document.querySelector('.floating-shield-card');
    const visual = document.querySelector('.hero-visual-container');
    if (!shield || !visual) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 1024) return;

    visual.addEventListener('mousemove', (e) => {
      const rect = visual.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const tiltX = (y / (rect.height / 2)) * -6;
      const tiltY = (x / (rect.width / 2)) * 6;

      shield.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px)`;
    });

    visual.addEventListener('mouseleave', () => {
      shield.style.transform = '';
    });
  }

  // ─── DOM Ready ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    logVisit();
    loadDocuments();
    initSearch();
    initHeader();
    initMobileMenu();
    initScrollSpy();
    initScrollReveal();
    initHeroTilt();
  });
})();
