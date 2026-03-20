const PDFDocument = require('pdfkit');

/**
 * PDF Service - Generate question paper PDFs
 */
const pdfService = {
  stripDifficultyPrefix(text = '') {
    return text.replace(/^\s*\[(easy|moderate|medium|hard|challenging)\]\s*/i, '');
  },

  /**
   * Generate PDF for a question paper
   * @param {Object} questionPaper - Question paper data
   * @returns {Promise<Buffer>} - PDF buffer
   */
  generateQuestionPaperPdf(questionPaper) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate PDF content
        this.addHeader(doc, questionPaper);
        this.addStudentInfo(doc);
        this.addGeneralInstructions(doc, questionPaper.generalInstructions);
        this.addSections(doc, questionPaper.sections);
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Add header to PDF
   */
  addHeader(doc, questionPaper) {
    // Title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text(questionPaper.title, { align: 'center' });
    
    doc.moveDown(0.5);

    // Subject and Grade
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Subject: ${questionPaper.subject}`, { align: 'center' });
    
    doc.text(`Class/Grade: ${questionPaper.grade}`, { align: 'center' });
    
    doc.moveDown(0.3);

    // Duration and Marks info box
    const boxY = doc.y;
    const boxWidth = 400;
    const boxX = (doc.page.width - boxWidth) / 2;

    doc.rect(boxX, boxY, boxWidth, 40)
       .stroke();

    doc.fontSize(11)
       .text(`Duration: ${questionPaper.duration} minutes`, boxX + 20, boxY + 10);
    doc.text(`Total Marks: ${questionPaper.totalMarks}`, boxX + 220, boxY + 10);

    doc.y = boxY + 50;
    doc.moveDown(0.5);
  },

  /**
   * Add student info section
   */
  addStudentInfo(doc) {
    doc.fontSize(11).font('Helvetica-Bold').text('Student Information:', { underline: true });
    doc.moveDown(0.3);

    doc.font('Helvetica');
    
    // Name field
    doc.text('Name: ', { continued: true });
    doc.text('_'.repeat(50));
    
    // Roll Number and Section on same line
    doc.moveDown(0.5);
    doc.text('Roll Number: ', { continued: true });
    doc.text('_'.repeat(20), { continued: true });
    doc.text('     Section: ', { continued: true });
    doc.text('_'.repeat(15));

    doc.moveDown(1);
    
    // Divider line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    
    doc.moveDown(0.5);
  },

  /**
   * Add general instructions
   */
  addGeneralInstructions(doc, instructions) {
    doc.fontSize(11).font('Helvetica-Bold').text('General Instructions:', { underline: true });
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(10);
    
    instructions.forEach((instruction, index) => {
      doc.text(`${index + 1}. ${instruction}`);
    });

    doc.moveDown(1);
    
    // Divider line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    
    doc.moveDown(0.5);
  },

  /**
   * Add all sections
   */
  addSections(doc, sections) {
    sections.forEach((section, sectionIndex) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }

      this.addSection(doc, section, sectionIndex);
    });
  },

  /**
   * Add a single section
   */
  addSection(doc, section, sectionIndex) {
    // Section header
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`${section.title}`, { underline: true });
    
    doc.moveDown(0.3);

    // Section instructions
    doc.fontSize(10)
       .font('Helvetica-Oblique')
       .text(`(${section.instructions}) [Total: ${section.totalMarks || section.questions.reduce((sum, question) => sum + (question.marks || 0), 0)} marks]`);
    
    doc.moveDown(0.5);

    // Questions
    doc.font('Helvetica').fontSize(11);
    
    section.questions.forEach((question, qIndex) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }

      this.addQuestion(doc, question);
    });

    doc.moveDown(1);
  },

  /**
   * Add a single question
   */
  addQuestion(doc, question) {
    const startY = doc.y;
    const questionWidth = doc.page.width - 150;

    // Question number and text
    doc.font('Helvetica-Bold')
       .text(`Q${question.questionNumber}. `, { continued: true });
    
    doc.font('Helvetica')
       .text(this.stripDifficultyPrefix(question.questionText), {
         width: questionWidth - 50,
         align: 'justify'
       });

     // Marks
    const marksX = doc.page.width - 100;
    doc.fontSize(9)
       .font('Helvetica')
       .text(`[${question.marks} marks]`, marksX, startY, { width: 50 });

    doc.moveDown(0.3);

    // Add options for multiple choice
    if (question.options && question.options.length > 0) {
      const optionLabels = ['a)', 'b)', 'c)', 'd)'];
      
      question.options.forEach((option, optIndex) => {
        doc.fontSize(10)
           .text(`   ${optionLabels[optIndex]} ${option}`);
      });
    }

    // Answer space based on question type
    if (question.type === 'short-answer') {
      doc.moveDown(0.5);
      doc.text('Answer: ' + '_'.repeat(60));
    } else if (question.type === 'long-answer') {
      doc.moveDown(0.5);
      // Add lined space for answer
      for (let i = 0; i < 3; i++) {
        doc.text('_'.repeat(80));
        doc.moveDown(0.3);
      }
    } else if (question.type === 'fill-blanks') {
      // Already has blanks in question
    }

    doc.moveDown(0.8);
  },

  /**
   * Add footer to each page
   */
  addFooter(doc) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Add page number
      doc.fontSize(9)
         .font('Helvetica')
         .text(
           `Page ${i + 1} of ${pages.count}`,
           50,
           doc.page.height - 30,
           { align: 'center', width: doc.page.width - 100 }
         );
    }
  }
};

module.exports = pdfService;
