const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Gemini AI Service - Handles all AI-powered question generation
 */
const geminiService = {
  /**
   * Get the Gemini Pro model instance
   */
  getModel() {
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  },

  /**
   * Generate questions based on assignment parameters
   * @param {Object} assignment - Assignment details
   * @returns {Promise<Object>} Generated questions organized by sections
   */
  async generateQuestions(assignment) {
    const model = this.getModel();
    
    const {
      subject,
      grade,
      questionTypes,
      difficultyDistribution,
      additionalInstructions,
      uploadedFileContent,
      totalMarks,
      duration
    } = assignment;

    const sections = [];

    // Generate questions for each question type
    for (const qt of questionTypes) {
      const sectionQuestions = await this.generateQuestionsForType(
        model,
        qt,
        subject,
        grade,
        difficultyDistribution,
        additionalInstructions,
        uploadedFileContent
      );
      
      sections.push({
        type: qt.type,
        title: this.getSectionTitle(qt.type),
        instructions: 'Attempt all questions. Each question carries marks as indicated.',
        totalMarks: qt.count * qt.marksPerQuestion,
        questions: sectionQuestions
      });
    }

    return {
      title: `${subject} Question Paper - ${grade}`,
      subject,
      grade,
      totalMarks,
      duration,
      sections,
      metadata: {
        generatedAt: new Date(),
        model: 'gemini-2.5-flash',
        difficultyDistribution
      }
    };
  },

  /**
   * Generate questions for a specific question type
   */
  async generateQuestionsForType(model, questionType, subject, grade, difficultyDistribution, instructions, fileContent) {
    const { type, count, marksPerQuestion } = questionType;
    
    // Calculate number of easy, medium, hard questions based on distribution
    const easyCount = Math.round(count * (difficultyDistribution.easy / 100));
    const hardCount = Math.round(count * (difficultyDistribution.hard / 100));
    const mediumCount = count - easyCount - hardCount;

    const prompt = this.buildPrompt(
      type,
      count,
      marksPerQuestion,
      subject,
      grade,
      { easy: easyCount, medium: mediumCount, hard: hardCount },
      instructions,
      fileContent
    );

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseQuestionsResponse(text, type, marksPerQuestion);
    } catch (error) {
      console.error(`Error generating ${type} questions:`, error);
      throw new Error(`Failed to generate ${type} questions: ${error.message}`);
    }
  },

  /**
   * Build the prompt for question generation
   */
  buildPrompt(type, count, marks, subject, grade, difficultyCount, instructions, fileContent) {
    const typeInstructions = this.getTypeInstructions(type);
    
    let prompt = `You are an expert educational content creator. Generate exactly ${count} ${type} questions for a ${subject} exam for ${grade} students.

QUESTION TYPE REQUIREMENTS:
${typeInstructions}

MARKS: Each question is worth ${marks} marks.

DIFFICULTY DISTRIBUTION:
- Easy questions: ${difficultyCount.easy}
- Medium questions: ${difficultyCount.medium}
- Hard questions: ${difficultyCount.hard}

`;

    if (fileContent) {
      prompt += `
REFERENCE CONTENT (Use this as the basis for questions):
${fileContent}

`;
    }

    if (instructions) {
      prompt += `
ADDITIONAL INSTRUCTIONS:
${instructions}

`;
    }

    prompt += `
OUTPUT FORMAT (IMPORTANT - Follow this JSON structure exactly):
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "The question text here",
      "difficulty": "easy|medium|hard",
      "marks": ${marks},
      ${type === 'mcq' ? `"options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "A",` : ''}
      ${type === 'numerical' ? `"correctAnswer": "numerical value or expression",
      "unit": "unit if applicable",` : ''}
      "answer": "Complete answer/solution",
      "explanation": "Brief explanation of the answer"
    }
  ]
}

Generate exactly ${count} questions following this format. Ensure questions are appropriate for ${grade} level and cover different aspects of ${subject}.
Return ONLY valid JSON, no additional text.`;
console.log(prompt);    
    return prompt;
  },

  /**
   * Get type-specific instructions
   */
  getTypeInstructions(type) {
    const instructions = {
      'mcq': `- Multiple Choice Questions with exactly 4 options (A, B, C, D)
- Include one correct answer and three plausible distractors
- Questions should test understanding, not just recall
- Avoid "All of the above" or "None of the above" options`,
      
      'short-answer': `- Short Answer Questions requiring 2-4 sentence responses
- Questions should be clear and specific
- Focus on concept understanding and application
- Include key points expected in the answer`,
      
      'long-answer': `- Long Answer/Essay Questions requiring detailed responses
- Questions should encourage critical thinking
- May include multiple parts or sub-questions
- Provide a structured answer with main points`,
      
      'numerical': `- Numerical/Calculation Problems
- Include all necessary data in the question
- Specify units where applicable
- Questions should test mathematical application of concepts
- Include step-by-step solution in the answer`,
      
      'diagram': `- Diagram-based Questions
- Describe what diagram should be drawn or labeled
- Questions may ask to draw, label, or interpret diagrams
- Include description of expected diagram in answer
- Can involve flowcharts, graphs, scientific diagrams, etc.`,
      
      'fill-blanks': `- Fill in the Blanks Questions
- Use underscores (___) to indicate blanks
- Each blank should test a key concept
- Provide the correct words/phrases for blanks`,
      
      'true-false': `- True/False Questions
- Statements should be clearly true or false
- Avoid ambiguous statements
- Include brief justification for the answer`
    };

    return instructions[type] || instructions['short-answer'];
  },

  /**
   * Parse the AI response into structured questions
   */
  parseQuestionsResponse(responseText, type, marks) {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedText);
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response structure: questions array not found');
      }

      return parsed.questions.map((q, index) => ({
        questionNumber: q.questionNumber || index + 1,
        questionText: q.questionText,
        type,
        difficulty: String(q.difficulty || 'medium').toLowerCase(),
        marks: q.marks || marks,
        options: q.options || null,
        correctAnswer: q.correctAnswer || null,
        answer: q.answer,
        explanation: q.explanation || '',
        unit: q.unit || null,
        blanks: q.blanks || null
      }));
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw response:', responseText);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  },

  /**
   * Get section title based on question type
   */
  getSectionTitle(type) {
    const titles = {
      'mcq': 'Section A - Multiple Choice Questions',
      'short-answer': 'Section B - Short Answer Questions',
      'long-answer': 'Section C - Long Answer Questions',
      'numerical': 'Section D - Numerical Problems',
      'diagram': 'Section E - Diagram Based Questions',
      'fill-blanks': 'Section F - Fill in the Blanks',
      'true-false': 'Section G - True or False'
    };
    return titles[type] || `Section - ${type}`;
  },

  /**
   * Regenerate a specific question
   */
  async regenerateQuestion(question, subject, grade) {
    const model = this.getModel();
    
    const prompt = `You are an expert educational content creator. Generate a new ${question.type} question similar to but different from this one:

Original Question: "${question.questionText}"

Subject: ${subject}
Grade: ${grade}
Difficulty: ${question.difficulty}
Marks: ${question.marks}

Generate ONE new question in the same format:
{
  "questionNumber": 1,
  "questionText": "New question text",
  "difficulty": "${question.difficulty}",
  "marks": ${question.marks},
  ${question.type === 'mcq' ? '"options": ["A", "B", "C", "D"],\n  "correctAnswer": "A",' : ''}
  "answer": "Complete answer",
  "explanation": "Brief explanation"
}

Return ONLY valid JSON.`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      return {
        ...parsed,
        questionText: parsed.questionText,
        type: question.type
      };
    } catch (error) {
      console.error('Error regenerating question:', error);
      throw new Error(`Failed to regenerate question: ${error.message}`);
    }
  },

  /**
   * Generate answer key for a question paper
   */
  async generateAnswerKey(sections) {
    const answerKey = [];
    let questionNumber = 1;

    for (const section of sections) {
      const sectionAnswers = {
        sectionTitle: section.title,
        answers: []
      };

      for (const q of section.questions) {
        sectionAnswers.answers.push({
          questionNumber: questionNumber++,
          answer: q.correctAnswer || q.answer,
          marks: q.marks
        });
      }

      answerKey.push(sectionAnswers);
    }

    return answerKey;
  },

  /**
   * Validate generated questions for quality
   */
  validateQuestions(questions, expectedCount) {
    const issues = [];

    if (questions.length !== expectedCount) {
      issues.push(`Expected ${expectedCount} questions, got ${questions.length}`);
    }

    questions.forEach((q, index) => {
      if (!q.questionText || q.questionText.trim().length < 10) {
        issues.push(`Question ${index + 1}: Question text is too short or missing`);
      }
      if (!q.answer || q.answer.trim().length < 5) {
        issues.push(`Question ${index + 1}: Answer is too short or missing`);
      }
      if (q.type === 'MCQ' && (!q.options || q.options.length !== 4)) {
        issues.push(`Question ${index + 1}: MCQ must have exactly 4 options`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }
};

module.exports = geminiService;