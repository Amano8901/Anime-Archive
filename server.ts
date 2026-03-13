import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to proxy and parse directory listings
  app.get("/api/proxy-dir", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await axios.get(url, { timeout: 10000 });
      const $ = cheerio.load(response.data);
      const items: any[] = [];

      $("a").each((_, element) => {
        const href = $(element).attr("href");
        const name = $(element).text();

        if (href && name && href !== "../" && !href.startsWith("?")) {
          const isDirectory = href.endsWith("/");
          items.push({
            name: name.trim(),
            url: new URL(href, url).toString(),
            isDirectory,
          });
        }
      });

      res.json({ items });
    } catch (error: any) {
      console.error(`Error fetching directory [${url}]:`, error.message);
      if (error.response) {
        res.status(error.response.status).json({ 
          error: `Failed to fetch directory: ${error.response.status} ${error.response.statusText}`,
          url 
        });
      } else if (error.request) {
        res.status(504).json({ error: "No response from target server", url });
      } else {
        res.status(500).json({ error: error.message, url });
      }
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
