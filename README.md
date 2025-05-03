# AI-Powered Interview Coach

An application that records mock interviews, analyzes responses using Gemini API, and provides structured feedback on tone, clarity, and content.

## Features

- Record video responses to interview questions
- AI-powered analysis of interview performance
- Detailed feedback on tone, clarity, and content
- Improvement suggestions
- Interview history tracking
- Random interview questions

## Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- Google Gemini API key

## Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
PORT=3000 (optional)
```

4. Create the required directories:
```bash
mkdir -p public/uploads
```

5. Start the server:
```bash
node server.js
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

## Getting API Keys

### MongoDB
1. Sign up for a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Create a database user
4. Get your connection string from the "Connect" button

### Gemini API
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy the key to your `.env` file

## Usage

1. Click "Get New Question" to receive a random interview question
2. Click "Start Recording" to begin your response
3. Click "Stop Recording" when finished
4. Click "Analyze Interview" to get feedback
5. View your feedback and improvement suggestions
6. Use "Clear History" to remove past interviews

## Security Notes

- Never commit your `.env` file
- Keep your API keys secure
- The application stores video files locally in the `public/uploads` directory

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 