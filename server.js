const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Admin Credentials (single user, no database) ──────────────────
const ADMIN_USERNAME = 'halimon';
const ADMIN_PASSWORD = 'halimon@2011';

// ─── Active sessions (in-memory) ────────────────────────────────────
const activeSessions = new Map(); // token -> { createdAt }
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const DOWNLOADS_FILE = path.join(DATA_DIR, 'downloads.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VISITORS_FILE)) fs.writeFileSync(VISITORS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(DOWNLOADS_FILE)) fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify({}, null, 2));
if (!fs.existsSync(CATEGORIES_FILE)) fs.writeFileSync(CATEGORIES_FILE, JSON.stringify({}, null, 2));

// Multer config for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Multer config for scary sound upload
const soundStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public')),
  filename: (req, file, cb) => cb(null, 'sound.mp3')
});
const uploadSound = multer({
  storage: soundStorage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// ─── Disable technology fingerprinting (Express / X-Powered-By) ─────
app.disable('x-powered-by');

// ─── Global Security Headers Middleware (OWASP, SOC 2, CWE-693) ────
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob:; " +
    "media-src 'self' data: blob:; " +
    "frame-src 'self' blob: data:; " +
    "connect-src 'self'; " +
    "object-src 'self' blob:; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self';"
  );
  next();
});

// Trust proxy for real IP behind reverse proxy (Render, Cloudflare, etc.)
app.set('trust proxy', true);

// Body parser & static assets (with dotfiles allowed for .well-known)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

// ─── Auth helpers ───────────────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidSession(token) {
  if (!token || !activeSessions.has(token)) return false;
  const session = activeSessions.get(token);
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// Auth middleware — protects admin-only routes
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!isValidSession(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions) {
    if (now - session.createdAt > SESSION_MAX_AGE) {
      activeSessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// Helper: get visitor IP
function getVisitorIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'Unknown';
}

// Helper: read visitors
function readVisitors() {
  try {
    return JSON.parse(fs.readFileSync(VISITORS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// Helper: write visitors
function writeVisitors(visitors) {
  fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2));
}

// Helper: read/write contacts
function readContacts() {
  try { return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8')); } catch { return []; }
}
function writeContacts(contacts) {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

// Helper: read/write download counts
function readDownloads() {
  try { return JSON.parse(fs.readFileSync(DOWNLOADS_FILE, 'utf-8')); } catch { return {}; }
}
function writeDownloads(downloads) {
  fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify(downloads, null, 2));
}

// Helper: read/write categories
function readCategories() {
  try { return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8')); } catch { return {}; }
}
function writeCategories(categories) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
}

// ─── Brute-force Login Protection & Rate Limiting ───────────────────
const loginAttempts = new Map(); // ip -> { count, firstAttempt, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 mins lockout

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMins = Math.ceil((record.lockedUntil - now) / 60000);
    return { allowed: false, remainingMins };
  }
  if (now - record.firstAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_TIME;
  }
  loginAttempts.set(ip, record);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function timingSafeMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length);
    crypto.timingSafeEqual(dummy, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ─── API: Admin Login (Hardened with rate-limiting & timing protection) ──
app.post('/api/admin/login', async (req, res) => {
  const ip = getVisitorIP(req);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Too many failed attempts. Login locked for ${rateLimit.remainingMins} minute(s).`
    });
  }

  const { username, password } = req.body || {};
  const userOk = timingSafeMatch(username, ADMIN_USERNAME);
  const passOk = timingSafeMatch(password, ADMIN_PASSWORD);

  if (userOk && passOk) {
    clearLoginAttempts(ip);
    const token = generateToken();
    activeSessions.set(token, { createdAt: Date.now() });
    res.json({ success: true, token });
  } else {
    recordFailedLogin(ip);
    // Artificial delay to prevent automated high-frequency brute-forcing
    await new Promise(resolve => setTimeout(resolve, 500));
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// ─── API: Admin Logout ──────────────────────────────────────────────
app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) activeSessions.delete(token);
  res.json({ success: true });
});

// ─── API: Check Auth ────────────────────────────────────────────────
app.get('/api/admin/check', (req, res) => {
  const token = req.headers['x-admin-token'];
  res.json({ authenticated: isValidSession(token) });
});

// ─── API: Log visitor ───────────────────────────────────────────────
app.post('/api/visit', (req, res) => {
  const ip = getVisitorIP(req);
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const visitors = readVisitors();

  visitors.push({
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
    page: req.body.page || '/'
  });

  // Permanent retention: Never truncate or delete visitor records
  writeVisitors(visitors);
  res.json({ success: true });
});

// ─── API: Get all visitors (admin, PROTECTED - permanent sorted) ────
app.get('/api/visitors', requireAdmin, (req, res) => {
  const visitors = readVisitors();
  const sort = (req.query.sort || 'desc').toLowerCase();
  visitors.sort((a, b) => {
    const tA = new Date(a.timestamp || 0).getTime();
    const tB = new Date(b.timestamp || 0).getTime();
    return sort === 'asc' ? tA - tB : tB - tA;
  });
  res.json(visitors);
});

// ─── API: Clear visitors DISABLED for permanent retention ─────────
app.post('/api/visitors/clear', requireAdmin, (req, res) => {
  res.status(403).json({ error: 'Visitor logs are permanent and deletion is permanently disabled.' });
});

// ─── API: Upload PDF (admin, PROTECTED) ─────────────────────────────
app.post('/api/upload', requireAdmin, upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    file: {
      name: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size
    }
  });
});

// ─── API: Upload Scary Sound (admin, PROTECTED) ─────────────────────
app.post('/api/upload-sound', requireAdmin, uploadSound.single('sound'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  res.json({
    success: true,
    message: 'Sound uploaded successfully as sound.mp3',
    size: req.file.size
  });
});

// ─── API: Check Sound Status (public) ───────────────────────────────
app.get('/api/sound-status', (req, res) => {
  const soundPath = path.join(__dirname, 'public', 'sound.mp3');
  const exists = fs.existsSync(soundPath);
  res.json({ exists, path: exists ? '/sound.mp3' : null });
});

// ─── API: List PDFs (public, enriched with downloads & categories) ──
app.get('/api/pdfs', (req, res) => {
  try {
    const downloads = readDownloads();
    const categories = readCategories();
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(filename => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
        const originalName = filename.replace(/^\d+-\d+-/, '');
        return {
          filename,
          originalName,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
          downloads: downloads[filename] || 0,
          category: categories[filename] || 'uncategorized'
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// ─── API: Delete PDF (admin, PROTECTED) ─────────────────────────────
app.delete('/api/pdfs/:filename', requireAdmin, (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── API: Download PDF (public, logs IP, tracks count) ──────────────
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    const ip = getVisitorIP(req);
    const visitors = readVisitors();
    visitors.push({
      ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
      timestamp: new Date().toISOString(),
      page: 'Download: ' + req.params.filename.replace(/^\d+-\d+-/, '')
    });
    writeVisitors(visitors);

    // Increment download counter
    const downloads = readDownloads();
    downloads[req.params.filename] = (downloads[req.params.filename] || 0) + 1;
    writeDownloads(downloads);

    const originalName = req.params.filename.replace(/^\d+-\d+-/, '');
    const stat = fs.statSync(filePath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── Serve RFC 9116 security.txt ───────────────────────────────────
const SECURITY_TXT_CONTENT = [
  'Contact: mailto:security@vault-pdf-portal.onrender.com',
  'Expires: 2027-12-31T23:59:59.000Z',
  'Preferred-Languages: en',
  'Canonical: https://vault-pdf-portal.onrender.com/.well-known/security.txt',
  'Policy: https://vault-pdf-portal.onrender.com/about',
  'Acknowledgments: https://vault-pdf-portal.onrender.com/about'
].join('\n') + '\n';

app.get(['/.well-known/security.txt', '/security.txt'], (req, res) => {
  res.type('text/plain; charset=utf-8');
  res.send(SECURITY_TXT_CONTENT);
});

// ─── Serve robots.txt & sitemap.xml ────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /\n\nSitemap: https://vault-pdf-portal.onrender.com/sitemap.xml\n");
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// ─── Serve about page ──────────────────────────────────────────────
app.get('/about', (req, res) => {
  res.redirect('/about.html');
});

// ─── Serve contact page ────────────────────────────────────────────
app.get('/contact', (req, res) => {
  res.redirect('/contact.html');
});

// ─── Serve admin page ───────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// ─── Serve secret page ──────────────────────────────────────────────
app.get('/secret', (req, res) => {
  res.redirect('/secret.html');
});

// ─── API: Submit Contact Message (public) ───────────────────────────
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  const contacts = readContacts();
  contacts.push({
    id: crypto.randomBytes(8).toString('hex'),
    name: name.trim(),
    email: email.trim(),
    subject: (subject || '').trim(),
    message: message.trim(),
    ip: getVisitorIP(req),
    timestamp: new Date().toISOString(),
    read: false
  });
  if (contacts.length > 500) contacts.splice(0, contacts.length - 500);
  writeContacts(contacts);
  res.json({ success: true, message: 'Thank you! Your message has been received.' });
});

// ─── API: Get Contact Messages (admin, PROTECTED) ───────────────────
app.get('/api/contacts', requireAdmin, (req, res) => {
  const contacts = readContacts();
  res.json(contacts.reverse());
});

// ─── API: Mark Contact as Read (admin, PROTECTED) ───────────────────
app.put('/api/contacts/:id/read', requireAdmin, (req, res) => {
  const contacts = readContacts();
  const contact = contacts.find(c => c.id === req.params.id);
  if (contact) {
    contact.read = true;
    writeContacts(contacts);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Contact not found' });
  }
});

// ─── API: Delete Contact (admin, PROTECTED) ─────────────────────────
app.delete('/api/contacts/:id', requireAdmin, (req, res) => {
  let contacts = readContacts();
  contacts = contacts.filter(c => c.id !== req.params.id);
  writeContacts(contacts);
  res.json({ success: true });
});

// ─── API: Clear All Contacts (admin, PROTECTED) ─────────────────────
app.post('/api/contacts/clear', requireAdmin, (req, res) => {
  writeContacts([]);
  res.json({ success: true });
});

// ─── API: Set Document Category (admin, PROTECTED) ──────────────────
app.put('/api/pdfs/:filename/category', requireAdmin, (req, res) => {
  const { category } = req.body;
  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }
  const categories = readCategories();
  categories[req.params.filename] = category;
  writeCategories(categories);
  res.json({ success: true });
});

// ─── API: Get Download Stats (admin, PROTECTED) ─────────────────────
app.get('/api/stats', requireAdmin, (req, res) => {
  const downloads = readDownloads();
  const visitors = readVisitors();
  const contacts = readContacts();
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.pdf'));
  
  const totalDownloads = Object.values(downloads).reduce((sum, n) => sum + n, 0);
  const totalSize = files.reduce((sum, f) => {
    try { return sum + fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch { return sum; }
  }, 0);
  
  // Top downloaded files
  const topFiles = Object.entries(downloads)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([filename, count]) => ({
      filename,
      originalName: filename.replace(/^\d+-\d+-/, ''),
      downloads: count
    }));

  // Downloads in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentDownloads = visitors.filter(v => 
    v.page && v.page.startsWith('Download:') && new Date(v.timestamp) > sevenDaysAgo
  ).length;

  res.json({
    totalFiles: files.length,
    totalDownloads,
    totalSize,
    totalVisitors: visitors.length,
    totalContacts: contacts.length,
    unreadContacts: contacts.filter(c => !c.read).length,
    recentDownloads,
    topFiles
  });
});

// ─── API: Preview PDF (public, serves PDF inline) ───────────────────
app.get('/api/preview/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── Start server ───────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 PDF Portal running at http://localhost:${PORT}`);
  console.log(`  📋 Admin panel at http://localhost:${PORT}/admin\n`);
});
