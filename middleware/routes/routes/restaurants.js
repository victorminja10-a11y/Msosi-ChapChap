const express = require('express');
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

// Orodha ya migahawa yote (kwa mteja kuvinjari) — hii ndiyo mzunguko wa "Mteja" kwenye app
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants ORDER BY id');
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Migahawa ya mmiliki aliyeingia (kwa mzunguko wa "Mgahawa")
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE owner_id=$1 ORDER BY id', [req.user.id]);
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Menyu ya mgahawa mmoja
router.get('/:id/menu', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM menu_items WHERE restaurant_id=$1 AND is_available=TRUE ORDER BY id',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
});

// Mmiliki wa mgahawa: tengeneza mgahawa mpya (mara ya kwanza kujiunga)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, category, emoji, delivery_fee } = req.body;
    const result = await pool.query(
      `INSERT INTO restaurants (owner_id, name, category, emoji, delivery_fee)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, name, category, emoji || '🍽️', delivery_fee || 1500]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

// Mmiliki wa mgahawa: ongeza kipengele kwenye menyu
router.post('/:id/menu', requireAuth, async (req, res, next) => {
  try {
    const { name, price } = req.body;
    const result = await pool.query(
      'INSERT INTO menu_items (restaurant_id, name, price) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, name, price]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

// Mmiliki wa mgahawa: badilisha bei/jina la kipengele cha menyu
router.put('/menu/:itemId', requireAuth, async (req, res, next) => {
  try {
    const { name, price, is_available } = req.body;
    const result = await pool.query(
      `UPDATE menu_items SET
         name = COALESCE($1, name),
         price = COALESCE($2, price),
         is_available = COALESCE($3, is_available)
       WHERE id=$4 RETURNING *`,
      [name, price, is_available, req.params.itemId]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

// Mmiliki wa mgahawa: futa kipengele cha menyu
router.delete('/menu/:itemId', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM menu_items WHERE id=$1', [req.params.itemId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
