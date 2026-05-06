(function () {
  'use strict';

  const CONFIG = {
    webhookUrl: 'https://n8n.srv1648209.hstgr.cloud/webhook/9eeb6c3f-98aa-4e38-b92b-6ef6d64ffed2/chat',
    title: 'Assistente UnoERP',
    subtitle: 'Come posso aiutarti?',
    placeholder: 'Scrivi qui la tua domanda...',
    welcomeMessage: 'Ciao! Sono l\'assistente AI di UnoERP. Posso aiutarti con fatturazione, contabilità, gestione utenti, permessi, preventivi, ticket e molto altro. Come posso esserti utile?',
    errorMessage: 'Si è verificato un errore. Riprova tra qualche istante.',
    colors: {
      primary: '#1E5FBF',
      dark: '#111827',
      bgLight: '#F3F4F6',
      border: '#E5E7EB',
      white: '#FFFFFF',
      muted: '#6B7280'
    },
    maxLength: 1000,
    maxStoredMessages: 50,
    markdownCdn: 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js',
    storageKey: 'uniwix_chat_session_id',
    messagesKey: 'uniwix_chat_messages'
  };

  let md = null;
  let sessionId = null;
  let isOpen = false;
  let isSending = false;
  let shadowRoot = null;

  function getSessionId() {
    let id = localStorage.getItem(CONFIG.storageKey);
    if (!id) id = createNewSessionId();
    return id;
  }

  function createNewSessionId() {
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(CONFIG.storageKey, id);
    return id;
  }

  function shortId() {
    return (sessionId || '').slice(-6);
  }

  function loadStoredMessages() {
    try {
      const raw = localStorage.getItem(CONFIG.messagesKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (parsed.sessionId !== sessionId) return [];
      return Array.isArray(parsed.messages) ? parsed.messages : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessage(role, text, options = {}) {
    try {
      const raw = localStorage.getItem(CONFIG.messagesKey);
      let store = { sessionId: sessionId, messages: [] };
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sessionId === sessionId) store = parsed;
      }
      store.messages.push({ role, text, time: currentTime(), isError: !!options.isError });
      if (store.messages.length > CONFIG.maxStoredMessages) {
        store.messages = store.messages.slice(-CONFIG.maxStoredMessages);
      }
      localStorage.setItem(CONFIG.messagesKey, JSON.stringify(store));
    } catch (e) {
      console.warn('[Uniwix Chat] unable to persist messages', e);
    }
  }

  function clearStoredMessages() {
    try { localStorage.removeItem(CONFIG.messagesKey); } catch (e) {}
  }

  function loadMarkdownIt() {
    return new Promise((resolve, reject) => {
      if (window.markdownit) return resolve(window.markdownit);
      const s = document.createElement('script');
      s.src = CONFIG.markdownCdn;
      s.onload = () => resolve(window.markdownit);
      s.onerror = () => reject(new Error('markdown-it load failed'));
      document.head.appendChild(s);
    });
  }

  function setupMarkdown(mdLib) {
    const instance = mdLib({ html: false, linkify: false, breaks: true });
    const defaultLinkOpen = instance.renderer.rules.link_open || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
    instance.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const targetIdx = tokens[idx].attrIndex('target');
      if (targetIdx < 0) tokens[idx].attrPush(['target', '_blank']);
      else tokens[idx].attrs[targetIdx][1] = '_blank';
      const relIdx = tokens[idx].attrIndex('rel');
      if (relIdx < 0) tokens[idx].attrPush(['rel', 'noopener noreferrer']);
      else tokens[idx].attrs[relIdx][1] = 'noopener noreferrer';
      return defaultLinkOpen(tokens, idx, options, env, self);
    };
    return instance;
  }

  function renderMarkdown(text) {
    if (!md) return escapeHtml(text).replace(/\n/g, '<br>');
    return md.render(text);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function currentTime() {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  function readChatContext() {
    const ctx = window.UNIWIX_CHAT_CONTEXT;
    if (!ctx || typeof ctx !== 'object') {
      return { community_address: null, local_user: null };
    }
    const ca = typeof ctx.community_address === 'string' && ctx.community_address.trim()
      ? ctx.community_address.trim()
      : null;
    const lu = ctx.local_user != null && (typeof ctx.local_user === 'string' || typeof ctx.local_user === 'number')
      ? String(ctx.local_user).trim() || null
      : null;
    return { community_address: ca, local_user: lu };
  }

  function createStyles() {
    const c = CONFIG.colors;
    return `
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

      .toggle {
        position: fixed; bottom: 24px; right: 24px;
        width: 56px; height: 56px; border-radius: 50%;
        background: ${c.primary}; color: ${c.white};
        border: none; cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s;
        z-index: 2147483647;
      }
      .toggle:hover { transform: scale(1.05); }
      .toggle:focus-visible { outline: 3px solid ${c.primary}; outline-offset: 2px; }
      .toggle svg { width: 26px; height: 26px; fill: currentColor; }

      .panel {
        position: fixed; bottom: 96px; right: 24px;
        width: 420px; max-width: calc(100vw - 32px);
        height: 640px; max-height: calc(100vh - 120px);
        background: ${c.white};
        border: 1px solid ${c.border};
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.12);
        display: flex; flex-direction: column;
        overflow: hidden;
        opacity: 0; transform: translateY(12px);
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 2147483647;
      }
      .panel.open {
        opacity: 1; transform: translateY(0);
        pointer-events: auto;
      }

      .header {
        background: ${c.dark}; color: ${c.white};
        padding: 14px 16px;
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px;
      }
      .header-text { flex: 1; min-width: 0; }
      .header-text h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .header-text p { margin: 2px 0 0; font-size: 12px; opacity: 0.75; display: flex; align-items: center; gap: 6px; }

      .header-actions { display: flex; gap: 4px; }
      .icon-btn {
        background: transparent; border: none; color: ${c.white};
        cursor: pointer; padding: 6px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
      }
      .icon-btn:hover { background: rgba(255,255,255,0.12); }
      .icon-btn:focus-visible { outline: 2px solid ${c.white}; outline-offset: 1px; }
      .icon-btn svg { width: 18px; height: 18px; fill: currentColor; }

      .messages {
        flex: 1; overflow-y: auto; padding: 16px;
        background: ${c.bgLight};
        display: flex; flex-direction: column; gap: 14px;
      }

      .msg-wrap { display: flex; flex-direction: column; max-width: 85%; }
      .msg-wrap.user { align-self: flex-end; align-items: flex-end; }
      .msg-wrap.bot { align-self: flex-start; align-items: flex-start; }

      .msg { padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
      .msg-bot { background: ${c.white}; color: ${c.dark}; border: 1px solid ${c.border}; }
      .msg-user { background: ${c.primary}; color: ${c.white}; }
      .msg-error { display: flex; align-items: flex-start; gap: 8px; }
      .msg-error svg { flex-shrink: 0; width: 16px; height: 16px; fill: ${c.muted}; margin-top: 2px; }

      .timestamp {
        font-size: 11px; color: ${c.muted};
        margin-top: 4px; padding: 0 4px;
      }

      .msg-bot p { margin: 0 0 8px; }
      .msg-bot p:last-child { margin-bottom: 0; }
      .msg-bot strong { font-weight: 600; }
      .msg-bot ul, .msg-bot ol { margin: 8px 0; padding-left: 20px; }
      .msg-bot li { margin-bottom: 4px; }
      .msg-bot a { color: ${c.primary}; text-decoration: underline; word-break: break-all; }
      .msg-bot code { background: ${c.bgLight}; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
      .msg-bot pre { background: ${c.bgLight}; padding: 10px; border-radius: 6px; overflow-x: auto; }

      .copy-email {
        cursor: pointer;
        color: ${c.primary};
        font-weight: 600;
        border-bottom: 1px dashed ${c.primary};
        padding: 0 2px;
        border-radius: 3px;
        transition: background 0.15s;
        position: relative;
        display: inline-block;
      }
      .copy-email:hover { background: rgba(30, 95, 191, 0.08); }
      .copy-email:focus-visible { outline: 2px solid ${c.primary}; outline-offset: 2px; }
      .copy-email.copied::after {
        content: 'Copiato!';
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: ${c.dark};
        color: ${c.white};
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 10;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(2px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      .typing { display: flex; gap: 4px; padding: 14px; }
      .typing span {
        width: 6px; height: 6px; border-radius: 50%; background: ${c.dark};
        opacity: 0.4; animation: dot 1.2s infinite;
      }
      .typing span:nth-child(2) { animation-delay: 0.15s; }
      .typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes dot {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-3px); }
      }

      .input-area {
        border-top: 1px solid ${c.border};
        padding: 12px; background: ${c.white};
        display: flex; gap: 8px; align-items: flex-end;
      }
      .input-area textarea {
        flex: 1; resize: none; border: 1px solid ${c.border};
        border-radius: 8px; padding: 10px 12px;
        font-size: 14px; font-family: inherit; line-height: 1.4;
        max-height: 100px; min-height: 40px; outline: none;
        color: ${c.dark};
      }
      .input-area textarea:focus { border-color: ${c.primary}; }
      .input-area .send-btn {
        background: ${c.primary}; color: ${c.white};
        border: none; border-radius: 8px; padding: 0; width: 40px; height: 40px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      .input-area .send-btn:disabled {
        background: ${c.border}; cursor: not-allowed;
      }
      .input-area .send-btn:focus-visible { outline: 3px solid ${c.primary}; outline-offset: 2px; }
      .input-area .send-btn svg { width: 16px; height: 16px; fill: currentColor; }

      @media (max-width: 480px) {
        .panel {
          bottom: 0; right: 0; left: 0;
          width: 100%; height: 100%; max-height: 100%;
          border-radius: 0; border: none;
          transform: translateY(20px);
        }
        .panel.open { transform: translateY(0); }
        .toggle { bottom: 16px; right: 16px; }
      }
    `;
  }

  function createWidgetHtml() {
    return `
      <style>${createStyles()}</style>
      <button class="toggle" aria-label="Apri chat" aria-expanded="false">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.38 1.03 4.55 2.71 6.16L4 22l5-2c1 .25 2 .38 3 .38 5.52 0 10-4.03 10-9S17.52 2 12 2z"/></svg>
      </button>
      <div class="panel" role="dialog" aria-label="Chat assistente UnoERP">
        <div class="header">
          <div class="header-text">
            <h3>${CONFIG.title}</h3>
            <p><span class="subtitle-text">${CONFIG.subtitle}</span></p>
          </div>
          <div class="header-actions">
            <button class="icon-btn reset-btn" aria-label="Nuova conversazione" title="Nuova conversazione">
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="icon-btn close-btn" aria-label="Chiudi chat" title="Chiudi">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
        <div class="messages" role="log" aria-live="polite"></div>
        <div class="input-area">
          <textarea rows="1" placeholder="${CONFIG.placeholder}" aria-label="Messaggio" maxlength="${CONFIG.maxLength}"></textarea>
          <button class="send-btn" aria-label="Invia messaggio" disabled>
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function wrapEmailsForCopy(element) {
    const emailText = 'ticket@unoerp.it';
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf(emailText) !== -1) matches.push(node);
    }
    matches.forEach(textNode => {
      const parts = textNode.nodeValue.split(emailText);
      const fragment = document.createDocumentFragment();
      parts.forEach((part, idx) => {
        if (part) fragment.appendChild(document.createTextNode(part));
        if (idx < parts.length - 1) {
          const span = document.createElement('span');
          span.className = 'copy-email';
          span.textContent = emailText;
          span.setAttribute('role', 'button');
          span.setAttribute('tabindex', '0');
          span.setAttribute('aria-label', 'Copia email ' + emailText);
          span.setAttribute('title', 'Clicca per copiare');
          fragment.appendChild(span);
        }
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  function renderMessage(role, text, options = {}) {
    const list = shadowRoot.querySelector('.messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap ' + role;

    const msg = document.createElement('div');
    msg.className = 'msg msg-' + role;
    if (options.isError) msg.classList.add('msg-error');

    if (role === 'bot') {
      if (options.isError) {
        msg.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>
          <span>${escapeHtml(text)}</span>
        `;
      } else {
        msg.innerHTML = renderMarkdown(text);
        wrapEmailsForCopy(msg);
      }
    } else {
      msg.textContent = text;
    }

    const ts = document.createElement('div');
    ts.className = 'timestamp';
    ts.textContent = options.time || currentTime();

    wrap.appendChild(msg);
    wrap.appendChild(ts);
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
    return wrap;
  }

  function addMessage(role, text, options = {}) {
    const wrap = renderMessage(role, text, options);
    saveMessage(role, text, options);
    return wrap;
  }

  function addTyping() {
    const list = shadowRoot.querySelector('.messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap bot';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-label', 'Sto scrivendo');
    wrap.innerHTML = '<div class="msg msg-bot typing"><span></span><span></span><span></span></div>';
    list.appendChild(wrap);
    list.scrollTop = list.scrollHeight;
    return wrap;
  }

  async function sendMessage(text) {
    if (!text.trim() || isSending) return;
    isSending = true;
    const sendBtn = shadowRoot.querySelector('.send-btn');
    const textarea = shadowRoot.querySelector('textarea');
    sendBtn.disabled = true;
    textarea.disabled = true;

    addMessage('user', text);
    textarea.value = '';
    textarea.style.height = 'auto';

    const typingEl = addTyping();

    try {
      const ctx = readChatContext();
      const res = await fetch(CONFIG.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          chatInput: text,
          sessionId: sessionId,
          community_address: ctx.community_address,
          local_user: ctx.local_user
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      typingEl.remove();
      const reply = data.output || data.reply || CONFIG.errorMessage;
      addMessage('bot', reply);
    } catch (err) {
      typingEl.remove();
      addMessage('bot', CONFIG.errorMessage, { isError: true });
      console.error('[Uniwix Chat]', err);
    } finally {
      isSending = false;
      textarea.disabled = false;
      updateSendButtonState();
      textarea.focus();
    }
  }

  function updateSessionChip() {
  }

  function resetConversation() {
    clearStoredMessages();
    sessionId = createNewSessionId();
    updateSessionChip();
    const list = shadowRoot.querySelector('.messages');
    list.innerHTML = '';
    addMessage('bot', CONFIG.welcomeMessage);
  }

  function populateMessages() {
    const list = shadowRoot.querySelector('.messages');
    const stored = loadStoredMessages();
    if (stored.length === 0) {
      addMessage('bot', CONFIG.welcomeMessage);
    } else {
      stored.forEach(m => renderMessage(m.role, m.text, { time: m.time, isError: m.isError }));
    }
  }

  function togglePanel(open) {
    const panel = shadowRoot.querySelector('.panel');
    const toggle = shadowRoot.querySelector('.toggle');
    isOpen = open !== undefined ? open : !isOpen;
    panel.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      const list = shadowRoot.querySelector('.messages');
      if (!list.hasChildNodes()) populateMessages();
      setTimeout(() => shadowRoot.querySelector('textarea').focus(), 220);
    }
  }

  function updateSendButtonState() {
    const textarea = shadowRoot.querySelector('textarea');
    const sendBtn = shadowRoot.querySelector('.send-btn');
    sendBtn.disabled = !textarea.value.trim() || isSending;
  }

  function bindEvents() {
    const toggle = shadowRoot.querySelector('.toggle');
    const closeBtn = shadowRoot.querySelector('.close-btn');
    const resetBtn = shadowRoot.querySelector('.reset-btn');
    const sendBtn = shadowRoot.querySelector('.send-btn');
    const textarea = shadowRoot.querySelector('textarea');

    toggle.addEventListener('click', () => togglePanel());
    closeBtn.addEventListener('click', () => togglePanel(false));
    resetBtn.addEventListener('click', () => resetConversation());
    sendBtn.addEventListener('click', () => sendMessage(textarea.value));
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(textarea.value);
      }
      if (e.key === 'Escape') togglePanel(false);
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      updateSendButtonState();
    });

    shadowRoot.addEventListener('click', handleEmailCopy);
    shadowRoot.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('copy-email')) {
        e.preventDefault();
        handleEmailCopy(e);
      }
    });
  }

  async function handleEmailCopy(e) {
    const target = e.target.closest('.copy-email');
    if (!target) return;
    const email = target.textContent;
    try {
      await navigator.clipboard.writeText(email);
      target.classList.add('copied');
      setTimeout(() => target.classList.remove('copied'), 1800);
    } catch (err) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      console.warn('[Uniwix Chat] clipboard API non disponibile, email selezionata', err);
    }
  }

  async function init() {
    sessionId = getSessionId();
    try {
      const mdLib = await loadMarkdownIt();
      md = setupMarkdown(mdLib);
    } catch (err) {
      console.warn('[Uniwix Chat] markdown-it non caricato, fallback a testo semplice', err);
    }

    const host = document.createElement('div');
    host.id = 'uniwix-chat-widget';
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = createWidgetHtml();
    bindEvents();

    window.UniwixChat = {
      open: () => togglePanel(true),
      close: () => togglePanel(false),
      sendMessage: (text) => {
        if (!text) return;
        togglePanel(true);
        const textarea = shadowRoot.querySelector('textarea');
        setTimeout(() => {
          textarea.value = text;
          sendMessage(text);
        }, 250);
      },
      reset: () => resetConversation()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
