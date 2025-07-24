// server.js (main application entry point)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv"); // Corrected dotenv import

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'https://poetrychat.netlify.app', // Allow requests from your React frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.use(express.json()); // Body parser for JSON requests

// Import and use your chat routes
const chatRoutes = require("./routes/chatRoutes");
app.use("/api", chatRoutes); // All routes in chatRoutes will be prefixed with /api

// Simple root route
app.get('/', (req, res) => {
  res.send('Poetry Chat Backend is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});