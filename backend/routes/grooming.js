const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

const SERVICE_PRICES = {
  '洗澡': 80,
  '剪毛': 150,
  'SPA': 200,
  '洁牙': 120
};

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'
];

router.get('/groomers', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM groomers';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY name';
    
    const groomers = await all(sql, params);
    res.json(groomers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/groomers/available', async (req, res) => {
  try {
    const { appointment_date, exclude_booking_id } = req.query;
    
    if (!appointment_date) {
      return res.status(400).json({ error: '请提供预约日期' });
    }
    
    const excludeId = exclude_booking_id ? parseInt(exclude_booking_id) : null;
    
    const conflicts = await all(`
      SELECT DISTINCT groomer_id, appointment_time 
      FROM grooming_bookings 
      WHERE appointment_date = ? 
      AND status != '已取消'
      AND id != COALESCE(?, 0)
    `, [appointment_date, excludeId]);
    
    const busySlots = {};
    conflicts.forEach(c => {
      if (!busySlots[c.groomer_id]) {
        busySlots[c.groomer_id] = [];
      }
      busySlots[c.groomer_id].push(c.appointment_time);
    });
    
    const groomers = await all(`SELECT * FROM groomers WHERE status = ? ORDER BY name`, ['在职']);
    
    const result = groomers.map(g => ({
      ...g,
      busyTimes: busySlots[g.id] || [],
      availableTimes: TIME_SLOTS.filter(t => !(busySlots[g.id] || []).includes(t))
    }));
    
    res.json({
      groomers: result,
      timeSlots: TIME_SLOTS,
      servicePrices: SERVICE_PRICES
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/services', (req, res) => {
  res.json({
    services: Object.keys(SERVICE_PRICES),
    prices: SERVICE_PRICES,
    timeSlots: TIME_SLOTS
  });
});

router.get('/', async (req, res) => {
  try {
    const { status, pet_id, groomer_id, start_date, end_date } = req.query;
    let sql = `
      SELECT gb.*, p.name as pet_name, p.breed as pet_breed,
             g.name as groomer_name, g.phone as groomer_phone
      FROM grooming_bookings gb
      LEFT JOIN pets p ON gb.pet_id = p.id
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE 1=1
    `;
    let params = [];
    
    if (status) {
      sql += ' AND gb.status = ?';
      params.push(status);
    }
    if (pet_id) {
      sql += ' AND gb.pet_id = ?';
      params.push(pet_id);
    }
    if (groomer_id) {
      sql += ' AND gb.groomer_id = ?';
      params.push(groomer_id);
    }
    if (start_date) {
      sql += ' AND gb.appointment_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND gb.appointment_date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY gb.appointment_date DESC, gb.appointment_time DESC, gb.created_at DESC';
    const bookings = await all(sql, params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await get(`
      SELECT gb.*, p.name as pet_name, p.breed as pet_breed, p.age as pet_age,
             p.vaccine_records as pet_vaccine_records, p.habits as pet_habits,
             g.name as groomer_name, g.phone as groomer_phone
      FROM grooming_bookings gb
      LEFT JOIN pets p ON gb.pet_id = p.id
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE gb.id = ?
    `, [req.params.id]);
    
    if (!booking) {
      return res.status(404).json({ error: '美容预约不存在' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { pet_id, groomer_id, appointment_date, appointment_time, service_type } = req.body;
    
    if (!pet_id || !groomer_id || !appointment_date || !appointment_time || !service_type) {
      return res.status(400).json({ error: '宠物、美容师、预约日期、时间、服务类型为必填项' });
    }
    
    if (!SERVICE_PRICES[service_type]) {
      return res.status(400).json({ error: '无效的服务类型' });
    }
    
    if (!TIME_SLOTS.includes(appointment_time)) {
      return res.status(400).json({ error: '无效的预约时间段' });
    }
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    
    const groomer = await get('SELECT * FROM groomers WHERE id = ? AND status = ?', [groomer_id, '在职']);
    if (!groomer) {
      return res.status(404).json({ error: '美容师不存在或不在职' });
    }
    
    const conflict = await get(`
      SELECT * FROM grooming_bookings 
      WHERE groomer_id = ? AND appointment_date = ? AND appointment_time = ?
      AND status != '已取消'
    `, [groomer_id, appointment_date, appointment_time]);
    
    if (conflict) {
      return res.status(400).json({ 
        error: '该美容师在所选时间段已有预约',
        conflict: conflict
      });
    }
    
    const price = SERVICE_PRICES[service_type];
    
    const result = await run(`
      INSERT INTO grooming_bookings 
      (pet_id, groomer_id, appointment_date, appointment_time, service_type, price, status)
      VALUES (?, ?, ?, ?, ?, ?, '待服务')
    `, [pet_id, groomer_id, appointment_date, appointment_time, service_type, price]);
    
    const booking = await get(`
      SELECT gb.*, p.name as pet_name, g.name as groomer_name
      FROM grooming_bookings gb
      LEFT JOIN pets p ON gb.pet_id = p.id
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE gb.id = ?
    `, [result.lastID]);
    
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { pet_id, groomer_id, appointment_date, appointment_time, service_type, status } = req.body;
    
    const existing = await get('SELECT * FROM grooming_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '美容预约不存在' });
    }
    
    const newGroomerId = groomer_id || existing.groomer_id;
    const newDate = appointment_date || existing.appointment_date;
    const newTime = appointment_time || existing.appointment_time;
    const newService = service_type || existing.service_type;
    
    if (service_type && !SERVICE_PRICES[service_type]) {
      return res.status(400).json({ error: '无效的服务类型' });
    }
    
    if (appointment_time && !TIME_SLOTS.includes(appointment_time)) {
      return res.status(400).json({ error: '无效的预约时间段' });
    }
    
    const conflict = await get(`
      SELECT * FROM grooming_bookings 
      WHERE id != ? AND groomer_id = ? AND appointment_date = ? AND appointment_time = ?
      AND status != '已取消'
    `, [req.params.id, newGroomerId, newDate, newTime]);
    
    if (conflict) {
      return res.status(400).json({ 
        error: '该美容师在所选时间段已有预约',
        conflict: conflict
      });
    }
    
    const price = SERVICE_PRICES[newService];
    
    await run(`
      UPDATE grooming_bookings SET 
      pet_id = ?, groomer_id = ?, appointment_date = ?, appointment_time = ?,
      service_type = ?, price = ?, status = ?
      WHERE id = ?
    `, [
      pet_id || existing.pet_id,
      newGroomerId,
      newDate,
      newTime,
      newService,
      price,
      status || existing.status,
      req.params.id
    ]);
    
    const booking = await get(`
      SELECT gb.*, p.name as pet_name, g.name as groomer_name
      FROM grooming_bookings gb
      LEFT JOIN pets p ON gb.pet_id = p.id
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE gb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const existing = await get('SELECT * FROM grooming_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '美容预约不存在' });
    }
    
    if (!['待服务', '服务中', '已完成', '已取消'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    await run('UPDATE grooming_bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    
    const booking = await get(`
      SELECT gb.*, p.name as pet_name, g.name as groomer_name
      FROM grooming_bookings gb
      LEFT JOIN pets p ON gb.pet_id = p.id
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE gb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM grooming_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '美容预约不存在' });
    }
    
    await run('UPDATE grooming_bookings SET status = ? WHERE id = ?', ['已取消', req.params.id]);
    res.json({ message: '预约已取消' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
