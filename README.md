# Written By Me

**Your writing style, distilled into a Skill.md for AI agents.**

![Before vs After](public/written_by_me_combined.png?v=2)

Upload your documents (notes, emails, code, blog posts) -- the AI analyzes your writing across 13 stylometric dimensions and generates a portable `Skill.md` that any AI agent (Claude, OpenCode, Cline, GPT) can load to write in your voice.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.example .env
# Edit .env → paste your DeepSeek or OpenAI-compatible API key

# 3. Start
npm start
```

Open `http://localhost:3000`, upload documents or paste text, select a model, and click **Analyze My Style**.

## How It Works

```
Upload Files / Paste Text  →  Select Model  →  AI Analysis (13 dimensions)  →  Download Skill.md
```

The analysis is grounded in computational stylometry research:

| Dimension | Research Basis |
|-----------|---------------|
| Function Words | Mosteller & Wallace (Federalist Papers) -- the most reliable authorship marker |
| Vocabulary Richness | Type-Token Ratio, Burrows Delta Method |
| Word Length | Mendenhall distribution, contraction preferences |
| Sentence Architecture | Clause complexity, nesting depth, variation patterns |
| Voice & Perspective | Active/passive ratio, hedging, boosting, person |
| Punctuation Fingerprint | Density, comma style, semicolons, em-dashes |
| Text Architecture | Paragraph patterns, headings, organizational structure |
| Tone & Register | Formality, humor type, emotional register |
| Rhetorical Devices | Metaphors, rhetorical questions, anaphora, anecdotes |
| Code Style | Brace placement, naming conventions, comment style |
| Language Preference | Korean/English patterns, honorifics, code-switching |

## Project Structure

```
written-by-me/
  server.js               # Express entrypoint, model cache, directory init
  routes/
    upload.js              # POST /api/upload, /analyze-with-paste, /clear
    analyze.js             # POST /api/analyze, GET /api/download/:id
  services/
    ai.js                  # AI API calls (analyze + list models), timeouts, streaming errors
    skillGenerator.js      # 13-dimension prompt engineering + source sanitization
    textExtractor.js       # .txt .md .docx .pdf extraction, EUC-KR auto-detect
  public/
    index.html             # SPA shell
    style.css              # Dark theme, responsive
    script.js              # Upload, drag-drop, model selector, analysis, download
```

## Configuration (.env)

```env
OPENAI_API_KEY=sk-xxx          # Required: DeepSeek or OpenAI-compatible key
OPENAI_BASE_URL=...            # Optional: defaults to https://api.deepseek.com/v1
AI_MODEL=deepseek-chat         # Optional: model override
AI_MAX_TOKENS=8192             # Optional: output token limit
PORT=3000                      # Optional: server port
MAX_FILE_SIZE_MB=10            # Optional: per-file upload limit
```

Also supports OpenAI, Groq, Ollama, and any OpenAI-compatible provider by changing `OPENAI_BASE_URL` and `AI_MODEL`.

## Supported File Formats

`.txt` `.md` `.csv` `.log` `.cpp` `.c` `.h` `.hpp` `.cs` `.java` `.py` `.js` `.ts` `.jsx` `.tsx` `.rs` `.go` `.rb` `.php` `.swift` `.kt` `.html` `.css` `.scss` `.json` `.xml` `.yaml` `.yml` `.docx` `.pdf`

## Limits

- 10 files per upload, 10 MB per file
- 50,000 characters stored per file (server-side mem cap)
- 100,000 characters total input per analysis
- 15,000 characters per source in the AI prompt
- 180-second timeout on AI calls (server + client)

## Requirements

- Node.js >= 18.0.0
- DeepSeek or OpenAI-compatible API key
