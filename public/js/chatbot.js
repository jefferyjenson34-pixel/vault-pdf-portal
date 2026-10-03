/* ═══════════════════════════════════════════════════════════════
   VAULT AI ASSISTANT — Floating Chatbot Widget Client
   OpenRouter Multi-Model Stream • Strict In-Memory Session
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Ephemeral In-Memory State ───────────────────────────────
  // CRITICAL CONSTRAINT: History lives strictly in JavaScript memory.
  // Strictly last 6 messages per specification.
  const conversationHistory = [];
  let isSending = false;

  // ─── Procedural Web Audio Synth for Cyber Chimes ────────────
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

  // ─── Injection of Chatbot DOM Structure ──────────────────────
  function initChatbotDOM() {
    let trigger = document.getElementById('vault-chat-trigger');
    let dialog = document.getElementById('vault-chat-dialog');

    // 1. Create floating trigger button if not present
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.className = 'vault-chat-trigger';
      trigger.id = 'vault-chat-trigger';
      trigger.setAttribute('aria-label', 'Open Vault AI Assistant');
      trigger.innerHTML = `
        <span class="vault-chat-badge-dot" aria-hidden="true"></span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      document.body.appendChild(trigger);
    }

    // 2. Create chat window dialog if not present
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.className = 'vault-chat-dialog';
      dialog.id = 'vault-chat-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'false');
      dialog.setAttribute('aria-label', 'Vault AI Assistant');

      dialog.innerHTML = `
        <div class="vault-chat-header">
          <div class="vault-chat-header-info">
            <div class="vault-chat-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div class="vault-chat-title-group">
              <h3>Halimon</h3>
              <span><span class="vault-chat-status-indicator"></span> Vault AI Assistant &bull; Online</span>
            </div>
          </div>
          <div class="vault-chat-header-actions">
            <button class="vault-chat-header-btn" id="vault-chat-btn-clear" title="Clear memory conversation">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
            </button>
            <button class="vault-chat-header-btn" id="vault-chat-btn-close" title="Close chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="vault-chat-privacy-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Memory-only chat &bull; Streaming OpenRouter &bull; Zero tracking.</span>
        </div>

        <div class="vault-chat-messages" id="vault-chat-messages">
          <!-- Messages rendered here -->
        </div>

        <div class="vault-chat-input-area">
          <form class="vault-chat-input-form" id="vault-chat-form">
            <input type="text" class="vault-chat-input" id="vault-chat-input" placeholder="Ask Halimon about Vault features..." maxlength="500" autocomplete="off" spellcheck="false" required>
            <button type="submit" class="vault-chat-send-btn" id="vault-chat-send" aria-label="Send message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
          <div class="vault-chat-meta-bar">
            <span>Encrypted ephemeral memory</span>
            <span id="vault-chat-counter">0/500</span>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    setupEvents(trigger, dialog);
    renderInitialGreeting();
  }

  // ─── Initial Bot Greeting with Suggestion Chips ──────────────
  function renderInitialGreeting() {
    const messagesContainer = document.getElementById('vault-chat-messages');
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';

    const greetingMsg = document.createElement('div');
    greetingMsg.className = 'vault-msg bot';
    greetingMsg.innerHTML = `
      <div class="vault-msg-content">
        Hello! I am <strong>Halimon</strong>, your official Vault AI Assistant. Ask me anything about document uploads, 16-character secret codes, neural audio listening, or security!
        <div class="vault-chat-suggestions">
          <button class="vault-suggestion-chip" data-query="How do secret codes work for private sharing?">
            <span>🔑 How do secret codes work?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="What are the PDF upload limits?">
            <span>📤 What are the upload limits?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="How does the Neural Voice Reader work?">
            <span>🎙️ How does Audio Reader work?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="How does the Quantum Scanner work?">
            <span>⚡ How does the Scanner work?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
        </div>
      </div>
      <span class="vault-msg-time">Just now</span>
    `;

    messagesContainer.appendChild(greetingMsg);

    // Bind suggestion chips
    greetingMsg.querySelectorAll('.vault-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        const input = document.getElementById('vault-chat-input');
        if (input) input.value = query;
        handleSendMessage(query);
      });
    });
  }

  // ─── Setup Event Listeners ───────────────────────────────────
  function setupEvents(trigger, dialog) {
    const closeBtn = document.getElementById('vault-chat-btn-close');
    const clearBtn = document.getElementById('vault-chat-btn-clear');
    const form = document.getElementById('vault-chat-form');
    const input = document.getElementById('vault-chat-input');
    const counterEl = document.getElementById('vault-chat-counter');

    // Toggle dialog visibility
    trigger.addEventListener('click', () => {
      const isActive = dialog.classList.contains('active');
      if (isActive) {
        dialog.classList.remove('active');
      } else {
        dialog.classList.add('active');
        playCyberChime('chime');
        if (input) setTimeout(() => input.focus(), 200);
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialog.classList.remove('active');
      });
    }

    // Escape key closes dialog
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialog.classList.contains('active')) {
        dialog.classList.remove('active');
      }
    });

    // Clear history
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        conversationHistory.length = 0;
        renderInitialGreeting();
        if (input) input.value = '';
        if (counterEl) counterEl.textContent = '0/500';
        playCyberChime('clear');
      });
    }

    // Character counter listener
    if (input && counterEl) {
      input.addEventListener('input', () => {
        const len = input.value.length;
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

    // Form submit
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage(input.value);
      });
    }
  }

  // ─── Send Message & SSE Streaming Handler ────────────────────
  async function handleSendMessage(rawText) {
    if (isSending) return;
    const trimmed = (rawText || '').trim();
    if (!trimmed) return;
    if (trimmed.length > 500) return;

    const input = document.getElementById('vault-chat-input');
    const sendBtn = document.getElementById('vault-chat-send');
    const messagesContainer = document.getElementById('vault-chat-messages');
    const counterEl = document.getElementById('vault-chat-counter');

    if (input) input.value = '';
    if (counterEl) counterEl.textContent = '0/500';
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;
    isSending = true;

    // 1. Render user message
    const userMsg = document.createElement('div');
    userMsg.className = 'vault-msg user';
    userMsg.innerHTML = `
      <div class="vault-msg-content">${escapeHtml(trimmed)}</div>
      <span class="vault-msg-time">Just now</span>
    `;
    if (messagesContainer) {
      messagesContainer.appendChild(userMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add to in-memory history (last 6 strictly per spec)
    conversationHistory.push({ role: 'user', content: trimmed });

    // 2. Prepare bot message bubble with streaming cursor
    const botMsg = document.createElement('div');
    botMsg.className = 'vault-msg bot';
    botMsg.innerHTML = `
      <div class="vault-msg-content"></div>
      <span class="vault-msg-time">Just now</span>
    `;
    if (messagesContainer) {
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const botContentEl = botMsg.querySelector('.vault-msg-content');
    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'chat-cursor';
    if (botContentEl) botContentEl.appendChild(cursorSpan);

    let accumulatedReply = '';

    try {
      // Send last 6 messages
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
                if (botContentEl) {
                  botContentEl.textContent = accumulatedReply;
                  botContentEl.appendChild(cursorSpan);
                }
                if (messagesContainer) {
                  messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
              }
            } catch (_) {}
          }
        }
      } else {
        const data = await response.json().catch(() => ({}));
        accumulatedReply = data.reply || "The assistant is busy right now. Please try again later or use the Contact page.";
      }
    } catch (err) {
      // Safe failure message per specification
      accumulatedReply = "The assistant is busy right now. Please try again later or use the Contact page.";
    } finally {
      if (cursorSpan && cursorSpan.parentNode) {
        cursorSpan.parentNode.removeChild(cursorSpan);
      }
      if (botContentEl) {
        botContentEl.textContent = accumulatedReply || "The assistant is busy right now. Please try again later or use the Contact page.";
      }
      conversationHistory.push({ role: 'assistant', content: accumulatedReply });

      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }

  // Helper: basic html escaping
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Initialize on DOM Ready ────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbotDOM);
  } else {
    initChatbotDOM();
  }
})();
