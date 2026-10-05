/**
 * ═══════════════════════════════════════════════════════════════════════
 *  VAULT SECURE SHARE: SELF-DESTRUCTING LINK MODAL LOGIC
 * ═══════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  let activeFilename = null;
  let activeTitle = null;

  let backdrop = null;
  let docPreview = null;
  let expirySelect = null;
  let viewsSelect = null;
  let passwordInput = null;
  let allowDownloadCheck = null;
  let generateBtn = null;
  let resultBox = null;
  let resultInput = null;
  let copyBtn = null;

  function createModalUI() {
    if (document.getElementById('vault-share-modal-root')) return;

    backdrop = document.createElement('div');
    backdrop.id = 'vault-share-modal-root';
    backdrop.className = 'share-modal-backdrop';

    backdrop.innerHTML = `
      <div class="share-modal-card" role="dialog" aria-modal="true" aria-label="Generate Self-Destructing Share Link">
        <div class="share-modal-header">
          <div class="share-modal-icon-title">
            <div class="share-modal-flame">🔥</div>
            <div>
              <h3 class="share-modal-title">Self-Destructing Link</h3>
              <p class="share-modal-subtitle">Zero-knowledge expiring relay with view burn</p>
            </div>
          </div>
          <button class="share-modal-close" id="share-modal-close-btn">&times;</button>
        </div>

        <div class="share-doc-preview">
          <span>📄</span>
          <span id="share-modal-doc-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Document.pdf</span>
        </div>

        <form id="share-generator-form">
          <div class="share-form-group">
            <label class="share-form-label">Auto Self-Destruct Timer</label>
            <select class="share-select" id="share-expiry-select">
              <option value="1">⏳ 1 Hour (High Security / Fast Burn)</option>
              <option value="6">⏳ 6 Hours</option>
              <option value="24" selected>⏳ 24 Hours (Standard)</option>
              <option value="72">⏳ 3 Days</option>
              <option value="168">⏳ 7 Days</option>
              <option value="">♾️ No Time Expiration</option>
            </select>
          </div>

          <div class="share-form-group">
            <label class="share-form-label">Maximum View Limit</label>
            <select class="share-select" id="share-views-select">
              <option value="1" selected>🔥 1 View (Burn-After-Reading — Instant Shred)</option>
              <option value="3">👁️ 3 Views</option>
              <option value="5">👁️ 5 Views</option>
              <option value="10">👁️ 10 Views</option>
              <option value="">♾️ Unlimited Views</option>
            </select>
          </div>

          <div class="share-form-group">
            <label class="share-form-label">Access Cipher / Password (Optional)</label>
            <input type="password" class="share-input" id="share-password-input" placeholder="Leave blank for no password...">
          </div>

          <div class="share-form-group" style="margin-bottom: 6px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; color:#cbd5e1; cursor:pointer;">
              <input type="checkbox" id="share-allow-download" checked style="accent-color:#a855f7;">
              <span>Allow recipient to download raw PDF file</span>
            </label>
          </div>

          <button type="submit" class="share-btn-generate" id="share-generate-btn">
            <span>🔥</span>
            <span>Generate Self-Destructing Link</span>
          </button>
        </form>

        <!-- Result Box -->
        <div class="share-result-box" id="share-result-box">
          <div class="share-result-header">
            <span>✓</span>
            <span>Secure Link Ready (Burn Policy Armed)</span>
          </div>
          <div class="share-link-input-wrap">
            <input type="text" class="share-link-input" id="share-link-result-url" readonly>
            <button type="button" class="share-btn-copy" id="share-btn-copy">Copy</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    docPreview = document.getElementById('share-modal-doc-name');
    expirySelect = document.getElementById('share-expiry-select');
    viewsSelect = document.getElementById('share-views-select');
    passwordInput = document.getElementById('share-password-input');
    allowDownloadCheck = document.getElementById('share-allow-download');
    generateBtn = document.getElementById('share-generate-btn');
    resultBox = document.getElementById('share-result-box');
    resultInput = document.getElementById('share-link-result-url');
    copyBtn = document.getElementById('share-btn-copy');

    // Close
    document.getElementById('share-modal-close-btn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('active')) closeModal();
    });

    // Form submission
    document.getElementById('share-generator-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeFilename) return;

      generateBtn.disabled = true;
      generateBtn.innerHTML = '<span>Arming cryptographic relay...</span>';

      try {
        const payload = {
          filename: activeFilename,
          expiresInHours: expirySelect.value ? Number(expirySelect.value) : null,
          maxViews: viewsSelect.value ? Number(viewsSelect.value) : null,
          password: passwordInput.value.trim() || null,
          allowDownload: allowDownloadCheck.checked
        };

        const res = await fetch('/api/share/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.shareUrl) {
          resultInput.value = data.shareUrl;
          resultBox.style.display = 'block';

          // Auto copy
          navigator.clipboard.writeText(data.shareUrl).catch(() => {});
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 3000);

          if (window.VaultTracker) {
            window.VaultTracker.log(`Created Share Link: ${activeTitle} (MaxViews: ${payload.maxViews || 'Unlimited'})`);
          }
        } else {
          alert(data.error || 'Failed to generate secure share link.');
        }
      } catch (err) {
        alert('Network communication error generating share link.');
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>🔥</span><span>Generate Self-Destructing Link</span>';
      }
    });

    // Copy Button
    copyBtn.addEventListener('click', () => {
      resultInput.select();
      navigator.clipboard.writeText(resultInput.value).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });
  }

  function openModal(filename, title) {
    createModalUI();
    activeFilename = filename;
    activeTitle = title || filename;

    docPreview.textContent = activeTitle;
    resultBox.style.display = 'none';
    resultInput.value = '';
    passwordInput.value = '';
    viewsSelect.value = '1'; // Default to Burn after reading!
    expirySelect.value = '24';

    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Intercept click on any .doc-share-btn or .btn-doc-share-secure
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.doc-share-btn') || e.target.closest('.btn-doc-share-secure') || e.target.closest('[data-doc-share]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const fn = btn.getAttribute('data-filename') || btn.closest('[data-filename]')?.getAttribute('data-filename');
      const title = btn.getAttribute('data-title') || btn.closest('[data-name]')?.getAttribute('data-name') || fn;
      if (fn) {
        openModal(fn, title);
      }
    }
  });

  window.VaultShareModal = {
    open: openModal,
    close: closeModal
  };
})();
