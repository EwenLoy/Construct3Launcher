const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Ports
const HTTP_PORT = 8080;
const HTTPS_PORT = 4430;

// Определяем корневую директорию ресурсов
// RESOURCES_PATH передается из main.js и указывает на папку resources (где находятся extraResources)
const RESOURCES_PATH = process.env.RESOURCES_PATH || __dirname;
const IS_PACKAGED = process.env.IS_PACKAGED === '1';

// В упакованном приложении:
// RESOURCES_PATH = C:\...\resources (папка с extraResources: certs, domains)
// В разработке:
// RESOURCES_PATH = d:\ar458-2Local-Launcher (корень проекта)
const DOMAINS_ROOT = path.join(RESOURCES_PATH, 'resources', 'domains');
const CERTS_DIR = path.join(RESOURCES_PATH, 'resources', 'certs');

console.log(`[Server] RESOURCES_PATH: ${RESOURCES_PATH}`);
console.log(`[Server] IS_PACKAGED: ${IS_PACKAGED}`);
console.log(`[Server] DOMAINS_ROOT: ${DOMAINS_ROOT}`);
console.log(`[Server] CERTS_DIR: ${CERTS_DIR}`);

// Проверка наличия папок
console.log(`[Server] Domains folder exists: ${fs.existsSync(DOMAINS_ROOT)}`);
console.log(`[Server] Certs folder exists: ${fs.existsSync(CERTS_DIR)}`);

// ===== Middleware для логирования =====
app.use((req, res, next) => {
  const host = req.hostname || 'editor.construct.net';
  console.log(`[${new Date().toISOString()}] ${req.method} ${host}${req.url}`);
  next();
});

// Разрешаем CORS для всех поддоменов construct.net
app.use((req, res, next) => {
  const host = req.hostname || '';
  if (host.includes('construct.net')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  next();
});

// ===== Маршруты для разных доменов =====

// preview.construct.net
app.use((req, res, next) => {
  const host = req.hostname || '';
  if (host === 'preview.construct.net' || host === 'localhost' || host === '127.0.0.1') {
    const previewDir = path.join(DOMAINS_ROOT, 'preview.construct.net');
    express.static(previewDir)(req, res, () => {
      createProxyMiddleware({
        target: 'https://preview.construct.net  ',
        changeOrigin: true,
        secure: true,
        logLevel: 'warn'
      })(req, res, next);
    });
  } else {
    next();
  }
});

//app.use('/preview.construct.', express.static(path.join(DOMAINS_ROOT, 'preview.construct.')));


// account.construct.net
app.use('/account.construct.net', express.static(path.join(DOMAINS_ROOT, 'account.construct.net')));
app.use('/account.construct.net', createProxyMiddleware({
  target: 'https://account.construct.net  ',
  changeOrigin: true,
  secure: true,
  logLevel: 'warn'
}));

// stats.construct.net
app.use('/stats.construct.net', express.static(path.join(DOMAINS_ROOT, 'stats.construct.net')));
app.use('/stats.construct.net', createProxyMiddleware({
  target: 'https://stats.construct.net  ',
  changeOrigin: true,
  secure: true,
  logLevel: 'warn'
}));

// editor.construct.net (основной домен на корне)
app.use(express.static(path.join(DOMAINS_ROOT, 'editor.construct.net')));
app.use(createProxyMiddleware({
  target: 'https://editor.construct.net  ',
  changeOrigin: true,
  secure: true,
  logLevel: 'warn'
}));

// ===== HTTP сервер =====
app.listen(HTTP_PORT, () => {
  console.log(`HTTP server running: http://localhost:${HTTP_PORT}/`);
});

// ===== HTTPS сервер =====
try {
  const keyPath = path.join(CERTS_DIR, 'server.key');
  const certPath = path.join(CERTS_DIR, 'server.crt');
  const caPath = path.join(CERTS_DIR, 'rootCA.crt');

  console.log(`[Server] Loading certificates from: ${CERTS_DIR}`);
  console.log(`[Server] Key file exists: ${fs.existsSync(keyPath)}`);
  console.log(`[Server] Cert file exists: ${fs.existsSync(certPath)}`);
  console.log(`[Server] CA file exists: ${fs.existsSync(caPath)}`);

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
    ca: fs.readFileSync(caPath)
  };

  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`[Server] HTTPS server running on port ${HTTPS_PORT}`);
    console.log(`[Server] Main editor URL: https://editor.construct.net/r458-2/`);
    console.log('[Server] Hybrid mode: local files + fallback to original Scirra server');
  });
} catch (err) {
  console.error('[Server] HTTPS server failed to start:', err.message);
  console.error('[Server] Check certificates in:', CERTS_DIR);
  process.exit(1);
}

// ===== Инициализация =====
console.log('Server starting...');
console.log('Working directory:', process.cwd());