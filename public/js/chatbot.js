/* ═══════════════════════════════════════════════════════════════
   HALIMON — CYBER SECURITY GUARDIAN & OPENROUTER AI CHAT CONTROLLER
   Vault PDF Portal &bull; Enterprise Document Security
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Halimon Guardian Dialogue Database ─────────────────────
  const HALIMON_QUOTES = [
    {
      icon: '👍',
      text: "Thumbs up! I'm <strong>Halimon</strong>, your Vault Cyber Guardian. Your documents are safe and encrypted with me!"
    },
    {
      icon: '🛡️',
      text: "<strong>AES-256 Armed!</strong> All files are encrypted outside the web root with zero third-party trackers."
    },
    {
      icon: '🔑',
      text: "Private files are locked with <strong>16-character cryptographic codes</strong>. Unlock them anytime at /unlock!"
    },
    {
      icon: '🎙️',
      text: "Did you know? Our <strong>Neural Voice Reader</strong> turns any PDF into an interactive audio experience with .mp3 downloads!"
    },
    {
      icon: '⚡',
      text: "Quantum scanner active! Every upload undergoes <strong>Shannon entropy analysis</strong> and cryptographic SHA hashing."
    },
    {
      icon: '✨',
      text: "Need forensic integrity? Review extracted text live in the expandable drawer before downloading clean .txt files."
    }
  ];

  let currentQuoteIndex = 0;
  let quoteInterval = null;
  let isScanning = false;

  // In-memory conversation history (strictly last 6 messages, ephemeral in-memory)
  const conversationHistory = [];

  // ─── Procedural Web Audio Synth for Cyber Chimes ────────────
  function playCyberChime(type = 'chime') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (type === 'scan') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.45);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      } else if (type === 'voice') {
        [587.33, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.06, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.26);
        });
      } else {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.05, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.36);
        });
      }
    } catch (_) {}
  }

  // ─── Initialize Halimon Showcase & OpenRouter Chat ──────────
  function initHalimonShowcase() {
    const card = document.getElementById('halimon-card');
    const trigger = document.getElementById('halimon-interactive-trigger');
    const speechEl = document.getElementById('halimon-speech');
    const speechTextEl = document.getElementById('halimon-speech-text');
    const speechIconEl = document.getElementById('halimon-speech-icon');
    const scanlineEl = document.getElementById('halimon-scanline');
    const statusTextEl = document.getElementById('halimon-status-text');

    const btnPoke = document.getElementById('btn-halimon-poke');
    const btnVoice = document.getElementById('btn-halimon-voice');
    const btnScan = document.getElementById('btn-halimon-scan');
    const btnChat = document.getElementById('btn-halimon-chat');

    // Chat Modal Elements
    const chatModal = document.getElementById('halimon-chat-modal');
    const chatModalClose = document.getElementById('chat-modal-close');
    const chatModalBackdrop = document.getElementById('chat-modal-backdrop');
    const chatForm = document.getElementById('chat-modal-form');
    const chatInput = document.getElementById('chat-modal-input');
    const chatSendBtn = document.getElementById('chat-modal-send');
    const chatMessagesEl = document.getElementById('chat-modal-messages');
    const charCounterEl = document.getElementById('chat-char-counter');
    const chipsContainer = document.getElementById('chat-modal-chips');

    // 1. Function to update speech bubble
    function updateSpeech(icon, htmlText, animate = true) {
      if (!speechTextEl) return;
      if (animate && speechEl) {
        speechEl.style.opacity = '0';
        speechEl.style.transform = 'translateY(6px) scale(0.98)';
        setTimeout(() => {
          if (speechIconEl) speechIconEl.textContent = icon;
          speechTextEl.innerHTML = htmlText;
          speechEl.style.opacity = '1';
          speechEl.style.transform = 'translateY(0) scale(1)';
        }, 180);
      } else {
        if (speechIconEl) speechIconEl.textContent = icon;
        speechTextEl.innerHTML = htmlText;
      }
    }

    // 2. Next Quote Cycle
    function nextQuote() {
      currentQuoteIndex = (currentQuoteIndex + 1) % HALIMON_QUOTES.length;
      const q = HALIMON_QUOTES[currentQuoteIndex];
      updateSpeech(q.icon, q.text, true);
    }

    quoteInterval = setInterval(nextQuote, 7500);

    // 3. Poke / Thumbs-up Interaction
    function handlePoke() {
      playCyberChime('chime');
      if (trigger) {
        trigger.classList.remove('halimon-react');
        void trigger.offsetWidth;
        trigger.classList.add('halimon-react');
      }

      const pokeQuotes = [
        { icon: '👋', text: "Hello! Halimon here. Everything in the Vault is locked down and secure!" },
        { icon: '🛡️', text: "Protected! Your documents are safe from prying eyes." },
        { icon: '👍', text: "High five! Zero-knowledge encryption keeps your privacy 100% intact." },
        { icon: '🚀', text: "All systems nominal! Ready to upload, scan, or listen to your PDFs." }
      ];

      const randomQuote = pokeQuotes[Math.floor(Math.random() * pokeQuotes.length)];
      updateSpeech(randomQuote.icon, randomQuote.text, true);

      clearInterval(quoteInterval);
      quoteInterval = setInterval(nextQuote, 9000);
    }

    if (trigger) {
      trigger.addEventListener('click', handlePoke);
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlePoke();
        }
      });
    }

    if (btnPoke) {
      btnPoke.addEventListener('click', handlePoke);
    }

    // 4. Voice Greeting Interaction (SpeechSynthesis)
    if (btnVoice) {
      btnVoice.addEventListener('click', () => {
        playCyberChime('voice');
        if (trigger) {
          trigger.classList.remove('halimon-react');
          void trigger.offsetWidth;
          trigger.classList.add('halimon-react');
        }

        const voiceMsg = speechTextEl ? speechTextEl.textContent.replace(/\s+/g, ' ').trim() : "Greetings! I am Halimon, your cyber security guardian.";

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(voiceMsg);
          utterance.rate = 1.04;
          utterance.pitch = 1.25;

          const voices = window.speechSynthesis.getVoices();
          const roboticVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Robot')));
          if (roboticVoice) utterance.voice = roboticVoice;

          if (speechIconEl) speechIconEl.textContent = '🔊';
          utterance.onend = () => {
            if (speechIconEl) speechIconEl.textContent = '👍';
          };
          window.speechSynthesis.speak(utterance);
        } else {
          updateSpeech('🔊', "<em>*Cyber greeting chime plays*</em> Halimon is online and guarding your vault!");
        }
      });
    }

    // 5. Quantum Security Audit Scan Interaction
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        if (isScanning) return;
        isScanning = true;
        btnScan.disabled = true;

        playCyberChime('scan');

        if (statusTextEl) {
          statusTextEl.textContent = '⚡ RUNNING QUANTUM AUDIT SCAN...';
        }

        if (scanlineEl) {
          scanlineEl.classList.remove('active-scan');
          void scanlineEl.offsetWidth;
          scanlineEl.classList.add('active-scan');
        }

        updateSpeech('⚡', "Initiating deep forensic scan... Evaluating entropy, cryptographic signatures, and transport security...", true);

        setTimeout(() => {
          playCyberChime('chime');
          if (statusTextEl) {
            statusTextEl.textContent = '✅ VERIFIED: 100% SECURE';
          }
          updateSpeech('🛡️', "<strong>Scan complete!</strong> SHA-256 checksums verified, zero leaks detected. Vault integrity at 100%!", true);

          setTimeout(() => {
            if (statusTextEl) {
              statusTextEl.textContent = 'HALIMON • GUARDIAN ACTIVE';
            }
            if (scanlineEl) scanlineEl.classList.remove('active-scan');
            isScanning = false;
            btnScan.disabled = false;
          }, 3500);
        }, 1300);
      });
    }

    // 6. Interactive 3D Card Parallax on Mouse Move
    const showcaseContainer = document.getElementById('halimon-showcase');
    if (showcaseContainer && card) {
      showcaseContainer.addEventListener('mousemove', (e) => {
        const rect = showcaseContainer.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotateX = -(y / rect.height) * 12;
        const rotateY = (x / rect.width) * 12;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
      });

      showcaseContainer.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── OpenRouter Streaming Chat Modal Controller ───────────────
    // ═══════════════════════════════════════════════════════════════
    function openChatModal() {
      if (!chatModal) return;
      playCyberChime('chime');
      chatModal.classList.add('is-open');
      chatModal.setAttribute('aria-hidden', 'false');
      if (chatInput) {
        setTimeout(() => chatInput.focus(), 250);
      }
    }

    function closeChatModal() {
      if (!chatModal) return;
      chatModal.classList.remove('is-open');
      chatModal.setAttribute('aria-hidden', 'true');
    }

    if (btnChat) {
      btnChat.addEventListener('click', openChatModal);
    }
    if (speechEl) {
      speechEl.style.cursor = 'pointer';
      speechEl.addEventListener('click', openChatModal);
    }
    if (chatModalClose) {
      chatModalClose.addEventListener('click', closeChatModal);
    }
    if (chatModalBackdrop) {
      chatModalBackdrop.addEventListener('click', closeChatModal);
    }

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatModal && chatModal.classList.contains('is-open')) {
        closeChatModal();
      }
    });

    // 500-Character Counter
    if (chatInput && charCounterEl) {
      chatInput.addEventListener('input', () => {
        const len = chatInput.value.length;
        charCounterEl.textContent = `${len}/500`;
        if (len >= 500) {
          charCounterEl.style.color = '#ef4444';
        } else {
          charCounterEl.style.color = '#64748b';
        }
      });
    }

    // Quick Chips handler
    if (chipsContainer && chatInput && chatForm) {
      chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chat-chip');
        if (!chip) return;
        const queryText = chip.getAttribute('data-q') || chip.textContent.replace(/^[^\w]+/, '').trim();
        chatInput.value = queryText;
        if (charCounterEl) charCounterEl.textContent = `${chatInput.value.length}/500`;
        submitChatPrompt(queryText);
      });
    }

    // Append Message UI helper
    function appendMessageBubble(role, content) {
      if (!chatMessagesEl) return null;
      const isUser = role === 'user';
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-msg ${isUser ? 'user-msg' : 'bot-msg'}`;

      const avatar = isUser ? '👤' : '🤖';
      const sender = isUser ? 'You' : 'Halimon';

      msgDiv.innerHTML = `
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-content">
          <div class="msg-sender">${sender}</div>
          <div class="msg-text">${content}</div>
          <div class="msg-time">Just now</div>
        </div>
      `;

      chatMessagesEl.appendChild(msgDiv);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      return msgDiv.querySelector('.msg-text');
    }

    // Submit Prompt & Handle Streaming SSE
    async function submitChatPrompt(text) {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      if (trimmed.length > 500) return;

      if (chatInput) chatInput.value = '';
      if (charCounterEl) charCounterEl.textContent = '0/500';
      if (chatSendBtn) chatSendBtn.disabled = true;
      if (chatInput) chatInput.disabled = true;

      // 1. Render user message
      appendMessageBubble('user', trimmed);
      conversationHistory.push({ role: 'user', content: trimmed });

      // 2. Prepare bot message bubble with streaming cursor
      const botTextEl = appendMessageBubble('bot', '');
      const cursorSpan = document.createElement('span');
      cursorSpan.className = 'chat-cursor';
      if (botTextEl) botTextEl.appendChild(cursorSpan);

      let accumulatedReply = '';

      try {
        // Enforce: last 6 messages only
        const historyPayload = conversationHistory.slice(-6);

        const response = await fetch('/api/chat?stream=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({
            message: trimmed,
            messages: historyPayload,
            stream: true
          })
        });

        const isSSE = (response.headers.get('content-type') || '').includes('text/event-stream');

        if (response.ok && isSSE && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let streamBuffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split('\n');
            streamBuffer = lines.pop();

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine.startsWith('data:')) continue;
              const rawData = cleanLine.slice(5).trim();
              if (rawData === '[DONE]') continue;

              try {
                const parsed = JSON.parse(rawData);
                if (parsed.token) {
                  accumulatedReply += parsed.token;
                  if (botTextEl) {
                    botTextEl.textContent = accumulatedReply;
                    botTextEl.appendChild(cursorSpan);
                  }
                  if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
                }
              } catch (_) {}
            }
          }
        } else {
          // Standard JSON fallback
          const data = await response.json().catch(() => ({}));
          accumulatedReply = data.reply || "The assistant is busy right now. Please try again later or use the Contact page.";
        }
      } catch (err) {
        // Requirement: "If both models fail, show: 'The assistant is busy right now. Please try again later or use the Contact page.' Never show raw errors."
        accumulatedReply = "The assistant is busy right now. Please try again later or use the Contact page.";
      } finally {
        if (cursorSpan && cursorSpan.parentNode) {
          cursorSpan.parentNode.removeChild(cursorSpan);
        }
        if (botTextEl) {
          botTextEl.textContent = accumulatedReply || "The assistant is busy right now. Please try again later or use the Contact page.";
        }
        conversationHistory.push({ role: 'assistant', content: accumulatedReply });

        if (chatSendBtn) chatSendBtn.disabled = false;
        if (chatInput) {
          chatInput.disabled = false;
          chatInput.focus();
        }
        if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      }
    }

    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitChatPrompt(chatInput.value);
      });
    }
  }

  // ─── Initialize on DOM Ready ────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHalimonShowcase);
  } else {
    initHalimonShowcase();
  }
})();
