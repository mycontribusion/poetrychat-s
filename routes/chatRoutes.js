// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { chatWithAI, getPoemTitles } = require("../controllers/chatController"); // Correct paths

router.post("/chat", chatWithAI);
router.get("/poems", getPoemTitles); // Changed to /poems for clarity

module.exports = router;