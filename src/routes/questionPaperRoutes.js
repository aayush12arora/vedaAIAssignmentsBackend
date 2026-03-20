const express = require('express');
const router = express.Router();
const { questionPaperController } = require('../controllers');
const pdfService = require('../services/pdfService');

/**
 * Question Paper Routes
 * Base path: /api/papers
 */

// Get all question papers
router.get('/', questionPaperController.getAll);

// Get question paper by assignment ID
router.get('/assignment/:assignmentId', questionPaperController.getByAssignmentId);

// Get single question paper
router.get('/:id', questionPaperController.getById);

// Get questions with filters
router.get('/:id/questions', questionPaperController.getQuestions);

// Update question paper
router.put('/:id', questionPaperController.update);

// Delete question paper
router.delete('/:id', questionPaperController.delete);

// Generate PDF for question paper
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const QuestionPaper = require('../models/QuestionPaper');
    
    const paper = await QuestionPaper.findById(id);
    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found'
      });
    }

    // Generate PDF
    const pdfBuffer = await pdfService.generateQuestionPaperPdf(paper);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_question_paper.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

module.exports = router;
