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
        throw new Error(`AI API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message)
    {
        throw new Error("Unexpected AI API response structure.");
    }

    const finishReason = data.choices[0].finish_reason;
    if (finishReason === "length")
    {
        console.warn("[ai] Output was truncated (finish_reason=length). Consider increasing AI_MAX_TOKENS.");
    }

    return data.choices[0].message.content;
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

module.exports = { analyzeStyle, listModels };
