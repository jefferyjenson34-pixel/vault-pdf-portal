/**
 * ═══════════════════════════════════════════════════════════════════════
 *  VAULT SENTINEL AI: CHAT WITH YOUR PDF JAVASCRIPT COMPONENT
 *  Direct OpenRouter Document Intelligence & Interactive Forensic Q&A
 * ═══════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  let currentFilename = null;
  let currentDocTitle = null;
  let chatHistory = [];
  let isSending = false;

  let backdrop = null;
  let messagesContainer = null;
  let textareaInput = null;
  let sendButton = null;
  let docTitleEl = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Format citations like [Page 1] or [Page 2, Paragraph 3]
    html = html.replace(/\[(Page\s+\d+[^\]]*)\]/gi, '<span class="doc-citation">📍 $1</span>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Bullet points: lines starting with • or -
    const lines = html.split('\n');
    let inList = false;
    let out = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        if (trimmed.startsWith('### ')) {
          out.push(`<h4 style="color:#38bdf8; margin:10px 0 4px; font-size:0.92rem;">${trimmed.substring(4)}</h4>`);
        } else if (trimmed.length > 0) {
          out.push(`<p>${line}</p>`);
        }
      }
    }
    if (inList) out.push('</ul>');

    return out.join('');
  }

  function createChatUI() {
    if (document.getElementById('vault-pdf-chat-root')) return;

    backdrop = document.createElement('div');
    backdrop.id = 'vault-pdf-chat-root';
    backdrop.className = 'pdf-chat-backdrop';

    backdrop.innerHTML = `
      <div class="pdf-chat-drawer" role="dialog" aria-modal="true" aria-label="Chat with Document">
        <!-- Header -->
        <div class="pdf-chat-header">
          <div class="pdf-chat-header-info">
            <div class="pdf-chat-bot-avatar">🤖</div>
            <div class="pdf-chat-title-wrap">
              <h3 class="pdf-chat-main-title">Sentinel <span>AI Q&amp;A</span></h3>
              <div class="pdf-chat-doc-sub" id="pdf-chat-active-doc">Loading document...</div>
            </div>
          </div>
          <button class="pdf-chat-close-btn" id="pdf-chat-btn-close" title="Close Q&amp;A panel">&times;</button>
        </div>

        <!-- Prompt Suggestions Chips -->
        <div class="pdf-chat-chips-bar">
          <button class="pdf-prompt-chip" data-prompt="30s Executive Summary">⚡ 30s Summary</button>
          <button class="pdf-prompt-chip" data-prompt="Identify any risks, red flags, or liabilities in this document">⚠️ Red Flags &amp; Risks</button>
          <button class="pdf-prompt-chip" data-prompt="List all key dates, milestones, and deadlines mentioned">📅 Key Dates</button>
          <button class="pdf-prompt-chip" data-prompt="Extract all organizations, companies, and people mentioned">👥 People &amp; Entities</button>
          <button class="pdf-prompt-chip" data-prompt="Summarize all numbers, financial figures, or statistics">📊 Numbers &amp; Stats</button>
        </div>

        <!-- Messages Area -->
        <div class="pdf-chat-messages" id="pdf-chat-msgs"></div>

        <!-- Input Bar -->
        <div class="pdf-chat-input-bar">
          <textarea class="pdf-chat-textarea" id="pdf-chat-input" placeholder="Ask anything about this document..." rows="1"></textarea>
          <button class="pdf-chat-send-btn" id="pdf-chat-send" title="Send Question" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    messagesContainer = document.getElementById('pdf-chat-msgs');
    textareaInput = document.getElementById('pdf-chat-input');
    sendButton = document.getElementById('pdf-chat-send');
    docTitleEl = document.getElementById('pdf-chat-active-doc');

    // Close button
    document.getElementById('pdf-chat-btn-close').addEventListener('click', closeChat);

    // Backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeChat();
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('active')) {
        closeChat();
      }
    });

    // Textarea Auto-Resize & Enter to send
    textareaInput.addEventListener('input', () => {
      textareaInput.style.height = 'auto';
      textareaInput.style.height = Math.min(120, textareaInput.scrollHeight) + 'px';
    });

    textareaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitQuestion();
      }
    });

    sendButton.addEventListener('click', submitQuestion);

    // Chip click handlers
    backdrop.querySelectorAll('.pdf-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt && !isSending) {
          textareaInput.value = prompt;
          submitQuestion();
        }
      });
    });
  }

  function appendMessage(role, content) {
    if (!messagesContainer) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `pdf-msg ${role === 'user' ? 'pdf-msg-user' : 'pdf-msg-ai'}`;

    const bubble = document.createElement('div');
    bubble.className = 'pdf-msg-bubble';

    if (role === 'user') {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = formatMarkdown(content);

      // Add copy button
      const footer = document.createElement('div');
      footer.className = 'pdf-msg-footer';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-copy-reply';
      copyBtn.innerHTML = '📋 Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
          copyBtn.innerHTML = '✓ Copied';
          setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
        });
      };
      footer.appendChild(copyBtn);
      bubble.appendChild(footer);
    }

    msgDiv.appendChild(bubble);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return msgDiv;
  }

  function appendTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'pdf-msg pdf-msg-ai';
    msgDiv.id = 'pdf-typing-indicator';

    const bubble = document.createElement('div');
    bubble.className = 'pdf-msg-bubble';
    bubble.innerHTML = `
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    msgDiv.appendChild(bubble);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('pdf-typing-indicator');
    if (el) el.remove();
  }

  async function submitQuestion() {
    const query = (textareaInput.value || '').trim();
    if (!query || isSending || !currentFilename) return;

    textareaInput.value = '';
    textareaInput.style.height = 'auto';

    appendMessage('user', query);
    chatHistory.push({ role: 'user', content: query });

    isSending = true;
    sendButton.disabled = true;
    appendTypingIndicator();

    try {
      let endpoint = '/api/pdf/chat';
      let payload = {
        filename: currentFilename,
        question: query,
        history: chatHistory
      };

      // Check if user specifically requested a 30s summary chip
      if (query.toLowerCase().includes('30s summary') || query.toLowerCase() === '30s executive summary') {
        endpoint = '/api/pdf/summarize';
        payload = { filename: currentFilename };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      removeTypingIndicator();

      if (res.ok && (data.answer || data.summary)) {
        const replyText = data.answer || data.summary;
        appendMessage('assistant', replyText);
        chatHistory.push({ role: 'assistant', content: replyText });
      } else {
        appendMessage('assistant', data.error || 'Unable to analyze the document with upstream AI. Please try again.');
      }
    } catch (err) {
      removeTypingIndicator();
      appendMessage('assistant', 'Network communication error with the forensic intelligence relay.');
    } finally {
      isSending = false;
      sendButton.disabled = false;
      textareaInput.focus();
    }
  }

  function openChat(filename, docTitle) {
    createChatUI();
    currentFilename = filename;
    currentDocTitle = docTitle || filename;
    chatHistory = [];

    if (docTitleEl) {
      docTitleEl.textContent = `Analyzing: ${currentDocTitle}`;
      docTitleEl.title = currentDocTitle;
    }

    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      // Welcome Greeting
      appendMessage('assistant',
        `**Vault Sentinel AI Connected** 🛡️\n\n` +
        `I have loaded **${currentDocTitle}** into my zero-knowledge analysis memory. ` +
        `Ask me any question about clauses, numbers, entities, or click one of the quick chips above for an instant brief.`
      );
    }

    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      if (textareaInput) textareaInput.focus();
    }, 300);

    // Track telemetry
    if (window.VaultTracker) {
      window.VaultTracker.log(`AI Q&A Opened: ${currentDocTitle}`);
    }
  }

  function closeChat() {
    if (backdrop) {
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Auto-delegate click events for buttons with data-doc-chat or .btn-doc-ai-chat
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-doc-ai-chat') || e.target.closest('[data-doc-chat]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const fn = btn.getAttribute('data-filename') || btn.closest('[data-filename]')?.getAttribute('data-filename');
      const title = btn.getAttribute('data-title') || btn.closest('[data-name]')?.getAttribute('data-name') || fn;
      if (fn) {
        openChat(fn, title);
      }
    }
  });

  // Expose global controller
  window.VaultPdfChat = {
    open: openChat,
    close: closeChat
  };
})();
