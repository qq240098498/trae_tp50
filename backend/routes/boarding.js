const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

router.get('/cages', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM cages';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY name';
    
    const cages = await all(sql, params);
    res.json(cages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cages/available', async (req, res) => {
  try {
    const { check_in_date, check_out_date, exclude_booking_id } = req.query;
    
    if (!check_in_date || !check_out_date) {
      return res.status(400).json({ error: '请提供入住和离店日期' });
    }
    
    const excludeId = exclude_booking_id ? parseInt(exclude_booking_id) : null;
    
    const conflictSQL = `
      SELECT DISTINCT cage_id FROM boarding_bookings 
      WHERE status != '已取消' 
      AND id != COALESCE(?, 0)
      AND (
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
    `;
    
    const conflictParams = [
      excludeId,
      check_out_date, check_in_date,
      check_out_date, check_in_date,
      check_in_date, check_out_date
    ];
    
    const conflicts = await all(conflictSQL, conflictParams);
    const conflictCageIds = conflicts.map(c => c.cage_id);
    
    let sql = 'SELECT * FROM cages WHERE status = ?';
    let params = ['可用'];
    
    if (conflictCageIds.length > 0) {
      const placeholders = conflictCageIds.map(() => '?').join(',');
      sql += ` AND id NOT IN (${placeholders})`;
      params = params.concat(conflictCageIds);
    }
    
    sql += ' ORDER BY name';
    const availableCages = await all(sql, params);
    
    res.json({
      availableCages,
      conflictCageIds,
      allCages: await all('SELECT * FROM cages ORDER BY name')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, pet_id, start_date, end_date } = req.query;
    let sql = `
      SELECT bb.*, p.name as pet_name, p.breed as pet_breed, 
             c.name as cage_name, c.size as cage_size, c.price_per_day
      FROM boarding_bookings bb
      LEFT JOIN pets p ON bb.pet_id = p.id
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE 1=1
    `;
    let params = [];
    
    if (status) {
      sql += ' AND bb.status = ?';
      params.push(status);
    }
    if (pet_id) {
      sql += ' AND bb.pet_id = ?';
      params.push(pet_id);
    }
    if (start_date) {
      sql += ' AND bb.check_in_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND bb.check_in_date <= ?';
      params.push(end_date);
    }
    
    sql += ' ORDER BY bb.check_in_date DESC, bb.created_at DESC';
    const bookings = await all(sql, params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await get(`
      SELECT bb.*, p.name as pet_name, p.breed as pet_breed, p.age as pet_age,
             p.vaccine_records as pet_vaccine_records, p.habits as pet_habits,
             c.name as cage_name, c.size as cage_size, c.price_per_day
      FROM boarding_bookings bb
      LEFT JOIN pets p ON bb.pet_id = p.id
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE bb.id = ?
    `, [req.params.id]);
    
    if (!booking) {
      return res.status(404).json({ error: '寄养预约不存在' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { pet_id, cage_id, check_in_date, check_out_date, feeding_requirements } = req.body;
    
    if (!pet_id || !cage_id || !check_in_date || !check_out_date) {
      return res.status(400).json({ error: '宠物、笼位、入住日期、离店日期为必填项' });
    }
    
    if (dayjs(check_out_date).isBefore(dayjs(check_in_date))) {
      return res.status(400).json({ error: '离店日期不能早于入住日期' });
    }
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    
    const cage = await get('SELECT * FROM cages WHERE id = ? AND status = ?', [cage_id, '可用']);
    if (!cage) {
      return res.status(404).json({ error: '笼位不存在或不可用' });
    }
    
    const conflicts = await all(`
      SELECT * FROM boarding_bookings 
      WHERE cage_id = ? AND status != '已取消'
      AND (
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
    `, [
      cage_id,
      check_out_date, check_in_date,
      check_out_date, check_in_date,
      check_in_date, check_out_date
    ]);
    
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        error: '该笼位在所选时间段内已被预约',
        conflicts: conflicts
      });
    }
    
    const days = dayjs(check_out_date).diff(dayjs(check_in_date), 'day') || 1;
    const total_price = days * cage.price_per_day;
    
    const result = await run(`
      INSERT INTO boarding_bookings 
      (pet_id, cage_id, check_in_date, check_out_date, feeding_requirements, total_price, status)
      VALUES (?, ?, ?, ?, ?, ?, '待入住')
    `, [pet_id, cage_id, check_in_date, check_out_date, feeding_requirements || '', total_price]);
    
    const booking = await get(`
      SELECT bb.*, p.name as pet_name, c.name as cage_name
      FROM boarding_bookings bb
      LEFT JOIN pets p ON bb.pet_id = p.id
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE bb.id = ?
    `, [result.lastID]);
    
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { pet_id, cage_id, check_in_date, check_out_date, feeding_requirements, status } = req.body;
    
    const existing = await get('SELECT * FROM boarding_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '寄养预约不存在' });
    }
    
    const newCageId = cage_id || existing.cage_id;
    const newCheckIn = check_in_date || existing.check_in_date;
    const newCheckOut = check_out_date || existing.check_out_date;
    
    if (dayjs(newCheckOut).isBefore(dayjs(newCheckIn))) {
      return res.status(400).json({ error: '离店日期不能早于入住日期' });
    }
    
    const conflicts = await all(`
      SELECT * FROM boarding_bookings 
      WHERE id != ? AND cage_id = ? AND status != '已取消'
      AND (
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date <= ? AND check_out_date >= ?) OR
        (check_in_date >= ? AND check_out_date <= ?)
      )
    `, [
      req.params.id,
      newCageId,
      newCheckOut, newCheckIn,
      newCheckOut, newCheckIn,
      newCheckIn, newCheckOut
    ]);
    
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        error: '该笼位在所选时间段内已被预约',
        conflicts: conflicts
      });
    }
    
    const cage = await get('SELECT * FROM cages WHERE id = ?', [newCageId]);
    const days = dayjs(newCheckOut).diff(dayjs(newCheckIn), 'day') || 1;
    const total_price = days * cage.price_per_day;
    
    await run(`
      UPDATE boarding_bookings SET 
      pet_id = ?, cage_id = ?, check_in_date = ?, check_out_date = ?, 
      feeding_requirements = ?, total_price = ?, status = ?
      WHERE id = ?
    `, [
      pet_id || existing.pet_id,
      newCageId,
      newCheckIn,
      newCheckOut,
      feeding_requirements !== undefined ? feeding_requirements : existing.feeding_requirements,
      total_price,
      status || existing.status,
      req.params.id
    ]);
    
    const booking = await get(`
      SELECT bb.*, p.name as pet_name, c.name as cage_name
      FROM boarding_bookings bb
      LEFT JOIN pets p ON bb.pet_id = p.id
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE bb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const existing = await get('SELECT * FROM boarding_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '寄养预约不存在' });
    }
    
    if (!['待入住', '已入住', '已离店', '已取消'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    await run('UPDATE boarding_bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    
    const booking = await get(`
      SELECT bb.*, p.name as pet_name, c.name as cage_name
      FROM boarding_bookings bb
      LEFT JOIN pets p ON bb.pet_id = p.id
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE bb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM boarding_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '寄养预约不存在' });
    }
    
    await run('UPDATE boarding_bookings SET status = ? WHERE id = ?', ['已取消', req.params.id]);
    res.json({ message: '预约已取消' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
