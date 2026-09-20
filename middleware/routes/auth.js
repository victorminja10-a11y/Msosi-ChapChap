const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const router = express.Router();

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // namba 6 za nasibu
}

// HATUA 1: Mtumiaji anaweka namba yake ya simu, tunamtumia msimbo (OTP)
router.post('/request-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Namba ya simu inahitajika' });

    const code = genCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // dakika 5

    await pool.query(
      'INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1,$2,$3)',
      [phone, code, expiresAt]
    );

    // --- HAPA NDIPO UNGANISHA HUDUMA HALISI YA SMS ---
    // Mfano kwa Africa's Talking (weka funguo zako kwenye .env kisha ondoa maoni haya):
    //
    // const AfricasTalking = require('africastalking')({
    //   apiKey: process.env.AFRICASTALKING_API_KEY,
    //   username: process.env.AFRICASTALKING_USERNAME,
    // });
    // await AfricasTalking.SMS.send({
    //   to: [phone],
    //   message: `Msosi ChapChap: Msimbo wako ni ${code}. Hauwezi kutumika baada ya dakika 5.`,
    // });

    // Kwa sasa (bila SMS halisi bado), tunarudisha code kwenye response ili uweze kujaribu:
    res.json({ ok: true, message: 'Msimbo umetumwa (angalia SMS yako)', dev_code_for_testing: code });
  } catch (e) { next(e); }
});

// HATUA 2: Mtumiaji anaingiza msimbo aliopokea, tunathibitisha na kumpa akaunti + token
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, code, name, role } = req.body;
    const result = await pool.query(
      `SELECT * FROM otp_codes WHERE phone=$1 AND code=$2 AND used=FALSE AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [phone, code]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Msimbo si sahihi au umeisha muda wake' });
    }
    await pool.query('UPDATE otp_codes SET used=TRUE WHERE id=$1', [result.rows[0].id]);

    // Tafuta mtumiaji, au mtengeneze kama ni mara yake ya kwanza
    let userRes = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    let user;
    if (userRes.rows.length === 0) {
      const insert = await pool.query(
        'INSERT INTO users (phone, name, role) VALUES ($1,$2,$3) RETURNING *',
        [phone, name || 'Mtumiaji', role || 'customer']
      );
      user = insert.rows[0];
    } else {
      user = userRes.rows[0];
    }

    const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, name: user.name }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({ ok: true, token, user });
  } catch (e) { next(e); }
});

module.exports = router;
