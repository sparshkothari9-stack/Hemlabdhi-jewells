const { getDB, save } = require('./db');

let _ready = null;
function ready() {
  if (!_ready) _ready = getDB();
  return _ready;
}

async function waitDB() {
  await ready();
}

function get(sql, params = []) {
  const db = getDB.__syncDb;
  if (!db) throw new Error('Database not initialized. Call init() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    row = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]] = vals[i];
    }
  }
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const db = getDB.__syncDb;
  if (!db) throw new Error('Database not initialized. Call init() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const vals = stmt.get();
    const row = {};
    for (let i = 0; i < cols.length; i++) {
      row[cols[i]] = vals[i];
    }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  const db = getDB.__syncDb;
  if (!db) throw new Error('Database not initialized. Call init() first.');
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id");
  const lastId = result && result[0] && result[0].values && result[0].values[0] ? result[0].values[0][0] : null;
  const changes = db.getRowsModified();
  save();
  return { lastInsertRowid: lastId, changes };
}

async function init() {
  await ready();
  return true;
}

module.exports = { get, all, run, init, waitDB };
