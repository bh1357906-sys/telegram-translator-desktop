// TG Translator 主进程入口：只放本应用的配置，通用逻辑在 core/main-core.js
'use strict';

const path = require('path');
const { createTranslatorApp } = require('./core/main-core');

createTranslatorApp({
  appName: 'TG Translator',
  shortName: 'tg-translator',
  url: 'https://web.telegram.org/k/',
  allowedHosts: ['web.telegram.org'],
  repo: 'bh1357906-sys/telegram-translator-desktop',
  preload: path.join(__dirname, 'preload.js'),
});
