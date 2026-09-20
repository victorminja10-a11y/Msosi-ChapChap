const jwt = require('jsonwebtoken');

// Tumia middleware hii mbele ya njia (routes) zinazohitaji mtumiaji awe ameingia
// Mfano: router.post('/orders', requireAuth, handler)
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Ingia kwanza (hakuna token)' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token si sahihi au imeisha muda wake' });
  }
}

module.exports = requireAuth;
