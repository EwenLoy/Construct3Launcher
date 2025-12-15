const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[Build] Starting build with obfuscation...');

// 1. Обфусцируем server.js
console.log('[Build] Step 1: Obfuscating server.js...');
try {
  execSync('node obfuscate-server.js', { stdio: 'inherit' });
} catch (error) {
  console.error('[Build] Obfuscation failed:', error.message);
  process.exit(1);
}

// 2. Заменяем server.js на обфусцированную версию
const originalServer = path.join(__dirname, 'server.js');
const obfuscatedServer = path.join(__dirname, 'server.obf.js');
const tempOriginal = path.join(__dirname, 'server.temp.js');

// Сохраняем оригинал временно
if (fs.existsSync(originalServer)) {
  fs.copyFileSync(originalServer, tempOriginal);
}

// Заменяем на обфусцированную
fs.copyFileSync(obfuscatedServer, originalServer);
console.log('[Build] Step 2: Replaced server.js with obfuscated version');

// 3. Запускаем сборку
console.log('[Build] Step 3: Running electron-builder...');
try {
  execSync('npm run dist', { stdio: 'inherit' });
} catch (error) {
  console.error('[Build] Build failed:', error.message);
} finally {
  // 4. Восстанавливаем оригинальный server.js
  if (fs.existsSync(tempOriginal)) {
    fs.copyFileSync(tempOriginal, originalServer);
    fs.unlinkSync(tempOriginal);
    console.log('[Build] Step 4: Restored original server.js');
  }
}

console.log('[Build] Build complete!');
