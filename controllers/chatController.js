// controllers/chatController.js
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai"); // Using the new client library
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

  const systemInstruction = `You are a poetic assistant. Answer any question related to the poem titled "${poemTitle}". Provide clarity, emotion, and if needed, break the lines down for better understanding, however don't attempt to upgrade the poem, be quiet about not criticizing unless when someone mentions it. The poem content is provided below.`;

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
    });

    // --- CRITICAL FIX: Access candidates and promptFeedback directly from 'result' ---
    // Removed '.response' from the path
    console.log("🔍 Full result object from Gemini API:", JSON.stringify(result, null, 2));

    if (result.promptFeedback && result.promptFeedback.blockReason) {
      const blockReason = result.promptFeedback.blockReason;
      console.warn(`⚠️ Gemini API blocked response due to: ${blockReason}`);
      return res.status(400).json({
        error: "AI response blocked by safety filters.",
        details: `Reason: ${blockReason}`,
      });
    }

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text; // Removed '.response'

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
