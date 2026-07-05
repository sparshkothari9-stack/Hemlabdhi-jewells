const { getClient } = require('./db');

async function get(sql, params = []) {
  const db = await getClient();
  const result = await db.execute({ sql, args: params });
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function all(sql, params = []) {
  const db = await getClient();
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

async function run(sql, params = []) {
  const db = await getClient();
  const result = await db.execute({ sql, args: params });
  return {
    lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
    changes: result.rowsAffected || 0,
  };
}

async function init() {
  await getClient();
  return true;
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { get, all, run, init, asyncHandler };
