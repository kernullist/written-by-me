require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { listModels } = require("./services/ai");

const app = express();

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-deepseek-api-key")
{
    console.error("[ERROR] OPENAI_API_KEY not set. Copy .env.example to .env and fill in your API key (DeepSeek or OpenAI-compatible).");
    process.exit(1);
}

fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "output"), { recursive: true });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

let cachedModels = null;
let cachedModelsAt = 0;
const MODEL_CACHE_TTL_MS = 3600000;

app.get("/api/config", async (_req, res) =>
{
    const defaultModel = process.env.AI_MODEL || "deepseek-chat";
    let models = [defaultModel];

    const now = Date.now();
    if (cachedModels && (now - cachedModelsAt) < MODEL_CACHE_TTL_MS)
    {
        models = cachedModels;
    }
    else
    {
        try
        {
            models = await listModels();
            cachedModels = models;
            cachedModelsAt = now;
        }
        catch (err)
        {
            console.warn("[WrittenByMe] Could not fetch model list:", err.message);
        }
    }

    res.json({
        model: defaultModel,
        models,
        maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB) || 10
    });
});

const uploadRoutes = require("./routes/upload");
const analyzeRoutes = require("./routes/analyze");

app.use("/api", uploadRoutes);
app.use("/api", analyzeRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
{
    console.log(`[WrittenByMe] Server running at http://localhost:${PORT}`);
    console.log(`[WrittenByMe] Model: ${process.env.AI_MODEL || "deepseek-chat"}`);
    console.log(`[WrittenByMe] Provider: ${process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1"}`);
});
