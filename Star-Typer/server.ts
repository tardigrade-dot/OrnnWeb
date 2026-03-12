import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch words from a URL
  app.get("/api/fetch-words", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const text = await response.text();
      
      // Simple word extraction: 3-12 characters, alphanumeric
      // Remove HTML tags first
      const cleanText = text.replace(/<[^>]*>?/gm, ' ');
      const words = cleanText.match(/[a-zA-Z]{3,12}/g) || [];
      
      // Deduplicate and filter common small words if needed, but let's keep it simple
      const uniqueWords = Array.from(new Set(words.map(w => w.toLowerCase())));
      
      // Limit to a reasonable number of words
      const limitedWords = uniqueWords.slice(0, 500);

      if (limitedWords.length === 0) {
        return res.status(404).json({ error: "No suitable words found at this URL" });
      }

      res.json({ words: limitedWords });
    } catch (error) {
      console.error("Error fetching words:", error);
      res.status(500).json({ error: "Failed to fetch or process the URL" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
