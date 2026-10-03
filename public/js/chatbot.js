/* ═══════════════════════════════════════════════════════════════
   HALIMON — VAULT AI ASSISTANT & OPENROUTER CHAT CONTROLLER
   Vault PDF Portal • Enterprise Document Security
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // In-memory conversation history (strictly last 6 messages per spec)
  const conversationHistory = [];

  // Procedural Web Audio Synth for Cyber Chimes
  function playCyberChime(type = 'chime') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      if (type === 'clear') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.21);
      } else {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          gain.gain.setValueAtTime(0.04, now + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.26);
        });
      }
    } catch (_) {}
  }

  function initChatbot() {
    // Hero Chat Elements
    const heroForm = document.getElementById('hero-chat-form');
    const heroInput = document.getElementById('hero-chat-input');
    const heroSendBtn = document.getElementById('hero-chat-send');
    const heroMessagesEl = document.getElementById('hero-chat-messages');
    const heroCounterEl = document.getElementById('hero-chat-counter');
    const heroSuggestionsEl = document.getElementById('hero-chat-suggestions');
    const heroClearBtn = document.getElementById('hero-chat-clear');

    // Modal Chat Elements (secondary / fallback)
    const chatModal = document.getElementById('halimon-chat-modal');
    const chatModalClose = document.getElementById('chat-modal-close');
    const chatModalBackdrop = document.getElementById('chat-modal-backdrop');
    const modalForm = document.getElementById('chat-modal-form');
    const modalInput = document.getElementById('chat-modal-input');
    const modalSendBtn = document.getElementById('chat-modal-send');
    const modalMessagesEl = document.getElementById('chat-modal-messages');
    const modalCounterEl = document.getElementById('chat-char-counter');
    const modalChips = document.getElementById('chat-modal-chips');

    // Initial greeting template
    const INITIAL_BOT_GREETING = `Hello! I am <strong>Halimon</strong>, your Vault AI Assistant. Ask me anything about PDF uploads, 16-character secret codes, neural audio listening, or security!`;

    // Reset Chat Memory
    function clearChatHistory() {
      conversationHistory.length = 0;
      if (heroMessagesEl) {
        heroMessagesEl.innerHTML = `
          <div class="chat-bubble bot-bubble">
            <div class="chat-bubble-avatar">🤖</div>
            <div class="chat-bubble-body">
              <div class="chat-bubble-sender">Halimon</div>
              <div class="chat-bubble-text">${INITIAL_BOT_GREETING}</div>
              <span class="chat-bubble-time">Just now</span>
            </div>
          </div>
        `;
      }
      if (modalMessagesEl) {
        modalMessagesEl.innerHTML = `
          <div class="chat-msg bot-msg">
            <div class="msg-avatar">🤖</div>
            <div class="msg-content">
              <div class="msg-sender">Halimon</div>
              <div class="msg-text">${INITIAL_BOT_GREETING}</div>
              <div class="msg-time">Just now</div>
            </div>
          </div>
        `;
      }
      if (heroInput) {
        heroInput.value = '';
        if (heroCounterEl) {
          heroCounterEl.textContent = '0/500';
          heroCounterEl.style.color = '#64748b';
        }
      }
      playCyberChime('clear');
    }

    if (heroClearBtn) {
      heroClearBtn.addEventListener('click', clearChatHistory);
    }

    // Input character counter listener
    function bindCharCounter(inputEl, counterEl) {
      if (!inputEl || !counterEl) return;
      inputEl.addEventListener('input', () => {
        const len = inputEl.value.length;
        counterEl.textContent = `${len}/500`;
        if (len >= 500) {
          counterEl.style.color = '#ef4444';
        } else if (len >= 450) {
          counterEl.style.color = '#f59e0b';
        } else {
          counterEl.style.color = '#64748b';
        }
      });
    }

    bindCharCounter(heroInput, heroCounterEl);
    bindCharCounter(modalInput, modalCounterEl);

    // Modal open/close support
    function openChatModal() {
      if (!chatModal) return;
      chatModal.classList.add('is-open');
      chatModal.setAttribute('aria-hidden', 'false');
      if (modalInput) setTimeout(() => modalInput.focus(), 250);
    }

    function closeChatModal() {
      if (!chatModal) return;
      chatModal.classList.remove('is-open');
      chatModal.setAttribute('aria-hidden', 'true');
    }

    if (chatModalClose) chatModalClose.addEventListener('click', closeChatModal);
    if (chatModalBackdrop) chatModalBackdrop.addEventListener('click', closeChatModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatModal && chatModal.classList.contains('is-open')) {
        closeChatModal();
      }
    });

    // Append Message to Hero UI
    function appendHeroMessage(role, content) {
      if (!heroMessagesEl) return null;
      const isUser = role === 'user';
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`;

      const avatar = isUser ? '👤' : '🤖';
      const sender = isUser ? 'You' : 'Halimon';

      bubble.innerHTML = `
        <div class="chat-bubble-avatar">${avatar}</div>
        <div class="chat-bubble-body">
          <div class="chat-bubble-sender">${sender}</div>
          <div class="chat-bubble-text">${content}</div>
          <span class="chat-bubble-time">Just now</span>
        </div>
      `;

      heroMessagesEl.appendChild(bubble);
      heroMessagesEl.scrollTop = heroMessagesEl.scrollHeight;
      return bubble.querySelector('.chat-bubble-text');
    }

    // Submit Prompt & Stream Response via SSE
    async function submitChat(rawText, source = 'hero') {
      const trimmed = (rawText || '').trim();
      if (!trimmed) return;
      if (trimmed.length > 500) return;

      const isHero = source === 'hero' || !modalForm;
      const activeInput = isHero ? heroInput : modalInput;
      const activeSendBtn = isHero ? heroSendBtn : modalSendBtn;
      const activeCounter = isHero ? heroCounterEl : modalCounterEl;
      const activeMessagesEl = isHero ? heroMessagesEl : modalMessagesEl;

      if (activeInput) activeInput.value = '';
      if (activeCounter) {
        activeCounter.textContent = '0/500';
        activeCounter.style.color = '#64748b';
      }
      if (activeSendBtn) activeSendBtn.disabled = true;
      if (activeInput) activeInput.disabled = true;

      // 1. Render user message
      if (isHero) {
        appendHeroMessage('user', escapeHtml(trimmed));
      } else if (modalMessagesEl) {
        const uMsg = document.createElement('div');
        uMsg.className = 'chat-msg user-msg';
        uMsg.innerHTML = `
          <div class="msg-avatar">👤</div>
          <div class="msg-content">
            <div class="msg-sender">You</div>
            <div class="msg-text">${escapeHtml(trimmed)}</div>
            <div class="msg-time">Just now</div>
          </div>
        `;
        modalMessagesEl.appendChild(uMsg);
        modalMessagesEl.scrollTop = modalMessagesEl.scrollHeight;
      }
      conversationHistory.push({ role: 'user', content: trimmed });

      // 2. Prepare bot bubble with streaming cursor
      let botTextEl = null;
      const cursorSpan = document.createElement('span');
      cursorSpan.className = 'chat-cursor';

      if (isHero) {
        botTextEl = appendHeroMessage('bot', '');
        if (botTextEl) botTextEl.appendChild(cursorSpan);
      } else if (modalMessagesEl) {
        const bMsg = document.createElement('div');
        bMsg.className = 'chat-msg bot-msg';
        bMsg.innerHTML = `
          <div class="msg-avatar">🤖</div>
          <div class="msg-content">
            <div class="msg-sender">Halimon</div>
            <div class="msg-text"></div>
            <div class="msg-time">Just now</div>
          </div>
        `;
        modalMessagesEl.appendChild(bMsg);
        modalMessagesEl.scrollTop = modalMessagesEl.scrollHeight;
        botTextEl = bMsg.querySelector('.msg-text');
        if (botTextEl) botTextEl.appendChild(cursorSpan);
      }

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
                  if (activeMessagesEl) activeMessagesEl.scrollTop = activeMessagesEl.scrollHeight;
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

        if (activeSendBtn) activeSendBtn.disabled = false;
        if (activeInput) {
          activeInput.disabled = false;
          activeInput.focus();
        }
        if (activeMessagesEl) activeMessagesEl.scrollTop = activeMessagesEl.scrollHeight;
      }
    }

    // Quick suggestion chips handler
    if (heroSuggestionsEl) {
      heroSuggestionsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.chat-suggestion-chip');
        if (!chip) return;
        const queryText = chip.getAttribute('data-query') || chip.textContent.trim();
        if (heroInput) heroInput.value = queryText;
        if (heroCounterEl) heroCounterEl.textContent = `${queryText.length}/500`;
        submitChat(queryText, 'hero');
      });
    }

    if (modalChips) {
      modalChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chat-chip');
        if (!chip) return;
        const queryText = chip.getAttribute('data-q') || chip.textContent.trim();
        if (modalInput) modalInput.value = queryText;
        submitChat(queryText, 'modal');
      });
    }

    // Hero Form submit
    if (heroForm && heroInput) {
      heroForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitChat(heroInput.value, 'hero');
      });
    }

    // Modal Form submit
    if (modalForm && modalInput) {
      modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitChat(modalInput.value, 'modal');
      });
    }

    // Helper: basic html escaping
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
