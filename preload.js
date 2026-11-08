// Telegram Web (K 版，web.telegram.org/k/) 页面适配器
// Telegram 改版时只需要改这个文件里的选择器。
'use strict';

const { boot, readRichText } = require('./core/renderer-core');

// 不属于正文的部分：引用、时间、回复按钮、反应、链接预览、署名等
const SKIP_SEL = 'audio-element, .audio, .reply, .time, .time-inner, .reactions, .message-sign, .webpage, .bubble-name-first, .name, .peer-title, .reply-markup, .tgico, .custom-emoji';

const adapter = {
  // 当前打开的聊天（Telegram 会同时保留多个消息容器，只看 .chat.active 里的）
  getMessageElements() {
    const root = document.querySelector('.chat.active') || document;
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

  // 翻译行放在正文后面、时间戳 / 表情回应之前
  placeLine(info, line) {
    const anchor = info.mount.querySelector(':scope > .clearfix, :scope > reactions-element, :scope > .reactions, :scope > .time');
    if (anchor) info.mount.insertBefore(line, anchor);
    else info.mount.appendChild(line);
  },

  // 语音消息：audio-element 里的播放键
  getVoiceInfo(el) {
    const ae = el.querySelector('audio-element, .audio');
    if (!ae) return null;
    const playBtn = ae.querySelector('.audio-toggle, .audio-play-icon, .audio-ico, button');
    if (!playBtn) return null;
    const msg = el.querySelector('.message') || el;
    const mid = el.getAttribute('data-mid') || '';
    if (!mid) return null;
    const peer = el.getAttribute('data-peer-id') || (location.hash || '');
    return { id: peer + ':' + mid, incoming: !el.classList.contains('is-out'), mount: msg, playBtn, voice: true };
  },

  // 图片消息：.attachment / .media-container 里的图；头像、表情、链接预览小图不算
  getImageInfo(el) {
    const imgs = Array.from(el.querySelectorAll('.attachment img, .media-container img, img.media-photo, .document-thumb img')).filter((img) => {
      if (img.closest('.wa-tr-line, .avatar, .reply, .webpage, .reactions, .custom-emoji, .sticker')) return false;
      const src = img.currentSrc || img.src || '';
      if (!/^(blob:|data:image|https:)/.test(src)) return false;
      const r = img.getBoundingClientRect();
      return r.width >= 80 && r.height >= 60;
    });
    if (!imgs.length) return null;
    const img = imgs[0];
    const mid = el.getAttribute('data-mid') || '';
    if (!mid) return null;
    const peer = el.getAttribute('data-peer-id') || (location.hash || '');
    const msg = el.querySelector('.message') || el;
    return { id: 'img:' + peer + ':' + mid, incoming: !el.classList.contains('is-out'), mount: msg, img };
  },

  getChat() {
    // URL hash 是聊天的唯一标识，如 #777000 / #@username / #-100123
    const hash = (location.hash || '').replace(/^#/, '');
    const t =
      document.querySelector('.chat.active .top .peer-title') ||
      document.querySelector('.chat.active .chat-info .peer-title') ||
      document.querySelector('.chat-info .peer-title, .top .peer-title');
    const name = t ? (t.textContent || '').trim() : '';
    if (!hash && !name) return null;
    const aliases = hash && name ? [name] : [];
    return { key: hash ? 'tg:' + hash : name, name: name || hash, aliases };
  },

  getComposer() {
    const list = document.querySelectorAll('.chat.active .chat-input .input-message-input[contenteditable="true"], .chat-input .input-message-input[contenteditable="true"]');
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

  // 发语音条：Telegram 的录音键是 .btn-send.record，录音中输入区带 is-recording
  voiceSend: {
    input: () => document.querySelector('.chat.active .chat-input') || document.querySelector('.chat-input'),
    micButton() {
      const ci = this.input();
      if (!ci) return null;
      const b = ci.querySelector('.btn-send.record');
      if (b) return b;
      // 录音键被切成了“视频圈”模式（右键录音键可以切回语音）
      if (ci.querySelector('.btn-send.record-video')) throw new Error('Telegram 的录音键现在是「视频」模式，请右键它切换回「语音」再试');
      return null;
    },
    errorToast: '.toast',
    isRecording() {
      const ci = this.input();
      return !!ci && ci.classList.contains('is-recording');
    },
    cancelButton() {
      const ci = this.input();
      return ci ? ci.querySelector('.voice-recording-cancel') : null;
    },
    sendButton() {
      const ci = this.input();
      return ci ? ci.querySelector('.btn-send.send') || ci.querySelector('.btn-send:not(.record)') : null;
    },
  },

  sendArea(el) {
    return el && el.closest ? el.closest('.chat-input, .popup') : null;
  },

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
