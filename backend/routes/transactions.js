const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/init');
const dayjs = require('dayjs');

router.get('/checkout/:pet_id', async (req, res) => {
  try {
    const { pet_id } = req.params;
    const { boarding_booking_id } = req.query;
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    
    let boardingSQL = `
      SELECT bb.*, c.name as cage_name, c.size as cage_size, c.price_per_day
      FROM boarding_bookings bb
      LEFT JOIN cages c ON bb.cage_id = c.id
      WHERE bb.pet_id = ? AND bb.status IN ('待入住', '已入住')
    `;
    let boardingParams = [pet_id];
    
    if (boarding_booking_id) {
      boardingSQL += ' AND bb.id = ?';
      boardingParams.push(boarding_booking_id);
    }
    boardingSQL += ' ORDER BY bb.check_in_date DESC LIMIT 1';
    
    const boarding = await get(boardingSQL, boardingParams);
    
    const grooming = await all(`
      SELECT gb.*, g.name as groomer_name
      FROM grooming_bookings gb
      LEFT JOIN groomers g ON gb.groomer_id = g.id
      WHERE gb.pet_id = ? AND gb.status IN ('待服务', '服务中', '已完成')
      AND DATE(gb.appointment_date) <= DATE('now', 'localtime')
      ORDER BY gb.appointment_date, gb.appointment_time
    `, [pet_id]);
    
    const unchargedGrooming = grooming.filter(g => {
      return !g.details || (JSON.parse(g.details || '{}').charged !== true);
    });
    
    let boardingTotal = 0;
    let groomingTotal = 0;
    const details = {
      pet: { id: pet.id, name: pet.name, breed: pet.breed },
      boarding: null,
      grooming: [],
      summary: {}
    };
    
    if (boarding) {
      const checkIn = dayjs(boarding.check_in_date);
      const checkOut = dayjs();
      const days = Math.max(1, checkOut.diff(checkIn, 'day'));
      const pricePerDay = boarding.price_per_day;
      boardingTotal = days * pricePerDay;
      
      details.boarding = {
        id: boarding.id,
        cage_name: boarding.cage_name,
        cage_size: boarding.cage_size,
        check_in_date: boarding.check_in_date,
        check_out_date: checkOut.format('YYYY-MM-DD'),
        days: days,
        price_per_day: pricePerDay,
        subtotal: boardingTotal,
        feeding_requirements: boarding.feeding_requirements
      };
      
      if (boarding.feeding_requirements) {
        const extraFee = 20;
        boardingTotal += extraFee;
        details.boarding.feeding_fee = extraFee;
        details.boarding.subtotal = boardingTotal;
      }
    }
    
    unchargedGrooming.forEach(g => {
      const item = {
        id: g.id,
        service_type: g.service_type,
        groomer_name: g.groomer_name,
        appointment_date: g.appointment_date,
        appointment_time: g.appointment_time,
        price: g.price
      };
      details.grooming.push(item);
      groomingTotal += g.price;
    });
    
    const grandTotal = boardingTotal + groomingTotal;
    
    details.summary = {
      boarding_total: boardingTotal,
      grooming_total: groomingTotal,
      grand_total: grandTotal
    };
    
    res.json({
      pet,
      boarding: details.boarding,
      grooming: details.grooming,
      summary: details.summary,
      details: JSON.stringify(details)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { pet_id, boarding_booking_id, payment_method, amount, details } = req.body;
    
    if (!pet_id || !payment_method || amount === undefined) {
      return res.status(400).json({ error: '宠物ID、支付方式、金额为必填项' });
    }
    
    if (!['现金', '微信', '支付宝', '银行卡'].includes(payment_method)) {
      return res.status(400).json({ error: '无效的支付方式' });
    }
    
    const pet = await get('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return res.status(404).json({ error: '宠物不存在' });
    }
    
    const detailsObj = details ? JSON.parse(details) : {};
    const hasBoarding = detailsObj.boarding !== null && detailsObj.boarding !== undefined;
    const hasGrooming = detailsObj.grooming && detailsObj.grooming.length > 0;
    
    let type = '综合';
    if (hasBoarding && !hasGrooming) type = '寄养';
    if (!hasBoarding && hasGrooming) type = '美容';
    
    const result = await run(`
      INSERT INTO transactions (pet_id, type, amount, payment_method, details)
      VALUES (?, ?, ?, ?, ?)
    `, [pet_id, type, amount, payment_method, details]);
    
    const transactionId = result.lastID;
    
    if (boarding_booking_id) {
      await run(`
        UPDATE boarding_bookings 
        SET status = '已离店', total_price = ?
        WHERE id = ?
      `, [detailsObj.boarding ? detailsObj.boarding.subtotal : 0, boarding_booking_id]);
    } else if (hasBoarding && detailsObj.boarding && detailsObj.boarding.id) {
      await run(`
        UPDATE boarding_bookings 
        SET status = '已离店', total_price = ?
        WHERE id = ?
      `, [detailsObj.boarding.subtotal, detailsObj.boarding.id]);
    }
    
    if (hasGrooming) {
      for (const g of detailsObj.grooming) {
        await run(`
          UPDATE grooming_bookings 
          SET status = '已完成', details = ?
          WHERE id = ?
        `, [JSON.stringify({ charged: true, transaction_id: transactionId }), g.id]);
      }
    }
    
    const transaction = await get(`
      SELECT t.*, p.name as pet_name
      FROM transactions t
      LEFT JOIN pets p ON t.pet_id = p.id
      WHERE t.id = ?
    `, [transactionId]);
    
    res.status(201).json({
      message: '结算成功',
      transaction,
      receipt: {
        id: transactionId,
        pet_name: pet.name,
        type: type,
        amount: amount,
        payment_method: payment_method,
        created_at: transaction.created_at,
        details: detailsObj
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, type, payment_method, pet_id } = req.query;
    let sql = `
      SELECT t.*, p.name as pet_name, p.breed as pet_breed
      FROM transactions t
      LEFT JOIN pets p ON t.pet_id = p.id
      WHERE 1=1
    `;
    let params = [];
    
    if (start_date) {
      sql += ' AND DATE(t.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND DATE(t.created_at) <= ?';
      params.push(end_date);
    }
    if (type) {
      sql += ' AND t.type = ?';
      params.push(type);
    }
    if (payment_method) {
      sql += ' AND t.payment_method = ?';
      params.push(payment_method);
    }
    if (pet_id) {
      sql += ' AND t.pet_id = ?';
      params.push(pet_id);
    }
    
    sql += ' ORDER BY t.created_at DESC';
    const transactions = await all(sql, params);
    
    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    res.json({
      transactions,
      summary: {
        count: transactions.length,
        total_amount: totalAmount.toFixed(2)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    const transactions = await all(`
      SELECT t.*, p.name as pet_name
      FROM transactions t
      LEFT JOIN pets p ON t.pet_id = p.id
      WHERE DATE(t.created_at) = ?
      ORDER BY t.created_at DESC
    `, [targetDate]);
    
    const summary = {
      date: targetDate,
      total_count: transactions.length,
      total_amount: 0,
      by_type: {
        '寄养': { count: 0, amount: 0 },
        '美容': { count: 0, amount: 0 },
        '综合': { count: 0, amount: 0 }
      },
      by_payment: {
        '现金': { count: 0, amount: 0 },
        '微信': { count: 0, amount: 0 },
        '支付宝': { count: 0, amount: 0 },
        '银行卡': { count: 0, amount: 0 }
      }
    };
    
    transactions.forEach(t => {
      const amount = parseFloat(t.amount);
      summary.total_amount += amount;
      
      if (summary.by_type[t.type]) {
        summary.by_type[t.type].count++;
        summary.by_type[t.type].amount += amount;
      }
      
      if (summary.by_payment[t.payment_method]) {
        summary.by_payment[t.payment_method].count++;
        summary.by_payment[t.payment_method].amount += amount;
      }
    });
    
    summary.total_amount = summary.total_amount.toFixed(2);
    Object.keys(summary.by_type).forEach(k => {
      summary.by_type[k].amount = summary.by_type[k].amount.toFixed(2);
    });
    Object.keys(summary.by_payment).forEach(k => {
      summary.by_payment[k].amount = summary.by_payment[k].amount.toFixed(2);
    });
    
    res.json({
      date: targetDate,
      transactions,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const transaction = await get(`
      SELECT t.*, p.name as pet_name, p.breed as pet_breed
      FROM transactions t
      LEFT JOIN pets p ON t.pet_id = p.id
      WHERE t.id = ?
    `, [req.params.id]);
    
    if (!transaction) {
      return res.status(404).json({ error: '交易记录不存在' });
    }
    
    if (transaction.details) {
      transaction.details = JSON.parse(transaction.details);
    }
    
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
