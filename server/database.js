/**
 * Database module using sql.js (pure JS SQLite).
 * The database is loaded from and saved to `database/visitors.db`.
 * On Vercel, the writable path is `/tmp/visitors.db`.
 */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Vercel provides only /tmp as writable; local uses a database folder
const dbPath = process.env.VERCEL
  ? '/tmp/visitors.db'
  : path.join(__dirname, '..', 'database', 'visitors.db');

let db = null;

// Ensure the local directory exists (only needed locally; Vercel's /tmp always exists)
if (!process.env.VERCEL) {
  const dbDir = path.join(__dirname, '..', 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

/**
 * Load or create the database, then run migrations.
 * Returns a promise that resolves when the database is ready.
 */
async function initDatabase() {
  // Tell sql.js exactly where to find its .wasm file
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
  });

  let fileBuffer;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }

  db = new SQL.Database(fileBuffer);

  db.run(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      timezone TEXT,
      browser_name TEXT,
      browser_version TEXT,
      os TEXT,
      device_type TEXT,
      screen_resolution TEXT,
      language TEXT,
      referrer TEXT,
      user_agent TEXT,
      is_returning INTEGER DEFAULT 0,
      visit_number INTEGER DEFAULT 1
    );
  `);

  saveDatabase();
  console.log('Database initialized successfully.');
}

/**
 * Write the current database state to the .db file.
 */
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Insert a new visitor record and return the inserted ID.
 */
function insertVisitor(data) {
  const record = {
    visitor_id: data.visitor_id || 'unknown',
    timestamp: data.timestamp || new Date().toISOString(),
    ip: data.ip || null,
    country: data.country || null,
    region: data.region || null,
    city: data.city || null,
    timezone: data.timezone || null,
    browser_name: data.browser_name || null,
    browser_version: data.browser_version || null,
    os: data.os || null,
    device_type: data.device_type || null,
    screen_resolution: data.screen_resolution || null,
    language: data.language || null,
    referrer: data.referrer || null,
    user_agent: data.user_agent || null,
    is_returning: data.is_returning ? 1 : 0,
    visit_number: data.visit_number || 1
  };

  const stmt = db.prepare(`
    INSERT INTO visitors (
      visitor_id, timestamp, ip, country, region, city, timezone,
      browser_name, browser_version, os, device_type, screen_resolution,
      language, referrer, user_agent, is_returning, visit_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.bind([
    record.visitor_id,
    record.timestamp,
    record.ip,
    record.country,
    record.region,
    record.city,
    record.timezone,
    record.browser_name,
    record.browser_version,
    record.os,
    record.device_type,
    record.screen_resolution,
    record.language,
    record.referrer,
    record.user_agent,
    record.is_returning,
    record.visit_number
  ]);

  stmt.step();
  stmt.free();
  saveDatabase();
  return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
}

/**
 * Get paginated visitors with optional search and filters.
 */
function getVisitors({ page = 1, limit = 20, search, country, city, startDate, endDate }) {
  const offset = (page - 1) * limit;
  let where = [];
  let params = [];

  if (search) {
    where.push(`(ip LIKE ? OR country LIKE ? OR city LIKE ? OR browser_name LIKE ? OR os LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  if (country) {
    where.push(`country = ?`);
    params.push(country);
  }
  if (city) {
    where.push(`city = ?`);
    params.push(city);
  }
  if (startDate) {
    where.push(`timestamp >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    where.push(`timestamp <= ?`);
    params.push(endDate);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM visitors ${whereClause}`);
  countStmt.bind(params);
  let total = 0;
  if (countStmt.step()) {
    total = countStmt.getAsObject().total;
  }
  countStmt.free();

  const stmt = db.prepare(`SELECT * FROM visitors ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`);
  const allParams = params.concat([limit, offset]);
  stmt.bind(allParams);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  return { total, page, limit, data: rows };
}

/**
 * Get aggregated statistics for the dashboard.
 */
function getStats() {
  const execResult = (query, params = []) => {
    const stmt = db.prepare(query);
    if (params.length) stmt.bind(params);
    const val = stmt.step() ? stmt.getAsObject().count : 0;
    stmt.free();
    return val;
  };

  const totalVisitors = execResult('SELECT COUNT(*) as count FROM visitors');
  const todayVisitors = execResult("SELECT COUNT(*) as count FROM visitors WHERE date(timestamp) = date('now')");
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const onlineVisitors = execResult('SELECT COUNT(DISTINCT visitor_id) as count FROM visitors WHERE timestamp >= ?', [fiveMinAgo]);

  const statsQuery = (query) => {
    const stmt = db.prepare(query);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  };

  return {
    totalVisitors,
    todayVisitors,
    onlineVisitors,
    countries: statsQuery('SELECT country, COUNT(*) as count FROM visitors GROUP BY country ORDER BY count DESC'),
    cities: statsQuery('SELECT city, COUNT(*) as count FROM visitors GROUP BY city ORDER BY count DESC'),
    browsers: statsQuery('SELECT browser_name, COUNT(*) as count FROM visitors GROUP BY browser_name ORDER BY count DESC'),
    devices: statsQuery('SELECT device_type, COUNT(*) as count FROM visitors GROUP BY device_type ORDER BY count DESC'),
    os: statsQuery('SELECT os, COUNT(*) as count FROM visitors GROUP BY os ORDER BY count DESC')
  };
}

/**
 * Delete a visitor by ID.
 */
function deleteVisitor(id) {
  db.run('DELETE FROM visitors WHERE id = ?', [id]);
  saveDatabase();
}

/**
 * Get all visitors for export.
 */
function getAllVisitorsForExport() {
  const stmt = db.prepare('SELECT * FROM visitors ORDER BY id DESC');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Helper: count visits for a given visitor_id.
 */
function getVisitorCount(visitorId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM visitors WHERE visitor_id = ?');
  stmt.bind([visitorId]);
  let count = 0;
  if (stmt.step()) {
    count = stmt.getAsObject().count;
  }
  stmt.free();
  return count;
}

// Immediately start initialising the database and export a promise
const ready = initDatabase();

module.exports = {
  ready,               // so routes can await it
  insertVisitor,
  getVisitors,
  getStats,
  deleteVisitor,
  getAllVisitorsForExport,
  getVisitorCount
};