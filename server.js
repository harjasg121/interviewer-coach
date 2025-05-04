const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Debug logging
console.log('Current directory:', __dirname);
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Log static file serving
app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    next();
});

// MongoDB Schema
const interviewSchema = new mongoose.Schema({
  videoUrl: String,
  feedback: {
    tone: String,
    clarity: String,
    content: String,
    suggestions: [String]
  },
  timestamp: { type: Date, default: Date.now }
});

const Interview = mongoose.model('Interview', interviewSchema);

// List of interview questions
const interviewQuestions = [
    "Tell me about yourself and your background.",
    "What are your greatest strengths and weaknesses?",
    "Why are you interested in this position?",
    "Where do you see yourself in 5 years?",
    "Describe a challenging situation you faced and how you handled it.",
    "What is your greatest professional achievement?",
    "How do you handle stress and pressure?",
    "What are your salary expectations?",
    "Why should we hire you?",
    "Do you have any questions for us?",
    "How do you stay current with industry trends and developments?",
    "Describe a time when you had to work with a difficult team member. How did you handle it?",
    "What motivates you in your work?",
    "How do you prioritize your work when you have multiple deadlines?",
    "Tell me about a time you failed and what you learned from it.",
    "What is your preferred work environment and why?",
    "How do you handle constructive criticism?",
    "Describe your ideal manager and work environment.",
    "What are your career goals and how does this position align with them?",
    "How do you measure success in your work?",
    "Tell me about a time you had to make a difficult decision at work.",
    "How do you handle conflicts in the workplace?",
    "What skills do you think are most important for this role?",
    "How do you approach learning new technologies or skills?",
    "Describe a time when you had to adapt to a major change at work.",
    "What do you consider your biggest professional accomplishment?",
    "How do you ensure quality in your work?",
    "Tell me about a time you had to work under tight deadlines.",
    "What do you think sets you apart from other candidates?",
    "How do you handle work-life balance?"
];

// Track last question to prevent repeats
let lastQuestion = null;

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// API Endpoints
app.get('/api/question', (req, res) => {
    let randomQuestion;
    do {
        randomQuestion = interviewQuestions[Math.floor(Math.random() * interviewQuestions.length)];
    } while (randomQuestion === lastQuestion);
    
    lastQuestion = randomQuestion;
    res.json({ success: true, question: randomQuestion });
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    console.log('Upload request received');
    const videoUrl = `/uploads/${req.file.filename}`;
    const interview = new Interview({ videoUrl });
    await interview.save();
    res.json({ success: true, videoUrl, interviewId: interview._id });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/analyze/:interviewId', async (req, res) => {
  try {
    console.log('=== Starting Analysis Process ===');
    console.log('Interview ID:', req.params.interviewId);
    
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview) {
      console.error('Interview not found in database');
      return res.status(404).json({ success: false, error: 'Interview not found' });
    }
    console.log('Found interview in database:', interview);

    // Get the video file path
    const videoPath = path.join(__dirname, 'public', interview.videoUrl);
    console.log('Attempting to read video from path:', videoPath);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      console.error('Video file not found at path:', videoPath);
      return res.status(404).json({ success: false, error: 'Video file not found' });
    }
    console.log('Video file exists');

    // Read the video file
    const videoData = fs.readFileSync(videoPath);
    console.log('Video file size:', videoData.length, 'bytes');

    // Convert video to base64
    const videoBase64 = videoData.toString('base64');
    console.log('Video converted to base64, length:', videoBase64.length);
    
    // Initialize Gemini
    console.log('Initializing Gemini API...');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('Gemini model initialized');

    // Create a prompt for analysis
    const prompt = `
      You are an expert interview coach analyzing a video response to an interview question.
      Please watch the video and provide specific, actionable feedback in the following exact format:

      Tone: (Your analysis of the candidate's tone, confidence, and professionalism)
      Clarity: (Your analysis of the response's structure and clarity)
      Content: (Your analysis of the response's relevance and quality)
      Suggestions:
      - (First specific suggestion)
      - (Second specific suggestion)
      - (Third specific suggestion)

      Focus on providing concrete, constructive feedback that will help the candidate improve.
      Be specific about what was good and what could be improved.
      Use complete sentences and avoid placeholders or templates.
    `;

    // Create the image part for Gemini
    const imagePart = {
      inlineData: {
        data: videoBase64,
        mimeType: 'video/webm'
      }
    };

    console.log('Sending request to Gemini API...');
    
    // Generate feedback using Gemini
    const result = await model.generateContent([prompt, imagePart]);
    console.log('Received response from Gemini API');
    const response = await result.response;
    const feedbackText = response.text();
    console.log('Feedback text received:', feedbackText);

    // Parse the feedback into structured format
    const feedback = {
      tone: extractFeedbackSection(feedbackText, 'Tone'),
      clarity: extractFeedbackSection(feedbackText, 'Clarity'),
      content: extractFeedbackSection(feedbackText, 'Content'),
      suggestions: extractSuggestions(feedbackText)
    };

    // Validate feedback
    if (feedback.tone.includes('[') || feedback.clarity.includes('[') || feedback.content.includes('[')) {
      throw new Error('Invalid feedback format received from API');
    }

    interview.feedback = feedback;
    await interview.save();
    console.log('Feedback saved to database');

    res.json({ success: true, feedback });
    console.log('=== Analysis Process Completed Successfully ===');
  } catch (error) {
    console.error('=== Analysis Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error.constructor.name);
    if (error.response) {
      console.error('API Response:', error.response);
    }
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

// Helper function to extract feedback sections
function extractFeedbackSection(text, section) {
  // First try to find the section with a colon
  let regex = new RegExp(`${section}:\\s*([^\\n]+)`, 'i');
  let match = text.match(regex);
  
  // If not found, try to find the section in a list format
  if (!match) {
    regex = new RegExp(`${section}[^\\n]*\\n([^\\n]+)`, 'i');
    match = text.match(regex);
  }
  
  // If still not found, try to find any content after the section header
  if (!match) {
    regex = new RegExp(`${section}[^\\n]*([^\\n]+)`, 'i');
    match = text.match(regex);
  }

  return match ? match[1].trim() : 'No feedback available';
}

// Helper function to extract suggestions
function extractSuggestions(text) {
  const suggestions = [];
  
  // First try to find the Suggestions section
  const suggestionsMatch = text.match(/Suggestions:([\s\S]*?)(?=\n\n|$)/i);
  if (suggestionsMatch) {
    const suggestionsText = suggestionsMatch[1];
    
    // Split by bullet points or dashes, but preserve multi-line content
    const bulletPoints = suggestionsText.split(/(?=^\s*[-•])/m).filter(point => point.trim());
    
    // Clean up each suggestion
    bulletPoints.forEach(point => {
      // Remove any remaining markdown or special characters
      const cleanPoint = point
        .replace(/\*\*/g, '') // Remove markdown bold
        .replace(/^\s*[-•]\s*/, '') // Remove any remaining bullet points
        .trim();
      
      if (cleanPoint && !suggestions.includes(cleanPoint)) {
        suggestions.push(cleanPoint);
      }
    });
  }
  
  // If no suggestions found in the section, try other patterns
  if (suggestions.length === 0) {
    const patterns = [
      /- ([\s\S]*?)(?=\n\s*-|\n\n|$)/g,
      /• ([\s\S]*?)(?=\n\s*•|\n\n|$)/g,
      /\d+\. ([\s\S]*?)(?=\n\s*\d+\.|\n\n|$)/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const suggestion = match[1].trim();
        if (suggestion && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
      if (suggestions.length > 0) break;
    }
  }
  
  return suggestions.length > 0 ? suggestions : ['No specific suggestions available'];
}

app.get('/api/history', async (req, res) => {
  try {
    console.log('History request received');
    const interviews = await Interview.find().sort({ timestamp: -1 });
    res.json({ success: true, interviews });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear interview history
app.delete('/api/history', async (req, res) => {
  try {
    console.log('Clear history request received');
    await Interview.deleteMany({});
    res.json({ success: true, message: 'Interview history cleared successfully' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    console.log('Serving index.html for route:', req.url);
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Access the application at: http://localhost:${port}`);
}); 