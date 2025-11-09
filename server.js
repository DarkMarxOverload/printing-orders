require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const session = require('express-session');

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

ensureDirs();

const app = express();
// limit uploads to 8MB and allow common document/image types
const upload = multer({ 
  dest: UPLOADS_DIR,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpeg|jpg|png|gif|svg|tif|tiff/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) || allowed.test(file.mimetype);
    cb(null, ok);
  }
});

app.use(helmet());

// rate limiter for order submissions
const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests, slow down' }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// session middleware for admin login
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const DB_FILE = path.join(DATA_DIR, 'orders.db');

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    email TEXT,
    phone TEXT,
    details TEXT,
    file_filename TEXT,
    file_originalname TEXT,
    createdAt TEXT
  )`);
});

function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // exclude confusing chars
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

app.post('/api/orders', orderLimiter, upload.single('file'), (req, res) => {
  const { name, email, phone, details } = req.body;
  if (!name || !email || !details) {
    return res.status(400).json({ success: false, error: 'name, email and details are required' });
  }
  // basic validation
  if (!validator.isEmail(email)) return res.status(400).json({ success: false, error: 'invalid email' });
  if (!validator.isLength(details, { min: 5 })) return res.status(400).json({ success: false, error: 'details too short' });
  const safeName = validator.escape(name);
  const safeDetails = validator.escape(details);

  let code = generateCode();
  const tryUnique = (cb) => {
    db.get('SELECT code FROM orders WHERE code = ?', [code], (err, row) => {
      if (err) return cb(err);
      if (row) {
        code = generateCode();
        return tryUnique(cb);
      }
      return cb(null);
    });
  };

  tryUnique((err) => {
    if (err) return res.status(500).json({ success: false, error: 'DB error' });

  const createdAt = new Date().toISOString();
  const file_filename = req.file ? req.file.filename : null;
  const file_originalname = req.file ? req.file.originalname : null;

    const sql = `INSERT INTO orders (code, name, email, phone, details, file_filename, file_originalname, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [code, name, email, phone || null, details, file_filename, file_originalname, createdAt];
    db.run(sql, params, function (dbErr) {
      if (dbErr) return res.status(500).json({ success: false, error: 'DB insert error' });
      const url = `/o/${code}`;
      res.json({ success: true, url, code });

      // send notification email if SMTP configured
      if (process.env.SMTP_HOST && process.env.NOTIFY_EMAIL) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
          });
          const mail = {
            from: process.env.SMTP_FROM || 'no-reply@printing.example',
            to: process.env.NOTIFY_EMAIL,
            subject: `New printing order: ${code}`,
            text: `Order ${code} by ${safeName} (${email})\n\nDetails:\n${safeDetails}\n\nView: ${url}`
          };
          transporter.sendMail(mail).catch(()=>{});
        } catch (e) {
          // ignore email errors for now
        }
      }
    });
  });
});

// Basic HTTP auth for admin / listing. Configure ADMIN_USER and ADMIN_PASS env vars.
function checkSessionAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/orders', checkSessionAuth, (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// CSV export
app.get('/api/orders.csv', checkSessionAuth, (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    const cols = ['id','code','name','email','phone','details','file_filename','file_originalname','createdAt'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.write(cols.join(',') + '\n');
    for (const r of rows) {
      const line = cols.map(c => '"' + String(r[c] || '').replace(/"/g,'""') + '"').join(',');
      res.write(line + '\n');
    }
    res.end();
  });
});

app.get('/api/orders/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT * FROM orders WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Order not found' });
    // convert DB row to legacy shape (file object)
    const order = {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      details: row.details,
      file: row.file_filename ? { filename: row.file_filename, originalname: row.file_originalname } : null,
      createdAt: row.createdAt
    };
    res.json(order);
  });
});

// protect admin HTML with basic auth
app.get('/admin.html', (req, res) => {
  // serve admin SPA which will call /api to check session
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// admin login/logout
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const { user, pass } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password';
  if (user === adminUser && pass === adminPass) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.status(403).json({ success: false, error: 'Invalid credentials' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/o/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

// Return uploaded file
app.get('/uploads/:filename', (req, res) => {
  const fn = req.params.filename;
  const p = path.join(UPLOADS_DIR, fn);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.sendFile(p);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
