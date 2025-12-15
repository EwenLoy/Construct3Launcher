const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Читаем оригинальный server.js
const serverPath = path.join(__dirname, 'server.js');
const originalCode = fs.readFileSync(serverPath, 'utf8');

console.log('[Obfuscator] Reading server.js...');

// Настройки обфускации - сохраняем require и exports
const obfuscatedCode = JavaScriptObfuscator.obfuscate(originalCode, {
  // Базовые настройки
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false, // Отключаем, чтобы не ломать Electron
  debugProtectionInterval: 0,
  disableConsoleOutput: false, // Оставляем console.log для отладки
  
  // Важные настройки для require/exports
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  renameGlobals: false, // НЕ переименовываем глобальные переменные
  rotateStringArray: true,
  selfDefending: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  
  // Критично: сохраняем require и module.exports
  target: 'node',
  domainLock: [],
  exclude: [
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'process',
    'console',
    'Buffer',
    'global'
  ]
});

// Сохраняем обфусцированный код
const obfuscatedPath = path.join(__dirname, 'server.obf.js');
fs.writeFileSync(obfuscatedPath, obfuscatedCode.getObfuscatedCode());

console.log('[Obfuscator] Obfuscated server.js -> server.obf.js');
console.log('[Obfuscator] Original size:', originalCode.length, 'bytes');
console.log('[Obfuscator] Obfuscated size:', obfuscatedCode.getObfuscatedCode().length, 'bytes');

// Создаем backup оригинального файла
const backupPath = path.join(__dirname, 'server.backup.js');
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, originalCode);
  console.log('[Obfuscator] Created backup: server.backup.js');
}

console.log('[Obfuscator] Done!');
