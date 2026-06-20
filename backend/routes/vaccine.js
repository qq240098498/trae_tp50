const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

const VACCINE_NEAR_EXPIRE_DAYS = 7;
const VACCINE_PRE_EXPIRE_DAYS = 3;

function computeVaccineStatus(expireDate) {
  if (!expireDate) {
    return { status: 'unknown', daysRemaining: null, shouldAlert: false };
  }
  const today = dayjs().startOf('day');
  const expire = dayjs(expireDate).startOf('day');
  const diff = expire.diff(today, 'day');
  if (diff < 0) {
    return { status: 'expired', daysRemaining: diff, shouldAlert: true };
  }
  if (diff <= VACCINE_NEAR_EXPIRE_DAYS) {
    return { status: 'expiring', daysRemaining: diff, shouldAlert: true };
  }
  return { status: 'valid', daysRemaining: diff, shouldAlert: false };
}

function buildSmsMessage(pet, status, daysRemaining, expireDate) {
  if (status === 'expired') {
    return `【宠物寄养店】您好，您的宠物${pet.name}（${pet.breed}）的疫苗已于${expireDate}过期（已逾期${Math.abs(daysRemaining)}天）。为保障爱宠健康，请尽快带它到店补种疫苗。`;
  }
  return `【宠物寄养店】您好，您的宠物${pet.name}（${pet.breed}）的疫苗将于${expireDate}到期，剩余${daysRemaining}天，请及时安排补种，避免影响寄养。`;
}

async function getReminderFlags(petIds) {
  const map = {};
  for (const id of petIds) {
    map[id] = { checkin: false, pre_expire: false, expired: false };
  }
  if (!petIds.length) return map;
  const placeholders = petIds.map(() => '?').join(',');
  const rows = await all(
    `SELECT DISTINCT pet_id, reminder_type FROM vaccine_reminders WHERE pet_id IN (${placeholders})`,
    petIds
  );
  for (const r of rows) {
    if (map[r.pet_id]) map[r.pet_id][r.reminder_type] = true;
  }
  return map;
}

router.get('/alerts', async (req, res) => {
  try {
    const pets = await all(
      'SELECT * FROM pets WHERE vaccine_expiry_date IS NOT NULL ORDER BY vaccine_expiry_date ASC'
    );
    const alerts = [];
    for (const pet of pets) {
      const info = computeVaccineStatus(pet.vaccine_expiry_date);
      if (!info.shouldAlert) continue;
      alerts.push({
        ...pet,
        ...info,
        expire_date: pet.vaccine_expiry_date
      });
    }
    const flags = await getReminderFlags(alerts.map(a => a.id));
    const result = alerts.map(a => ({ ...a, reminded: flags[a.id] || {} }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/check/:petId', async (req, res) => {
  try {
    const pet = await get('SELECT * FROM pets WHERE id = ?', [req.params.petId]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    const info = computeVaccineStatus(pet.vaccine_expiry_date);
    const flags = await getReminderFlags([pet.id]);
    res.json({
      ...pet,
      ...info,
      expire_date: pet.vaccine_expiry_date,
      reminded: flags[pet.id] || {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pre-expire', async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const deadline = dayjs().add(VACCINE_PRE_EXPIRE_DAYS, 'day').format('YYYY-MM-DD');
    const pets = await all(
      `SELECT * FROM pets
       WHERE vaccine_expiry_date IS NOT NULL
       AND date(vaccine_expiry_date) >= date(?)
       AND date(vaccine_expiry_date) <= date(?)
       ORDER BY vaccine_expiry_date ASC`,
      [today, deadline]
    );
    const result = [];
    for (const pet of pets) {
      const sent = await get(
        `SELECT id FROM vaccine_reminders WHERE pet_id = ? AND reminder_type = 'pre_expire' LIMIT 1`,
        [pet.id]
      );
      if (sent) continue;
      const info = computeVaccineStatus(pet.vaccine_expiry_date);
      result.push({
        ...pet,
        ...info,
        expire_date: pet.vaccine_expiry_date,
        message: buildSmsMessage(pet, info.status, info.daysRemaining, pet.vaccine_expiry_date)
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sms', async (req, res) => {
  try {
    const { pet_id, reminder_type } = req.body;
    if (!pet_id || !reminder_type) {
      return res.status(400).json({ error: '缺少宠物ID或提醒类型' });
    }
    if (!['checkin', 'pre_expire', 'expired'].includes(reminder_type)) {
      return res.status(400).json({ error: '无效的提醒类型' });
    }
    const pet = await get('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    if (!pet.owner_phone) {
      return res.status(400).json({ error: '该宠物未登记主人手机号，无法发送短信' });
    }
    const info = computeVaccineStatus(pet.vaccine_expiry_date);
    const message = buildSmsMessage(pet, info.status, info.daysRemaining, pet.vaccine_expiry_date);

    console.log('========================================');
    console.log('[短信模拟] 发送短信通知主人');
    console.log(`  收件人: ${pet.owner_phone}`);
    console.log(`  宠物: ${pet.name} (${pet.breed})`);
    console.log(`  内容: ${message}`);
    console.log('========================================');

    const result = await run(
      `INSERT INTO vaccine_reminders (pet_id, reminder_type, phone, message) VALUES (?, ?, ?, ?)`,
      [pet_id, reminder_type, pet.owner_phone, message]
    );

    res.json({
      success: true,
      message_id: result.lastID,
      phone: pet.owner_phone,
      message,
      sent_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reminders', async (req, res) => {
  try {
    const { pet_id } = req.query;
    let sql = `
      SELECT vr.*, p.name as pet_name, p.breed as pet_breed
      FROM vaccine_reminders vr
      LEFT JOIN pets p ON vr.pet_id = p.id
    `;
    let params = [];
    if (pet_id) {
      sql += ' WHERE vr.pet_id = ?';
      params.push(pet_id);
    }
    sql += ' ORDER BY vr.sent_at DESC LIMIT 100';
    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
