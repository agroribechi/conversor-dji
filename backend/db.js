const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'dji_database.db');
const db = new sqlite3.Database(dbPath);

// Promise-based helper methods for cleaner async/await
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize Tables & Default Admin User
const initDb = async () => {
  db.serialize(async () => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        credits INTEGER DEFAULT 50,
        status TEXT DEFAULT 'active',
        current_session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversions log table
    db.run(`
      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_count INTEGER NOT NULL,
        profile TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Transactions table for Pix / Payments
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        credits_added INTEGER NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        payment_id TEXT UNIQUE,
        pix_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Check & Create Default Admin User
    try {
      const adminExists = await dbGet("SELECT * FROM users WHERE email = ?", ['admin@dji.com']);
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await dbRun(
          "INSERT INTO users (email, password_hash, role, credits, status) VALUES (?, ?, 'admin', 999999, 'active')",
          ['admin@dji.com', hashedPassword]
        );
        console.log('[Database] Admin padrão criado: admin@dji.com / admin123');
      }
    } catch (err) {
      console.error('[Database Error] Falha ao criar admin:', err);
    }
  });
};

initDb();

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll
};
