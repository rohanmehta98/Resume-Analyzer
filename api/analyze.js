const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });

// Configure Multer for in-memory file handling
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single("resume");

// Helper to run multer in a promise-based way for Vercel
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await runMiddleware(req, res, upload);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let resumeText = "";
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    if (fileName.endsWith(".pdf")) {
      const data = await pdf(fileBuffer);
      resumeText = data.text;
    } else if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      resumeText = result.value;
    } else {
      return res.status(400).json({ error: "Unsupported file format. Please upload PDF or DOCX." });
    }

    if (!resumeText || resumeText.trim().length < 100) {
      return res.status(400).json({ error: "Could not extract enough text from the resume." });
    }

    const { targetRole, targetIndustry, jobDescription } = req.body;

    const prompt = buildPrompt({
      resumeText,
      fileName,
      targetRole,
      targetIndustry,
      jobDescription
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const response = await result.response;
    const text = response.text();

    // Parse JSON safely
    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      console.error("JSON Parse Error:", e, text);
      return res.status(502).json({ error: "Failed to parse AI response. Please try again." });
    }

    return res.status(200).json({
      ok: true,
      analysis,
      meta: {
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        fileName
      }
    });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

function buildPrompt(input) {
  return `
You are ResumeIQ, an expert recruiter, ATS auditor, and resume strategist.
Analyze the provided resume and respond with a structured JSON analysis.

CONTEXT:
File Name: ${input.fileName}
Target Role: ${input.targetRole || "General"}
Target Industry: ${input.targetIndustry || "General"}
Job Description: ${input.jobDescription || "Not provided"}

RESUME TEXT:
${input.resumeText}

RESPONSE FORMAT:
Respond ONLY with a JSON object. No markdown, no code blocks, no intro/outro.
Structure:
{
  "candidateName": "string",
  "overallScore": number (0-100),
  "overallVerdict": "Excellent Match | Promising Match | Needs Revision",
  "executiveSummary": "string",
  "sectionScores": {
    "experience": {"score": number, "insight": "string"},
    "education": {"score": number, "insight": "string"},
    "skills": {"score": number, "insight": "string"},
    "impact": {"score": number, "insight": "string"},
    "formatting": {"score": number, "insight": "string"}
  },
  "ats": {
    "score": number,
    "checks": {
      "fileFormatCompatible": boolean,
      "standardHeadings": boolean,
      "readableLayout": boolean,
      "keywordCoverage": boolean
    }
  },
  "strengths": ["string"],
  "gaps": ["string"],
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "recommendations": [{"priority": "High|Medium|Low", "title": "string", "detail": "string"}],
  "likelyInterviewQuestions": ["string"]
}
`;
}

module.exports.config = {
  api: {
    bodyParser: false, // Disabling bodyParser to handle multipart/form-data with multer
  },
};

