const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, resumeText, history } = req.body;

  if (!message || !resumeText) {
    return res.status(400).json({ error: "Missing message or resume context" });
  }

  try {
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `Here is my resume context for all future questions: \n\n ${resumeText}` }]
        },
        {
          role: "model",
          parts: [{ text: "I have received and analyzed your resume. How can I help you improve it today?" }]
        },
        ...(history || [])
      ]
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({
      ok: true,
      answer: text
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
