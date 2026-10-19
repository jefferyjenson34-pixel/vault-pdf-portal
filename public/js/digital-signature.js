/**
 * ═════════════════════════════════════════════════════════════════════
 *  VAULT PDF PORTAL — DIGITAL SIGNATURES & CRYPTOGRAPHIC NOTARY
 *  Interactive Canvas Signing, Typography Signatures, Certificate Modal
 * ═════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  let currentDoc = null;
  let activeTab = 'draw';
  let inkColor = '#000000';
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let hasDrawn = false;
  let uploadedSigData = null;

  const FONTS = [
    { id: 'caveat', name: 'Executive Modern', family: "'Caveat', cursive" },
    { id: 'dancing', name: 'Diplomatic Script', family: "'Dancing Script', cursive" },
    { id: 'brush', name: 'Classic Calligraphy', family: "'Alex Brush', cursive" },
    { id: 'vibes', name: 'Prestige Flourish', family: "'Great Vibes', cursive" }
  ];
  let selectedFontId = 'caveat';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectDOM() {
    if (document.getElementById('vault-signature-modal-root')) return;

    const root = document.createElement('div');
    root.id = 'vault-signature-modal-root';
    root.className = 'vault-sig-modal-backdrop';

    root.innerHTML = `
      <div class="vault-sig-modal-card" role="dialog" aria-modal="true" aria-label="Sign Document Digitally">
        <!-- Header -->
        <div class="vault-sig-header">
          <div class="vault-sig-title-wrap">
            <div class="vault-sig-icon-badge">🖋️</div>
            <div>
              <h3>Sign Document Digitally</h3>
              <p>Cryptographic signature with tamper-evident Certificate of Completion</p>
            </div>
          </div>
          <button type="button" class="vault-sig-close-btn" id="vault-sig-close-x">&times;</button>
        </div>

        <!-- Body -->
        <div class="vault-sig-body">
          <!-- Target Document Info -->
          <div class="vault-sig-target-doc">
            <div class="vault-sig-target-info">
              <span style="font-size:1.15rem;">📄</span>
              <span id="vault-sig-doc-title">Select Document...</span>
            </div>
            <div class="vault-sig-badge-secure">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>SHA-256 Protected</span>
            </div>
          </div>

          <!-- Mode Selector Tabs -->
          <div class="vault-sig-tabs">
            <button type="button" class="vault-sig-tab-btn active" data-tab="draw">
              <span>✍️</span> Draw
            </button>
            <button type="button" class="vault-sig-tab-btn" data-tab="type">
              <span>⌨️</span> Type
            </button>
            <button type="button" class="vault-sig-tab-btn" data-tab="upload">
              <span>📤</span> Upload
            </button>
          </div>

          <!-- Tab 1: Draw -->
          <div class="vault-sig-panel active" id="vault-sig-panel-draw">
            <div class="vault-sig-canvas-container">
              <canvas id="vault-signature-canvas"></canvas>
              <div class="vault-sig-canvas-baseline"></div>
              <div class="vault-sig-canvas-watermark">VAULT CRYPTO SEAL</div>
            </div>
            <div class="vault-sig-canvas-toolbar">
              <div class="vault-sig-color-picks">
                <div class="vault-sig-color-dot active" data-color="#000000" style="background:#000000;" title="Obsidian Black"></div>
                <div class="vault-sig-color-dot" data-color="#1e3a8a" style="background:#1e3a8a;" title="Royal Navy"></div>
                <div class="vault-sig-color-dot" data-color="#047857" style="background:#047857;" title="Cyber Emerald"></div>
                <div class="vault-sig-color-dot" data-color="#b91c1c" style="background:#b91c1c;" title="Crimson Red"></div>
              </div>
              <button type="button" class="vault-sig-btn-clear" id="vault-sig-canvas-clear">Clear Signature</button>
            </div>
          </div>

          <!-- Tab 2: Type -->
          <div class="vault-sig-panel" id="vault-sig-panel-type">
            <input type="text" class="vault-sig-input" id="vault-sig-type-input" placeholder="Type your full legal name..." maxlength="50" autocomplete="name">
            <div class="vault-sig-font-options" id="vault-sig-font-list"></div>
          </div>

          <!-- Tab 3: Upload -->
          <div class="vault-sig-panel" id="vault-sig-panel-upload">
            <div class="vault-sig-dropzone" id="vault-sig-dropzone">
              <div class="vault-sig-dropzone-icon">📷</div>
              <p style="margin:0; font-size:0.88rem; color:#cbd5e1; font-weight:600;">Drag & drop your signature image here</p>
              <p style="margin:4px 0 0; font-size:0.75rem; color:#64748b;">Supports PNG, JPG, WebP. Light backgrounds are auto-cleaned.</p>
              <input type="file" id="vault-sig-file-input" accept="image/*" style="display:none;">
            </div>
            <img id="vault-sig-upload-preview" class="vault-sig-upload-preview" alt="Signature preview">
          </div>

          <!-- Signer Identity Fields -->
          <div class="vault-sig-grid-fields">
            <div class="vault-sig-field">
              <label for="vault-sig-name">Signer Full Legal Name *</label>
              <input type="text" class="vault-sig-input" id="vault-sig-name" placeholder="e.g. John Doe" required>
            </div>
            <div class="vault-sig-field">
              <label for="vault-sig-email">Signer Email Address *</label>
              <input type="email" class="vault-sig-input" id="vault-sig-email" placeholder="e.g. john@company.com" required>
            </div>
          </div>

          <div class="vault-sig-grid-fields">
            <div class="vault-sig-field">
              <label for="vault-sig-role">Signer Title / Role</label>
              <input type="text" class="vault-sig-input" id="vault-sig-role" placeholder="e.g. Authorized Signatory, Director">
            </div>
            <div class="vault-sig-field">
              <label for="vault-sig-reason">Signing Purpose / Reason</label>
              <input type="text" class="vault-sig-input" id="vault-sig-reason" placeholder="e.g. Approved and Accepted">
            </div>
          </div>

          <!-- Legal & Compliance Notice -->
          <div class="vault-sig-legal-note">
            By signing, you agree that your digital signature, cryptographic SHA-256 fingerprint, client IP address, and timestamp will be permanently linked in a tamper-evident Certificate of Completion compliant with electronic signature standards (ESIGN &amp; eIDAS).
          </div>

          <!-- Submit Button -->
          <button type="button" class="vault-sig-btn-submit" id="vault-sig-submit-btn">
            <span>🛡️</span>
            <span>Sign &amp; Generate Certificate of Completion</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Certificate View Modal Root
    const certRoot = document.createElement('div');
    certRoot.id = 'vault-certificate-modal-root';
    certRoot.className = 'vault-sig-modal-backdrop';
    document.body.appendChild(certRoot);

    bindEvents();
    initCanvas();
    renderTypeFonts();
  }

  function bindEvents() {
    const root = document.getElementById('vault-signature-modal-root');
    const closeBtn = document.getElementById('vault-sig-close-x');
    const submitBtn = document.getElementById('vault-sig-submit-btn');

    closeBtn.addEventListener('click', closeSignatureModal);
    root.addEventListener('click', (e) => {
      if (e.target === root) closeSignatureModal();
    });

    // Tab buttons
    root.querySelectorAll('.vault-sig-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.vault-sig-tab-btn').forEach(b => b.classList.remove('active'));
        root.querySelectorAll('.vault-sig-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        const panel = document.getElementById(`vault-sig-panel-${activeTab}`);
        if (panel) panel.classList.add('active');

        if (activeTab === 'draw') {
          resizeCanvas();
        }
      });
    });

    // Color pickers
    root.querySelectorAll('.vault-sig-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        root.querySelectorAll('.vault-sig-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        inkColor = dot.getAttribute('data-color') || '#000000';
        updateTypeColor();
      });
    });

    // Type input
    const typeInput = document.getElementById('vault-sig-type-input');
    typeInput.addEventListener('input', () => {
      const val = typeInput.value.trim() || 'Your Signature';
      root.querySelectorAll('.vault-sig-font-preview').forEach(p => {
        p.textContent = val;
      });
      // Auto-fill legal name if empty
      const nameInput = document.getElementById('vault-sig-name');
      if (!nameInput.value.trim()) {
        nameInput.value = typeInput.value.trim();
      }
    });

    // Upload Dropzone
    const dropzone = document.getElementById('vault-sig-dropzone');
    const fileInput = document.getElementById('vault-sig-file-input');
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedSignature(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processUploadedSignature(e.target.files[0]);
      }
    });

    // Submit
    submitBtn.addEventListener('click', submitSignature);
  }

  function initCanvas() {
    canvas = document.getElementById('vault-signature-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    const clearBtn = document.getElementById('vault-sig-canvas-clear');
    clearBtn.addEventListener('click', clearCanvas);

    // Pointer events for mouse & touch
    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    });

    window.addEventListener('mouseup', () => { isDrawing = false; });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isDrawing = false; });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && (canvas.width !== rect.width || canvas.height !== rect.height)) {
      // Save content if any
      const tempImg = hasDrawn ? canvas.toDataURL() : null;
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (tempImg) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = tempImg;
      }
    }
  }

  function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
  }

  function renderTypeFonts() {
    const list = document.getElementById('vault-sig-font-list');
    if (!list) return;
    list.innerHTML = '';

    FONTS.forEach(f => {
      const card = document.createElement('div');
      card.className = `vault-sig-font-card ${f.id === selectedFontId ? 'active' : ''}`;
      card.setAttribute('data-font-id', f.id);
      card.innerHTML = `
        <div class="vault-sig-font-preview" style="font-family:${f.family}; color:${inkColor};">
          Your Signature
        </div>
      `;
      card.addEventListener('click', () => {
        list.querySelectorAll('.vault-sig-font-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedFontId = f.id;
      });
      list.appendChild(card);
    });
  }

  function updateTypeColor() {
    const list = document.getElementById('vault-sig-font-list');
    if (!list) return;
    list.querySelectorAll('.vault-sig-font-preview').forEach(p => {
      p.style.color = inkColor;
    });
  }

  function processUploadedSignature(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Render onto offscreen canvas to clean off-white background
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const oCtx = offCanvas.getContext('2d');
        oCtx.drawImage(img, 0, 0);

        const imgData = oCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const d = imgData.data;
        // Make light / off-white pixels fully transparent
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          // Brightness threshold
          if (r > 200 && g > 200 && b > 200) {
            d[i + 3] = 0; // Alpha transparent
          }
        }
        oCtx.putImageData(imgData, 0, 0);
        uploadedSigData = offCanvas.toDataURL('image/png');

        const prevEl = document.getElementById('vault-sig-upload-preview');
        if (prevEl) {
          prevEl.src = uploadedSigData;
          prevEl.style.display = 'block';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderTypedSignatureToPNG() {
    const typeInput = document.getElementById('vault-sig-type-input');
    const text = (typeInput.value || '').trim() || 'Signature';
    const fontObj = FONTS.find(f => f.id === selectedFontId) || FONTS[0];

    const offCanvas = document.createElement('canvas');
    offCanvas.width = 500;
    offCanvas.height = 140;
    const oCtx = offCanvas.getContext('2d');

    oCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
    oCtx.font = `64px ${fontObj.family}`;
    oCtx.fillStyle = inkColor;
    oCtx.textAlign = 'center';
    oCtx.textBaseline = 'middle';
    oCtx.fillText(text, offCanvas.width / 2, offCanvas.height / 2);

    return offCanvas.toDataURL('image/png');
  }

  async function submitSignature() {
    const submitBtn = document.getElementById('vault-sig-submit-btn');
    const nameInput = document.getElementById('vault-sig-name');
    const emailInput = document.getElementById('vault-sig-email');
    const roleInput = document.getElementById('vault-sig-role');
    const reasonInput = document.getElementById('vault-sig-reason');

    const signerName = (nameInput.value || '').trim();
    const signerEmail = (emailInput.value || '').trim();

    if (!signerName) {
      alert('Please enter your full legal name.');
      nameInput.focus();
      return;
    }
    if (!signerEmail || !signerEmail.includes('@')) {
      alert('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    let sigImage = null;
    if (activeTab === 'draw') {
      if (!hasDrawn) {
        alert('Please draw your signature on the canvas first.');
        return;
      }
      sigImage = canvas.toDataURL('image/png');
    } else if (activeTab === 'type') {
      const typeInput = document.getElementById('vault-sig-type-input');
      if (!typeInput.value.trim()) {
        alert('Please type your name for the signature.');
        typeInput.focus();
        return;
      }
      sigImage = renderTypedSignatureToPNG();
    } else if (activeTab === 'upload') {
      if (!uploadedSigData) {
        alert('Please upload an image of your signature.');
        return;
      }
      sigImage = uploadedSigData;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳</span> <span>Generating Cryptographic Certificate...</span>`;

    try {
      const payload = {
        filename: currentDoc ? (currentDoc.filename || currentDoc.id) : null,
        docTitle: currentDoc ? (currentDoc.originalName || currentDoc.filename) : 'Document.pdf',
        fileData: currentDoc ? currentDoc.fileData : null,
        signerName,
        signerEmail,
        signerRole: roleInput.value.trim() || 'Authorized Signatory',
        reason: reasonInput.value.trim() || 'Formal Document Approval & Acceptance',
        signatureData: sigImage,
        signatureType: activeTab
      };

      const res = await fetch('/api/signatures/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign document.');
      }

      closeSignatureModal();
      openCertificateModal(data.certificate);

      // Trigger custom notification event
      window.dispatchEvent(new CustomEvent('vault:docSigned', { detail: data.certificate }));
    } catch (err) {
      alert('Signature Error: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🛡️</span> <span>Sign &amp; Generate Certificate of Completion</span>`;
    }
  }

  function openSignatureModal(doc) {
    injectDOM();
    currentDoc = doc || { filename: 'Document.pdf', originalName: 'Vault Document.pdf' };

    const titleEl = document.getElementById('vault-sig-doc-title');
    if (titleEl) {
      titleEl.textContent = currentDoc.originalName || currentDoc.filename || 'Document.pdf';
    }

    const backdrop = document.getElementById('vault-signature-modal-root');
    backdrop.classList.add('active');

    setTimeout(() => {
      resizeCanvas();
    }, 150);
  }

  function closeSignatureModal() {
    const backdrop = document.getElementById('vault-signature-modal-root');
    if (backdrop) backdrop.classList.remove('active');
  }

  // ─── Certificate Modal ──────────────────────────────────────────────
  function openCertificateModal(cert) {
    injectDOM();
    const certRoot = document.getElementById('vault-certificate-modal-root');
    if (!certRoot || !cert) return;

    const formattedDate = new Date(cert.signedAt).toUTCString();
    const verifyUrl = `${window.location.origin}/verify-certificate.html?id=${encodeURIComponent(cert.id)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verifyUrl)}`;

    certRoot.innerHTML = `
      <div class="vault-sig-modal-card" style="max-width:760px;" role="dialog" aria-modal="true" aria-label="Certificate of Completion">
        <div class="vault-cert-card" id="vault-printable-cert">
          <!-- Close button -->
          <button type="button" class="vault-sig-close-btn" id="vault-cert-close-btn" style="position:absolute; top:20px; right:20px; z-index:10;">&times;</button>

          <div class="vault-cert-header">
            <div class="vault-cert-seal">🛡️</div>
            <h2>Certificate of Completion</h2>
            <div class="cert-subtitle">Vault Cryptographic Notary &amp; Forensic Audit Record</div>
          </div>

          <!-- Document & Signer Metadata Grid -->
          <div class="vault-cert-meta-grid">
            <div class="vault-cert-row">
              <span class="vault-cert-label">Certificate Identifier</span>
              <span class="vault-cert-val mono">${escapeHtml(cert.id)}</span>
            </div>
            <div class="vault-cert-row">
              <span class="vault-cert-label">Date &amp; Time (UTC)</span>
              <span class="vault-cert-val">${escapeHtml(formattedDate)}</span>
            </div>
            <div class="vault-cert-row" style="grid-column: 1 / -1;">
              <span class="vault-cert-label">Document Title</span>
              <span class="vault-cert-val">${escapeHtml(cert.docTitle)}</span>
            </div>
            <div class="vault-cert-row" style="grid-column: 1 / -1;">
              <span class="vault-cert-label">Document SHA-256 Fingerprint</span>
              <span class="vault-cert-val mono" style="font-size:0.7rem;">${escapeHtml(cert.docHash)}</span>
            </div>
            <div class="vault-cert-row">
              <span class="vault-cert-label">Signer Legal Name</span>
              <span class="vault-cert-val">${escapeHtml(cert.signerName)}</span>
            </div>
            <div class="vault-cert-row">
              <span class="vault-cert-label">Signer Verified Email</span>
              <span class="vault-cert-val">${escapeHtml(cert.signerEmail)}</span>
            </div>
            <div class="vault-cert-row">
              <span class="vault-cert-label">Signer Role / Capacity</span>
              <span class="vault-cert-val">${escapeHtml(cert.signerRole || 'Authorized Signatory')}</span>
            </div>
            <div class="vault-cert-row">
              <span class="vault-cert-label">Forensic Network IP &amp; Geolocation</span>
              <span class="vault-cert-val">${escapeHtml(cert.signerGeo?.flag || '🌐')} ${escapeHtml(cert.signerIp)} (${escapeHtml(cert.signerGeo?.country || 'Verified')})</span>
            </div>
            <div class="vault-cert-row" style="grid-column: 1 / -1;">
              <span class="vault-cert-label">Tamper-Proof Audit Checksum</span>
              <span class="vault-cert-val mono" style="font-size:0.68rem; color:#059669;">${escapeHtml(cert.checksum)}</span>
            </div>
          </div>

          <!-- Signature Stamp & Security Badge -->
          <div class="vault-cert-signature-area">
            <div class="vault-cert-sign-img-wrap">
              <img src="${cert.signatureData}" class="vault-cert-sign-img" alt="Digital Signature">
              <div class="vault-cert-sign-rule">${escapeHtml(cert.signerName)} (${escapeHtml(cert.signerRole || 'Signatory')})</div>
            </div>

            <div style="display:flex; align-items:center; gap:14px;">
              <img src="${qrUrl}" width="70" height="70" style="border-radius:6px; border:1px solid #cbd5e1;" alt="Verification QR Code" title="Scan to verify on mobile">
              <div class="vault-cert-badge-valid">
                <div class="valid-title">
                  <span>✓</span>
                  <span>CRYPTOGRAPHICALLY SEALED</span>
                </div>
                <div class="valid-desc">UNALTERED &bull; ESIGN COMPLIANT</div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="vault-cert-actions">
            <button type="button" class="vault-cert-btn vault-cert-btn-secondary" id="vault-cert-copy-link">
              <span>🔗</span> Copy Verify Link
            </button>
            <button type="button" class="vault-cert-btn vault-cert-btn-secondary" id="vault-cert-download-json">
              <span>📥</span> Export Audit JSON
            </button>
            <button type="button" class="vault-cert-btn vault-cert-btn-primary" id="vault-cert-print">
              <span>🖨️</span> Print / Save Certificate
            </button>
          </div>
        </div>
      </div>
    `;

    certRoot.classList.add('active');

    // Bind certificate action buttons
    document.getElementById('vault-cert-close-btn').addEventListener('click', () => {
      certRoot.classList.remove('active');
    });

    document.getElementById('vault-cert-copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(verifyUrl).then(() => {
        const btn = document.getElementById('vault-cert-copy-link');
        btn.innerHTML = `<span>✓</span> Copied Link!`;
        setTimeout(() => {
          btn.innerHTML = `<span>🔗</span> Copy Verify Link`;
        }, 2000);
      });
    });

    document.getElementById('vault-cert-download-json').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${cert.id}_audit_manifest.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById('vault-cert-print').addEventListener('click', () => {
      window.print();
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────
  window.VaultDigitalSignature = {
    open: openSignatureModal,
    close: closeSignatureModal,
    openCertificate: async function(certId) {
      try {
        const res = await fetch(`/api/signatures/certificate/${encodeURIComponent(certId)}`);
        const data = await res.json();
        if (data.success && data.certificate) {
          openCertificateModal(data.certificate);
        } else {
          alert('Certificate not found: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Failed to load certificate: ' + e.message);
      }
    }
  };

})();
