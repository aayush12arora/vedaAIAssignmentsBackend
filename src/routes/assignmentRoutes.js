const express = require('express');
const router = express.Router();
const { assignmentController } = require('../controllers');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * Assignment Routes
 * Base path: /api/assignments
 */

// Create new assignment
router.post('/', ...uploadMiddleware.single('file'), assignmentController.create);

// Get all assignments
router.get('/', assignmentController.getAll);

// Get single assignment
router.get('/:id', assignmentController.getById);

// Update assignment
router.put('/:id', assignmentController.update);

// Delete assignment
router.delete('/:id', assignmentController.delete);

// Generate questions for assignment
router.post('/:id/generate', assignmentController.generateQuestions);

// Regenerate questions for assignment
router.post('/:id/regenerate', assignmentController.regenerateQuestions);

// Get job status/progress for assignment generation
router.get('/:id/job/:jobId', assignmentController.getGenerationStatus);

// Get question paper for assignment
router.get('/:id/paper', assignmentController.getQuestionPaper);

// Upload file for assignment (optional)
router.post('/:id/upload', ...uploadMiddleware.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // File content is available in req.fileContent from middleware
    const Assignment = require('../models/Assignment');
    
    const updatedAssignment = await Assignment.findByIdAndUpdate(
      id,
      {
        uploadedFileContent: req.fileContent || file.buffer.toString('utf-8'),
        uploadedFileUrl: file.originalname
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

module.exports = router;
