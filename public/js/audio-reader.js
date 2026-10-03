/**
 * ═════════════════════════════════════════════════════════════════════
 * VAULT PDF PORTAL — NEURAL VOICE READER (CYBER MEDIA PLAYER)
 * Interactive Speech Synthesis, Sentence Teleprompter, Audio Waveform
 * ═════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  // ─── Player State ──────────────────────────────────────────────────
  const state = {
    docData: null,
    currentPageIdx: 0,
    sentences: [],
    currentSentenceIdx: 0,
    isPlaying: false,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    selectedVoiceURI: localStorage.getItem('vault_voice_uri') || '',
    voices: [],
    synth: window.speechSynthesis || null,
    currentUtterance: null,
    isMinimized: false,
    animFrameId: null,
    pendingResume: null
  };

  // Restore saved speed
  const savedRate = localStorage.getItem('vault_speech_rate');
  if (savedRate && !isNaN(parseFloat(savedRate))) {
    state.rate = parseFloat(savedRate);
  }

  // ─── DOM Injections ────────────────────────────────────────────────
  function injectPlayerDOM() {
    if (document.getElementById('neural-voice-reader-root')) return;

    const root = document.createElement('div');
    root.id = 'neural-voice-reader-root';
    root.innerHTML = `
      <!-- Floating Mini Capsule (Minimized mode) -->
      <div class="cyber-audio-capsule" id="cyber-audio-capsule" title="Click to expand Neural Voice Reader">
        <div class="capsule-pulse-indicator">
          <div class="capsule-wave-bar"></div>
          <div class="capsule-wave-bar"></div>
          <div class="capsule-wave-bar"></div>
          <div class="capsule-wave-bar"></div>
        </div>
        <div class="capsule-title" id="capsule-doc-title">No document playing</div>
        <button type="button" class="capsule-ctrl-btn" id="capsule-play-btn" title="Play/Pause">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button type="button" class="capsule-ctrl-btn" id="capsule-expand-btn" title="Expand Full Cyber Player">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>

      <!-- Main Neural Voice Reader Overlay Modal -->
      <div class="neural-reader-overlay" id="neural-reader-overlay" aria-hidden="true">
        <div class="neural-player-container" role="dialog" aria-modal="true" aria-labelledby="neural-doc-title">
          
          <!-- Header -->
          <div class="neural-player-header">
            <div class="neural-badge">
              <span class="neural-pulse-dot"></span>
              <span>Neural Audio Synthesis Engine</span>
            </div>
            <div class="neural-header-actions">
              <a href="#" class="player-action-btn" id="neural-btn-dl-text" download title="Download Extracted Text (.txt)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                </svg>
                <span class="btn-action-text-label">Text</span>
              </a>
              <a href="#" class="player-action-btn" id="neural-btn-dl-audio" download title="Download Speech Audio (.mp3)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <span class="btn-action-text-label">Audio</span>
              </a>
              <button type="button" class="player-action-btn" id="neural-btn-toggle-fulltext" title="Toggle Full Document Text">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span class="btn-action-text-label">Read</span>
              </button>
              <button type="button" class="player-action-btn" id="neural-btn-minimize" title="Minimize to Floating Mini Capsule">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button type="button" class="player-action-btn" id="neural-btn-close" title="Close and Stop Playback">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Visualizer & Meta Deck -->
          <div class="neural-visualizer-deck">
            <div class="neural-doc-info">
              <h2 class="neural-doc-title" id="neural-doc-title">Loading document...</h2>
              <div class="neural-doc-meta">
                <span class="neural-meta-item" id="neural-doc-page-info">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span id="neural-meta-pages">Page 1 of 1</span>
                </span>
                <span class="neural-meta-item" id="neural-meta-time">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span id="neural-est-time">-- min listen</span>
                </span>
              </div>
            </div>

            <!-- Waveform EQ Canvas -->
            <div class="neural-canvas-wrap">
              <canvas id="neural-eq-canvas" width="160" height="42"></canvas>
            </div>
          </div>

          <!-- Interactive Teleprompter Area -->
          <div class="neural-teleprompter-area" id="neural-teleprompter-area">
            <div class="teleprompter-empty">Processing document text with neural synthesis...</div>
          </div>

          <!-- Full Text Reader View (Toggled) -->
          <div class="neural-fulltext-view" id="neural-fulltext-view" style="display: none;">
            <div class="fulltext-toolbar">
              <span>📖 Complete Document Text (Pre-Download Reader)</span>
              <button type="button" class="btn-reader-tool" id="neural-btn-copy-fulltext">Copy All Text</button>
            </div>
            <div class="fulltext-content" id="neural-fulltext-content"></div>
          </div>

          <!-- Chapter / Page Nav Bar -->
          <div class="neural-chapter-bar">
            <button type="button" class="chapter-btn" id="neural-btn-prev-page" title="Previous Page (PageUp)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Prev Page</span>
            </button>

            <select class="page-select-dropdown" id="neural-page-select" title="Jump to Page/Chapter">
              <option value="0">Page 1</option>
            </select>

            <button type="button" class="chapter-btn" id="neural-btn-next-page" title="Next Page (PageDown)">
              <span>Next Page</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <!-- Primary Controls Deck -->
          <div class="neural-controls-deck">
            
            <!-- Timeline Slider -->
            <div class="neural-timeline-wrap">
              <span class="time-label" id="neural-time-current">0:00</span>
              <input type="range" class="neural-timeline-slider" id="neural-timeline-slider" min="0" max="100" value="0">
              <span class="time-label right" id="neural-time-total">0:00</span>
            </div>

            <!-- Buttons Row -->
            <div class="neural-buttons-row">
              
              <!-- Playback Cluster -->
              <div class="neural-playback-cluster">
                <button type="button" class="btn-ctrl-round" id="neural-btn-rewind" title="Rewind 10 Seconds (-10s)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"></path>
                  </svg>
                </button>

                <button type="button" class="btn-ctrl-play" id="neural-btn-main-play" title="Play / Pause (Spacebar)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="neural-play-icon">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>

                <button type="button" class="btn-ctrl-round" id="neural-btn-forward" title="Fast Forward 10 Seconds (+10s)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M13 17l5-5-5-5M6 17l5-5-5-5"></path>
                  </svg>
                </button>
              </div>

              <!-- Speed Selector Pills -->
              <div class="neural-speed-cluster" id="neural-speed-cluster">
                <button type="button" class="speed-pill-btn" data-rate="0.75">0.75x</button>
                <button type="button" class="speed-pill-btn active" data-rate="1">1.0x</button>
                <button type="button" class="speed-pill-btn" data-rate="1.25">1.25x</button>
                <button type="button" class="speed-pill-btn" data-rate="1.5">1.5x</button>
                <button type="button" class="speed-pill-btn" data-rate="2">2.0x</button>
              </div>

              <!-- Settings Cluster (Voice & Volume) -->
              <div class="neural-settings-cluster">
                <select class="voice-select-dropdown" id="neural-voice-select" title="Select Neural Voice Model">
                  <option value="">Default Neural Voice</option>
                </select>

                <div class="volume-wrap">
                  <button type="button" class="btn-ctrl-round" id="neural-btn-mute" style="width:28px; height:28px;" title="Mute / Unmute (M)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" id="neural-vol-icon">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  </button>
                  <input type="range" class="volume-slider" id="neural-volume-slider" min="0" max="1" step="0.05" value="1" title="Volume">
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(root);
    setupEvents();
    initVoices();
  }

  // ─── Voice Management ──────────────────────────────────────────────
  function initVoices() {
    if (!state.synth) return;

    function populateVoices() {
      const voices = state.synth.getVoices();
      if (!voices || voices.length === 0) return;
      state.voices = voices;

      const voiceSelect = document.getElementById('neural-voice-select');
      if (!voiceSelect) return;

      voiceSelect.innerHTML = '';

      // Prefer English voices first, then others
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      const otherVoices = voices.filter(v => !v.lang.startsWith('en'));
      const sorted = [...englishVoices, ...otherVoices];

      sorted.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        const isNatural = /natural|neural|google|samantha|daniel|karen|siri/i.test(voice.name);
        opt.textContent = `${voice.name} (${voice.lang})${isNatural ? ' ★ Neural' : ''}`;
        if (voice.voiceURI === state.selectedVoiceURI) {
          opt.selected = true;
        }
        voiceSelect.appendChild(opt);
      });

      // Default to best voice if none selected
      if (!state.selectedVoiceURI && englishVoices.length > 0) {
        const best = englishVoices.find(v => /natural|neural|google|samantha/i.test(v.name)) || englishVoices[0];
        state.selectedVoiceURI = best.voiceURI;
        voiceSelect.value = best.voiceURI;
      }
    }

    populateVoices();
    if (state.synth.onvoiceschanged !== undefined) {
      state.synth.onvoiceschanged = populateVoices;
    }
  }

  // ─── Visualizer Waveform Animation ──────────────────────────────────
  function initVisualizer() {
    const canvas = document.getElementById('neural-eq-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const numBars = 16;
    const barWidth = 6;
    const gap = 4;
    let step = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#7c3aed');
      gradient.addColorStop(1, '#38bdf8');
      ctx.fillStyle = gradient;

      for (let i = 0; i < numBars; i++) {
        let height;
        if (state.isPlaying) {
          const freq = Math.sin(step * 0.12 + i * 0.5) * Math.cos(step * 0.08 + i * 0.3);
          height = Math.max(4, Math.abs(freq) * (canvas.height - 6) + 4);
        } else {
          // Idle low wave
          height = Math.max(3, Math.sin(step * 0.04 + i * 0.2) * 4 + 4);
        }

        const x = i * (barWidth + gap) + 4;
        const y = canvas.height - height;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barWidth, height, [3, 3, 0, 0]) : ctx.rect(x, y, barWidth, height);
        ctx.fill();
      }

      step++;
      state.animFrameId = requestAnimationFrame(draw);
    }

    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
    draw();
  }

  // ─── Speech Engine Core ────────────────────────────────────────────
  function splitIntoSentences(text) {
    if (!text) return [];
    // Split by sentence terminators while keeping reasonable chunks
    const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    return matches.map(s => s.trim()).filter(s => s.length > 0);
  }

  function renderTeleprompter() {
    const container = document.getElementById('neural-teleprompter-area');
    if (!container || !state.docData) return;

    const page = state.docData.pages[state.currentPageIdx];
    if (!page) {
      container.innerHTML = '<div class="teleprompter-empty">No text content available on this page.</div>';
      return;
    }

    state.sentences = splitIntoSentences(page.text);
    if (state.sentences.length === 0) {
      container.innerHTML = '<div class="teleprompter-empty">No readable sentences found on this page.</div>';
      return;
    }

    container.innerHTML = '';
    state.sentences.forEach((sentence, idx) => {
      const span = document.createElement('span');
      span.className = 'teleprompter-sentence' + (idx === state.currentSentenceIdx ? ' active' : '');
      span.setAttribute('data-idx', idx);
      span.textContent = sentence + ' ';
      span.addEventListener('click', () => {
        jumpToSentence(idx);
      });
      container.appendChild(span);
    });

    updateSentenceHighlight();
  }

  function updateSentenceHighlight() {
    const container = document.getElementById('neural-teleprompter-area');
    if (!container) return;

    const all = container.querySelectorAll('.teleprompter-sentence');
    all.forEach((el, idx) => {
      if (idx === state.currentSentenceIdx) {
        el.classList.add('active');
        // Smoothly scroll active sentence into view
        const topPos = el.offsetTop - container.offsetTop - 40;
        container.scrollTo({ top: topPos, behavior: 'smooth' });
      } else {
        el.classList.remove('active');
      }
    });

    // Update timeline slider
    const slider = document.getElementById('neural-timeline-slider');
    const curTimeEl = document.getElementById('neural-time-current');
    const totTimeEl = document.getElementById('neural-time-total');
    if (slider && state.sentences.length > 0) {
      const progress = (state.currentSentenceIdx / state.sentences.length) * 100;
      slider.value = progress;
      if (curTimeEl) {
        const estSecCurrent = Math.round(state.currentSentenceIdx * 4);
        curTimeEl.textContent = formatTime(estSecCurrent);
      }
      if (totTimeEl) {
        const estSecTotal = Math.round(state.sentences.length * 4);
        totTimeEl.textContent = formatTime(estSecTotal);
      }
    }
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function playCurrentSentence() {
    if (!state.synth) return;
    state.synth.cancel();

    if (!state.sentences || state.sentences.length === 0) {
      advancePage();
      return;
    }

    if (state.currentSentenceIdx >= state.sentences.length) {
      advancePage();
      return;
    }

    const textToRead = state.sentences[state.currentSentenceIdx];
    updateSentenceHighlight();

    const utter = new SpeechSynthesisUtterance(textToRead);
    utter.rate = state.rate;
    utter.pitch = state.pitch;
    utter.volume = state.volume;

    // Apply voice
    if (state.selectedVoiceURI && state.voices.length > 0) {
      const match = state.voices.find(v => v.voiceURI === state.selectedVoiceURI);
      if (match) utter.voice = match;
    }

    utter.onstart = () => {
      state.isPlaying = true;
      updatePlayButtonUI();
      updateMediaSession();
    };

    utter.onend = () => {
      if (!state.isPlaying) return;
      state.currentSentenceIdx++;
      if (state.currentSentenceIdx < state.sentences.length) {
        playCurrentSentence();
      } else {
        advancePage();
      }
    };

    utter.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech synthesis warning:', e.error);
      }
    };

    state.currentUtterance = utter;
    saveSession();
    state.synth.speak(utter);
  }

  function advancePage() {
    if (!state.docData) return;
    if (state.currentPageIdx < state.docData.totalPages - 1) {
      setPage(state.currentPageIdx + 1);
      if (state.isPlaying) {
        setTimeout(playCurrentSentence, 300);
      }
    } else {
      // Finished entire document
      stopPlayback();
      const container = document.getElementById('neural-teleprompter-area');
      if (container) {
        container.innerHTML = '<div class="teleprompter-empty" style="color:#10b981; font-weight:700;">✓ Document audio narration complete!</div>';
      }
    }
  }

  function setPage(pageIdx) {
    if (!state.docData) return;
    pageIdx = Math.max(0, Math.min(pageIdx, state.docData.totalPages - 1));
    state.currentPageIdx = pageIdx;
    state.currentSentenceIdx = 0;

    // Update UI elements
    const pageSelect = document.getElementById('neural-page-select');
    if (pageSelect) pageSelect.value = pageIdx;

    const metaPages = document.getElementById('neural-meta-pages');
    if (metaPages) metaPages.textContent = `Page ${pageIdx + 1} of ${state.docData.totalPages}`;

    const prevBtn = document.getElementById('neural-btn-prev-page');
    const nextBtn = document.getElementById('neural-btn-next-page');
    if (prevBtn) prevBtn.disabled = (pageIdx === 0);
    if (nextBtn) nextBtn.disabled = (pageIdx >= state.docData.totalPages - 1);

    renderTeleprompter();
    saveSession();
  }

  function jumpToSentence(sentenceIdx) {
    state.currentSentenceIdx = sentenceIdx;
    updateSentenceHighlight();
    saveSession();
    if (state.isPlaying) {
      playCurrentSentence();
    }
  }

  function saveSession() {
    if (state.docData) {
      try {
        sessionStorage.setItem('vault_audio_session', JSON.stringify({
          filename: state.docData.filename,
          title: state.docData.title,
          pageIdx: state.currentPageIdx,
          sentenceIdx: state.currentSentenceIdx,
          active: true
        }));
      } catch (e) {}
    }
  }

  function restoreSessionIfAny() {
    try {
      const raw = sessionStorage.getItem('vault_audio_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || !s.filename || !s.active) return;

      const capsule = document.getElementById('cyber-audio-capsule');
      const capsuleTitle = document.getElementById('capsule-doc-title');
      if (capsule && capsuleTitle) {
        capsuleTitle.textContent = s.title || s.filename;
        capsule.classList.add('active', 'paused');
        state.pendingResume = s;
      }
    } catch (e) {}
  }

  function togglePlay() {
    if (!state.synth) return;

    if (state.isPlaying) {
      state.isPlaying = false;
      state.synth.cancel();
      updatePlayButtonUI();
    } else {
      state.isPlaying = true;
      updatePlayButtonUI();
      playCurrentSentence();
    }
    updateMediaSession();
  }

  function stopPlayback() {
    state.isPlaying = false;
    if (state.synth) state.synth.cancel();
    updatePlayButtonUI();
    updateMediaSession();
  }

  function updatePlayButtonUI() {
    const playIcon = document.getElementById('neural-play-icon');
    const capsulePlayBtn = document.getElementById('capsule-play-btn');
    const capsule = document.getElementById('cyber-audio-capsule');

    if (state.isPlaying) {
      if (playIcon) {
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      }
      if (capsulePlayBtn) {
        capsulePlayBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      }
      if (capsule) capsule.classList.remove('paused');
    } else {
      if (playIcon) {
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }
      if (capsulePlayBtn) {
        capsulePlayBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
      if (capsule) capsule.classList.add('paused');
    }
  }

  // ─── Media Session (OS Lock Screen & Headphone Controls) ────────────
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.docData) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.docData.title || 'Document',
      artist: 'Vault PDF Neural Reader',
      album: `Page ${state.currentPageIdx + 1} of ${state.docData.totalPages}`
    });

    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => { togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { togglePlay(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (state.currentPageIdx > 0) setPage(state.currentPageIdx - 1);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (state.currentPageIdx < state.docData.totalPages - 1) setPage(state.currentPageIdx + 1);
    });
  }

  // ─── Event Setup ───────────────────────────────────────────────────
  function setupEvents() {
    const overlay = document.getElementById('neural-reader-overlay');
    const capsule = document.getElementById('cyber-audio-capsule');
    const btnClose = document.getElementById('neural-btn-close');
    const btnMinimize = document.getElementById('neural-btn-minimize');
    const btnMainPlay = document.getElementById('neural-btn-main-play');
    const capsulePlayBtn = document.getElementById('capsule-play-btn');
    const capsuleExpandBtn = document.getElementById('capsule-expand-btn');
    const btnRewind = document.getElementById('neural-btn-rewind');
    const btnForward = document.getElementById('neural-btn-forward');
    const btnPrevPage = document.getElementById('neural-btn-prev-page');
    const btnNextPage = document.getElementById('neural-btn-next-page');
    const pageSelect = document.getElementById('neural-page-select');
    const voiceSelect = document.getElementById('neural-voice-select');
    const speedCluster = document.getElementById('neural-speed-cluster');
    const volumeSlider = document.getElementById('neural-volume-slider');
    const btnMute = document.getElementById('neural-btn-mute');
    const timelineSlider = document.getElementById('neural-timeline-slider');

    // Close & Minimize
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        stopPlayback();
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        capsule.classList.remove('active');
        try { sessionStorage.removeItem('vault_audio_session'); } catch (e) {}
        state.pendingResume = null;
      });
    }

    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        capsule.classList.add('active');
      });
    }

    if (capsule) {
      capsule.addEventListener('click', (e) => {
        if (e.target.closest('#capsule-play-btn')) return;
        if (state.pendingResume && !state.docData) {
          playPdf(state.pendingResume.filename, state.pendingResume.title, state.pendingResume.pageIdx, state.pendingResume.sentenceIdx);
          state.pendingResume = null;
          return;
        }
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        capsule.classList.remove('active');
      });
    }

    if (capsulePlayBtn) {
      capsulePlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.pendingResume && !state.docData) {
          playPdf(state.pendingResume.filename, state.pendingResume.title, state.pendingResume.pageIdx, state.pendingResume.sentenceIdx);
          state.pendingResume = null;
          return;
        }
        togglePlay();
      });
    }

    if (btnMainPlay) {
      btnMainPlay.addEventListener('click', togglePlay);
    }

    // Toggle full text reader inside cyber player
    const btnToggleFullText = document.getElementById('neural-btn-toggle-fulltext');
    const fullTextView = document.getElementById('neural-fulltext-view');
    const teleprompterArea = document.getElementById('neural-teleprompter-area');
    if (btnToggleFullText && fullTextView) {
      btnToggleFullText.addEventListener('click', () => {
        const isHidden = fullTextView.style.display === 'none';
        fullTextView.style.display = isHidden ? 'flex' : 'none';
        if (teleprompterArea) teleprompterArea.style.display = isHidden ? 'none' : 'block';
      });
    }

    const btnCopyFullText = document.getElementById('neural-btn-copy-fulltext');
    if (btnCopyFullText) {
      btnCopyFullText.addEventListener('click', async () => {
        if (!state.docData || !state.docData.fullText) return;
        try {
          await navigator.clipboard.writeText(state.docData.fullText);
          const orig = btnCopyFullText.textContent;
          btnCopyFullText.textContent = '✓ Copied!';
          setTimeout(() => { btnCopyFullText.textContent = orig; }, 2000);
        } catch (e) {}
      });
    }

    // Rewind 10s (jump 2 sentences back)
    if (btnRewind) {
      btnRewind.addEventListener('click', () => {
        jumpToSentence(Math.max(0, state.currentSentenceIdx - 2));
      });
    }

    // Forward 10s (jump 2 sentences ahead)
    if (btnForward) {
      btnForward.addEventListener('click', () => {
        jumpToSentence(Math.min(state.sentences.length - 1, state.currentSentenceIdx + 2));
      });
    }

    // Page navigation
    if (btnPrevPage) {
      btnPrevPage.addEventListener('click', () => {
        if (state.currentPageIdx > 0) {
          setPage(state.currentPageIdx - 1);
          if (state.isPlaying) setTimeout(playCurrentSentence, 200);
        }
      });
    }

    if (btnNextPage) {
      btnNextPage.addEventListener('click', () => {
        if (state.docData && state.currentPageIdx < state.docData.totalPages - 1) {
          setPage(state.currentPageIdx + 1);
          if (state.isPlaying) setTimeout(playCurrentSentence, 200);
        }
      });
    }

    if (pageSelect) {
      pageSelect.addEventListener('change', () => {
        setPage(parseInt(pageSelect.value, 10));
        if (state.isPlaying) setTimeout(playCurrentSentence, 200);
      });
    }

    // Speed Pill Selection
    if (speedCluster) {
      speedCluster.querySelectorAll('.speed-pill-btn').forEach(b => {
        const r = parseFloat(b.getAttribute('data-rate'));
        if (Math.abs(r - state.rate) < 0.05) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      speedCluster.addEventListener('click', (e) => {
        const btn = e.target.closest('.speed-pill-btn');
        if (!btn) return;

        speedCluster.querySelectorAll('.speed-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const rate = parseFloat(btn.getAttribute('data-rate'));
        state.rate = rate;
        localStorage.setItem('vault_speech_rate', rate);

        // If playing, re-speak current sentence with new rate smoothly
        if (state.isPlaying) {
          playCurrentSentence();
        }
      });
    }

    // Voice Selection
    if (voiceSelect) {
      voiceSelect.addEventListener('change', () => {
        state.selectedVoiceURI = voiceSelect.value;
        localStorage.setItem('vault_voice_uri', voiceSelect.value);
        if (state.isPlaying) {
          playCurrentSentence();
        }
      });
    }

    // Volume Slider & Mute
    if (volumeSlider) {
      volumeSlider.addEventListener('input', () => {
        state.volume = parseFloat(volumeSlider.value);
        updateVolumeIcon();
        if (state.currentUtterance) {
          state.currentUtterance.volume = state.volume;
        }
      });
    }

    if (btnMute) {
      btnMute.addEventListener('click', () => {
        if (state.volume > 0) {
          state.volume = 0;
          if (volumeSlider) volumeSlider.value = 0;
        } else {
          state.volume = 1;
          if (volumeSlider) volumeSlider.value = 1;
        }
        updateVolumeIcon();
      });
    }

    // Timeline Drag / Jump
    if (timelineSlider) {
      timelineSlider.addEventListener('change', () => {
        if (!state.sentences || state.sentences.length === 0) return;
        const targetIdx = Math.round((timelineSlider.value / 100) * (state.sentences.length - 1));
        jumpToSentence(targetIdx);
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      const overlayActive = overlay.classList.contains('active');
      const capsuleActive = capsule.classList.contains('active');

      if (!overlayActive && !capsuleActive) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        jumpToSentence(Math.max(0, state.currentSentenceIdx - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        jumpToSentence(Math.min(state.sentences.length - 1, state.currentSentenceIdx + 1));
      } else if (e.code === 'KeyM') {
        if (btnMute) btnMute.click();
      } else if (e.code === 'Escape' && overlayActive) {
        if (btnMinimize) btnMinimize.click();
      }
    });

    initVisualizer();
  }

  function updateVolumeIcon() {
    const icon = document.getElementById('neural-vol-icon');
    if (!icon) return;
    if (state.volume === 0) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
    } else {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    }
  }

  // ─── Public API: Load & Play PDF ───────────────────────────────────
  async function playPdf(filename, customTitle, startPageIdx = 0, startSentenceIdx = 0) {
    injectPlayerDOM();

    const overlay = document.getElementById('neural-reader-overlay');
    const capsule = document.getElementById('cyber-audio-capsule');
    const titleEl = document.getElementById('neural-doc-title');
    const capsuleTitle = document.getElementById('capsule-doc-title');
    const teleprompter = document.getElementById('neural-teleprompter-area');
    const estTimeEl = document.getElementById('neural-est-time');
    const pageSelect = document.getElementById('neural-page-select');

    if (!overlay) return;

    // Open overlay
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    if (capsule) capsule.classList.remove('active');

    // Display loading state
    const displayTitle = customTitle || filename.replace(/^\d+-\d+-/, '');
    if (titleEl) titleEl.textContent = displayTitle;
    if (capsuleTitle) capsuleTitle.textContent = displayTitle;
    if (teleprompter) teleprompter.innerHTML = '<div class="teleprompter-empty">⚡ Extracting high-fidelity neural audio stream from document...</div>';

    try {
      const res = await fetch(`/api/pdf/audio-content/${encodeURIComponent(filename)}`, {
        credentials: 'same-origin'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract text from document.');
      }

      state.docData = data;
      state.currentPageIdx = startPageIdx || 0;
      state.currentSentenceIdx = startSentenceIdx || 0;

      if (titleEl) titleEl.textContent = data.title;
      if (capsuleTitle) capsuleTitle.textContent = data.title;
      if (estTimeEl) estTimeEl.textContent = `${data.estimatedMinutes} min listen (${data.totalWords} words)`;

      // Populate Page Dropdown
      if (pageSelect) {
        pageSelect.innerHTML = '';
        data.pages.forEach((p, idx) => {
          const opt = document.createElement('option');
          opt.value = idx;
          opt.textContent = `Page ${p.pageNum} (${p.wordCount} words)`;
          pageSelect.appendChild(opt);
        });
      }

      setPage(state.currentPageIdx);
      if (startSentenceIdx) {
        state.currentSentenceIdx = startSentenceIdx;
      }

      // Configure text and audio download buttons
      const dlTextBtn = document.getElementById('neural-btn-dl-text');
      const dlAudioBtn = document.getElementById('neural-btn-dl-audio');
      const fullTextContent = document.getElementById('neural-fulltext-content');
      if (dlTextBtn) {
        dlTextBtn.href = `/api/pdf/download-text/${encodeURIComponent(filename)}`;
        dlTextBtn.setAttribute('download', (customTitle || filename).replace(/\.pdf$/i, '') + '.txt');
      }
      if (dlAudioBtn) {
        dlAudioBtn.href = `/api/pdf/download-audio/${encodeURIComponent(filename)}`;
        dlAudioBtn.setAttribute('download', (customTitle || filename).replace(/\.pdf$/i, '') + '.mp3');
      }
      if (fullTextContent) {
        fullTextContent.textContent = data.fullText || '';
      }

      // Start playing automatically
      state.isPlaying = true;
      updatePlayButtonUI();
      playCurrentSentence();

    } catch (err) {
      if (teleprompter) {
        teleprompter.innerHTML = `<div class="teleprompter-empty" style="color:#ef4444;">❌ ${err.message}</div>`;
      }
    }
  }

  // ─── Attach Listeners to Document Cards on Page ────────────────────
  function attachListenButtons() {
    // 1. In Catalog Cards
    document.querySelectorAll('.doc-card').forEach(card => {
      if (card.querySelector('.btn-doc-listen')) return;

      const actions = card.querySelector('.doc-card-actions');
      if (actions) {
        const listenBtn = document.createElement('button');
        listenBtn.type = 'button';
        listenBtn.className = 'btn-doc-listen';
        listenBtn.title = 'Neural Voice Reader (Listen Hands-Free)';
        listenBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
          </svg>
          <span>Listen</span>
        `;

        listenBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const docName = card.querySelector('.doc-name')?.textContent || 'Document';
          const downloadBtn = card.querySelector('.doc-download-btn');
          const href = downloadBtn?.getAttribute('href') || '';
          const filename = href.replace('/api/download/', '') || card.getAttribute('data-filename') || docName;
          playPdf(decodeURIComponent(filename), docName);
        });

        // Insert before Preview button
        const previewBtn = actions.querySelector('.doc-preview-btn');
        if (previewBtn) {
          actions.insertBefore(listenBtn, previewBtn);
        } else {
          actions.appendChild(listenBtn);
        }
      }
    });

    // 2. In Preview Modal
    const modal = document.getElementById('pdf-preview-modal');
    if (modal) {
      const modalHeaderActions = modal.querySelector('.modal-header-actions, .modal-actions');
      if (modalHeaderActions && !modalHeaderActions.querySelector('#modal-listen-btn')) {
        const listenModalBtn = document.createElement('button');
        listenModalBtn.type = 'button';
        listenModalBtn.id = 'modal-listen-btn';
        listenModalBtn.className = 'modal-btn-listen';
        listenModalBtn.title = 'Listen with Neural Voice Reader';
        listenModalBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
          </svg>
          <span>🎙️ Listen</span>
        `;

        listenModalBtn.addEventListener('click', () => {
          const title = document.getElementById('modal-doc-title')?.textContent || 'Document';
          const iframe = document.getElementById('modal-pdf-frame');
          const src = iframe?.getAttribute('src') || '';
          const filename = src.replace('/api/preview/', '');
          if (filename) {
            playPdf(decodeURIComponent(filename), title);
          }
        });

        modalHeaderActions.insertBefore(listenModalBtn, modalHeaderActions.firstChild);
      }
    }
  }

  // ─── Export Global API ─────────────────────────────────────────────
  window.VaultAudioReader = {
    playPdf,
    togglePlay,
    stop: stopPlayback,
    setPage,
    open: () => {
      injectPlayerDOM();
      const overlay = document.getElementById('neural-reader-overlay');
      if (overlay) overlay.classList.add('active');
    },
    close: () => {
      const overlay = document.getElementById('neural-reader-overlay');
      if (overlay) overlay.classList.remove('active');
    }
  };

  // Run on load and periodically observe dynamic catalog additions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectPlayerDOM();
      attachListenButtons();
      restoreSessionIfAny();
    });
  } else {
    injectPlayerDOM();
    attachListenButtons();
    restoreSessionIfAny();
  }

  // Observe grid changes (e.g. search, filters, async load)
  const observer = new MutationObserver(() => {
    attachListenButtons();
  });
  const grid = document.getElementById('document-grid') || document.querySelector('.documents-grid');
  if (grid) {
    observer.observe(grid, { childList: true, subtree: true });
  }

})();
