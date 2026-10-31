// Telegram Web (K 版，web.telegram.org/k/) 页面适配器
// Telegram 改版时只需要改这个文件里的选择器。
'use strict';

const { boot, readRichText } = require('./core/renderer-core');

// 不属于正文的部分：引用、时间、回复按钮、反应、链接预览、署名等
const SKIP_SEL = '.reply, .time, .time-inner, .reactions, .message-sign, .webpage, .bubble-name-first, .name, .peer-title, .reply-markup, .tgico, .custom-emoji';

const adapter = {
  getMessageElements() {
    const root = document.querySelector('.bubbles-inner') || document.querySelector('.bubbles') || document;
    return Array.from(root.querySelectorAll('.bubble[data-mid]')).filter(
      (el) => !el.classList.contains('service') && !el.classList.contains('is-date') && !el.classList.contains('sticker')
    );
  },

  getMessageInfo(el) {
    const msg = el.querySelector('.message');
    if (!msg) return null;
    const src = msg.querySelector('.translatable-message') || msg;
    const text = readRichText(src, SKIP_SEL);
    if (!text) return null;
    const incoming = el.classList.contains('is-out') ? false : true;
    const mid = el.getAttribute('data-mid') || '';
    const peer = el.getAttribute('data-peer-id') || (location.hash || '');
    return { id: peer + ':' + mid, text, incoming, mount: msg };
  },

  // 翻译行放在时间戳前面，避免和右下角的时间重叠
  placeLine(info, line) {
    const time = info.mount.querySelector(':scope > .time');
    if (time) info.mount.insertBefore(line, time);
    else info.mount.appendChild(line);
  },

  getChat() {
    // URL hash 是聊天的唯一标识，如 #777000 / #@username / #-100123
    const hash = (location.hash || '').replace(/^#/, '');
    const t = document.querySelector('.chat-info .peer-title, .sidebar-header .chat-info .peer-title, .top .peer-title');
    const name = t ? (t.textContent || '').trim() : '';
    if (!hash && !name) return null;
    const aliases = hash && name ? [name] : [];
    return { key: hash ? 'tg:' + hash : name, name: name || hash, aliases };
  },

  getComposer() {
    const list = document.querySelectorAll('.chat-input .input-message-input[contenteditable="true"]');
    for (const el of list) if (!el.classList.contains('input-field-input-fake') && el.offsetParent !== null) return el;
    return list[0] || null;
  },

  // 聊天输入框、图片配文框都算；其他 contenteditable（如搜索）不算
  composerFrom(target) {
    const el = target && target.closest ? target.closest('[contenteditable="true"]') : null;
    if (!el) return null;
    if (!el.classList.contains('input-message-input')) return null;
    if (el.classList.contains('input-field-input-fake')) return null;
    return el;
  },

  sendButtonSelector: '.btn-send:not(.record)',

  composerForButton(btn) {
    const popup = btn.closest('.popup');
    if (popup) {
      const c = popup.querySelector('.input-message-input[contenteditable="true"]:not(.input-field-input-fake)');
      if (c) return c;
    }
    return adapter.getComposer();
  },

  findSendButton(box) {
    const scope = (box && (box.closest('.popup') || box.closest('.chat-input'))) || document;
    return scope.querySelector('.btn-send');
  },
};

boot(adapter, null);
