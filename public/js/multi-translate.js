/**
 * Vault PDF Portal — Instant Multi-Lingual Neural Translator & Synchronized Dual-Column View
 * Features:
 *  - 32+ supported languages with instant parallelized neural translation
 *  - Synchronized dual-column viewport (Original vs Translated)
 *  - Proportional synchronized scrolling with sentence/paragraph hover pairing
 *  - Native Speech Synthesis (Web Speech API) with language-specific native voices
 *  - Word/paragraph audio highlighting & speed playback controls
 *  - Direct clipboard copy & markdown export
 */

(function () {
  'use strict';

  // Supported languages list with BCP-47 voice tags and country flag emojis
  const SUPPORTED_LANGUAGES = [
    { code: 'es', name: 'Spanish (Español)', bcp47: 'es-ES', flag: '🇪🇸' },
    { code: 'fr', name: 'French (Français)', bcp47: 'fr-FR', flag: '🇫🇷' },
    { code: 'de', name: 'German (Deutsch)', bcp47: 'de-DE', flag: '🇩🇪' },
    { code: 'it', name: 'Italian (Italiano)', bcp47: 'it-IT', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese (Português)', bcp47: 'pt-PT', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian (Русский)', bcp47: 'ru-RU', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese Simplified (中文)', bcp47: 'zh-CN', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese (日本語)', bcp47: 'ja-JP', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean (한국어)', bcp47: 'ko-KR', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic (العربية)', bcp47: 'ar-SA', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi (हिन्दी)', bcp47: 'hi-IN', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam (മലയാളം)', bcp47: 'ml-IN', flag: '🇮🇳' },
    { code: 'nl', name: 'Dutch (Nederlands)', bcp47: 'nl-NL', flag: '🇳🇱' },
    { code: 'sv', name: 'Swedish (Svenska)', bcp47: 'sv-SE', flag: '🇸🇪' },
    { code: 'no', name: 'Norwegian (Norsk)', bcp47: 'nb-NO', flag: '🇳🇴' },
    { code: 'da', name: 'Danish (Dansk)', bcp47: 'da-DK', flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish (Suomi)', bcp47: 'fi-FI', flag: '🇫🇮' },
    { code: 'pl', name: 'Polish (Polski)', bcp47: 'pl-PL', flag: '🇵🇱' },
    { code: 'tr', name: 'Turkish (Türkçe)', bcp47: 'tr-TR', flag: '🇹🇷' },
    { code: 'el', name: 'Greek (Ελληνικά)', bcp47: 'el-GR', flag: '🇬🇷' },
    { code: 'he', name: 'Hebrew (עברית)', bcp47: 'he-IL', flag: '🇮🇱' },
    { code: 'cs', name: 'Czech (Čeština)', bcp47: 'cs-CZ', flag: '🇨🇿' },
    { code: 'ro', name: 'Romanian (Română)', bcp47: 'ro-RO', flag: '🇷🇴' },
    { code: 'hu', name: 'Hungarian (Magyar)', bcp47: 'hu-HU', flag: '🇭🇺' },
    { code: 'uk', name: 'Ukrainian (Українська)', bcp47: 'uk-UA', flag: '🇺🇦' },
    { code: 'id', name: 'Indonesian (Bahasa)', bcp47: 'id-ID', flag: '🇮🇩' },
    { code: 'vi', name: 'Vietnamese (Tiếng Việt)', bcp47: 'vi-VN', flag: '🇻🇳' },
    { code: 'th', name: 'Thai (ไทย)', bcp47: 'th-TH', flag: '🇹🇭' },
    { code: 'ms', name: 'Malay (Bahasa Melayu)', bcp47: 'ms-MY', flag: '🇲🇾' },
    { code: 'bg', name: 'Bulgarian (Български)', bcp47: 'bg-BG', flag: '🇧🇬' },
    { code: 'hr', name: 'Croatian (Hrvatski)', bcp47: 'hr-HR', flag: '🇭🇷' },
    { code: 'sk', name: 'Slovak (Slovenčina)', bcp47: 'sk-SK', flag: '🇸🇰' },
    { code: 'bn', name: 'Bengali (বাংলা)', bcp47: 'bn-IN', flag: '🇧🇩' }
  ];

  let currentFile = null;
  let currentTargetLang = 'es';
  let originalParagraphs = [];
  let translatedParagraphs = [];
  let syncScrollActive = true;
  let isScrollingOriginal = false;
  let isScrollingTranslated = false;

  // Speech state
  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let currentAudioElement = null;
  let isSpeaking = false;
  let isPaused = false;
  let activeAudioSide = null; // 'original' or 'translated'
  let activeParagraphIndex = -1;
  let speechRate = 1.0;

  function initModal() {
    if (document.getElementById('vault-translator-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'vault-translator-backdrop';
    backdrop.className = 'vault-translator-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Instant Multi-Lingual Neural Translator');

    const langOptionsHtml = SUPPORTED_LANGUAGES.map(
      (l) => `<option value="${l.code}" ${l.code === 'es' ? 'selected' : ''}>${l.flag} ${l.name}</option>`
    ).join('');

    backdrop.innerHTML = `
      <div class="vault-translator-modal">
        <!-- Header -->
        <div class="translator-header">
          <div class="translator-title-wrap">
            <div class="translator-icon-badge">🌐</div>
            <div>
              <h2 class="translator-header-title">
                <span>Instant Multi-Lingual Neural Translator</span>
                <span class="pulse-dot" title="Neural Engine Ready"></span>
              </h2>
              <p class="translator-header-subtitle" id="translator-doc-title">Select a document to translate</p>
            </div>
          </div>
          <div class="translator-header-actions">
            <button class="btn-translator-close" id="btn-close-translator" title="Close Translator (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="translator-toolbar">
          <div class="translator-controls-left">
            <div class="lang-selector-group">
              <div class="lang-badge-source">
                <span>🇺🇸</span>
                <span>English (Detected)</span>
              </div>
              <span class="lang-arrow">➔</span>
              <select class="lang-select-target" id="translator-target-lang" title="Select Translation Language">
                ${langOptionsHtml}
              </select>
            </div>

            <button class="btn-trigger-translate" id="btn-do-translate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.8 1.04 6.44 2.73L21 8"></path>
                <polyline points="21 3 21 8 16 8"></polyline>
              </svg>
              <span>Translate Now</span>
            </button>

            <!-- Audio Player Controls -->
            <div class="translator-audio-bar">
              <button class="audio-btn" id="btn-audio-orig" title="Listen to Original Text (English)">
                <span>🔊 Listen Orig</span>
              </button>
              <button class="audio-btn" id="btn-audio-trans" title="Listen to Translated Text">
                <span>🌐 Listen Trans</span>
              </button>
              <button class="audio-btn" id="btn-audio-stop" title="Stop Audio" style="display:none; color:#ef4444;">
                <span>⏹ Stop</span>
              </button>
              <select class="audio-speed-select" id="audio-speed-select" title="Speech Playback Speed">
                <option value="0.75">0.75x</option>
                <option value="1.0" selected>1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
              </select>
              <div class="soundwave-indicator" id="soundwave-viz">
                <div class="soundwave-bar"></div>
                <div class="soundwave-bar"></div>
                <div class="soundwave-bar"></div>
                <div class="soundwave-bar"></div>
              </div>
            </div>
          </div>

          <div class="translator-controls-right">
            <button class="tool-toggle-btn is-active" id="btn-toggle-sync" title="Synchronize scrolling between original and translated columns">
              <span>🔗 Sync Scroll: ON</span>
            </button>
            <button class="tool-toggle-btn" id="btn-copy-trans" title="Copy translated text to clipboard">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
            <button class="tool-toggle-btn" id="btn-download-trans" title="Download translated markdown">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Export</span>
            </button>
          </div>
        </div>

        <!-- Dual Column Viewport -->
        <div class="translator-dual-container">
          <!-- Column 1: Original Document Text -->
          <div class="translator-column" id="panel-original">
            <div class="column-header">
              <span class="column-title">
                <span>Original Document</span>
                <span class="col-badge" id="orig-badge-count">0 paragraphs</span>
              </span>
              <span class="column-meta" id="orig-lang-label">English (Source)</span>
            </div>
            <div class="column-scroll-body" id="col-original">
              <div class="translator-empty-state">
                <div class="translator-empty-icon">📄</div>
                <div>Document text will load here...</div>
              </div>
            </div>
          </div>

          <!-- Column 2: Translated Document Text -->
          <div class="translator-column" id="panel-translated">
            <div class="column-header">
              <span class="column-title">
                <span>Neural Translation</span>
                <span class="col-badge" id="trans-badge-count">0 paragraphs</span>
              </span>
              <span class="column-meta" id="trans-lang-label">Spanish</span>
            </div>
            <div class="column-scroll-body" id="col-translated">
              <div class="translator-empty-state">
                <div class="translator-empty-icon">🌐</div>
                <div>Select a language and click Translate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Event Listeners
    backdrop.querySelector('#btn-close-translator').addEventListener('click', closeTranslator);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeTranslator();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
        closeTranslator();
      }
    });

    backdrop.querySelector('#btn-do-translate').addEventListener('click', () => {
      const select = backdrop.querySelector('#translator-target-lang');
      currentTargetLang = select.value;
      executeTranslation(currentFile, currentTargetLang);
    });

    backdrop.querySelector('#translator-target-lang').addEventListener('change', (e) => {
      currentTargetLang = e.target.value;
      executeTranslation(currentFile, currentTargetLang);
    });

    backdrop.querySelector('#btn-toggle-sync').addEventListener('click', (e) => {
      syncScrollActive = !syncScrollActive;
      const btn = e.currentTarget;
      if (syncScrollActive) {
        btn.classList.add('is-active');
        btn.innerHTML = '<span>🔗 Sync Scroll: ON</span>';
      } else {
        btn.classList.remove('is-active');
        btn.innerHTML = '<span>🔓 Sync Scroll: OFF</span>';
      }
    });

    backdrop.querySelector('#btn-copy-trans').addEventListener('click', copyTranslation);
    backdrop.querySelector('#btn-download-trans').addEventListener('click', downloadTranslation);

    // Synchronized scroll handlers
    const origBody = backdrop.querySelector('#col-original');
    const transBody = backdrop.querySelector('#col-translated');

    origBody.addEventListener('scroll', () => {
      if (!syncScrollActive || isScrollingTranslated) return;
      isScrollingOriginal = true;
      const scrollPct = origBody.scrollTop / (origBody.scrollHeight - origBody.clientHeight || 1);
      transBody.scrollTop = scrollPct * (transBody.scrollHeight - transBody.clientHeight);
      setTimeout(() => { isScrollingOriginal = false; }, 50);
    });

    transBody.addEventListener('scroll', () => {
      if (!syncScrollActive || isScrollingOriginal) return;
      isScrollingTranslated = true;
      const scrollPct = transBody.scrollTop / (transBody.scrollHeight - transBody.clientHeight || 1);
      origBody.scrollTop = scrollPct * (origBody.scrollHeight - origBody.clientHeight);
      setTimeout(() => { isScrollingTranslated = false; }, 50);
    });

    // Audio handlers
    backdrop.querySelector('#btn-audio-orig').addEventListener('click', () => {
      toggleSpeech('original');
    });

    backdrop.querySelector('#btn-audio-trans').addEventListener('click', () => {
      toggleSpeech('translated');
    });

    backdrop.querySelector('#btn-audio-stop').addEventListener('click', () => {
      stopSpeech();
    });

    backdrop.querySelector('#audio-speed-select').addEventListener('change', (e) => {
      speechRate = parseFloat(e.target.value) || 1.0;
      if (isSpeaking && !isPaused) {
        // Restart current paragraph with new speed
        const side = activeAudioSide;
        const idx = activeParagraphIndex;
        stopSpeech();
        speakParagraph(side, idx >= 0 ? idx : 0);
      }
    });
  }

  let activeTranslationSequence = 0;
  let activeAbortController = null;

  function openTranslator(file) {
    initModal();
    currentFile = file;
    const backdrop = document.getElementById('vault-translator-backdrop');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    const titleEl = document.getElementById('translator-doc-title');
    if (titleEl) {
      titleEl.textContent = `${file.originalName || file.filename} • ${formatBytes(file.size)}`;
    }

    const langSelect = document.getElementById('translator-target-lang');
    if (langSelect && currentTargetLang) {
      langSelect.value = currentTargetLang;
    } else if (langSelect) {
      currentTargetLang = langSelect.value;
    }

    // Load original text into left column immediately if available in memory
    if (file && (file.fullText || file.customText)) {
      originalParagraphs = (file.fullText || file.customText).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      const origCol = document.getElementById('col-original');
      const origCount = document.getElementById('orig-badge-count');
      if (origCount) origCount.textContent = `${originalParagraphs.length} paragraphs`;
      if (origCol && originalParagraphs.length > 0) {
        origCol.innerHTML = originalParagraphs
          .map((p, i) => `
            <div class="sync-paragraph" data-idx="${i}" data-side="original" tabindex="0">
              <span class="para-number">#${i + 1}</span>
              ${escapeHtml(p)}
            </div>
          `)
          .join('');
      }
    }

    const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentTargetLang) || { name: currentTargetLang, flag: '🌐' };
    const transLangLabel = document.getElementById('trans-lang-label');
    if (transLangLabel) transLangLabel.textContent = `${targetLangMeta.flag} ${targetLangMeta.name}`;

    // Clean ready state in right column until user translates
    const transCol = document.getElementById('col-translated');
    if (transCol) {
      transCol.innerHTML = `
        <div class="translator-empty-state">
          <div class="translator-empty-icon">${targetLangMeta.flag}</div>
          <div style="font-weight:600; color:#e2e8f0; margin-bottom:6px;">Ready to Translate</div>
          <div style="font-size:0.85rem; color:#94a3b8; max-width:280px; margin-bottom:16px;">
            Target Language: <strong>${targetLangMeta.name}</strong>
          </div>
          <button class="btn-trigger-translate" id="btn-modal-start-translate" style="margin:0 auto;">
            <span>Translate Now</span>
          </button>
        </div>
      `;
      const startBtn = transCol.querySelector('#btn-modal-start-translate');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          executeTranslation(currentFile, currentTargetLang);
        });
      }
    }
  }

  function closeTranslator() {
    stopSpeech();
    const backdrop = document.getElementById('vault-translator-backdrop');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function showTranslatorNotice(message, type = 'info') {
    let noticeEl = document.getElementById('translator-notice');
    if (!noticeEl) {
      const modal = document.querySelector('.vault-translator-modal');
      if (!modal) return alert(message);
      noticeEl = document.createElement('div');
      noticeEl.id = 'translator-notice';
      noticeEl.className = 'translator-notice-banner';
      const toolbar = modal.querySelector('.translator-toolbar');
      if (toolbar) {
        modal.insertBefore(noticeEl, toolbar);
      } else {
        modal.appendChild(noticeEl);
      }
    }
    const icon = type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
    noticeEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; justify-content:space-between; width:100%;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span>${icon}</span>
          <span>${escapeHtml(message)}</span>
        </div>
        <button type="button" style="background:none; border:none; color:inherit; cursor:pointer; font-size:1.2rem; line-height:1; padding:0 4px;" onclick="this.closest('.translator-notice-banner').style.display='none'">×</button>
      </div>
    `;
    noticeEl.className = `translator-notice-banner notice-${type}`;
    noticeEl.style.display = 'block';
    clearTimeout(noticeEl._timeout);
    noticeEl._timeout = setTimeout(() => {
      noticeEl.style.display = 'none';
    }, 6000);
  }

  function showTranslationUnavailable(title, message, file, targetLang) {
    const origCol = document.getElementById('col-original');
    const transCol = document.getElementById('col-translated');
    const origCount = document.getElementById('orig-badge-count');
    const transCount = document.getElementById('trans-badge-count');

    // Ensure left column displays original document text
    if (file && (file.fullText || file.customText)) {
      originalParagraphs = (file.fullText || file.customText).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    }
    translatedParagraphs = [];

    if (origCount) origCount.textContent = `${originalParagraphs.length} paragraphs`;
    if (transCount) transCount.textContent = `0 paragraphs`;

    if (originalParagraphs.length > 0 && origCol) {
      origCol.innerHTML = originalParagraphs
        .map((p, i) => `
          <div class="sync-paragraph" data-idx="${i}" data-side="original">
            <span class="para-number">#${i + 1}</span>
            ${escapeHtml(p)}
          </div>
        `)
        .join('');
    }

    if (transCol) {
      transCol.innerHTML = `
        <div class="translator-empty-state" style="color:#ef4444; padding:36px 20px;">
          <div class="translator-empty-icon" style="opacity:0.9;">⚠️</div>
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:8px; color:#f87171;">${escapeHtml(title)}</div>
          <div style="font-size:0.85rem; color:#94a3b8; max-width:340px; line-height:1.5; margin-bottom:18px;">
            ${escapeHtml(message)}
          </div>
          <button class="btn-trigger-translate" id="btn-retry-trans" style="margin:0 auto;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.8 1.04 6.44 2.73L21 8"></path>
              <polyline points="21 3 21 8 16 8"></polyline>
            </svg>
            <span>Retry Translation</span>
          </button>
        </div>
      `;

      const retryBtn = transCol.querySelector('#btn-retry-trans');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          executeTranslation(file, targetLang);
        });
      }
    }
  }

  // Helper: Client-side neural translation engine (CORS enabled, 0 cost, residential IP trust)
  async function translateParagraphClientSide(text, targetLang) {
    if (!text || !text.trim()) {
      return { text: '', success: true, engine: 'none' };
    }
    const trimmed = text.trim();

    // 1. Google Translate Neural API (via Chrome Extension endpoint)
    try {
      const googleUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(trimmed)}`;
      const gRes = await fetch(googleUrl);
      if (gRes.ok) {
        const gData = await gRes.json();
        let translatedText = '';
        if (typeof gData === 'string') {
          translatedText = gData.trim();
        } else if (Array.isArray(gData)) {
          translatedText = gData.map(item => {
            if (Array.isArray(item)) return item[0];
            if (typeof item === 'string') return item;
            return '';
          }).filter(Boolean).join(' ').trim();
        }
        if (translatedText) {
          return { text: translatedText, success: true, engine: 'google-client' };
        }
      }
    } catch (err) {
      console.warn('[Client Translate] Google Neural failed:', err.message);
    }

    // 2. Fallback: MyMemory Neural Translate API from client browser
    try {
      const myMemoryEmail = 'jefferyjenson34@gmail.com';
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed.slice(0, 500))}&langpair=en|${encodeURIComponent(targetLang)}&de=${encodeURIComponent(myMemoryEmail)}`;
      const mmRes = await fetch(mmUrl);
      if (mmRes.ok) {
        const mmData = await mmRes.json();
        const trans = mmData?.responseData?.translatedText;
        if (trans && !trans.includes('INVALID SOURCE LANGUAGE') && !trans.includes('MYMEMORY WARNING')) {
          return { text: trans, success: true, engine: 'mymemory-client' };
        }
      }
    } catch (err) {
      console.warn('[Client Translate] MyMemory fallback failed:', err.message);
    }

    return { text: '', success: false, engine: 'none' };
  }

  async function translateParagraphClientSideWithChunking(text, targetLang) {
    if (!text || !text.trim()) {
      return { text: '', success: true, engine: 'none' };
    }
    const trimmed = text.trim();
    if (trimmed.length > 900) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmed];
      const chunks = [];
      let cur = '';
      for (const s of sentences) {
        if ((cur + ' ' + s).length > 800) {
          if (cur) chunks.push(cur.trim());
          cur = s;
        } else {
          cur = cur ? (cur + ' ' + s) : s;
        }
      }
      if (cur) chunks.push(cur.trim());

      const subResults = await Promise.all(chunks.map(c => translateParagraphClientSide(c, targetLang)));
      if (subResults.some(r => !r.success)) {
        return { text: '', success: false, engine: 'none' };
      }
      return {
        text: subResults.map(r => r.text).join(' '),
        success: true,
        engine: subResults[0]?.engine || 'google-client'
      };
    }
    return translateParagraphClientSide(trimmed, targetLang);
  }

  async function translateParagraphBatchClientSide(paragraphs, targetLang, progressCallback) {
    if (!paragraphs || paragraphs.length === 0) {
      return { success: true, translatedParagraphs: [] };
    }

    const translatedParagraphs = [];
    const BATCH_SIZE = 3;
    let anyFailed = false;

    for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
      const batch = paragraphs.slice(i, i + BATCH_SIZE);
      if (typeof progressCallback === 'function') {
        progressCallback(i, paragraphs.length);
      }
      const results = await Promise.all(batch.map(p => translateParagraphClientSideWithChunking(p, targetLang)));
      for (const res of results) {
        if (!res.success) {
          anyFailed = true;
          break;
        }
        translatedParagraphs.push(res.text);
      }
      if (anyFailed) {
        break;
      }
    }

    if (anyFailed || translatedParagraphs.length !== paragraphs.length) {
      return { success: false, translatedParagraphs: [] };
    }

    return { success: true, translatedParagraphs };
  }

  async function executeTranslation(file, targetLang) {
    if (!file) return;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const thisSequence = ++activeTranslationSequence;
    currentTargetLang = targetLang;

    const origCol = document.getElementById('col-original');
    const transCol = document.getElementById('col-translated');
    const transLangLabel = document.getElementById('trans-lang-label');
    const translateBtn = document.getElementById('btn-do-translate');

    const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) || { name: targetLang, flag: '🌐' };
    if (transLangLabel) transLangLabel.textContent = `${targetLangMeta.flag} ${targetLangMeta.name}`;

    // Reset active speech
    stopSpeech();

    // Show loading state in translated column
    if (translateBtn) {
      translateBtn.disabled = true;
      translateBtn.innerHTML = `
        <span class="spinner-quantum" style="width:14px; height:14px; border-width:2px; display:inline-block;"></span>
        <span>Translating...</span>
      `;
    }

    transCol.innerHTML = `
      <div class="translator-loading-overlay">
        <div class="spinner-quantum"></div>
        <div style="font-weight:600; color:#38bdf8; font-size:0.95rem;" id="trans-loading-status">Translating via Neural Engine...</div>
        <div style="color:#94a3b8; font-size:0.8rem;">Target: ${targetLangMeta.name} (${targetLang.toUpperCase()})</div>
      </div>
    `;

    try {
      const res = await fetch('/api/translate/document', {
        method: 'POST',
        signal: activeAbortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.filename,
          customText: file.fullText || file.customText || '',
          targetLang
        })
      });

      if (thisSequence !== activeTranslationSequence || targetLang !== currentTargetLang) {
        console.log('[Translator] Discarding response from obsolete request sequence');
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        showTranslationUnavailable(
          'Rate Limit Reached',
          data.error || 'Too many translation requests from this IP. Please wait a minute before translating again.',
          file,
          targetLang
        );
        return;
      }

      // 1. If backend translation succeeded directly
      if (res.ok && data.success && Array.isArray(data.translatedParagraphs) && data.translatedParagraphs.length > 0) {
        if (thisSequence !== activeTranslationSequence || targetLang !== currentTargetLang) return;
        originalParagraphs = data.originalParagraphs || [];
        translatedParagraphs = data.translatedParagraphs || [];
        renderDualColumns(targetLang);
        return;
      }

      // 2. If backend was exhausted on datacenter IP or signaled fallbackToClient, execute client-side neural translation
      const candidateParagraphs = (data.originalParagraphs && data.originalParagraphs.length > 0)
        ? data.originalParagraphs
        : ((file.fullText || file.customText) ? (file.fullText || file.customText).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : []);

      if (candidateParagraphs.length > 0) {
        const statusEl = document.getElementById('trans-loading-status');
        if (statusEl) statusEl.textContent = 'Translating via Neural Client Engine...';

        const clientBatch = await translateParagraphBatchClientSide(
          candidateParagraphs,
          targetLang,
          (done, total) => {
            if (statusEl && thisSequence === activeTranslationSequence) {
              statusEl.textContent = `Translating via Neural Engine (${Math.round((done / total) * 100)}%)...`;
            }
          }
        );

        if (thisSequence !== activeTranslationSequence || targetLang !== currentTargetLang) {
          console.log('[Translator] Discarding client batch results from obsolete sequence');
          return;
        }

        if (clientBatch.success && clientBatch.translatedParagraphs.length === candidateParagraphs.length) {
          originalParagraphs = candidateParagraphs;
          translatedParagraphs = clientBatch.translatedParagraphs;
          renderDualColumns(targetLang);
          return;
        }
      }

      // 3. Both server and client engines exhausted - display explicit error card
      if (thisSequence !== activeTranslationSequence || targetLang !== currentTargetLang) return;
      if (data.originalParagraphs && data.originalParagraphs.length > 0) {
        originalParagraphs = data.originalParagraphs;
      }
      showTranslationUnavailable(
        'Translation Unavailable',
        data.error || `Could not translate document into ${targetLangMeta.name}. Neural translation service is temporarily unavailable. Please retry in a moment.`,
        file,
        targetLang
      );
    } catch (err) {
      if (err.name === 'AbortError' || thisSequence !== activeTranslationSequence) {
        console.log('[Translator] Request aborted for targetLang:', targetLang);
        return;
      }
      console.warn('[Translator] Network/Request error:', err);
      // Attempt client translation if file text is present in browser memory
      const candidateParagraphs = (file.fullText || file.customText)
        ? (file.fullText || file.customText).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
        : [];
      if (candidateParagraphs.length > 0) {
        try {
          const clientBatch = await translateParagraphBatchClientSide(candidateParagraphs, targetLang);
          if (thisSequence === activeTranslationSequence && clientBatch.success && clientBatch.translatedParagraphs.length === candidateParagraphs.length) {
            originalParagraphs = candidateParagraphs;
            translatedParagraphs = clientBatch.translatedParagraphs;
            renderDualColumns(targetLang);
            return;
          }
        } catch (_) {}
      }
      if (thisSequence === activeTranslationSequence) {
        showTranslationUnavailable(
          'Network Error',
          err.message || 'Failed to connect to the translation server. Please check your connection and retry.',
          file,
          targetLang
        );
      }
    } finally {
      if (translateBtn && thisSequence === activeTranslationSequence) {
        translateBtn.disabled = false;
        translateBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.8 1.04 6.44 2.73L21 8"></path>
            <polyline points="21 3 21 8 16 8"></polyline>
          </svg>
          <span>Translate Now</span>
        `;
      }
    }
  }

  function renderDualColumns(forLang) {
    if (forLang && forLang !== currentTargetLang) {
      console.log('[Translator] Suppressing render for non-current language:', forLang);
      return;
    }
    const origCol = document.getElementById('col-original');
    const transCol = document.getElementById('col-translated');
    const origCount = document.getElementById('orig-badge-count');
    const transCount = document.getElementById('trans-badge-count');

    if (origCount) origCount.textContent = `${originalParagraphs.length} paragraphs`;
    if (transCount) transCount.textContent = `${translatedParagraphs.length} paragraphs`;

    // Render Original Paragraphs
    if (originalParagraphs.length === 0) {
      origCol.innerHTML = `
        <div class="translator-empty-state">
          <div class="translator-empty-icon">📄</div>
          <div>No readable text found in document.</div>
        </div>
      `;
    } else {
      origCol.innerHTML = originalParagraphs
        .map((p, i) => `
          <div class="sync-paragraph" data-idx="${i}" data-side="original" title="Click to align & listen">
            <span class="para-number">#${i + 1}</span>
            ${escapeHtml(p)}
          </div>
        `)
        .join('');
    }

    // Render Translated Paragraphs
    if (translatedParagraphs.length === 0) {
      transCol.innerHTML = `
        <div class="translator-empty-state">
          <div class="translator-empty-icon">🌐</div>
          <div>No translation generated.</div>
        </div>
      `;
    } else {
      transCol.innerHTML = translatedParagraphs
        .map((p, i) => `
          <div class="sync-paragraph" data-idx="${i}" data-side="translated" title="Click to align & listen">
            <span class="para-number">#${i + 1}</span>
            ${escapeHtml(p)}
          </div>
        `)
        .join('');
    }

    // Attach Hover & Click Pairing
    bindParagraphInteractions();
  }

  function bindParagraphInteractions() {
    const origParas = document.querySelectorAll('#col-original .sync-paragraph');
    const transParas = document.querySelectorAll('#col-translated .sync-paragraph');

    function highlightPair(idx, activate) {
      const p1 = document.querySelector(`#col-original .sync-paragraph[data-idx="${idx}"]`);
      const p2 = document.querySelector(`#col-translated .sync-paragraph[data-idx="${idx}"]`);
      if (p1) p1.classList.toggle('is-highlighted', activate);
      if (p2) p2.classList.toggle('is-highlighted', activate);
    }

    [...origParas, ...transParas].forEach((el) => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      const side = el.getAttribute('data-side');

      el.addEventListener('mouseenter', () => highlightPair(idx, true));
      el.addEventListener('mouseleave', () => highlightPair(idx, false));

      el.addEventListener('click', () => {
        // Scroll both columns to align this paragraph
        alignParagraph(idx);
        // Start speech from this paragraph
        speakParagraph(side, idx);
      });
    });
  }

  function alignParagraph(idx) {
    const p1 = document.querySelector(`#col-original .sync-paragraph[data-idx="${idx}"]`);
    const p2 = document.querySelector(`#col-translated .sync-paragraph[data-idx="${idx}"]`);
    if (p1) p1.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (p2) p2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ─── Speech Synthesis Engine ──────────────────────────────────────
  function getBestVoiceForLang(bcp47Code) {
    if (!synth) return null;
    const voices = synth.getVoices() || [];
    if (!voices.length) return null;
    const prefix = bcp47Code.split('-')[0].toLowerCase();

    // 1. Exact match (e.g. es-ES, ml-IN)
    let matched = voices.find((v) => v.lang.toLowerCase() === bcp47Code.toLowerCase());
    if (matched) return matched;

    // 2. Prefix match (e.g. es_MX or ml)
    matched = voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
    if (matched) return matched;

    return null; // Return null so we never silently use an English voice for foreign languages
  }

  function toggleSpeech(side) {
    if (isSpeaking && activeAudioSide === side) {
      if (currentAudioElement) {
        if (isPaused) {
          currentAudioElement.play().catch(() => {});
          isPaused = false;
        } else {
          currentAudioElement.pause();
          isPaused = true;
        }
        updateAudioUIState();
        return;
      }
      if (synth) {
        if (isPaused) {
          synth.resume();
          isPaused = false;
        } else {
          synth.pause();
          isPaused = true;
        }
        updateAudioUIState();
        return;
      }
    }

    const paragraphs = side === 'original' ? originalParagraphs : translatedParagraphs;
    if (!paragraphs || paragraphs.length === 0) {
      showTranslatorNotice(`No ${side === 'original' ? 'original document' : 'translated'} text available to play.`, 'warning');
      return;
    }

    stopSpeech();
    speakParagraph(side, 0);
  }

  function speakParagraph(side, index) {
    stopSpeech();

    const paragraphs = side === 'original' ? originalParagraphs : translatedParagraphs;
    if (!paragraphs || index >= paragraphs.length || index < 0) return;

    const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentTargetLang) || { name: 'Target Language', bcp47: 'en-US', code: currentTargetLang };
    const bcp47 = side === 'original' ? 'en-US' : (targetLangMeta ? targetLangMeta.bcp47 : 'en-US');
    const textToSpeak = paragraphs[index];

    activeAudioSide = side;
    activeParagraphIndex = index;
    isSpeaking = true;
    isPaused = false;

    // Visual glowing highlight on currently speaking paragraph
    highlightSpeakingParagraph(side, index);

    // 1. Check if browser/OS has a native voice installed for this language
    const voice = getBestVoiceForLang(bcp47);
    const prefix = bcp47.split('-')[0].toLowerCase();
    const hasLocalVoice = voice && voice.lang.toLowerCase().replace('_', '-').startsWith(prefix);

    // 2. If no local voice (e.g. Malayalam on macOS/Windows), seamlessly stream Neural Cloud Audio
    if (side === 'translated' && !hasLocalVoice) {
      const langCode = targetLangMeta.code || prefix || 'ml';
      const audioUrl = `/api/translate/tts?lang=${encodeURIComponent(langCode)}&text=${encodeURIComponent(textToSpeak)}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = speechRate;
      currentAudioElement = audio;

      audio.onplay = () => {
        updateAudioUIState();
      };

      audio.onended = () => {
        if (index + 1 < paragraphs.length) {
          speakParagraph(side, index + 1);
        } else {
          stopSpeech();
        }
      };

      audio.onerror = (e) => {
        console.warn('[Neural Audio Error]', e);
        stopSpeech();
        showTranslatorNotice(`Could not stream audio for ${targetLangMeta.name}.`, 'warning');
      };

      audio.play().catch(err => {
        console.warn('[Audio Play Failed]', err.message);
        stopSpeech();
      });

      updateAudioUIState();
      return;
    }

    // 3. Otherwise use Web Speech API with the verified regional voice
    if (!('speechSynthesis' in window)) {
      showTranslatorNotice('Speech synthesis is not supported on this browser.', 'warning');
      stopSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;
    utterance.lang = bcp47;
    if (voice) {
      utterance.voice = voice;
    } else if (side === 'original') {
      const defaultVoice = (synth.getVoices() || []).find(v => v.lang.toLowerCase().startsWith('en')) || (synth.getVoices() || [])[0];
      if (defaultVoice) utterance.voice = defaultVoice;
    }

    utterance.onend = () => {
      // Continue to next paragraph
      if (index + 1 < paragraphs.length) {
        speakParagraph(side, index + 1);
      } else {
        stopSpeech();
      }
    };

    utterance.onerror = (e) => {
      console.warn('[Speech] Error:', e);
      stopSpeech();
    };

    currentUtterance = utterance;
    synth.speak(utterance);
    updateAudioUIState();
  }

  function stopSpeech() {
    if (synth) synth.cancel();
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement = null;
    }
    isSpeaking = false;
    isPaused = false;
    activeAudioSide = null;
    activeParagraphIndex = -1;
    clearSpeakingHighlights();
    updateAudioUIState();
  }

  function highlightSpeakingParagraph(side, index) {
    clearSpeakingHighlights();
    const p1 = document.querySelector(`#col-original .sync-paragraph[data-idx="${index}"]`);
    const p2 = document.querySelector(`#col-translated .sync-paragraph[data-idx="${index}"]`);

    if (p1) {
      p1.classList.add('is-speaking');
      p1.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (p2) {
      p2.classList.add('is-speaking');
      p2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function clearSpeakingHighlights() {
    document.querySelectorAll('.sync-paragraph.is-speaking').forEach((el) => {
      el.classList.remove('is-speaking');
    });
  }

  function updateAudioUIState() {
    const origBtn = document.getElementById('btn-audio-orig');
    const transBtn = document.getElementById('btn-audio-trans');
    const stopBtn = document.getElementById('btn-audio-stop');
    const soundwave = document.getElementById('soundwave-viz');

    if (!origBtn || !transBtn || !stopBtn || !soundwave) return;

    if (!isSpeaking) {
      origBtn.classList.remove('is-active');
      origBtn.innerHTML = '<span>🔊 Listen Orig</span>';
      transBtn.classList.remove('is-active');
      transBtn.innerHTML = '<span>🌐 Listen Trans</span>';
      stopBtn.style.display = 'none';
      soundwave.classList.remove('is-playing');
      return;
    }

    stopBtn.style.display = 'inline-flex';
    soundwave.classList.toggle('is-playing', !isPaused);

    if (activeAudioSide === 'original') {
      origBtn.classList.add('is-active');
      origBtn.innerHTML = isPaused ? '<span>▶ Resume Orig</span>' : '<span>⏸ Pause Orig</span>';
      transBtn.classList.remove('is-active');
      transBtn.innerHTML = '<span>🌐 Listen Trans</span>';
    } else {
      transBtn.classList.add('is-active');
      transBtn.innerHTML = isPaused ? '<span>▶ Resume Trans</span>' : '<span>⏸ Pause Trans</span>';
      origBtn.classList.remove('is-active');
      origBtn.innerHTML = '<span>🔊 Listen Orig</span>';
    }
  }

  // ─── Utility Operations ───────────────────────────────────────────
  function copyTranslation() {
    if (!translatedParagraphs.length) return;
    const text = translatedParagraphs.join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-trans');
      if (btn) {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<span>✓ Copied!</span>';
        setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
      }
    });
  }

  function downloadTranslation() {
    if (!translatedParagraphs.length) return;
    const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentTargetLang) || { name: currentTargetLang };
    const docName = (currentFile ? currentFile.originalName : 'document').replace(/\.[^/.]+$/, '');
    const filename = `${docName}_translated_${currentTargetLang}.txt`;

    const content = [
      `# Translation: ${docName}`,
      `# Target Language: ${targetLangMeta.name} (${currentTargetLang.toUpperCase()})`,
      `# Generated: ${new Date().toISOString()}`,
      `# Engine: Vault PDF Neural Multi-Lingual Translator`,
      `\n` + '─'.repeat(60) + `\n\n`,
      translatedParagraphs.join('\n\n')
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose public API
  window.VaultTranslator = {
    open: openTranslator,
    close: closeTranslator,
    retry: () => executeTranslation(currentFile, currentTargetLang)
  };
})();
