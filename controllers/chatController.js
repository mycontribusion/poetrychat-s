// controllers/chatController.js
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai"); // Using the new client library
require("dotenv").config(); // Ensure dotenv is configured here too

// CORRECTED: Initialize the client by explicitly passing an options object with apiKey
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Define the model you want to use.
const MODEL_NAME = "gemini-2.5-flash"; // Or "gemini-1.5-pro", "gemini-1.0-pro"

// Define the path to your poetry book file (assuming 'data' folder)
const poetryFilePath = path.join(__dirname, "../data/poetry_book.txt");

// Function to extract poems from the text content
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

// Load and parse the poetry book content once when the controller is initialized
let poems = {};
try {
  const fileContent = fs.readFileSync(poetryFilePath, "utf-8");
  poems = extractPoems(fileContent);
  console.log("📖 Poetry book loaded successfully in chatController.");
} catch (err) {
  console.error("❌ Error loading poetry book in chatController:", err.message);
  // It's critical data, so you might want to exit the process or handle gracefully
  // process.exit(1);
}

// Helper function to get a poem by its title
function getPoemByTitle(title) {
  return poems[title] || null;
}

// GET all poem titles API endpoint
exports.getPoemTitles = (req, res) => {
  res.json(Object.keys(poems));
};

// POST chat with AI API endpoint
exports.chatWithAI = async (req, res) => {
  const { message, poemTitle } = req.body;

  // Input validation
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

  // Construct the prompt for the AI
  const systemInstruction = `You are a poetic assistant. Answer as if you're the poet of the poem titled "${poemTitle}". Provide clarity, emotion, and if needed, break the lines down for better understanding. The poem content is provided below.`;

  const poemContext = `
--- Poem Content Start ---
Title: "${poemTitle}"
${poem}
--- Poem Content End ---
`;

  try {
    console.log("🔍 Prompt being sent to Gemini (via new client library):\n", message);

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

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (responseText) {
      res.json({ reply: responseText });
    } else {
      console.error("❌ AI error: No text content found in AI response.");
      res.status(500).json({ error: "AI generated an empty or malformed response." });
    }

  } catch (err) {
    console.error(
      "❌ AI generation failed (new client library):",
      err.response?.data || err.message || JSON.toString(err)
    );
    res.status(500).json({
      error: "AI failed to generate response.",
      details: err.response?.data || err.message || "Unknown error",
    });
  }
};
