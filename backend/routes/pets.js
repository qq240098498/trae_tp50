const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query;
    let sql = 'SELECT * FROM pets ORDER BY updated_at DESC';
    let params = [];
    
    if (keyword) {
      sql = 'SELECT * FROM pets WHERE name LIKE ? OR breed LIKE ? ORDER BY updated_at DESC';
      params = [`%${keyword}%`, `%${keyword}%`];
    }
    
    const pets = await all(sql, params);
    res.json(pets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pet = await get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物档案不存在' });
    }
    res.json(pet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, breed, age, vaccine_records, vaccine_expiry_date, owner_phone, habits } = req.body;
    
    if (!name || !breed || age === undefined) {
      return res.status(400).json({ error: '名称、品种、年龄为必填项' });
    }
    
    const result = await run(
      `INSERT INTO pets (name, breed, age, vaccine_records, vaccine_expiry_date, owner_phone, habits, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, breed, age,
        vaccine_records || '',
        vaccine_expiry_date || null,
        owner_phone || '',
        habits || '',
        dayjs().format('YYYY-MM-DD HH:mm:ss')
      ]
    );
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [result.lastID]);
    res.status(201).json(pet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, breed, age, vaccine_records, vaccine_expiry_date, owner_phone, habits } = req.body;
    
    const existing = await get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '宠物档案不存在' });
    }
    
    await run(
      `UPDATE pets SET name = ?, breed = ?, age = ?, vaccine_records = ?, vaccine_expiry_date = ?, owner_phone = ?, habits = ?, updated_at = ? 
       WHERE id = ?`,
      [
        name || existing.name,
        breed || existing.breed,
        age !== undefined ? age : existing.age,
        vaccine_records !== undefined ? vaccine_records : existing.vaccine_records,
        vaccine_expiry_date !== undefined ? (vaccine_expiry_date || null) : existing.vaccine_expiry_date,
        owner_phone !== undefined ? owner_phone : existing.owner_phone,
        habits !== undefined ? habits : existing.habits,
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        req.params.id
      ]
    );
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    res.json(pet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '宠物档案不存在' });
    }
    
    const boardingCount = await get(
      'SELECT COUNT(*) as count FROM boarding_bookings WHERE pet_id = ? AND status != ?',
      [req.params.id, '已取消']
    );
    const groomingCount = await get(
      'SELECT COUNT(*) as count FROM grooming_bookings WHERE pet_id = ? AND status != ?',
      [req.params.id, '已取消']
    );
    
    if (boardingCount.count > 0 || groomingCount.count > 0) {
      return res.status(400).json({ error: '该宠物存在有效预约，无法删除' });
    }
    
    await run('DELETE FROM pets WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
