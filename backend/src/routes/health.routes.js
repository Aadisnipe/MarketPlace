const router = require('express').Router();
const mongoose = require('mongoose');
const { sendSuccess } = require('../utils/apiResponse');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/', (req, res) =>
  sendSuccess(res, {
    message: 'API is running',
    data: {
      uptime: Math.round(process.uptime()),
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    },
  })
);

module.exports = router;
