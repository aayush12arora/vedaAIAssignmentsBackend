const mongoose = require('mongoose');

/**
 * Question Type Schema
 */
const questionTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['mcq', 'short-answer', 'long-answer', 'true-false', 'fill-blanks', 'numerical', 'diagram']
  },
  label: {
    type: String,
    default: ''
  },
  count: {
    type: Number,
    required: true,
    min: 1
  },
  marksPerQuestion: {
    type: Number,
    required: true,
    min: 1
  }
}, { _id: false });

/**
 * Difficulty Distribution Schema
 */
const difficultyDistributionSchema = new mongoose.Schema({
  easy: { type: Number, default: 30 },
  medium: { type: Number, default: 50 },
  hard: { type: Number, default: 20 }
}, { _id: false });

/**
 * Assignment Schema
 */
const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number,
    default: 60,
    min: 1
  },
  questionTypes: [questionTypeSchema],
  difficultyDistribution: {
    type: difficultyDistributionSchema,
    default: () => ({ easy: 30, medium: 50, hard: 20 })
  },
  additionalInstructions: {
    type: String,
    default: ''
  },
  uploadedFileUrl: {
    type: String,
    default: null
  },
  uploadedFileContent: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'processing', 'completed', 'failed'],
    default: 'draft'
  },
  generatedPaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionPaper',
    default: null
  },
  jobId: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  // School/Institution info
  schoolName: {
    type: String,
    default: ''
  },
  section: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ createdAt: -1 });

// Virtual for total questions
assignmentSchema.virtual('totalQuestions').get(function() {
  return this.questionTypes?.reduce((sum, qt) => sum + qt.count, 0) || 0;
});

// Transform for JSON output
assignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

assignmentSchema.set('toObject', { virtuals: true });

/**
 * Static methods for Assignment model
 */
assignmentSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = Assignment;
