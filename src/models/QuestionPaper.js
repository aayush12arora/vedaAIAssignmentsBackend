const mongoose = require('mongoose');

/**
 * Question Schema
 */
const questionSchema = new mongoose.Schema({
  questionNumber: {
    type: Number,
    default: 1
  },
  questionText: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['mcq', 'short-answer', 'long-answer', 'true-false', 'fill-blanks', 'numerical', 'diagram']
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  marks: {
    type: Number,
    required: true,
    min: 1
  },
  options: [String], // For MCQ
  correctAnswer: mongoose.Schema.Types.Mixed,
  answer: mongoose.Schema.Types.Mixed,
  explanation: String,
  unit: String,
  blanks: [String]
}, { _id: false });

/**
 * Section Schema
 */
const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  instructions: {
    type: String,
    default: 'Attempt all questions. Each question carries marks as indicated.'
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  questions: [questionSchema]
}, { _id: false });

/**
 * Metadata Schema
 */
const metadataSchema = new mongoose.Schema({
  generatedAt: {
    type: Date,
    default: Date.now
  },
  aiModel: {
    type: String,
    default: 'gemini-pro'
  },
  regenerationCount: {
    type: Number,
    default: 0
  },
  lastRegeneratedAt: Date
}, { _id: false });

/**
 * Question Paper Schema
 */
const questionPaperSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  grade: {
    type: String,
    required: true
  },
  // School Info
  schoolName: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true
  },
  generalInstructions: {
    type: [String],
    default: [
      'Read all questions carefully before attempting.',
      'Write your answers clearly and legibly.',
      'All questions are compulsory unless otherwise stated.',
      'Marks for each question are indicated against it.'
    ]
  },
  sections: [sectionSchema],
  metadata: {
    type: metadataSchema,
    default: () => ({
      generatedAt: new Date(),
      aiModel: 'gemini-pro',
      regenerationCount: 0
    })
  },
  pdfUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
questionPaperSchema.index({ assignmentId: 1 });
questionPaperSchema.index({ createdAt: -1 });

// Virtual for total questions count
questionPaperSchema.virtual('totalQuestions').get(function() {
  return this.sections?.reduce((total, section) => 
    total + (section.questions?.length || 0), 0) || 0;
});

// Transform for JSON output
questionPaperSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

questionPaperSchema.set('toObject', { virtuals: true });

/**
 * Static methods
 */
questionPaperSchema.statics.findByAssignmentId = function(assignmentId) {
  return this.findOne({ assignmentId }).sort({ createdAt: -1 });
};

questionPaperSchema.statics.incrementRegenerationCount = async function(paperId) {
  return this.findByIdAndUpdate(paperId, {
    $inc: { 'metadata.regenerationCount': 1 },
    $set: { 'metadata.lastRegeneratedAt': new Date() }
  }, { new: true });
};

const QuestionPaper = mongoose.model('QuestionPaper', questionPaperSchema);

module.exports = QuestionPaper;
