const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

const COMMISSION_RATE = 0.15; // asilimia yako - badilisha kadri unavyotaka

// Sehemu ya SQL inayotumika kwenye njia zote za kuorodhesha oda — inaunganisha (JOIN) majina
// ya mgahawa, mteja, dereva, na kuambatanisha vitu vya oda (order_items) kama JSON array.
const ORDER_SELECT = `
  SELECT o.*,
    r.name AS restaurant_name, r.emoji AS restaurant_emoji, r.owner_id AS restaurant_owner_id,
    cu.name AS customer_name, cu.phone AS customer_phone,
    ru.name AS rider_name, ru.phone AS rider_phone,
    COALESCE(items_agg.items, '[]') AS items
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  JOIN users cu ON cu.id = o.customer_id
  LEFT JOIN users ru ON ru.id = o.rider_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('name', oi.name, 'price', oi.price, 'quantity', oi.quantity)) AS items
    FROM order_items oi WHERE oi.order_id = o.id
  ) items_agg ON true
`;

// Mteja: tengeneza oda mpya
router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { restaurant_id, items, payment_method } = req.body; // items: [{menu_item_id,name,price,quantity}]
    const restRes = await client.query('SELECT * FROM restaurants WHERE id=$1', [restaurant_id]);
    const rest = restRes.rows[0];
    if (!rest) return res.status(404).json({ error: 'Mgahawa haupo' });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const commission = Math.round(subtotal * COMMISSION_RATE);
    const total = subtotal + rest.delivery_fee;

    await client.query('BEGIN');
    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, restaurant_id, subtotal, delivery_fee, commission, total, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, restaurant_id, subtotal, rest.delivery_fee, commission, total, payment_method]
    );
    const order = orderRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menu_item_id, item.name, item.price, item.quantity]
      );
    }
    await client.query('COMMIT');
    res.json({ ...order, restaurant_name: rest.name, customer_name: req.user.name, items });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// Mteja: oda zangu
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`${ORDER_SELECT} WHERE o.customer_id=$1 ORDER BY o.id DESC`, [req.user.id]);
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Mgahawa: oda za mgahawa fulani
router.get('/restaurant/:restaurantId', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `${ORDER_SELECT} WHERE o.restaurant_id=$1 ORDER BY o.id DESC`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Dereva: oda zilizo tayari kuchukuliwa (bado hazina dereva)
router.get('/available-for-pickup', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `${ORDER_SELECT} WHERE o.status='ready_for_pickup' AND o.rider_id IS NULL ORDER BY o.id`
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Dereva: oda zangu (za sasa na zilizokamilika)
router.get('/rider/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `${ORDER_SELECT} WHERE o.rider_id=$1 ORDER BY o.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Msimamizi: oda zote (kwa dashibodi)
router.get('/admin/all', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Huna ruhusa' });
    const result = await pool.query(`${ORDER_SELECT} ORDER BY o.id DESC`);
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Badilisha hali ya oda (mgahawa anaanza kuandaa, dereva anachukua, n.k)
// status inayoruhusiwa: preparing | ready_for_pickup | in_transit | delivered | cancelled
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    let query = 'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *';
    let params = [status, req.params.id];

    if (status === 'in_transit') {
      query = 'UPDATE orders SET status=$1, rider_id=$2 WHERE id=$3 RETURNING *';
      params = [status, req.user.id, req.params.id];
    }
    const result = await pool.query(query, params);
    const order = result.rows[0];

    if (status === 'delivered' && order.rider_id) {
      await pool.query(
        'INSERT INTO payouts (rider_id, order_id, amount) VALUES ($1,$2,$3)',
        [order.rider_id, order.id, order.delivery_fee]
      );
    }
    res.json(order);
  } catch (e) { next(e); }
});

// Msimamizi: muhtasari wa biashara (mauzo, kamisheni, malipo ya madereva)
router.get('/admin/summary', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Huna ruhusa' });
    const totals = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(subtotal),0) AS total_revenue,
        COALESCE(SUM(commission) FILTER (WHERE status='delivered'),0) AS total_commission,
        COALESCE(SUM(delivery_fee) FILTER (WHERE status='delivered'),0) AS total_rider_pay
      FROM orders
    `);
    res.json(totals.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
