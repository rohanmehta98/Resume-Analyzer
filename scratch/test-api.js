const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('YOUR_ACTUAL_API_KEY')) {
    console.error("❌ API Key not set correctly in .env");
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Say 'System Check Passed'");
    console.log("✅ API Response:", result.response.text());
  } catch (err) {
    console.error("❌ API Error:", err.message);
  }
}

test();
