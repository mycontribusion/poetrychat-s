// controllers/chatController.js
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL_NAME = "gemini-2.5-flash"; // Or "gemini-1.5-pro", "gemini-1.0-pro"

const poetryFilePath = path.join(__dirname, "../data/poetry_book.txt");

function extractPoems(text) {
  const regex = /----\s*TITLE:\s*(.*?)\n([\s\S]*?)(?=----|$)/g;
  const poems = {};
  let match;
  while ((match = regex.exec(text)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();
    poems[title] = body;
  }
  return poems;
}

let poems = {};
try {
  const fileContent = fs.readFileSync(poetryFilePath, "utf-8");
  poems = extractPoems(fileContent);
  console.log("📖 Poetry book loaded successfully in chatController.");
} catch (err) {
  console.error("❌ Error loading poetry book in chatController:", err.message);
}

function getPoemByTitle(title) {
  return poems[title] || null;
}

exports.getPoemTitles = (req, res) => {
  res.json(Object.keys(poems));
};

exports.chatWithAI = async (req, res) => {
  const { message, poemTitle } = req.body;

  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: "Message cannot be empty." });
  }
  if (typeof poemTitle !== 'string' || poemTitle.trim() === '') {
    return res.status(400).json({ error: "Poem title cannot be empty." });
  }

  const poem = getPoemByTitle(poemTitle);

  if (!poem) {
    return res.status(404).json({ error: "Poem not found" });
  }

  const systemInstruction = `You are a poetic assistant. Answer as if you're the poet of the poem titled "${poemTitle}". Provide clarity, emotion, and if needed, break the lines down for better understanding. The poem content is provided below.`;

  const poemContext = `
--- Poem Content Start ---
Title: "${poemTitle}"
${poem}
--- Poem Content End ---
`;

  try {
    console.log("🔍 Prompt being sent to Gemini (via new client library):", message);

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { role: "user", parts: [{ text: `${systemInstruction}\n\n${poemContext}\n\nUser's question: "${message}"` }] }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
      // Consider adding safetySettings here if you want to relax or tighten them
      // safetySettings: [
      //   {
      //     category: 'HARM_CATEGORY_HARASSMENT',
      //     threshold: 'BLOCK_NONE',
      //   },
      //   // ... other categories
      // ],
    });

    // --- NEW DEBUGGING LOGS ---
    console.log("🔍 Full result object from Gemini API:", JSON.stringify(result, null, 2));
    console.log("🔍 result.response object:", JSON.stringify(result.response, null, 2));

    // --- CRITICAL FIX: Check if result.response exists before accessing its properties ---
    if (!result.response) {
      console.error("❌ AI error: 'result.response' is undefined or null.");
      return res.status(500).json({
        error: "AI response was empty or malformed at the top level.",
        details: "result.response is undefined or null.",
      });
    }

    // Check for safety feedback before accessing candidates
    if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
      const blockReason = result.response.promptFeedback.blockReason;
      console.warn(`⚠️ Gemini API blocked response due to: ${blockReason}`);
      return res.status(400).json({
        error: "AI response blocked by safety filters.",
        details: `Reason: ${blockReason}`,
      });
    }

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (responseText) {
      res.json({ reply: responseText });
    } else {
      console.error("❌ AI error: No text content found in AI response candidates.");
      res.status(500).json({ error: "AI generated an empty or malformed response (no candidates)." });
    }

  } catch (err) {
    console.error(
      "❌ AI generation failed (new client library):",
      err.response?.data || err.message || JSON.stringify(err)
    );
    res.status(500).json({
      error: "AI failed to generate response.",
      details: err.response?.data || err.message || "Unknown error",
    });
  }
};
