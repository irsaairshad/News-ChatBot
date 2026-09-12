// ================================================================
// API & MODEL SETTINGS — intentionally blank, as requested.
// Never paste private keys here. Add them to .env.local on your own machine.
// ================================================================
export const NEWS_PROVIDER = ""; // Later: "gnews" or "newsapi"
export const NEWS_API_KEY = ""; // Later: process.env.NEWS_API_KEY (server only)
export const YOUTUBE_API_KEY = ""; // Later: process.env.YOUTUBE_API_KEY
export const AI_PROVIDER = ""; // Later: "openai" or "gemini"
export const AI_MODEL = ""; // Later: your chosen model name

// Recommended flow: fetch headlines → fetch YouTube videos → select relevant
// source text → ask the model to answer with title, publisher, date and URL.
