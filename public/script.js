(function ()
{
    "use strict";

    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.getElementById("browseBtn");
    const fileList = document.getElementById("fileList");
    const fileCount = document.getElementById("fileCount");
    const uploadStatus = document.getElementById("uploadStatus");
    const pasteEntries = document.getElementById("pasteEntries");
    const addPasteBtn = document.getElementById("addPasteBtn");
    const pasteCharCount = document.getElementById("pasteCharCount");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const btnSpinner = document.getElementById("btnSpinner");
    const btnLabel = analyzeBtn.querySelector(".btn-label");
    const resultZone = document.getElementById("resultZone");
    const resultStatus = document.getElementById("resultStatus");
    const skillPreview = document.getElementById("skillPreview");
    const downloadBtn = document.getElementById("downloadBtn");
    const copyBtn = document.getElementById("copyBtn");
    const newAnalysisBtn = document.getElementById("newAnalysisBtn");
    const toast = document.getElementById("toast");
    const footerConfig = document.getElementById("footerConfig");
    const modelSelect = document.getElementById("modelSelect");
    const modelStatus = document.getElementById("modelStatus");

    let uploadedFiles = [];
    let analysisResult = null;
    let analysisId = null;
    let selectedModel = null;

    /* ===== Model Selector & Footer ===== */
    fetch("/api/config")
        .then((r) => r.json())
        .then((cfg) =>
        {
            footerConfig.textContent = "Model: " + (cfg.model || "deepseek-chat");

            if (cfg.models && cfg.models.length > 0)
            {
                modelSelect.innerHTML = "";
                for (const m of cfg.models)
                {
                    const opt = document.createElement("option");
                    opt.value = m;
                    opt.textContent = m;
                    if (m === cfg.model)
                    {
                        opt.selected = true;
                    }
                    modelSelect.appendChild(opt);
                }
                selectedModel = modelSelect.value;
                if (modelStatus)
                {
                    modelStatus.textContent = cfg.models.length + " models";
                    modelStatus.classList.remove("hidden");
                }
            }
            else
            {
                modelSelect.innerHTML = `<option value="${cfg.model}">${cfg.model}</option>`;
                selectedModel = cfg.model;
                if (modelStatus)
                {
                    modelStatus.textContent = "default";
                    modelStatus.classList.remove("hidden");
                }
            }

            modelSelect.addEventListener("change", () =>
            {
                selectedModel = modelSelect.value;
                footerConfig.textContent = "Model: " + (selectedModel || cfg.model);
                if (modelStatus)
                {
                    modelStatus.textContent = selectedModel;
                }
            });
        })
        .catch(() =>
        {
            footerConfig.textContent = "Model: deepseek-chat";
            modelSelect.innerHTML = '<option value="deepseek-chat">deepseek-chat</option>';
            selectedModel = "deepseek-chat";
        });

    /* ===== File Upload ===== */
    browseBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () =>
    {
        if (fileInput.files.length > 0)
        {
            handleNewFiles(fileInput.files);
            fileInput.value = "";
        }
    });

    dropZone.addEventListener("dragover", (e) =>
    {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () =>
    {
        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) =>
    {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0)
        {
            handleNewFiles(e.dataTransfer.files);
        }
    });

    dropZone.addEventListener("click", (e) =>
    {
        if (!browseBtn.contains(e.target))
        {
            fileInput.click();
        }
    });

    async function handleNewFiles(fileListRaw)
    {
        const formData = new FormData();
        let fileCount_ = 0;

        for (const file of fileListRaw)
        {
            const ext = file.name.split(".").pop().toLowerCase();
            const allowed = ["txt","md","csv","log","cpp","c","h","hpp","cs","java","py","js","ts","jsx","tsx","rs","go","rb","php","swift","kt","html","css","scss","json","xml","yaml","yml","docx","pdf"];

            if (!allowed.includes(ext))
            {
                showToast("Skipped unsupported file: " + file.name, "error");
                continue;
            }

            if (uploadedFiles.length + fileCount_ >= 10)
            {
                showToast("Maximum 10 files allowed.", "error");
                break;
            }

            formData.append("files", file);
            fileCount_++;
        }

        if (fileCount_ === 0)
        {
            return;
        }

        uploadStatus.textContent = "Uploading " + fileCount_ + " file(s)...";
        uploadStatus.className = "upload-status";

        try
        {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok || !data.ok)
            {
                throw new Error(data.error || "Upload failed.");
            }

            for (const f of data.files)
            {
                uploadedFiles.push(f);
            }

            uploadStatus.textContent = fileCount_ + " file(s) uploaded successfully.";
            uploadStatus.className = "upload-status upload-ok";
        }
        catch (err)
        {
            uploadStatus.textContent = "Error: " + err.message;
            uploadStatus.className = "upload-status upload-error";
            showToast(err.message, "error");
        }

        renderFileList();
        updateAnalyzeButton();
    }

    function renderFileList()
    {
        fileList.innerHTML = "";
        fileCount.textContent = uploadedFiles.length + " file" + (uploadedFiles.length !== 1 ? "s" : "");

        for (let i = 0; i < uploadedFiles.length; i++)
        {
            const f = uploadedFiles[i];
            const chip = document.createElement("div");
            chip.className = "file-chip";

            const nameSpan = document.createElement("span");
            nameSpan.className = "file-chip-name";
            nameSpan.textContent = f.name;
            nameSpan.title = f.name;

            const sizeSpan = document.createElement("span");
            sizeSpan.className = "file-chip-size";
            sizeSpan.textContent = formatSize(f.size);

            const removeSpan = document.createElement("span");
            removeSpan.className = "file-chip-remove";
            removeSpan.textContent = "\u00d7";
            removeSpan.title = "Remove";
            removeSpan.addEventListener("click", () =>
            {
                uploadedFiles.splice(i, 1);
                renderFileList();
                updateAnalyzeButton();
            });

            chip.appendChild(nameSpan);
            chip.appendChild(sizeSpan);
            chip.appendChild(removeSpan);
            fileList.appendChild(chip);
        }
    }

    function formatSize(bytes)
    {
        if (bytes < 1024)
        {
            return bytes + " B";
        }
        if (bytes < 1024 * 1024)
        {
            return (bytes / 1024).toFixed(1) + " KB";
        }
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    /* ===== Paste Area ===== */

    let pasteEntryCounter = 1;

    addPasteBtn.addEventListener("click", () =>
    {
        const entry = document.createElement("div");
        entry.className = "paste-entry";
        entry.dataset.idx = pasteEntryCounter;

        const title = document.createElement("input");
        title.type = "text";
        title.className = "paste-title";
        title.placeholder = "Title (e.g. email, blog post, notes)";

        const textarea = document.createElement("textarea");
        textarea.className = "paste-area";
        textarea.placeholder = "Paste any text here...";
        textarea.addEventListener("input", updatePasteStats);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "paste-remove-btn";
        removeBtn.textContent = "\u00d7";
        removeBtn.title = "Remove";
        removeBtn.addEventListener("click", () =>
        {
            entry.remove();
            updatePasteStats();
            updateRemoveButtons();
        });

        entry.appendChild(title);
        entry.appendChild(textarea);
        entry.appendChild(removeBtn);
        pasteEntries.appendChild(entry);

        pasteEntryCounter++;
        updateRemoveButtons();
    });

    function updateRemoveButtons()
    {
        const entries = pasteEntries.querySelectorAll(".paste-entry");
        for (const entry of entries)
        {
            const btn = entry.querySelector(".paste-remove-btn");
            if (entries.length > 1)
            {
                btn.classList.remove("hidden");
            }
            else
            {
                btn.classList.add("hidden");
            }
        }
    }

    function updatePasteStats()
    {
        let total = 0;
        const areas = pasteEntries.querySelectorAll(".paste-area");
        for (const area of areas)
        {
            total += area.value.length;
        }
        pasteCharCount.textContent = total + " char" + (total !== 1 ? "s" : "");
        updateAnalyzeButton();
    }

    pasteEntries.querySelector(".paste-area").addEventListener("input", updatePasteStats);
    updateRemoveButtons();

    /* ===== Analyze Button ===== */
    function updateAnalyzeButton()
    {
        const hasFiles = uploadedFiles.length > 0;
        let hasPaste = false;
        const areas = pasteEntries.querySelectorAll(".paste-area");
        for (const area of areas)
        {
            if (area.value.trim().length > 0)
            {
                hasPaste = true;
                break;
            }
        }

        analyzeBtn.disabled = !(hasFiles || hasPaste);
    }

    analyzeBtn.addEventListener("click", runAnalysis);

    async function runAnalysis()
    {
        let hasPaste = false;
        const areas = pasteEntries.querySelectorAll(".paste-area");
        for (const area of areas)
        {
            if (area.value.trim().length > 0)
            {
                hasPaste = true;
                break;
            }
        }
        const hasFiles = uploadedFiles.length > 0;

        if (!hasFiles && !hasPaste)
        {
            return;
        }

        analyzeBtn.disabled = true;
        btnLabel.textContent = "Analyzing...";
        btnSpinner.classList.remove("hidden");
        resultZone.classList.add("hidden");
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";

        const pasteTexts = [];
        const entries = pasteEntries.querySelectorAll(".paste-entry");
        for (const entry of entries)
        {
            const title = entry.querySelector(".paste-title");
            const textarea = entry.querySelector(".paste-area");
            const text = textarea.value.trim();
            if (text.length > 0)
            {
                pasteTexts.push({
                    source: title.value.trim() || "pasted-text-" + pasteTexts.length,
                    content: text
                });
            }
        }

        const body = {
            fileIds: uploadedFiles.map((f) => f.id),
            pasteTexts: pasteTexts,
            model: selectedModel
        };

        try
        {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 310000);

            const res = await fetch("/api/analyze-with-paste", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await res.json();

            if (!res.ok || !data.ok)
            {
                throw new Error(data.error || "Analysis failed.");
            }

            analysisResult = data.analysis.skillMd;
            analysisId = data.analysisId;
            const currentAnalysisId = data.analysisId;

            if (data.warning)
            {
                showToast(data.warning, "error");
            }

            const strategyLabel = data.strategy === "batched"
                ? ` (${data.batches} batches merged)`
                : "";
            resultStatus.textContent = "Ready" + strategyLabel;
            resultStatus.className = "badge badge-success";
            skillPreview.textContent = analysisResult;
            resultZone.classList.remove("hidden");

            downloadBtn.onclick = async () =>
            {
                try
                {
                    const dlRes = await fetch("/api/download/" + currentAnalysisId);
                    if (!dlRes.ok)
                    {
                        showToast("Download failed: file may have expired.", "error");
                        return;
                    }
                    const blob = await dlRes.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "Skill.md";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
                catch (_)
                {
                    showToast("Download failed. Please try again.", "error");
                }
            };

            showToast("Analysis complete! Your Skill.md is ready.", "success");
            resultZone.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        catch (err)
        {
            if (err.name === "AbortError")
            {
                showToast("Analysis timed out (5 min limit). Try fewer files or a faster model.", "error");
            }
            else
            {
                showToast(err.message, "error");
            }
        }
        finally
        {
            btnLabel.textContent = "Analyze My Style";
            btnSpinner.classList.add("hidden");
            analyzeBtn.disabled = false;
        }
    }

    /* ===== Copy Button ===== */
    copyBtn.addEventListener("click", () =>
    {
        if (!analysisResult)
        {
            return;
        }

        navigator.clipboard.writeText(analysisResult).then(() =>
        {
            showToast("Copied to clipboard!", "success");
        }).catch(() =>
        {
            const ta = document.createElement("textarea");
            ta.value = analysisResult;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast("Copied to clipboard!", "success");
        });
    });

    /* ===== New Analysis Button ===== */
    newAnalysisBtn.addEventListener("click", () =>
    {
        uploadedFiles = [];
        analysisResult = null;
        analysisId = null;

        pasteEntries.innerHTML = "";
        const entry = document.createElement("div");
        entry.className = "paste-entry";
        entry.dataset.idx = "0";
        const title = document.createElement("input");
        title.type = "text";
        title.className = "paste-title";
        title.placeholder = "Title (e.g. email, blog post, notes)";
        const textarea = document.createElement("textarea");
        textarea.className = "paste-area";
        textarea.placeholder = "Paste any text here...";
        textarea.addEventListener("input", updatePasteStats);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "paste-remove-btn hidden";
        removeBtn.textContent = "\u00d7";
        removeBtn.title = "Remove";
        removeBtn.addEventListener("click", () =>
        {
            entry.remove();
            updatePasteStats();
            updateRemoveButtons();
        });
        entry.appendChild(title);
        entry.appendChild(textarea);
        entry.appendChild(removeBtn);
        pasteEntries.appendChild(entry);

        pasteEntryCounter = 1;
        pasteCharCount.textContent = "0 chars";
        renderFileList();
        updateAnalyzeButton();
        updateRemoveButtons();
        resultZone.classList.add("hidden");
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";
        window.scrollTo({ top: 0, behavior: "smooth" });

        fetch("/api/clear", { method: "POST" }).catch(() => {});
    });

    /* ===== Toast ===== */
    let toastTimer = null;

    function showToast(message, type)
    {
        if (toastTimer)
        {
            clearTimeout(toastTimer);
        }

        toast.textContent = message;
        toast.className = "toast toast-" + type;
        toast.classList.remove("hidden");

        toastTimer = setTimeout(() =>
        {
            toast.classList.add("hidden");
            toastTimer = null;
        }, 3500);
    }

    /* ===== Activity Log (SSE) ===== */
    const logEntries = document.getElementById("logEntries");
    const logClearBtn = document.getElementById("logClearBtn");

    logClearBtn.addEventListener("click", () =>
    {
        logEntries.innerHTML = '<div class="log-entry log-placeholder">Cleared.</div>';
        setTimeout(() =>
        {
            const placeholder = logEntries.querySelector(".log-placeholder");
            if (placeholder)
            {
                placeholder.textContent = "Waiting for activity...";
            }
        }, 2000);
    });

    function formatLogTime(ts)
    {
        const d = new Date(ts);
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        const s = String(d.getSeconds()).padStart(2, "0");
        return h + ":" + m + ":" + s;
    }

    function appendLogEntry(entry)
    {
        const placeholder = logEntries.querySelector(".log-placeholder");
        if (placeholder)
        {
            placeholder.remove();
        }

        const div = document.createElement("div");
        div.className = "log-entry";

        const timeSpan = document.createElement("span");
        timeSpan.className = "log-time";
        timeSpan.textContent = formatLogTime(entry.ts);

        const typeSpan = document.createElement("span");
        typeSpan.className = "log-type log-type-" + (entry.type || "info");
        typeSpan.textContent = entry.type || "info";

        const msgSpan = document.createElement("span");
        msgSpan.className = "log-msg";
        msgSpan.textContent = entry.message;

        div.appendChild(timeSpan);
        div.appendChild(typeSpan);
        div.appendChild(msgSpan);
        logEntries.appendChild(div);

        logEntries.scrollTop = logEntries.scrollHeight;
    }

    try
    {
        const evtSource = new EventSource("/api/logs/stream");
        evtSource.onmessage = (e) =>
        {
            try
            {
                const entry = JSON.parse(e.data);
                appendLogEntry(entry);
            }
            catch (_)
            {
            }
        };
        evtSource.onerror = () =>
        {
        };
    }
    catch (_)
    {
    }

    /* ===== Initial State ===== */
    updateAnalyzeButton();
})();
