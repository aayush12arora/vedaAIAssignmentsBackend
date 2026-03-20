const express = require('express');
const router = express.Router();

const assignmentRoutes = require('./assignmentRoutes');
const questionPaperRoutes = require('./questionPaperRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'VedaAI API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
router.use('/assignments', assignmentRoutes);
router.use('/papers', questionPaperRoutes);

module.exports = router;
