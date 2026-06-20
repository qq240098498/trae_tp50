const db = require('./db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function addColumnIfNotExists(table, column, definition) {
  const info = await all(`PRAGMA table_info(${table})`);
  const exists = info.some(c => c.name === column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`数据库迁移: 已添加列 ${table}.${column}`);
  }
}

async function dropColumnIfExists(table, column) {
  const info = await all(`PRAGMA table_info(${table})`);
  const exists = info.some(c => c.name === column);
  if (!exists) return;
  try {
    await run(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    console.log(`数据库迁移: 已删除冗余列 ${table}.${column}`);
  } catch (err) {
    console.warn(`数据库迁移: 跳过删除 ${table}.${column}（当前SQLite版本不支持）`, err.message);
  }
}

async function initDatabase() {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        breed TEXT NOT NULL,
        age INTEGER NOT NULL,
        vaccine_records TEXT,
        vaccine_expiry_date DATE,
        owner_phone TEXT,
        habits TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addColumnIfNotExists('pets', 'vaccine_expiry_date', 'DATE');
    await addColumnIfNotExists('pets', 'owner_phone', 'TEXT');
    const petCols = await all('PRAGMA table_info(pets)');
    if (petCols.some(c => c.name === 'vaccine_expire_date')) {
      await run('UPDATE pets SET vaccine_expiry_date = vaccine_expire_date WHERE vaccine_expire_date IS NOT NULL AND vaccine_expiry_date IS NULL');
      console.log('数据库迁移: 已迁移 vaccine_expire_date 数据至 vaccine_expiry_date');
    }
    await dropColumnIfExists('pets', 'vaccine_expire_date');

    await run(`
      CREATE TABLE IF NOT EXISTS cages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        size TEXT NOT NULL CHECK(size IN ('小型', '中型', '大型')),
        price_per_day DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT '可用' CHECK(status IN ('可用', '维修', '停用'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS groomers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        status TEXT NOT NULL DEFAULT '在职' CHECK(status IN ('在职', '休息', '离职'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS boarding_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        cage_id INTEGER NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        feeding_requirements TEXT,
        status TEXT NOT NULL DEFAULT '待入住' CHECK(status IN ('待入住', '已入住', '已离店', '已取消')),
        total_price DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES pets(id),
        FOREIGN KEY (cage_id) REFERENCES cages(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS grooming_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        groomer_id INTEGER NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TEXT NOT NULL,
        service_type TEXT NOT NULL CHECK(service_type IN ('洗澡', '剪毛', 'SPA', '洁牙')),
        price DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT '待服务' CHECK(status IN ('待服务', '服务中', '已完成', '已取消')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES pets(id),
        FOREIGN KEY (groomer_id) REFERENCES groomers(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('寄养', '美容', '综合')),
        amount DECIMAL(10,2) NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('现金', '微信', '支付宝', '银行卡')),
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES pets(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS vaccine_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL,
        reminder_type TEXT NOT NULL CHECK(reminder_type IN ('checkin', 'pre_expire', 'expired')),
        phone TEXT,
        message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES pets(id)
      )
    `);

    const vrInfo = await all('PRAGMA table_info(vaccine_reminders)');
    if (vrInfo.length > 0 && !vrInfo.some(c => c.name === 'phone')) {
      await run('DROP TABLE vaccine_reminders');
      await run(`
        CREATE TABLE vaccine_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pet_id INTEGER NOT NULL,
          reminder_type TEXT NOT NULL CHECK(reminder_type IN ('checkin', 'pre_expire', 'expired')),
          phone TEXT,
          message TEXT,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pet_id) REFERENCES pets(id)
        )
      `);
      console.log('数据库迁移: 已重建表 vaccine_reminders（兼容旧版结构）');
    }

    await run('CREATE INDEX IF NOT EXISTS idx_boarding_cage_date ON boarding_bookings(cage_id, check_in_date, check_out_date)');
    await run('CREATE INDEX IF NOT EXISTS idx_grooming_groomer_datetime ON grooming_bookings(groomer_id, appointment_date, appointment_time)');
    await run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_vaccine_reminders_pet ON vaccine_reminders(pet_id, reminder_type, sent_at)');

    const cageCount = await get('SELECT COUNT(*) as count FROM cages');
    if (cageCount.count === 0) {
      const cages = [
        ['A-101', '小型', 80],
        ['A-102', '小型', 80],
        ['A-103', '小型', 80],
        ['B-201', '中型', 120],
        ['B-202', '中型', 120],
        ['B-203', '中型', 120],
        ['C-301', '大型', 180],
        ['C-302', '大型', 180],
      ];
      for (const c of cages) {
        await run(`INSERT INTO cages (name, size, price_per_day, status) VALUES (?, ?, ?, '可用')`, c);
      }
      console.log('初始化笼位数据完成');
    }

    const groomerCount = await get('SELECT COUNT(*) as count FROM groomers');
    if (groomerCount.count === 0) {
      const groomers = [
        ['张小明', '13800138001'],
        ['李小红', '13800138002'],
        ['王大伟', '13800138003'],
      ];
      for (const g of groomers) {
        await run(`INSERT INTO groomers (name, phone, status) VALUES (?, ?, '在职')`, g);
      }
      console.log('初始化美容师数据完成');
    }

    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
    throw err;
  }
}

module.exports = { run, get, all, initDatabase };
