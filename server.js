require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, app: 'Msosi ChapChap API' }));

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

// Kishikilia makosa cha jumla
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Hitilafu ya server', detail: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Msosi ChapChap API inaendesha kwenye port ${PORT}`));
