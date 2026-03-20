const { Queue, Worker } = require('bullmq');
const config = require('../config');
const geminiService = require('../services/geminiService');
const Assignment = require('../models/Assignment');
const QuestionPaper = require('../models/QuestionPaper');
const socketService = require('../services/socketService');
const { cacheDelete, cacheDeleteByPattern } = require('../config/redis');

let questionQueue = null;
let questionWorker = null;

const clearAssignmentCaches = async (assignmentId) => {
  await cacheDelete(`assignment:${assignmentId}`);
  await cacheDeleteByPattern('assignments:all:*');
};

/**
 * Initialize BullMQ Queue and Worker
 */
const initializeQueue = () => {
  const connection = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null
  };

  // Create queue
  questionQueue = new Queue(config.queue.questionGeneration, { connection });

  // Create worker
  questionWorker = new Worker(
    config.queue.questionGeneration,
    async (job) => {
      console.log(`Processing job ${job.id} for assignment ${job.data.assignmentId}`);
      return await processQuestionGeneration(job);
    },
    {
      connection,
      concurrency: 2,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 }
    }
  );

  // Worker event handlers
  questionWorker.on('completed', async (job, result) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  questionWorker.on('failed', async (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
    
    // Update assignment status
    try {
      await Assignment.findByIdAndUpdate(job.data.assignmentId, {
        status: 'failed',
        errorMessage: err.message
      });

      await clearAssignmentCaches(job.data.assignmentId);

      // Notify via WebSocket
      socketService.emitGenerationError(job.data.assignmentId, err.message);
    } catch (updateError) {
      console.error('Failed to update assignment status:', updateError);
    }
  });

  questionWorker.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}%`);
  });

  console.log('Question generation queue initialized');
  return { questionQueue, questionWorker };
};

/**
 * Process question generation job
 * @param {Object} job - BullMQ job
 */
const processQuestionGeneration = async (job) => {
  const { assignmentId, assignmentData, isRegeneration } = job.data;

  try {
    // Update progress - Starting
    await job.updateProgress(10);
    socketService.emitProgress(assignmentId, 10, 'Starting question generation...');

    // Generate questions using AI
    await job.updateProgress(30);
    socketService.emitProgress(assignmentId, 30, 'Generating questions with AI...');

    const generatedContent = await geminiService.generateQuestions(assignmentData);

    await job.updateProgress(70);
    socketService.emitProgress(assignmentId, 70, 'Processing generated content...');

    // Create or update question paper
    let questionPaper;
    
    if (isRegeneration) {
      // For regeneration, find existing paper and update
      const existingPaper = await QuestionPaper.findByAssignmentId(assignmentId);
      
      if (existingPaper) {
        const currentCount = existingPaper.metadata?.regenerationCount || 0;
        questionPaper = await QuestionPaper.findByIdAndUpdate(
          existingPaper._id,
          {
            sections: generatedContent.sections,
            'metadata.regenerationCount': currentCount + 1,
            'metadata.lastRegeneratedAt': new Date()
          },
          { new: true }
        );
      } else {
        // Create new if doesn't exist
        questionPaper = await createQuestionPaper(assignmentId, assignmentData, generatedContent);
      }
    } else {
      // Create new question paper
      questionPaper = await createQuestionPaper(assignmentId, assignmentData, generatedContent);
    }

    await job.updateProgress(90);
    socketService.emitProgress(assignmentId, 90, 'Saving results...');

    // Update assignment with reference to question paper
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: 'completed',
      generatedPaperId: questionPaper._id,
      errorMessage: null
    });

    await clearAssignmentCaches(assignmentId);

    await job.updateProgress(100);
    
    // Notify completion via WebSocket
    socketService.emitGenerationComplete(assignmentId, questionPaper);

    return { success: true, paperId: questionPaper._id };
  } catch (error) {
    console.error('Question generation error:', error);
    
    // Update assignment with error
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: 'failed',
      errorMessage: error.message
    });

    await clearAssignmentCaches(assignmentId);

    // Notify error via WebSocket
    socketService.emitGenerationError(assignmentId, error.message);

    throw error;
  }
};

/**
 * Create a new question paper
 */
const createQuestionPaper = async (assignmentId, assignmentData, generatedContent) => {
  // Calculate total marks from sections
  const totalMarks = generatedContent.sections.reduce(
    (sum, section) => sum + section.totalMarks,
    0
  );

  const questionPaper = new QuestionPaper({
    assignmentId,
    title: assignmentData.title,
    subject: assignmentData.subject,
    grade: assignmentData.grade,
    duration: assignmentData.duration,
    totalMarks,
    sections: generatedContent.sections,
    metadata: {
      generatedAt: new Date(),
      aiModel: 'gemini-2.5-flash',
      regenerationCount: 0
    }
  });

  await questionPaper.save();
  return questionPaper;
};

/**
 * Add job to the queue
 * @param {Object} assignment - Assignment data
 * @param {boolean} isRegeneration - Whether this is a regeneration request
 */
const addJobToQueue = async (assignment, isRegeneration = false) => {
  if (!questionQueue) {
    throw new Error('Queue not initialized');
  }

  // Handle both Mongoose documents and plain objects
  const assignmentId = assignment._id || assignment.id;

  const job = await questionQueue.add(
    'generate-questions',
    {
      assignmentId: assignmentId.toString(),
      assignmentData: assignment,
      isRegeneration
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      priority: isRegeneration ? 2 : 1
    }
  );

  return job;
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 */
const getJobStatus = async (jobId) => {
  if (!questionQueue) {
    throw new Error('Queue not initialized');
  }

  const job = await questionQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason
  };
};

/**
 * Close queue and worker
 */
const closeQueue = async () => {
  if (questionWorker) {
    await questionWorker.close();
  }
  if (questionQueue) {
    await questionQueue.close();
  }
  console.log('Question generation queue closed');
};

module.exports = {
  initializeQueue,
  addJobToQueue,
  getJobStatus,
  closeQueue
};
