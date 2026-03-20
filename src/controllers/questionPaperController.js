const QuestionPaper = require('../models/QuestionPaper');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');

/**
 * Question Paper Controller - Handles all question paper operations
 */
const questionPaperController = {
  /**
   * Get question paper by ID
   * GET /api/papers/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      // Try cache first
      const cacheKey = `paper:${id}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          source: 'cache'
        });
      }

      const paper = await QuestionPaper.findById(id);

      if (!paper) {
        return res.status(404).json({
          success: false,
          message: 'Question paper not found'
        });
      }

      // Cache for 30 minutes
      await cacheSet(cacheKey, paper, 1800);

      res.json({
        success: true,
        data: paper,
        source: 'database'
      });
    } catch (error) {
      console.error('Get Question Paper Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch question paper',
        error: error.message
      });
    }
  },

  /**
   * Get question paper by assignment ID
   * GET /api/papers/assignment/:assignmentId
   */
  async getByAssignmentId(req, res) {
    try {
      const { assignmentId } = req.params;

      const paper = await QuestionPaper.findByAssignmentId(assignmentId);

      if (!paper) {
        return res.status(404).json({
          success: false,
          message: 'Question paper not found for this assignment'
        });
      }

      res.json({
        success: true,
        data: paper
      });
    } catch (error) {
      console.error('Get Question Paper by Assignment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch question paper',
        error: error.message
      });
    }
  },

  /**
   * Get all question papers
   * GET /api/papers
   */
  async getAll(req, res) {
    try {
      const { assignmentId, limit = 20, offset = 0 } = req.query;
      
      let query = QuestionPaper.find();
      
      if (assignmentId) {
        query = query.where('assignmentId').equals(assignmentId);
      }

      const papers = await query
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: papers
      });
    } catch (error) {
      console.error('Get Question Papers Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch question papers',
        error: error.message
      });
    }
  },

  /**
   * Update question paper
   * PUT /api/papers/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const paper = await QuestionPaper.findById(id);
      if (!paper) {
        return res.status(404).json({
          success: false,
          message: 'Question paper not found'
        });
      }

      const updatedPaper = await QuestionPaper.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      // Clear cache
      await cacheDelete(`paper:${id}`);

      res.json({
        success: true,
        message: 'Question paper updated successfully',
        data: updatedPaper
      });
    } catch (error) {
      console.error('Update Question Paper Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update question paper',
        error: error.message
      });
    }
  },

  /**
   * Delete question paper
   * DELETE /api/papers/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const paper = await QuestionPaper.findById(id);
      if (!paper) {
        return res.status(404).json({
          success: false,
          message: 'Question paper not found'
        });
      }

      await QuestionPaper.findByIdAndDelete(id);

      // Clear cache
      await cacheDelete(`paper:${id}`);

      res.json({
        success: true,
        message: 'Question paper deleted successfully'
      });
    } catch (error) {
      console.error('Delete Question Paper Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete question paper',
        error: error.message
      });
    }
  },

  /**
   * Get questions by section and difficulty
   * GET /api/papers/:id/questions
   */
  async getQuestions(req, res) {
    try {
      const { id } = req.params;
      const { sectionType, difficulty } = req.query;

      const paper = await QuestionPaper.findById(id);
      if (!paper) {
        return res.status(404).json({
          success: false,
          message: 'Question paper not found'
        });
      }

      let questions = [];
      
      paper.sections.forEach(section => {
        if (!sectionType || section.type === sectionType) {
          section.questions.forEach(q => {
            if (!difficulty || q.difficulty === difficulty) {
              questions.push({
                ...q.toObject(),
                sectionType: section.type
              });
            }
          });
        }
      });

      res.json({
        success: true,
        data: questions
      });
    } catch (error) {
      console.error('Get Questions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch questions',
        error: error.message
      });
    }
  }
};

module.exports = questionPaperController;
