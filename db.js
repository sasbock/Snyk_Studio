// Pure-JS SQLite (sql.js / WASM) — no native build step required.
// Uses an in-memory database that is seeded on startup, so the app is fully
// self-contained and runnable with `npm start`.
const path = require('path');
const initSqlJs = require('sql.js');

// Mutable handle; methods are populated once the WASM engine is ready.
const db = { get: null, all: null };

function rowsFromExec(database, sql) {
  const res = database.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

const ready = (async () => {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  const database = new SQL.Database();

  database.run(`
    CREATE TABLE users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role     TEXT NOT NULL DEFAULT 'user',
      email    TEXT
    );
    CREATE TABLE notes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      owner   TEXT NOT NULL,
      title   TEXT NOT NULL,
      body    TEXT
    );
  `);

  const insertUser = database.prepare(
    'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)'
  );
  [
    ['admin', 'admin123', 'admin', 'admin@example.com'],
    ['alice', 'password1', 'user', 'alice@example.com'],
    ['bob', 'hunter2', 'user', 'bob@example.com']
  ].forEach((u) => insertUser.run(u));
  insertUser.free();

  const insertNote = database.prepare(
    'INSERT INTO notes (owner, title, body) VALUES (?, ?, ?)'
  );
  [
    ['admin', 'Server credentials', 'root / S3cr3tR00t'],
    ['alice', 'Shopping list', 'milk, eggs, bread'],
    ['bob', 'TODO', 'finish the quarterly report']
  ].forEach((n) => insertNote.run(n));
  insertNote.free();

  // Callback-style API so route handlers read like node-sqlite3.
  db.all = (sql, cb) => {
    try {
      cb(null, rowsFromExec(database, sql));
    } catch (e) {
      cb(e);
    }
  };
  db.get = (sql, cb) => {
    try {
      cb(null, rowsFromExec(database, sql)[0]);
    } catch (e) {
      cb(e);
    }
  };
})();

module.exports = { db, ready };
