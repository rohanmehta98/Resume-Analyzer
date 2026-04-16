const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON (for the chat endpoint)
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/analyze', require('./api/analyze'));
app.post('/api/chat', require('./api/chat'));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Local dev server running at http://localhost:${PORT}`);
    console.log(`🤖 Using Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ MISSING (Check .env)'}`);
});
