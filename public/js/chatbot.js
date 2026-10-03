/* ═══════════════════════════════════════════════════════════════
   VAULT AI ASSISTANT — Floating Chatbot Widget Client
   Strict In-Memory Session (Zero Database / Zero Local Storage)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Ephemeral In-Memory State ───────────────────────────────
  // CRITICAL CONSTRAINT: History lives strictly in JavaScript memory.
  // Never written to localStorage, sessionStorage, or databases.
  let conversationHistory = [];
  let remainingMessages = 20;
  let isSending = false;

  // ─── Injection of Chatbot DOM Structure ──────────────────────
  function initChatbotDOM() {
    // 1. Create floating trigger button
    const trigger = document.createElement('button');
    trigger.className = 'vault-chat-trigger';
    trigger.id = 'vault-chat-trigger';
    trigger.setAttribute('aria-label', 'Open Halimon AI Assistant');
    trigger.title = 'Chat with Halimon';
    trigger.innerHTML = `
      <span class="vault-chat-badge-dot" aria-hidden="true"></span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;

    // 2. Create chat window dialog
    const dialog = document.createElement('div');
    dialog.className = 'vault-chat-dialog';
    dialog.id = 'vault-chat-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-label', 'Halimon AI Assistant');

    dialog.innerHTML = `
      <div class="vault-chat-header">
        <div class="vault-chat-header-info">
          <div class="vault-chat-avatar halimon-sentinel-avatar" style="width:36px; height:36px; animation: sentinelFloat 3s ease-in-out infinite;">
            <svg viewBox="0 0 100 100" class="halimon-sentinel-svg">
              <ellipse cx="50" cy="94" rx="20" ry="4" fill="#00f0ff" opacity="0.3"/>
              <path d="M30 68 L50 88 L70 68 L64 56 L36 56 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
              <polygon points="50,65 58,73 50,81 42,73" fill="#00f0ff" class="halimon-core-heart"/>
              <rect x="25" y="24" width="50" height="34" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
              <line x1="33" y1="24" x2="26" y2="10" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="26" cy="10" r="3.5" fill="#00f0ff" class="halimon-antenna-beacon"/>
              <line x1="67" y1="24" x2="74" y2="10" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="74" cy="10" r="3.5" fill="#00f0ff" class="halimon-antenna-beacon"/>
              <rect x="30" y="32" width="40" height="18" rx="8" fill="#020617" stroke="#00f0ff" stroke-width="1.5"/>
              <ellipse cx="42" cy="41" rx="4" ry="4" fill="#00f0ff" class="halimon-eye halimon-eye-left"/>
              <ellipse cx="58" cy="41" rx="4" ry="4" fill="#00f0ff" class="halimon-eye halimon-eye-right"/>
            </svg>
          </div>
          <div class="vault-chat-title-group">
            <h3>Halimon</h3>
            <span><span class="vault-chat-status-indicator"></span> Halimon AI Assistant &bull; Online</span>
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
        <span>Memory-only chat &bull; Wiped instantly when tab closes.</span>
      </div>

      <div class="vault-chat-messages" id="vault-chat-messages">
        <!-- Messages rendered here -->
      </div>

      <div class="vault-chat-input-area">
        <form class="vault-chat-input-form" id="vault-chat-form">
          <input type="text" class="vault-chat-input" id="vault-chat-input" placeholder="Ask Halimon about Vault features, uploading, codes..." maxlength="500" autocomplete="off" spellcheck="false">
          <button type="submit" class="vault-chat-send-btn" id="vault-chat-send" aria-label="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div class="vault-chat-meta-bar">
          <span id="vault-chat-cap-display">20 messages remaining this hour</span>
          <span>Max 500 chars</span>
        </div>
      </div>
    `;

    document.body.appendChild(trigger);
    document.body.appendChild(dialog);

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
        Hello! I am <strong>Halimon</strong>, the official Vault AI Assistant. I can answer any questions about using Vault PDF Portal, uploading documents, private sharing with secret codes, and security policies.
        <div class="vault-chat-suggestions">
          <button class="vault-suggestion-chip" data-query="How do secret codes work for private sharing?">
            <span>How do secret codes work?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="How do I upload a PDF document?">
            <span>How do I upload a PDF?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="What is your data tracking and privacy policy?">
            <span>What is your privacy policy?</span>
            <span style="font-size:0.9rem;">&rarr;</span>
          </button>
          <button class="vault-suggestion-chip" data-query="How can I report an inappropriate file?">
            <span>How do I report a file?</span>
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

    trigger.addEventListener('click', () => {
      const isActive = dialog.classList.contains('active');
      if (isActive) {
        dialog.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        dialog.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
        setTimeout(() => input && input.focus(), 200);
      }
    });

    closeBtn.addEventListener('click', () => {
      dialog.classList.remove('active');
      trigger.setAttribute('aria-expanded', 'false');
    });

    clearBtn.addEventListener('click', () => {
      conversationHistory = [];
      renderInitialGreeting();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || isSending) return;
      input.value = '';
      handleSendMessage(text);
    });
  }

  // ─── Send Message to Backend /api/chat ───────────────────────
  async function handleSendMessage(text) {
    if (!text || isSending) return;
    isSending = true;

    const messagesContainer = document.getElementById('vault-chat-messages');
    const sendBtn = document.getElementById('vault-chat-send');
    const capDisplay = document.getElementById('vault-chat-cap-display');
    if (sendBtn) sendBtn.disabled = true;

    // 1. Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'vault-msg user';
    userMsg.innerHTML = `
      <div class="vault-msg-content">${escapeHtml(text)}</div>
      <span class="vault-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    messagesContainer.appendChild(userMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Save to ephemeral in-memory conversation list
    conversationHistory.push({ role: 'user', text });

    // 2. Render Typing Indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'vault-typing';
    typingIndicator.id = 'vault-typing-indicator';
    typingIndicator.innerHTML = `
      <div class="vault-typing-dot"></div>
      <div class="vault-typing-dot"></div>
      <div class="vault-typing-dot"></div>
      <span class="vault-typing-label">Halimon is analyzing query...</span>
    `;
    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const MIN_ACK_DELAY = 5000; // Halimon will give an acknowledgment as soon as possible after 5 seconds
    let interimAckEl = null;

    // Interim acknowledgment timer at 5.0 seconds if backend is still processing
    const interimTimer = setTimeout(() => {
      if (isSending && !interimAckEl && document.getElementById('vault-typing-indicator')) {
        interimAckEl = document.createElement('div');
        interimAckEl.className = 'vault-msg bot vault-interim-ack';
        interimAckEl.id = 'halimon-interim-ack';
        interimAckEl.innerHTML = `
          <div class="vault-ack-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Acknowledged by Halimon (5s)
          </div>
          <div class="vault-msg-content">
            <strong>Halimon:</strong> Message acknowledged. Processing inquiry from Vault archives...
          </div>
        `;
        messagesContainer.insertBefore(interimAckEl, typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, MIN_ACK_DELAY);

    try {
      const fetchPromise = fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: conversationHistory.slice(-8)
        })
      });

      // Wait for response AND ensure minimum 5 seconds delay for prompt acknowledgment
      const [res] = await Promise.all([
        fetchPromise,
        new Promise(resolve => setTimeout(resolve, MIN_ACK_DELAY))
      ]);

      clearTimeout(interimTimer);
      const data = await res.json();
      typingIndicator.remove();
      if (interimAckEl) interimAckEl.remove();

      if (res.ok) {
        remainingMessages = data.remaining !== undefined ? data.remaining : remainingMessages;
        if (capDisplay) {
          capDisplay.textContent = `${remainingMessages} messages remaining this hour`;
        }

        const botReply = data.reply || "I am Halimon, the Vault AI Assistant. How may I assist you with your documents?";
        conversationHistory.push({ role: 'assistant', text: botReply });

        const botMsg = document.createElement('div');
        botMsg.className = 'vault-msg bot';
        botMsg.innerHTML = `
          <div class="vault-ack-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Acknowledged by Halimon (5s)
          </div>
          <div class="vault-msg-content">${formatReply(botReply)}</div>
          <span class="vault-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        `;
        messagesContainer.appendChild(botMsg);
      } else {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'vault-msg bot';
        errorMsg.innerHTML = `
          <div class="vault-msg-content" style="border-color: rgba(239,68,68,0.4); color:#fca5a5;">
            <strong>Notice:</strong> ${escapeHtml(data.error || 'Unable to process message at this time.')}
          </div>
          <span class="vault-msg-time">System</span>
        `;
        messagesContainer.appendChild(errorMsg);
      }
    } catch (err) {
      clearTimeout(interimTimer);
      typingIndicator.remove();
      if (interimAckEl) interimAckEl.remove();

      const networkErrorMsg = document.createElement('div');
      networkErrorMsg.className = 'vault-msg bot';
      networkErrorMsg.innerHTML = `
        <div class="vault-msg-content" style="border-color: rgba(239,68,68,0.4); color:#fca5a5;">
          Unable to contact Halimon server. Please check your connection.
        </div>
        <span class="vault-msg-time">Offline</span>
      `;
      messagesContainer.appendChild(networkErrorMsg);
    } finally {
      clearTimeout(interimTimer);
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // ─── Format Helpers ──────────────────────────────────────────
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatReply(text) {
    let clean = escapeHtml(text);
    // Format bold markdown **text**
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format code backticks `code`
    clean = clean.replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px; font-size:0.85em;">$1</code>');
    // Format links: /unlock, /register, /login, /dashboard, /contact
    clean = clean.replace(/(\/(?:unlock|register|login|dashboard|contact|about))/g, '<a href="$1" style="color:#a78bfa; text-decoration:underline; font-weight:600;">$1</a>');
    return clean;
  }

  // ─── Hero Section In-Page AI Chatbot ─────────────────────────
  function initHeroChatDOM() {
    const heroChatContainer = document.getElementById('hero-ai-chatbot');
    if (!heroChatContainer) return;

    const messagesEl = document.getElementById('hero-chat-messages');
    const formEl = document.getElementById('hero-chat-form');
    const inputEl = document.getElementById('hero-chat-input');
    const sendBtn = document.getElementById('hero-chat-send');
    const clearBtn = document.getElementById('hero-chat-clear');
    const avatarEl = document.getElementById('halimon-avatar');
    const charCountEl = document.getElementById('hero-chat-char-count');
    const suggestionChips = heroChatContainer.querySelectorAll('.chat-suggestion-chip');

    if (!formEl || !inputEl || !messagesEl) return;

    // Character counter
    inputEl.addEventListener('input', () => {
      const remaining = 500 - inputEl.value.length;
      if (charCountEl) {
        charCountEl.textContent = `${remaining} chars left`;
      }
    });

    // Clear chat
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        conversationHistory = [];
        messagesEl.innerHTML = `
          <div class="chat-bubble bot-bubble">
            <div class="chat-bubble-avatar">🤖</div>
            <div class="chat-bubble-body">
              <div class="chat-bubble-sender">Halimon</div>
              <div class="chat-bubble-text">
                Chat cleared. Hello! I am <strong>Halimon</strong>, your Vault AI Assistant. Ask me anything about uploading files, private 16-character secret codes, neural audio reading, document scanning, or security!
              </div>
              <span class="chat-bubble-time">Just now</span>
            </div>
          </div>
        `;
      });
    }

    // Suggestion chips
    suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query && !isSending) {
          sendHeroChatMessage(query);
        }
      });
    });

    // Submit form
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text || isSending) return;
      inputEl.value = '';
      if (charCountEl) charCountEl.textContent = 'Max 500 chars';
      sendHeroChatMessage(text);
    });

    async function sendHeroChatMessage(text) {
      if (isSending) return;
      isSending = true;
      if (sendBtn) sendBtn.disabled = true;

      // Append user bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble user-bubble';
      userBubble.innerHTML = `
        <div class="chat-bubble-avatar">👤</div>
        <div class="chat-bubble-body">
          <div class="chat-bubble-sender">You</div>
          <div class="chat-bubble-text">${escapeHtml(text)}</div>
          <span class="chat-bubble-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      `;
      messagesEl.appendChild(userBubble);

      // Append typing indicator bubble
      const typingBubble = document.createElement('div');
      typingBubble.className = 'chat-bubble bot-bubble typing-state';
      typingBubble.innerHTML = `
        <div class="chat-bubble-avatar">🤖</div>
        <div class="chat-bubble-body">
          <div class="chat-bubble-sender">Halimon is thinking...</div>
          <div class="chat-typing-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
      messagesEl.appendChild(typingBubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      // Animate character thinking state
      if (avatarEl) avatarEl.classList.add('thinking');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        typingBubble.remove();

        if (res.ok) {
          const reply = data.reply || "I am Halimon, the Vault AI Assistant. How may I assist you with your documents?";
          conversationHistory.push({ role: 'user', text }, { role: 'assistant', text: reply });

          const botBubble = document.createElement('div');
          botBubble.className = 'chat-bubble bot-bubble';
          botBubble.innerHTML = `
            <div class="chat-bubble-avatar">🤖</div>
            <div class="chat-bubble-body">
              <div class="chat-bubble-sender">Halimon</div>
              <div class="chat-bubble-text">${formatReply(reply)}</div>
              <span class="chat-bubble-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          `;
          messagesEl.appendChild(botBubble);
        } else {
          const errBubble = document.createElement('div');
          errBubble.className = 'chat-bubble bot-bubble';
          errBubble.innerHTML = `
            <div class="chat-bubble-avatar">⚠️</div>
            <div class="chat-bubble-body">
              <div class="chat-bubble-sender">Halimon</div>
              <div class="chat-bubble-text" style="color:#fca5a5;">${escapeHtml(data.error || 'Unable to process query at this time.')}</div>
              <span class="chat-bubble-time">System</span>
            </div>
          `;
          messagesEl.appendChild(errBubble);
        }
      } catch (err) {
        typingBubble.remove();
        const errBubble = document.createElement('div');
        errBubble.className = 'chat-bubble bot-bubble';
        errBubble.innerHTML = `
          <div class="chat-bubble-avatar">⚠️</div>
          <div class="chat-bubble-body">
            <div class="chat-bubble-sender">Halimon</div>
            <div class="chat-bubble-text" style="color:#fca5a5;">Unable to reach server. Please check your connection.</div>
            <span class="chat-bubble-time">Offline</span>
          </div>
        `;
        messagesEl.appendChild(errBubble);
      } finally {
        isSending = false;
        if (sendBtn) sendBtn.disabled = false;
        if (avatarEl) avatarEl.classList.remove('thinking');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
  }

  // ─── Initialize on DOM Ready ─────────────────────────────────
  function initAllChatbotFeatures() {
    initChatbotDOM();
    initHeroChatDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllChatbotFeatures);
  } else {
    initAllChatbotFeatures();
  }
})();
