const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'petshop.db');
const db = new sqlite3.Database(dbPath);

db.run('PRAGMA foreign_keys = ON');

module.exports = db;
