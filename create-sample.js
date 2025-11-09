// Small helper to create a sample order in the SQLite DB so the demo shows data.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, 'data', 'orders.db');

const db = new sqlite3.Database(dbFile);
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

  const stmt = db.prepare(`INSERT OR IGNORE INTO orders (code, name, email, phone, details, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const now = new Date().toISOString();
  stmt.run('DEMO01', 'Jane Doe', 'jane@example.com', '123-456', 'Demo print: 10x A4, color, double-sided', now);
  stmt.finalize(() => {
    console.log('Sample order added (code=DEMO01)');
    db.close();
  });
});
