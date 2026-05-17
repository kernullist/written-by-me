const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { extractText } = require("../services/textExtractor");
const { analyzeWithBatching } = require("../services/ai");

const router = express.Router();

const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

(function cleanupUploadsDir()
{
    const dir = path.join(__dirname, "..", "uploads");
    try
    {
        for (const entry of fs.readdirSync(dir))
        {
            try { fs.unlinkSync(path.join(dir, entry)); }
            catch (_) {}
        }
    }
    catch (_) {}
})();
const MAX_STORED_CONTENT = 50000;
const MAX_TOTAL_CHARS = 100000;

const ALLOWED_EXTENSIONS = [
    ".txt", ".md", ".csv", ".log",
    ".cpp", ".c", ".h", ".hpp", ".cs", ".java",
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".rs", ".go", ".rb", ".php", ".swift", ".kt",
    ".html", ".css", ".scss", ".json", ".xml", ".yaml", ".yml",
    ".docx", ".pdf"
];

const textStore = new Map();

const storage = multer.diskStorage({
    destination: path.join(__dirname, "..", "uploads"),
    filename: (_req, file, cb) =>
    {
        const id = uuidv4();
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, id + ext);
    }
});

const fileFilter = (_req, file, cb) =>
{
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext))
    {
        cb(null, true);
    }
    else
    {
        cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: 10 }
});

router.post("/upload", async (req, res) =>
{
    upload.array("files", 10)(req, res, async (err) =>
    {
        if (err)
        {
            if (err instanceof multer.MulterError)
            {
                if (err.code === "LIMIT_FILE_SIZE")
                {
                    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB.` });
                }
                if (err.code === "LIMIT_FILE_COUNT")
                {
                    return res.status(400).json({ error: "Maximum 10 files allowed." });
                }
                return res.status(400).json({ error: err.message });
            }
            return res.status(400).json({ error: err.message });
        }

        if (!req.files || req.files.length === 0)
        {
            return res.status(400).json({ error: "No files provided." });
        }

        try
        {
            const results = [];
            for (const file of req.files)
            {
                const text = await extractText(file.path, file.originalname);
                const fileId = path.basename(file.filename, path.extname(file.filename));

                const capped = text.length > MAX_STORED_CONTENT
                    ? text.slice(0, MAX_STORED_CONTENT)
                    : text;

                textStore.set(fileId, { name: file.originalname, content: capped });

                console.log(`[upload] Stored: ${file.originalname} (${text.length} chars, capped to ${capped.length})`);

                results.push({
                    id: fileId,
                    name: file.originalname,
                    size: file.size,
                    type: path.extname(file.originalname).toLowerCase()
                });
            }
            res.json({ ok: true, files: results });
        }
        catch (extractErr)
        {
            res.status(500).json({ error: "Text extraction failed.", detail: extractErr.message });
        }
    });
});

router.post("/analyze-with-paste", async (req, res) =>
{
    const { fileIds, pasteTexts, pastedText, model, preferredLanguage } = req.body;
    const texts = [];
    const missingFileIds = [];

    if (pasteTexts && Array.isArray(pasteTexts))
    {
        for (const pt of pasteTexts)
        {
            if (pt.content && pt.content.trim().length > 0)
            {
                const source = pt.source || "pasted-text";
                texts.push({ source, content: pt.content.trim() });
            }
        }
    }
    else if (pastedText && pastedText.trim().length > 0)
    {
        texts.push({ source: "pasted-text", content: pastedText.trim() });
    }

    if (fileIds && Array.isArray(fileIds))
    {
        for (const fileId of fileIds)
        {
            const stored = textStore.get(fileId);
            if (stored)
            {
                texts.push({ source: stored.name, content: stored.content });
            }
            else
            {
                missingFileIds.push(fileId);
            }
        }
    }

    if (texts.length === 0)
    {
        return res.status(400).json({
            error: "No content available. Upload files or paste text first.",
            missingFileIds: missingFileIds.length > 0 ? missingFileIds : undefined
        });
    }

    const totalChars = texts.reduce((sum, t) => sum + (t.content ? t.content.length : 0), 0);
    if (totalChars === 0)
    {
        return res.status(400).json({ error: "All provided texts are empty." });
    }

    if (totalChars > MAX_TOTAL_CHARS)
    {
        return res.status(400).json({
            error: `Combined text too large (${totalChars} chars). Maximum is ${MAX_TOTAL_CHARS} characters.`
        });
    }

    try
    {
        const { skillMd, strategy, batches } = await analyzeWithBatching(texts, preferredLanguage || "auto", model);
        const analysisId = uuidv4();
        const outputPath = path.join(__dirname, "..", "output", `${analysisId}.md`);
        await fs.promises.writeFile(outputPath, skillMd, "utf-8");

        const resp = {
            ok: true,
            analysisId,
            strategy,
            batches,
            analysis: {
                skillMd
            }
        };

        if (missingFileIds.length > 0)
        {
            resp.warning = `${missingFileIds.length} uploaded file(s) could not be found. The server may have restarted. Please re-upload those files.`;
            resp.missingFileIds = missingFileIds;
        }

        res.json(resp);
    }
    catch (err)
    {
        console.error("[analyze] AI call failed:", err.message);
        res.status(500).json({ error: "AI analysis failed.", detail: err.message });
    }
});

router.post("/clear", (_req, res) =>
{
    const count = textStore.size;
    textStore.clear();

    const dir = path.join(__dirname, "..", "uploads");
    try
    {
        for (const entry of fs.readdirSync(dir))
        {
            try { fs.unlinkSync(path.join(dir, entry)); }
            catch (_) {}
        }
    }
    catch (_) {}

    res.json({ ok: true, cleared: count });
});

module.exports = router;
