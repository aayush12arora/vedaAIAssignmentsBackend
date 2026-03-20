const Assignment = require('../models/Assignment');
const QuestionPaper = require('../models/QuestionPaper');
const { addJobToQueue, getJobStatus } = require('../workers/questionGenerationWorker');
const { cacheGet, cacheSet, cacheDelete, cacheDeleteByPattern } = require('../config/redis');
const socketService = require('../services/socketService');

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const clearAssignmentListCache = async () => {
  await cacheDeleteByPattern('assignments:all:*');
};

/**
 * Assignment Controller - Handles all assignment-related operations
 */
const assignmentController = {
  /**
   * Create a new assignment
   * POST /api/assignments
   */
  async create(req, res) {
    console.log("creating")
    try {
      const questionTypes = parseJsonField(req.body.questionTypes, []);
      const difficultyDistribution = parseJsonField(
        req.body.difficultyDistribution,
        { easy: 30, medium: 50, hard: 20 }
      );

      const {
        title,
        subject,
        grade,
        dueDate,
        totalMarks,
        duration,
        additionalInstructions,
        uploadedFileContent,
        schoolName,
        section
      } = req.body;

      const resolvedFileContent = req.fileContent || uploadedFileContent || null;
      const resolvedFileUrl = req.file?.originalname || null;

      // Validation
      if (!subject || !grade || !questionTypes || questionTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: subject, grade, and questionTypes are required'
        });
      }

      // Calculate total marks from question types if not provided
      const calculatedTotalMarks = totalMarks || questionTypes.reduce(
        (sum, qt) => sum + (qt.count * qt.marksPerQuestion), 0
      );

      const assignment = new Assignment({
        title: title || `${subject} - ${grade}`,
        subject,
        grade,
        dueDate: dueDate || new Date(),
        totalMarks: Number(calculatedTotalMarks),
        duration: Number(duration || 60),
        questionTypes,
        difficultyDistribution,
        additionalInstructions,
        uploadedFileContent: resolvedFileContent,
        uploadedFileUrl: resolvedFileUrl,
        schoolName,
        section,
        status: 'draft'
      });

      await assignment.save();

      // Clear assignments cache
      await clearAssignmentListCache();

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        data: assignment
      });
    } catch (error) {
      console.error('Create Assignment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create assignment',
        error: error.message
      });
    }
  },

  /**
   * Get all assignments
   * GET /api/assignments
   */
  async getAll(req, res) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      // Try to get from cache first
      const cacheKey = `assignments:all:${status || 'all'}:${limit}:${offset}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          source: 'cache'
        });
      }

      let query = Assignment.find();
      
      if (status) {
        query = query.where('status').equals(status);
      }

      const assignments = await query
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      // Cache the results for 5 minutes
      await cacheSet(cacheKey, assignments, 300);

      res.json({
        success: true,
        data: assignments,
        source: 'database'
      });
    } catch (error) {
      console.error('Get Assignments Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignments',
        error: error.message
      });
    }
  },

  /**
   * Get assignment by ID
   * GET /api/assignments/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      // Try cache first
      const cacheKey = `assignment:${id}`;
      const cached = await cacheGet(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          source: 'cache'
        });
      }

      const assignment = await Assignment.findById(id);

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Cache for 10 minutes
      await cacheSet(cacheKey, assignment, 600);

      res.json({
        success: true,
        data: assignment,
        source: 'database'
      });
    } catch (error) {
      console.error('Get Assignment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch assignment',
        error: error.message
      });
    }
  },

  /**
   * Update assignment
   * PUT /api/assignments/:id
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Prevent updating if already processing
      if (assignment.status === 'processing') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update assignment while question generation is in progress'
        });
      }

      const updatedAssignment = await Assignment.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      // Clear related cache
      await cacheDelete(`assignment:${id}`);
      await clearAssignmentListCache();

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: updatedAssignment
      });
    } catch (error) {
      console.error('Update Assignment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assignment',
        error: error.message
      });
    }
  },

  /**
   * Delete assignment
   * DELETE /api/assignments/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      await Assignment.findByIdAndDelete(id);

      // Also delete associated question paper
      if (assignment.generatedPaperId) {
        await QuestionPaper.findByIdAndDelete(assignment.generatedPaperId);
      }

      // Clear cache
      await cacheDelete(`assignment:${id}`);
      await clearAssignmentListCache();

      res.json({
        success: true,
        message: 'Assignment deleted successfully'
      });
    } catch (error) {
      console.error('Delete Assignment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assignment',
        error: error.message
      });
    }
  },

  /**
   * Generate questions for assignment
   * POST /api/assignments/:id/generate
   */
  async generateQuestions(req, res) {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if already processing
      if (assignment.status === 'processing') {
        return res.status(400).json({
          success: false,
          message: 'Question generation is already in progress'
        });
      }

      // Add job to queue
      const job = await addJobToQueue(assignment.toObject());

      // Update assignment status
      await Assignment.findByIdAndUpdate(id, {
        status: 'processing',
        jobId: job.id
      });

      // Clear cache
      await cacheDelete(`assignment:${id}`);
      await clearAssignmentListCache();

      // Notify via WebSocket
      socketService.emitJobStatus(id, 'processing', {
        message: 'Question generation started',
        jobId: job.id
      });

      res.json({
        success: true,
        message: 'Question generation started',
        data: {
          jobId: job.id,
          status: 'processing'
        }
      });
    } catch (error) {
      console.error('Generate Questions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start question generation',
        error: error.message
      });
    }
  },

  /**
   * Get generation job status for an assignment
   * GET /api/assignments/:id/job/:jobId
   */
  async getGenerationStatus(req, res) {
    try {
      const { id, jobId } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const job = await getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      const numericProgress = typeof job.progress === 'number'
        ? job.progress
        : (job.progress?.progress || 0);

      res.json({
        success: true,
        data: {
          assignmentId: id,
          jobId: String(job.id),
          state: job.state,
          progress: Math.max(0, Math.min(100, Number(numericProgress) || 0)),
          status: assignment.status,
          generatedPaperId: assignment.generatedPaperId || null,
          errorMessage: assignment.errorMessage || null
        }
      });
    } catch (error) {
      console.error('Get Generation Status Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch generation status',
        error: error.message
      });
    }
  },

  /**
   * Get generated question paper for assignment
   * GET /api/assignments/:id/paper
   */
  async getQuestionPaper(req, res) {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Try to find by generatedPaperId first, then by assignmentId
      let questionPaper = null;
      
      if (assignment.generatedPaperId) {
        questionPaper = await QuestionPaper.findById(assignment.generatedPaperId);
      }
      
      if (!questionPaper) {
        questionPaper = await QuestionPaper.findByAssignmentId(id);
      }

      if (!questionPaper) {
        return res.status(404).json({
          success: false,
          message: 'No question paper generated yet'
        });
      }

      res.json({
        success: true,
        data: questionPaper
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
   * Regenerate questions for assignment
   * POST /api/assignments/:id/regenerate
   */
  async regenerateQuestions(req, res) {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      if (assignment.status === 'processing') {
        return res.status(400).json({
          success: false,
          message: 'Cannot regenerate while processing is in progress'
        });
      }

      // Add job to queue for regeneration
      const job = await addJobToQueue(assignment.toObject(), true);

      // Update assignment status
      await Assignment.findByIdAndUpdate(id, {
        status: 'processing',
        jobId: job.id
      });

      // Clear cache
      await cacheDelete(`assignment:${id}`);
      await clearAssignmentListCache();

      // Notify via WebSocket
      socketService.emitJobStatus(id, 'processing', {
        message: 'Question regeneration started',
        jobId: job.id
      });

      res.json({
        success: true,
        message: 'Question regeneration started',
        data: {
          jobId: job.id,
          status: 'processing'
        }
      });
    } catch (error) {
      console.error('Regenerate Questions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start question regeneration',
        error: error.message
      });
    }
  },

  /**
   * Upload file for assignment
   * POST /api/assignments/:id/upload
   */
  async uploadFile(req, res) {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Update assignment with file info
      const updatedAssignment = await Assignment.findByIdAndUpdate(
        id,
        {
          uploadedFileUrl: req.file.path,
          uploadedFileContent: req.fileContent || null
        },
        { new: true }
      );

      await cacheDelete(`assignment:${id}`);
      await clearAssignmentListCache();

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: updatedAssignment
      });
    } catch (error) {
      console.error('Upload File Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error.message
      });
    }
  }
};

module.exports = assignmentController;
