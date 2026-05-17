const { buildPrompt, estimateTokens, buildMergePrompt } = require("./skillGenerator");

function log(type, message)
{
    if (global.__wbmLogEvent)
    {
        global.__wbmLogEvent(type, message);
    }
}

function getBaseUrl()
{
    let url = process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
    return url.replace(/\/+$/, "");
}

function getApiKey()
{
    return process.env.OPENAI_API_KEY;
}

const CONNECT_TIMEOUT_MS = 30000;
const RESPONSE_TIMEOUT_MS = 300000;

const MODEL_CONTEXT_WINDOWS = {
    "deepseek-chat": 64000,
    "deepseek-reasoner": 64000,
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-3.5-turbo": 16385,
    "claude-3-opus": 200000,
    "claude-3-sonnet": 200000,
    "claude-3-haiku": 200000,
    "claude-3.5-sonnet": 200000,
    "o1": 200000,
    "o1-mini": 128000,
    "o3-mini": 200000
};

function fetchWithTimeout(url, options, timeoutMs)
{
    return new Promise((resolve, reject) =>
    {
        const controller = new AbortController();
        const timer = setTimeout(() =>
        {
            controller.abort();
        }, timeoutMs);

        fetch(url, { ...options, signal: controller.signal })
            .then((res) =>
            {
                clearTimeout(timer);
                resolve(res);
            })
            .catch((err) =>
            {
                clearTimeout(timer);
                reject(err);
            });
    });
}

async function analyzeStyle(prompt, modelOverride)
{
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();
    const model = modelOverride || process.env.AI_MODEL || "deepseek-chat";
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 8192;

    console.log(`[ai] Sending prompt (${prompt.length} chars) to model: ${model}`);
    log("info", `Sending ${prompt.length} chars to ${model}`);

    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a writing style analyst. Your task is to analyze texts written by the same person and produce a comprehensive writing style profile in the exact Markdown format specified. Do not add commentary outside the requested format. Be precise and evidence-based in your analysis."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: maxTokens
        })
    }, RESPONSE_TIMEOUT_MS);

    if (!response.ok)
    {
        let errText;
        try
        {
            const reader = response.body.getReader();
            const chunks = [];
            let total = 0;
            while (true)
            {
                const { done, value } = await reader.read();
                if (done)
                {
                    break;
                }
                chunks.push(value);
                total += value.length;
                if (total > 1024)
                {
                    try { reader.cancel(); }
                    catch (_) {}
                    break;
                }
            }
            const buf = Buffer.concat(chunks).slice(0, 1024);
            errText = buf.toString("utf-8");
        }
        catch (_)
        {
            errText = "(could not read error body)";
        }
        log("error", `API error ${response.status}: ${errText}`);
        throw new Error(`AI API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message)
    {
        throw new Error("Unexpected AI API response structure.");
    }

    const content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason;
    log("info", `Response received: ${content.length} chars, finish_reason=${finishReason || "stop"}`);

    if (finishReason === "length")
    {
        log("warn", "Output was truncated (finish_reason=length). Consider increasing AI_MAX_TOKENS.");
        console.warn("[ai] Output was truncated (finish_reason=length). Consider increasing AI_MAX_TOKENS.");
    }

    return content;
}

async function listModels()
{
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();

    const response = await fetchWithTimeout(`${baseUrl}/models`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    }, CONNECT_TIMEOUT_MS);

    if (!response.ok)
    {
        let errText;
        try
        {
            errText = await response.text();
            errText = errText.slice(0, 300);
        }
        catch (_)
        {
            errText = "(could not read error body)";
        }
        throw new Error(`Models API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data))
    {
        throw new Error("Unexpected models API response structure.");
    }

    const excludePatterns = [
        "embedding", "moderation", "dall-e", "tts", "whisper",
        "audio", "babbage", "davinci", "instruct", "draft",
        "omni-moderation", "gpt-3.5-turbo-instruct"
    ];

    const chatModels = data.data
        .map((m) => m.id)
        .filter((id) =>
        {
            const lower = id.toLowerCase();
            for (const pat of excludePatterns)
            {
                if (lower.includes(pat))
                {
                    return false;
                }
            }
            return true;
        })
        .sort();

    if (chatModels.length === 0)
    {
        return data.data.map((m) => m.id).sort();
    }

    return chatModels;
}

async function analyzeWithBatching(allTexts, preferredLanguage, modelOverride)
{
    const model = modelOverride || process.env.AI_MODEL || "deepseek-chat";
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS) || 8192;
    const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 64000;
    const safetyMargin = Math.ceil(contextWindow * 0.15);
    const availableForInput = contextWindow - maxTokens - safetyMargin;

    const totalCount = allTexts.length;
    if (totalCount === 0)
    {
        throw new Error("No texts to analyze.");
    }

    const fullPrompt = buildPrompt(allTexts, preferredLanguage);
    const totalTokens = estimateTokens(fullPrompt);

    console.log(`[ai] Texts: ${totalCount}, total chars: ${allTexts.reduce((s, t) => s + t.content.length, 0)}, est tokens: ${totalTokens}, available: ${availableForInput}`);

    if (totalTokens <= availableForInput)
    {
        console.log("[ai] Strategy: single_pass");
        log("info", `Strategy: single_pass (${totalCount} sources, ~${totalTokens} tokens fit in ${availableForInput})`);
        const result = await analyzeStyle(fullPrompt, model);
        return { skillMd: result, strategy: "single_pass", batches: 1 };
    }

    console.log("[ai] Strategy: batched");
    log("info", `Strategy: batched — ${totalTokens} tokens exceeds ${availableForInput} limit, splitting sources`);

    const batches = [];
    let currentBatch = [];
    let currentTokens = 0;
    const basePromptLen = fullPrompt.length - allTexts.reduce((s, t) =>
    {
        const truncated = t.content.length > 15000 ? 15000 : t.content.length;
        return s + truncated + 50;
    }, 0);

    for (const text of allTexts)
    {
        const truncated = text.content.length > 15000
            ? text.content.slice(0, 15000)
            : text.content;
        const entryTokens = estimateTokens(truncated) + 20;
        const batchTokens = estimateTokens(buildPrompt([...currentBatch, text], preferredLanguage))
            - estimateTokens(buildPrompt(currentBatch, preferredLanguage));

        if (currentBatch.length > 0 && (currentTokens + entryTokens > availableForInput || currentBatch.length >= 5))
        {
            batches.push([...currentBatch]);
            currentBatch = [];
            currentTokens = 0;
        }

        currentBatch.push(text);
        currentTokens += entryTokens;
    }

    if (currentBatch.length > 0)
    {
        batches.push([...currentBatch]);
    }

    if (batches.length === 1)
    {
        const result = await analyzeStyle(fullPrompt, model);
        return { skillMd: result, strategy: "single_pass", batches: 1 };
    }

    console.log(`[ai] Split into ${batches.length} batches`);
    log("info", `Split into ${batches.length} batches`);

    const analyses = [];
    for (let i = 0; i < batches.length; i++)
    {
        console.log(`[ai] Processing batch ${i + 1}/${batches.length} (${batches[i].length} sources)`);
        log("info", `Batch ${i + 1}/${batches.length}: analyzing ${batches[i].length} sources (${batches[i].reduce((s, t) => s + t.content.length, 0)} chars)`);
        const batchPrompt = buildPrompt(batches[i], preferredLanguage);
        const analysis = await analyzeStyle(batchPrompt, model);
        analyses.push(analysis);
    }

    console.log("[ai] Merging batch results...");
    log("info", `Merging ${analyses.length} batch analyses into one Skill.md`);
    const mergePrompt = buildMergePrompt(analyses, totalCount, preferredLanguage);
    const merged = await analyzeStyle(mergePrompt, model);

    return { skillMd: merged, strategy: "batched", batches: batches.length };
}

module.exports = { analyzeStyle, listModels, analyzeWithBatching };
