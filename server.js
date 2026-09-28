const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VISITORS_FILE)) fs.writeFileSync(VISITORS_FILE, JSON.stringify([], null, 2));

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

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Trust proxy for real IP behind reverse proxy (Render, Cloudflare, etc.)
app.set('trust proxy', true);

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

  // Keep last 500 entries
  if (visitors.length > 500) visitors.splice(0, visitors.length - 500);

  writeVisitors(visitors);
  res.json({ success: true });
});

// ─── API: Get all visitors (admin) ──────────────────────────────────
app.get('/api/visitors', (req, res) => {
  const visitors = readVisitors();
  res.json(visitors.reverse());
});

// ─── API: Clear visitors (admin) ────────────────────────────────────
app.post('/api/visitors/clear', (req, res) => {
  writeVisitors([]);
  res.json({ success: true });
});

// ─── API: Upload PDF (admin) ────────────────────────────────────────
app.post('/api/upload', upload.single('pdf'), (req, res) => {
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

// ─── API: List PDFs ─────────────────────────────────────────────────
app.get('/api/pdfs', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(filename => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
        // Extract original name from stored filename
        const originalName = filename.replace(/^\d+-\d+-/, '');
        return {
          filename,
          originalName,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// ─── API: Delete PDF (admin) ────────────────────────────────────────
app.delete('/api/pdfs/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── API: Download PDF (FIXED — uses stream instead of res.download) ─
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    // Log the download
    const ip = getVisitorIP(req);
    const visitors = readVisitors();
    visitors.push({
      ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
      timestamp: new Date().toISOString(),
      page: 'Download: ' + req.params.filename.replace(/^\d+-\d+-/, '')
    });
    writeVisitors(visitors);

    const originalName = req.params.filename.replace(/^\d+-\d+-/, '');
    const stat = fs.statSync(filePath);

    // Stream file directly — avoids Express sendFile dotfiles restriction
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

// ─── Serve admin page ───────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// ─── Start server ───────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 PDF Portal running at http://localhost:${PORT}`);
  console.log(`  📋 Admin panel at http://localhost:${PORT}/admin\n`);
});
