const { app, BrowserWindow, ipcMain, Menu, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// WhatsApp Web may reject an Electron user agent; present a normal Chrome UA.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const defaultSettings = {
  engine: 'deepseek',
  apiBase: '',
  model: '',
  apiKey: '',
  myLang: 'Simplified Chinese',
  theirLang: 'English',
};

const ENGINE_PRESETS = {
  deepseek: { apiBase: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { apiBase: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}
function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return { ...defaultSettings };
  }
}
function saveSettings(s) {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    title: 'TG Translator',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL('https://web.telegram.org/k/', { userAgent: CHROME_UA });
  return win;
}

function openSettings() {
  const win = new BrowserWindow({
    width: 480,
    height: 600,
    title: '设置 - TG Translator',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('settings.html');
}

// 检查更新：查 GitHub 最新 release，有新版本弹窗 + 跳转下载
const APP_VERSION = '0.1.3';
const GITHUB_REPO = 'bh1357906-sys/telegram-translator-desktop';
async function checkUpdate(silentOk) {
  const win = BrowserWindow.getAllWindows()[0];
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tg-translator' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    const cur = APP_VERSION.replace(/^v/, '');
    if (latest && latest !== cur) {
      const r = dialog.showMessageBoxSync(win, {
        type: 'info',
        title: '发现新版本',
        message: `新版本 ${data.tag_name || latest} 可用（当前 ${APP_VERSION}）`,
        detail: '点「下载」前往 GitHub 下载最新安装包。',
        buttons: ['下载', '稍后'],
        defaultId: 0,
        cancelId: 1,
      });
      if (r === 0) shell.openExternal(data.html_url || `https://github.com/${GITHUB_REPO}/releases`);
      return true;
    }
    if (!silentOk) {
      dialog.showMessageBoxSync(win, { type: 'info', title: '检查更新', message: '当前已是最新版本', buttons: ['好'] });
    }
    return false;
  } catch (err) {
    if (!silentOk) {
      dialog.showMessageBoxSync(win, { type: 'warning', title: '检查更新', message: '检查失败：' + (err && err.message), buttons: ['好'] });
    }
    return false;
  }
}

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: '设置…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { label: '检查更新…', click: () => checkUpdate() },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);

  createMainWindow();
  // 启动后 5 秒静默检查更新（只有发现新版本才弹窗）
  setTimeout(() => checkUpdate(true), 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('open-settings', () => {
  openSettings();
  return true;
});
ipcMain.handle('replace-draft', async (e, { text }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return true;
  clipboard.writeText(text);
  await win.webContents.executeJavaScript(`
    (function() {
      const box = document.querySelector('.input-message-input[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');
      if (!box) return false;
      box.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    })()
  `);
  win.webContents.paste();
  return true;
});
ipcMain.handle('press-enter', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return true;
  // Telegram 输入框按回车发送，模拟回车键（click() 点不动 Telegram 的发送按钮）
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
  win.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  return true;
});
ipcMain.handle('set-settings', (e, s) => {
  const merged = { ...defaultSettings, ...s };
  saveSettings(merged);
  return true;
});
ipcMain.handle('set-their-lang', (e, lang) => {
  currentTheirLang = lang || null;
  return currentTheirLang;
});
ipcMain.handle('get-their-lang', () => currentTheirLang);

let currentTheirLang = null; // 用户手动选择的对方语言，由界面按钮设置（不再自动检测）

async function callDeepSeek(s, prompt) {
  const preset = ENGINE_PRESETS[s.engine] || ENGINE_PRESETS.deepseek;
  const apiBase = s.apiBase || preset.apiBase;
  const model = s.model || preset.model;
  const res = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

ipcMain.handle('translate', async (e, { text, direction, latest }) => {
  const s = loadSettings();
  if (!s.apiKey) throw new Error('NO_KEY');

  if (direction === 'incoming') {
    const prompt = [
      `Translate the following WhatsApp message into natural, idiomatic ${s.myLang} — like a native speaker chatting, not a literal word-for-word translation.`,
      'Preserve tone, emojis and line breaks.',
      'Do not add quotes, notes or explanations. Output only the translation.',
      '',
      text,
    ].join('\n');
    return await callDeepSeek(s, prompt);
  }

  if (direction === 'to-my-lang') {
    // 自己消息显示中文：只翻译，不检测源语言、不更新对方语言
    const prompt = [
      `Translate the following WhatsApp message into natural, idiomatic ${s.myLang} — like a native speaker chatting, not a literal word-for-word translation.`,
      'Preserve tone, emojis and line breaks.',
      'Do not add quotes, notes or explanations. Output only the translation.',
      '',
      text,
    ].join('\n');
    return await callDeepSeek(s, prompt);
  }

  // outgoing: translate into the user-selected language (manual, not auto-detected)
  const target = currentTheirLang || s.theirLang;
  const prompt = [
    `Translate the following WhatsApp message into natural, idiomatic ${target} — like a native speaker chatting, not a literal word-for-word translation.`,
    'Keep it casual and conversational (this is WhatsApp chat, not formal writing).',
    'First fix any typos, wrong characters or missing characters in the message.',
    'Preserve tone, emojis, line breaks and punctuation.',
    'Do not add quotes, notes or explanations. Output only the translation.',
    '',
    text,
  ].join('\n');
  const out = await callDeepSeek(s, prompt);
  return out;
});
