const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

/**
 * MUHIMU KUSOMA KABLA YA KUTUMIA:
 * Sehemu hii ni MFUMO/MFANO wa jinsi ya kuunganisha na Selcom (Vendor ID + API Key + API Secret,
 * saini ya HMAC-SHA256) kama ilivyoelezwa kwenye developers.selcommobile.com.
 * Majina kamili ya fields na muundo wa request/response wa Selcom huwa unabadilika na
 * hutolewa rasmi wakati unajisajili kama Merchant/Developer Partner nao.
 * KABLA ya kwenda "live" na pesa halisi za wateja:
 *   1) Jisajili Selcom Business (selcom.net/business) upate Vendor ID, API Key, API Secret.
 *   2) Fungua developers.selcommobile.com na akaunti yako, soma "Minimum Gateway (Order & Push USSD)"
 *      ili kupata muundo halisi wa request/response (majina ya fields yanaweza kutofautiana kidogo
 *      na mfano hapa chini).
 *   3) Jaribu kwenye mazingira yao ya "sandbox" kwanza.
 */

function signRequest(payload, apiSecret) {
  const data = JSON.stringify(payload);
  return crypto.createHmac('sha256', apiSecret).update(data).digest('base64');
}

// Mteja anapobonyeza "Thibitisha Malipo" — tunaanzisha ombi la malipo kwa Selcom
router.post('/selcom/checkout', requireAuth, async (req, res, next) => {
  try {
    const { order_id, phone, amount } = req.body;

    const payload = {
      vendor: process.env.SELCOM_VENDOR_ID,
      order_id: `MSOSI-${order_id}-${Date.now()}`,
      buyer_phone: phone,
      amount,
      currency: 'TZS',
      webhook: process.env.SELCOM_WEBHOOK_URL,
    };
    const signature = signRequest(payload, process.env.SELCOM_API_SECRET);

    const response = await axios.post(
      `${process.env.SELCOM_BASE_URL}/v1/checkout/create-order-minimal`,
      payload,
      {
        headers: {
          Authorization: `SELCOM ${process.env.SELCOM_API_KEY}`,
          'Digest-Method': 'HS256',
          Digest: signature,
          'Content-Type': 'application/json',
        },
      }
    );

    await pool.query('UPDATE orders SET payment_reference=$1 WHERE id=$2', [
      payload.order_id,
      order_id,
    ]);

    res.json({ ok: true, selcom_response: response.data });
  } catch (e) {
    res.status(502).json({
      error: 'Imeshindikana kuwasiliana na Selcom. Hakikisha SELCOM_VENDOR_ID/API_KEY/API_SECRET ni sahihi kwenye .env, na kwamba umejisajili kama Merchant.',
      detail: e.message,
    });
  }
});

// Selcom itatuma taarifa hapa moja kwa moja mteja akishalipa (webhook)
router.post('/selcom/webhook', async (req, res, next) => {
  try {
    const { order_id, payment_status, reference } = req.body;
    const orderId = String(order_id).split('-')[1];

    if (payment_status === 'COMPLETED' || payment_status === 'success') {
      await pool.query(
        `UPDATE orders SET payment_status='paid', payment_reference=$1 WHERE id=$2`,
        [reference, orderId]
      );
    } else {
      await pool.query(`UPDATE orders SET payment_status='failed' WHERE id=$1`, [orderId]);
    }
    res.json({ received: true });
  } catch (e) { next(e); }
});

module.exports = router;
