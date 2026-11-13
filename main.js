// TG Translator 主进程入口：只放本应用的配置，通用逻辑在 core/main-core.js
'use strict';

const path = require('path');
const fs = require('fs');

if (!fs.existsSync(path.join(__dirname, 'dist-preload', 'preload.js'))) {
  console.error('[translator] dist-preload/preload.js 不存在：请先运行 npm run build（npm start 会自动构建）');
  process.exit(1);
}
const { createTranslatorApp } = require('./core/main-core');

createTranslatorApp({
  appName: 'TG Translator',
  shortName: 'tg-translator',
  url: 'https://web.telegram.org/k/',
  allowedHosts: ['web.telegram.org'],
  // 只支持 K 版网页；有人在 Telegram 菜单里点“切换到 A 版”也留在 K 版（A 版上翻译和护栏都不工作）
  pathPrefix: '/k',
  repo: 'bh1357906-sys/telegram-translator-desktop',
  // 聊天页面的 preload 用打包后的单文件（npm run build 生成），这样页面可以开沙箱
  preload: path.join(__dirname, 'dist-preload', 'preload.js'),
  icon: path.join(__dirname, 'build', 'icon.png'),
});
