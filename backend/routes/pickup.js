const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

router.get('/areas', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM pickup_areas';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY sort_order, id';
    
    const areas = await all(sql, params);
    res.json(areas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/areas', async (req, res) => {
  try {
    const { name, description, base_price, sort_order } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '区域名称为必填项' });
    }
    
    const existing = await get('SELECT * FROM pickup_areas WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ error: '该区域名称已存在' });
    }
    
    const result = await run(`
      INSERT INTO pickup_areas (name, description, base_price, sort_order, status)
      VALUES (?, ?, ?, ?, '启用')
    `, [name, description || '', base_price || 0, sort_order || 0]);
    
    const area = await get('SELECT * FROM pickup_areas WHERE id = ?', [result.lastID]);
    res.status(201).json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/areas/:id', async (req, res) => {
  try {
    const { name, description, base_price, sort_order, status } = req.body;
    
    const existing = await get('SELECT * FROM pickup_areas WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '区域不存在' });
    }
    
    if (name && name !== existing.name) {
      const duplicate = await get('SELECT * FROM pickup_areas WHERE name = ? AND id != ?', [name, req.params.id]);
      if (duplicate) {
        return res.status(400).json({ error: '该区域名称已存在' });
      }
    }
    
    await run(`
      UPDATE pickup_areas SET 
      name = ?, description = ?, base_price = ?, sort_order = ?, status = ?
      WHERE id = ?
    `, [
      name || existing.name,
      description !== undefined ? description : existing.description,
      base_price !== undefined ? base_price : existing.base_price,
      sort_order !== undefined ? sort_order : existing.sort_order,
      status || existing.status,
      req.params.id
    ]);
    
    const area = await get('SELECT * FROM pickup_areas WHERE id = ?', [req.params.id]);
    res.json(area);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/areas/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM pickup_areas WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '区域不存在' });
    }
    
    await run('DELETE FROM pickup_areas WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/price-tiers', async (req, res) => {
  try {
    const tiers = await all('SELECT * FROM pickup_price_tiers ORDER BY sort_order, min_distance');
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/price-tiers', async (req, res) => {
  try {
    const { min_distance, max_distance, price, description, sort_order } = req.body;
    
    if (min_distance === undefined || max_distance === undefined || price === undefined) {
      return res.status(400).json({ error: '最小距离、最大距离、价格为必填项' });
    }
    
    if (parseFloat(max_distance) <= parseFloat(min_distance)) {
      return res.status(400).json({ error: '最大距离必须大于最小距离' });
    }
    
    const result = await run(`
      INSERT INTO pickup_price_tiers (min_distance, max_distance, price, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `, [min_distance, max_distance, price, description || '', sort_order || 0]);
    
    const tier = await get('SELECT * FROM pickup_price_tiers WHERE id = ?', [result.lastID]);
    res.status(201).json(tier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/price-tiers/:id', async (req, res) => {
  try {
    const { min_distance, max_distance, price, description, sort_order } = req.body;
    
    const existing = await get('SELECT * FROM pickup_price_tiers WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '价格区间不存在' });
    }
    
    const newMin = min_distance !== undefined ? min_distance : existing.min_distance;
    const newMax = max_distance !== undefined ? max_distance : existing.max_distance;
    
    if (parseFloat(newMax) <= parseFloat(newMin)) {
      return res.status(400).json({ error: '最大距离必须大于最小距离' });
    }
    
    await run(`
      UPDATE pickup_price_tiers SET 
      min_distance = ?, max_distance = ?, price = ?, description = ?, sort_order = ?
      WHERE id = ?
    `, [
      newMin, newMax,
      price !== undefined ? price : existing.price,
      description !== undefined ? description : existing.description,
      sort_order !== undefined ? sort_order : existing.sort_order,
      req.params.id
    ]);
    
    const tier = await get('SELECT * FROM pickup_price_tiers WHERE id = ?', [req.params.id]);
    res.json(tier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/price-tiers/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM pickup_price_tiers WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '价格区间不存在' });
    }
    
    await run('DELETE FROM pickup_price_tiers WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculate-fee', async (req, res) => {
  try {
    const { distance_km, area_id, area_name } = req.body;
    
    if (distance_km === undefined) {
      return res.status(400).json({ error: '请提供距离' });
    }
    
    const distance = parseFloat(distance_km);
    let totalFee = 0;
    let matchedTier = null;
    
    const tiers = await all('SELECT * FROM pickup_price_tiers ORDER BY min_distance');
    for (const tier of tiers) {
      if (distance >= tier.min_distance && distance < tier.max_distance) {
        matchedTier = tier;
        totalFee = tier.price;
        break;
      }
    }
    
    if (!matchedTier && tiers.length > 0) {
      const lastTier = tiers[tiers.length - 1];
      if (distance >= lastTier.max_distance) {
        matchedTier = lastTier;
        const extraKm = distance - lastTier.max_distance;
        const perKmPrice = lastTier.price / (lastTier.max_distance - lastTier.min_distance);
        totalFee = lastTier.price + Math.ceil(extraKm) * perKmPrice * 1.5;
      }
    }
    
    let basePrice = 0;
    let area = null;
    if (area_id) {
      area = await get('SELECT * FROM pickup_areas WHERE id = ?', [area_id]);
    } else if (area_name) {
      area = await get('SELECT * FROM pickup_areas WHERE name = ?', [area_name]);
    }
    
    if (area) {
      basePrice = area.base_price;
    }
    
    totalFee = totalFee + basePrice;
    
    res.json({
      distance_km: distance,
      base_price: basePrice,
      distance_price: totalFee - basePrice,
      total_fee: parseFloat(totalFee.toFixed(2)),
      matched_tier: matchedTier,
      area: area
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, area, start_date, end_date, pet_id, keyword } = req.query;
    let sql = `
      SELECT pb.*, p.name as pet_name, p.breed as pet_breed
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE 1=1
    `;
    let params = [];
    
    if (status) {
      sql += ' AND pb.status = ?';
      params.push(status);
    }
    if (area) {
      sql += ' AND pb.pickup_area = ?';
      params.push(area);
    }
    if (pet_id) {
      sql += ' AND pb.pet_id = ?';
      params.push(pet_id);
    }
    if (start_date) {
      sql += ' AND pb.pickup_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND pb.pickup_date <= ?';
      params.push(end_date);
    }
    if (keyword) {
      sql += ' AND (pb.owner_name LIKE ? OR pb.owner_phone LIKE ? OR pb.pickup_address LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    sql += ' ORDER BY pb.pickup_date DESC, pb.pickup_time DESC, pb.id DESC';
    const bookings = await all(sql, params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/routes', async (req, res) => {
  try {
    const { date } = req.query;
    
    let queryDate = date || dayjs().format('YYYY-MM-DD');
    
    const sql = `
      SELECT pb.*, p.name as pet_name, p.breed as pet_breed
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.pickup_date = ? AND pb.status != '已取消'
      ORDER BY pb.pickup_area, pb.pickup_time, pb.id
    `;
    
    const bookings = await all(sql, [queryDate]);
    
    const routes = {};
    for (const booking of bookings) {
      const area = booking.pickup_area;
      if (!routes[area]) {
        routes[area] = {
          area: area,
          date: queryDate,
          booking_count: 0,
          total_fee: 0,
          bookings: []
        };
      }
      routes[area].booking_count++;
      routes[area].total_fee += parseFloat(booking.pickup_fee) || 0;
      routes[area].bookings.push(booking);
    }
    
    const routeList = Object.values(routes).sort((a, b) => a.area.localeCompare(b.area));
    routeList.forEach(r => {
      r.total_fee = parseFloat(r.total_fee.toFixed(2));
    });
    
    res.json({
      date: queryDate,
      total_routes: routeList.length,
      total_bookings: bookings.length,
      total_fee: parseFloat(routeList.reduce((sum, r) => sum + r.total_fee, 0).toFixed(2)),
      routes: routeList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await get(`
      SELECT pb.*, p.name as pet_name, p.breed as pet_breed, p.age as pet_age,
             p.owner_phone as pet_owner_phone
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [req.params.id]);
    
    if (!booking) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      pet_id, owner_name, owner_phone, pickup_address, pickup_area,
      pickup_date, pickup_time, dropoff_address, distance_km, pickup_fee,
      service_type, related_booking_id, driver_name, driver_phone, remarks
    } = req.body;
    
    if (!owner_name || !owner_phone || !pickup_address || !pickup_area || !pickup_date || !pickup_time) {
      return res.status(400).json({ error: '主人姓名、电话、接送地址、区域、日期、时间为必填项' });
    }
    
    let calculatedFee = pickup_fee;
    if (calculatedFee === undefined && distance_km !== undefined) {
      try {
        const result = await calculatePickupFee(distance_km, null, pickup_area);
        calculatedFee = result.total_fee;
      } catch (e) {}
    }
    
    const result = await run(`
      INSERT INTO pickup_bookings 
      (pet_id, owner_name, owner_phone, pickup_address, pickup_area,
       pickup_date, pickup_time, dropoff_address, distance_km, pickup_fee,
       service_type, related_booking_id, driver_name, driver_phone, remarks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待接送')
    `, [
      pet_id || null,
      owner_name,
      owner_phone,
      pickup_address,
      pickup_area,
      pickup_date,
      pickup_time,
      dropoff_address || '',
      distance_km || null,
      calculatedFee || 0,
      service_type || '上门接送',
      related_booking_id || null,
      driver_name || '',
      driver_phone || '',
      remarks || ''
    ]);
    
    const booking = await get(`
      SELECT pb.*, p.name as pet_name
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [result.lastID]);
    
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      pet_id, owner_name, owner_phone, pickup_address, pickup_area,
      pickup_date, pickup_time, dropoff_address, distance_km, pickup_fee,
      service_type, related_booking_id, status, driver_name, driver_phone, remarks
    } = req.body;
    
    const existing = await get('SELECT * FROM pickup_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    
    let calculatedFee = pickup_fee;
    if (calculatedFee === undefined && distance_km !== undefined) {
      try {
        const newArea = pickup_area || existing.pickup_area;
        const result = await calculatePickupFee(distance_km, null, newArea);
        calculatedFee = result.total_fee;
      } catch (e) {}
    }
    
    await run(`
      UPDATE pickup_bookings SET 
      pet_id = ?, owner_name = ?, owner_phone = ?, pickup_address = ?, pickup_area = ?,
      pickup_date = ?, pickup_time = ?, dropoff_address = ?, distance_km = ?, pickup_fee = ?,
      service_type = ?, related_booking_id = ?, status = ?, driver_name = ?, driver_phone = ?,
      remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      pet_id !== undefined ? pet_id : existing.pet_id,
      owner_name || existing.owner_name,
      owner_phone || existing.owner_phone,
      pickup_address || existing.pickup_address,
      pickup_area || existing.pickup_area,
      pickup_date || existing.pickup_date,
      pickup_time || existing.pickup_time,
      dropoff_address !== undefined ? dropoff_address : existing.dropoff_address,
      distance_km !== undefined ? distance_km : existing.distance_km,
      calculatedFee !== undefined ? calculatedFee : existing.pickup_fee,
      service_type || existing.service_type,
      related_booking_id !== undefined ? related_booking_id : existing.related_booking_id,
      status || existing.status,
      driver_name !== undefined ? driver_name : existing.driver_name,
      driver_phone !== undefined ? driver_phone : existing.driver_phone,
      remarks !== undefined ? remarks : existing.remarks,
      req.params.id
    ]);
    
    const booking = await get(`
      SELECT pb.*, p.name as pet_name
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const existing = await get('SELECT * FROM pickup_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    
    if (!['待接送', '已接走', '已送回', '已完成', '已取消'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    await run('UPDATE pickup_bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    
    const booking = await get(`
      SELECT pb.*, p.name as pet_name
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM pickup_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    
    await run('UPDATE pickup_bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['已取消', req.params.id]);
    res.json({ message: '预约已取消' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/pickup-confirm', async (req, res) => {
  try {
    const { pickup_photo, pickup_remark, pet_condition_pickup, confirmed_by } = req.body;
    
    const existing = await get('SELECT * FROM pickup_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    
    if (existing.status !== '待接送') {
      return res.status(400).json({ error: '当前状态不允许接走确认' });
    }
    
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    await run(`
      UPDATE pickup_bookings SET 
      status = '已接走',
      pickup_at = ?,
      pickup_photo = ?,
      pickup_remark = ?,
      pet_condition_pickup = ?,
      pickup_confirmed_by = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      now,
      pickup_photo || '',
      pickup_remark || '',
      pet_condition_pickup || '',
      confirmed_by || '',
      req.params.id
    ]);
    
    const booking = await get(`
      SELECT pb.*, p.name as pet_name
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dropoff-confirm', async (req, res) => {
  try {
    const { dropoff_photo, dropoff_remark, pet_condition_dropoff, confirmed_by } = req.body;
    
    const existing = await get('SELECT * FROM pickup_bookings WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: '接送预约不存在' });
    }
    
    if (existing.status !== '已接走') {
      return res.status(400).json({ error: '当前状态不允许送回确认' });
    }
    
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    await run(`
      UPDATE pickup_bookings SET 
      status = '已送回',
      dropoff_at = ?,
      dropoff_photo = ?,
      dropoff_remark = ?,
      pet_condition_dropoff = ?,
      dropoff_confirmed_by = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      now,
      dropoff_photo || '',
      dropoff_remark || '',
      pet_condition_dropoff || '',
      confirmed_by || '',
      req.params.id
    ]);
    
    const booking = await get(`
      SELECT pb.*, p.name as pet_name
      FROM pickup_bookings pb
      LEFT JOIN pets p ON pb.pet_id = p.id
      WHERE pb.id = ?
    `, [req.params.id]);
    
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function calculatePickupFee(distance_km, area_id, area_name) {
  const distance = parseFloat(distance_km);
  let totalFee = 0;
  let matchedTier = null;
  
  const tiers = await all('SELECT * FROM pickup_price_tiers ORDER BY min_distance');
  for (const tier of tiers) {
    if (distance >= tier.min_distance && distance < tier.max_distance) {
      matchedTier = tier;
      totalFee = tier.price;
      break;
    }
  }
  
  if (!matchedTier && tiers.length > 0) {
    const lastTier = tiers[tiers.length - 1];
    if (distance >= lastTier.max_distance) {
      matchedTier = lastTier;
      const extraKm = distance - lastTier.max_distance;
      const perKmPrice = lastTier.price / (lastTier.max_distance - lastTier.min_distance);
      totalFee = lastTier.price + Math.ceil(extraKm) * perKmPrice * 1.5;
    }
  }
  
  let basePrice = 0;
  let area = null;
  if (area_id) {
    area = await get('SELECT * FROM pickup_areas WHERE id = ?', [area_id]);
  } else if (area_name) {
    area = await get('SELECT * FROM pickup_areas WHERE name = ?', [area_name]);
  }
  
  if (area) {
    basePrice = area.base_price;
  }
  
  totalFee = totalFee + basePrice;
  
  return {
    distance_km: distance,
    base_price: basePrice,
    distance_price: totalFee - basePrice,
    total_fee: parseFloat(totalFee.toFixed(2)),
    matched_tier: matchedTier,
    area: area
  };
}

module.exports = router;
