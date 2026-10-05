/* ═══════════════════════════════════════════════════════════════
   VAULT PDF PORTAL — Client App Logic
   Interactive In-Browser PDF Preview, Live Filtering & Sorting,
   Dual View Modes (Grid & Table), Category Tabs & Share System
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── State Management ─────────────────────────────────────────
  let portalFiles = [];
  let currentCategory = 'all';
  let currentSearchQuery = '';
  let currentSort = 'newest';
  let currentViewMode = 'grid'; // 'grid' | 'table'

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

  // ─── 5. Determine category for document ────────────────────────
  function resolveCategory(file) {
    if (file.category && file.category !== 'uncategorized') {
      return file.category.toLowerCase();
    }
    const name = (file.originalName || '').toLowerCase();
    if (/agreement|contract|nda|policy|terms|legal|deed|license|compliance/i.test(name)) {
      return 'legal';
    }
    if (/report|finance|financial|budget|audit|statement|annual|quarterly|revenue|balance/i.test(name)) {
      return 'reports';
    }
    if (/academic|transcript|diploma|certificate|thesis|syllabus|university|grade|course/i.test(name)) {
      return 'academic';
    }
    if (/invoice|receipt|billing|payment|slip|tax|quote|po\b/i.test(name)) {
      return 'invoices';
    }
    return 'general';
  }

  function getCategoryLabel(cat) {
    const map = {
      legal: 'Legal & Contracts',
      reports: 'Reports & Financials',
      academic: 'Academic & Records',
      invoices: 'Invoices & Receipts',
      general: 'General'
    };
    return map[cat] || 'General';
  }

  // ─── 6. Toast Notification Helper ─────────────────────────────
  function showPortalToast(message, type = 'success') {
    const container = document.getElementById('portal-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'portal-toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  // ─── 7. Copy Direct Document Link ──────────────────────────────
  async function copyDocumentLink(file) {
    const origin = window.location.origin;
    const link = `${origin}/api/preview/${encodeURIComponent(file.filename)}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showPortalToast(`Copied verified link for "${file.originalName}"`);
    } catch (err) {
      showPortalToast('Failed to copy link to clipboard');
    }
  }

  // ─── 8. In-Browser PDF Preview Modal ──────────────────────────
  function openPdfModal(file) {
    const modal = document.getElementById('pdf-preview-modal');
    const iframe = document.getElementById('modal-pdf-frame');
    const titleEl = document.getElementById('modal-doc-title');
    const catEl = document.getElementById('modal-doc-category');
    const sizeEl = document.getElementById('modal-doc-size');
    const downloadsEl = document.getElementById('modal-doc-downloads');
    const downloadBtn = document.getElementById('modal-download-btn');
    const openTabBtn = document.getElementById('modal-open-tab-btn');
    const copyLinkBtn = document.getElementById('modal-copy-link-btn');
    const loader = document.getElementById('modal-loader');

    if (!modal || !iframe) return;

    const category = resolveCategory(file);
    const downloadUrl = `/api/download/${encodeURIComponent(file.filename)}`;
    const previewUrl = `/api/preview/${encodeURIComponent(file.filename)}`;

    if (titleEl) titleEl.textContent = file.originalName;
    if (catEl) {
      catEl.className = `category-tag ${category}`;
      catEl.textContent = getCategoryLabel(category);
    }
    if (sizeEl) sizeEl.textContent = formatSize(file.size);
    if (downloadsEl) downloadsEl.textContent = `${file.downloads || 0} downloads`;
    if (downloadBtn) {
      downloadBtn.href = downloadUrl;
      downloadBtn.onclick = () => {
        file.downloads = (file.downloads || 0) + 1;
        if (downloadsEl) downloadsEl.textContent = `${file.downloads} downloads`;
        updateCategoryCounts();
      };
    }
    if (openTabBtn) openTabBtn.href = previewUrl;
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => copyDocumentLink(file);
    }
    const modalListenBtn = document.getElementById('modal-listen-btn');
    if (modalListenBtn) {
      modalListenBtn.onclick = () => {
        if (window.VaultAudioReader) {
          window.VaultAudioReader.playPdf(file.filename, file.originalName);
        }
      };
    }

    const modalTextBtn = document.getElementById('modal-download-text-btn');
    if (modalTextBtn) {
      modalTextBtn.href = `/api/pdf/download-text/${encodeURIComponent(file.filename)}`;
      modalTextBtn.setAttribute('download', file.originalName.replace(/\.pdf$/i, '') + '.txt');
    }

    const modalAudioBtn = document.getElementById('modal-download-audio-btn');
    if (modalAudioBtn) {
      modalAudioBtn.href = `/api/pdf/download-audio/${encodeURIComponent(file.filename)}`;
      modalAudioBtn.setAttribute('download', file.originalName.replace(/\.pdf$/i, '') + '.mp3');
    }

    if (loader) loader.style.display = 'flex';
    iframe.onload = () => {
      if (loader) loader.style.display = 'none';
    };
    iframe.src = previewUrl;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePdfModal() {
    const modal = document.getElementById('pdf-preview-modal');
    const iframe = document.getElementById('modal-pdf-frame');
    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (iframe) iframe.src = 'about:blank';
  }

  function initPdfModal() {
    const modal = document.getElementById('pdf-preview-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    if (!modal) return;

    if (closeBtn) {
      closeBtn.addEventListener('click', closePdfModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePdfModal();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closePdfModal();
      }
    });
  }

  // ─── 8b. Report Document Modal Handling ────────────────────────
  function openReportModal(file) {
    const modal = document.getElementById('doc-report-modal');
    const docIdInput = document.getElementById('report-doc-id');
    const docNameDisplay = document.getElementById('report-modal-filename');
    const reasonSelect = document.getElementById('report-reason-select');
    const detailsInput = document.getElementById('report-details-input');

    if (!modal) return;

    if (docIdInput) docIdInput.value = file.id || file.filename;
    if (docNameDisplay) docNameDisplay.textContent = file.originalName;
    if (reasonSelect) reasonSelect.selectedIndex = 0;
    if (detailsInput) detailsInput.value = '';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeReportModal() {
    const modal = document.getElementById('doc-report-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function initReportModal() {
    const modal = document.getElementById('doc-report-modal');
    const closeBtn = document.getElementById('btn-close-report');
    const cancelBtn = document.getElementById('btn-cancel-report');
    const form = document.getElementById('doc-report-form');
    const submitBtn = document.getElementById('btn-submit-report');

    if (!modal) return;

    if (closeBtn) closeBtn.addEventListener('click', closeReportModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeReportModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeReportModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeReportModal();
      }
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docId = document.getElementById('report-doc-id').value;
        const reason = document.getElementById('report-reason-select').value;
        const details = document.getElementById('report-details-input').value;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Submitting...</span>';
        }

        try {
          const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, details })
          });
          const data = await res.json();

          if (res.ok) {
            closeReportModal();
            showPortalToast('Report submitted. Administrators will review this document.');
          } else {
            alert(data.error || 'Failed to submit report.');
          }
        } catch (err) {
          alert('Network error while submitting report.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Submit Report</span>';
          }
        }
      });
    }
  }

  // ─── 9. Build Modern Grid Card ────────────────────────────────
  function createDocCard(file) {
    const category = resolveCategory(file);
    const isPopular = (file.downloads && file.downloads >= 3);

    const card = document.createElement('div');
    card.className = 'doc-card reveal-fade-up is-revealed';
    card.setAttribute('data-name', (file.originalName || '').toLowerCase());
    card.setAttribute('data-filename', file.filename || '');
    card.setAttribute('data-category', category);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Document: ${file.originalName}`);

    card.innerHTML = `
      <div class="doc-badge-row">
        <span class="category-tag ${category}">${escapeHtml(getCategoryLabel(category))}</span>
        ${isPopular ? `
          <span class="popular-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c-.6 3.4-3.5 5.5-4.5 8.5C6.3 14 7.2 17 9.5 19c.6.5 1.5.3 1.8-.4.3-.7-.2-1.5-.7-2-1.2-1.3-1.4-3.2-.4-4.6.3-.4.8-.7 1.3-.9 1.1-.5 2-1.5 2.5-2.6 1.8 2.2 2 5.2.8 7.6-.3.6.1 1.4.7 1.6.6.2 1.3-.2 1.6-.7 1.7-2.9 1.4-6.6-.7-9.2-.8-1-1.7-2-2.3-3.2-.5-1-.9-2.1-1.1-3.1-.2-.6-.8-1-1.4-.9z"/>
            </svg>
            Popular
          </span>
        ` : ''}
      </div>

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
          <div class="doc-stats-line">
            <span class="doc-stat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>${file.downloads || 0} downloads</span>
            </span>
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

        <div class="doc-card-actions">
          <button class="btn-doc-scan" title="Neural Forensic Integrity Scan" aria-label="Neural scan ${escapeHtml(file.originalName)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            <span>Scan</span>
          </button>

          <button class="btn-doc-ai-chat" title="Chat with PDF (AI Intelligence Q&amp;A)" aria-label="Ask AI about ${escapeHtml(file.originalName)}" data-filename="${escapeHtml(file.filename)}" data-title="${escapeHtml(file.originalName)}" style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; font-weight:700; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.76rem; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;">
            <span>💬</span>
            <span>Ask AI</span>
          </button>

          <button class="doc-share-btn" title="Create self-destructing share link" aria-label="Share ${escapeHtml(file.originalName)}" data-filename="${escapeHtml(file.filename)}" data-title="${escapeHtml(file.originalName)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>

          <button class="btn-doc-listen" title="Neural Voice Reader (Listen Hands-Free)" aria-label="Listen to ${escapeHtml(file.originalName)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
            </svg>
            <span>Listen</span>
          </button>

          <button class="doc-preview-btn" aria-label="Preview ${escapeHtml(file.originalName)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Preview</span>
          </button>

          <button class="doc-download-btn" aria-label="Download ${escapeHtml(file.originalName)}">
            <span>Download</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>

          <button class="doc-report-btn" title="Report this document" aria-label="Report ${escapeHtml(file.originalName)}" style="background:none; border:none; color:var(--text-muted); padding:6px 8px; cursor:pointer; border-radius:6px; display:inline-flex; align-items:center; transition:color 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Click card opens preview
    card.addEventListener('click', (e) => {
      openPdfModal(file);
    });

    // Neural scan button
    const scanBtn = card.querySelector('.btn-doc-scan');
    if (scanBtn) {
      scanBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.VaultForensicScanner) {
          window.VaultForensicScanner.scanFile(`/api/preview/${encodeURIComponent(file.filename)}`, file.originalName);
        }
      });
    }

    // Neural Voice Reader button
    const cardListenBtn = card.querySelector('.btn-doc-listen');
    if (cardListenBtn) {
      cardListenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.VaultAudioReader) {
          window.VaultAudioReader.playPdf(file.filename, file.originalName);
        }
      });
    }

    // Preview button
    const previewBtn = card.querySelector('.doc-preview-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPdfModal(file);
      });
    }

    // Share button
    const shareBtn = card.querySelector('.doc-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyDocumentLink(file);
      });
    }

    // Download button
    const downloadBtn = card.querySelector('.doc-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        file.downloads = (file.downloads || 0) + 1;
        window.location.href = '/api/download/' + encodeURIComponent(file.filename);
        setTimeout(renderDocuments, 500);
      });
    }

    // Report button
    const reportBtn = card.querySelector('.doc-report-btn');
    if (reportBtn) {
      reportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReportModal(file);
      });
    }

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        openPdfModal(file);
      }
    });

    return card;
  }

  // ─── 10. Build Compact Table Row ──────────────────────────────
  function createDocTableRow(file) {
    const category = resolveCategory(file);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <div class="table-doc-cell">
          <div class="table-doc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <span class="table-doc-title">${escapeHtml(file.originalName)}</span>
        </div>
      </td>
      <td>
        <span class="category-tag ${category}">${escapeHtml(getCategoryLabel(category))}</span>
      </td>
      <td>
        <span class="doc-size">${formatSize(file.size)}</span>
      </td>
      <td>
        <span style="font-weight:600; color:var(--navy-900);">${file.downloads || 0}</span>
      </td>
      <td>
        <span style="color:var(--text-muted); font-size:0.84rem;">${formatDate(file.uploadedAt)}</span>
      </td>
      <td class="table-actions-cell">
        <div class="table-actions-group">
          <button class="btn-doc-scan btn-table-scan" title="Neural Forensic Integrity Scan" aria-label="Neural scan ${escapeHtml(file.originalName)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            <span>Scan</span>
          </button>
          <button class="btn-doc-ai-chat btn-table-ai" title="Chat with PDF (AI Intelligence Q&amp;A)" aria-label="Ask AI about ${escapeHtml(file.originalName)}" data-filename="${escapeHtml(file.filename)}" data-title="${escapeHtml(file.originalName)}" style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; font-weight:700; padding:5px 9px; border-radius:6px; cursor:pointer; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
            <span>💬</span>
            <span>Ask AI</span>
          </button>
          <button class="doc-share-btn btn-table-share" title="Create self-destructing share link" aria-label="Share ${escapeHtml(file.originalName)}" data-filename="${escapeHtml(file.filename)}" data-title="${escapeHtml(file.originalName)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
          <button class="btn-table-listen" title="Neural Voice Reader (Listen Hands-Free)" aria-label="Listen to ${escapeHtml(file.originalName)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
            </svg>
            <span>Listen</span>
          </button>
          <button class="doc-preview-btn btn-table-preview" aria-label="Preview ${escapeHtml(file.originalName)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Preview</span>
          </button>
          <button class="doc-download-btn btn-table-download" aria-label="Download ${escapeHtml(file.originalName)}">
            <span>Download</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </td>
    `;

    // Row click opens preview
    tr.addEventListener('click', () => openPdfModal(file));

    tr.querySelector('.btn-table-scan').addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.VaultForensicScanner) {
        window.VaultForensicScanner.scanFile(`/api/preview/${encodeURIComponent(file.filename)}`, file.originalName);
      }
    });

    tr.querySelector('.btn-table-share').addEventListener('click', (e) => {
      e.stopPropagation();
      copyDocumentLink(file);
    });

    const tableListenBtn = tr.querySelector('.btn-table-listen');
    if (tableListenBtn) {
      tableListenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.VaultAudioReader) {
          window.VaultAudioReader.playPdf(file.filename, file.originalName);
        }
      });
    }

    tr.querySelector('.btn-table-preview').addEventListener('click', (e) => {
      e.stopPropagation();
      openPdfModal(file);
    });

    tr.querySelector('.btn-table-download').addEventListener('click', (e) => {
      e.stopPropagation();
      file.downloads = (file.downloads || 0) + 1;
      window.location.href = '/api/download/' + encodeURIComponent(file.filename);
      setTimeout(renderDocuments, 500);
    });

    return tr;
  }

  // ─── 11. Update Category Count Indicators ─────────────────────
  function updateCategoryCounts() {
    const counts = { all: portalFiles.length, legal: 0, reports: 0, academic: 0, invoices: 0, general: 0 };

    portalFiles.forEach((f) => {
      const cat = resolveCategory(f);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.general++;
    });

    for (const [cat, count] of Object.entries(counts)) {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = count;
    }
  }

  // ─── 12. Filter & Sort Documents ──────────────────────────────
  function getFilteredAndSortedFiles() {
    let result = portalFiles.slice();

    // 1. Category Filter
    if (currentCategory !== 'all') {
      result = result.filter((f) => resolveCategory(f) === currentCategory);
    }

    // 2. Keyword Search
    if (currentSearchQuery) {
      result = result.filter((f) => {
        const name = (f.originalName || '').toLowerCase();
        const cat = resolveCategory(f);
        return name.includes(currentSearchQuery) || cat.includes(currentSearchQuery);
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (currentSort === 'newest') {
        return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
      }
      if (currentSort === 'downloads') {
        return (b.downloads || 0) - (a.downloads || 0);
      }
      if (currentSort === 'name-asc') {
        return (a.originalName || '').localeCompare(b.originalName || '');
      }
      if (currentSort === 'name-desc') {
        return (b.originalName || '').localeCompare(a.originalName || '');
      }
      if (currentSort === 'size-desc') {
        return (b.size || 0) - (a.size || 0);
      }
      if (currentSort === 'size-asc') {
        return (a.size || 0) - (b.size || 0);
      }
      return 0;
    });

    return result;
  }

  // ─── 13. Render Documents in Current View Mode ────────────────
  function renderDocuments() {
    const grid = document.getElementById('documents-grid');
    const tableWrapper = document.getElementById('documents-table-wrapper');
    const tbody = document.getElementById('documents-tbody');
    const empty = document.getElementById('empty-state');
    const countNum = document.getElementById('docs-count-num');
    const statFiles = document.getElementById('stat-files');

    const files = getFilteredAndSortedFiles();

    if (countNum) countNum.textContent = files.length;
    if (statFiles) statFiles.textContent = portalFiles.length;

    if (files.length === 0) {
      if (empty) {
        empty.style.display = 'block';
        const desc = document.getElementById('empty-state-desc');
        if (desc) {
          if (currentSearchQuery) {
            desc.textContent = `No documents matched "${currentSearchQuery}". Try adjusting your keywords.`;
          } else if (currentCategory !== 'all') {
            desc.textContent = `No documents found in ${getCategoryLabel(currentCategory)}. Check "All Documents".`;
          } else {
            desc.textContent = 'Documents will appear here once uploaded by the portal administrator.';
          }
        }
      }
      if (grid) grid.innerHTML = '';
      if (tbody) tbody.innerHTML = '';
      if (grid) grid.style.display = 'none';
      if (tableWrapper) tableWrapper.style.display = 'none';
      return;
    }

    if (empty) empty.style.display = 'none';

    if (currentViewMode === 'table') {
      if (grid) grid.style.display = 'none';
      if (tableWrapper) tableWrapper.style.display = 'block';
      if (tbody) {
        tbody.innerHTML = '';
        files.forEach((f) => tbody.appendChild(createDocTableRow(f)));
      }
    } else {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = '';
        files.forEach((f) => grid.appendChild(createDocCard(f)));
      }
    }
  }

  // ─── 14. Fetch All Documents from Server ──────────────────────
  async function loadDocuments() {
    const loading = document.getElementById('loading-state');
    try {
      const res = await fetch('/api/pdfs');
      portalFiles = await res.json();
      if (!Array.isArray(portalFiles)) portalFiles = [];

      if (loading) loading.style.display = 'none';
      updateCategoryCounts();
      renderDocuments();
    } catch (e) {
      if (loading) loading.style.display = 'none';
      renderDocuments();
    }
  }

  // Listen for client document uploads & scans from the Neural Scanner
  window.addEventListener('vault:docUploaded', (e) => {
    loadDocuments();
    if (e.detail && e.detail.originalName) {
      showPortalToast(`✓ Scanned & ready: "${e.detail.originalName}"`);
    }
  });

  // ─── 15. Setup Filter Pills, Sort & View Mode Listeners ────────
  function initControls() {
    // 1. Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        currentSearchQuery = searchInput.value.toLowerCase().trim();
        renderDocuments();
      });
    }

    // 2. Category Pills
    const pills = document.querySelectorAll('.cat-pill-btn');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');
        currentCategory = pill.getAttribute('data-category') || 'all';
        renderDocuments();
      });
    });

    // 3. Sort Select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderDocuments();
      });
    }

    // 4. View Switcher
    const gridBtn = document.getElementById('view-grid-btn');
    const tableBtn = document.getElementById('view-table-btn');
    if (gridBtn && tableBtn) {
      gridBtn.addEventListener('click', () => {
        currentViewMode = 'grid';
        gridBtn.classList.add('active');
        gridBtn.setAttribute('aria-pressed', 'true');
        tableBtn.classList.remove('active');
        tableBtn.setAttribute('aria-pressed', 'false');
        renderDocuments();
      });

      tableBtn.addEventListener('click', () => {
        currentViewMode = 'table';
        tableBtn.classList.add('active');
        tableBtn.setAttribute('aria-pressed', 'true');
        gridBtn.classList.remove('active');
        gridBtn.setAttribute('aria-pressed', 'false');
        renderDocuments();
      });
    }
  }

  // ─── 16. Sticky header & scroll observer ───────────────────────
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

  // ─── 17. Mobile menu toggle ────────────────────────────────────
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

  // ─── 18. Nav Scroll Spy: highlight Documents vs About ─────────
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

  // ─── 19. Viewport Scroll Reveals (IntersectionObserver) ───────
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

  // ─── 20. Subtle 3D Tilt on Floating Hero Shield ───────────────
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
    initControls();
    initPdfModal();
    initReportModal();
    initHeader();
    initMobileMenu();
    initScrollSpy();
    initScrollReveal();
    initHeroTilt();
  });
})();
