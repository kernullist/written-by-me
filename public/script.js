(function ()
{
    "use strict";

    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const browseBtn = document.getElementById("browseBtn");
    const fileList = document.getElementById("fileList");
    const fileCount = document.getElementById("fileCount");
    const uploadStatus = document.getElementById("uploadStatus");
    const pasteArea = document.getElementById("pasteArea");
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
    pasteArea.addEventListener("input", () =>
    {
        const len = pasteArea.value.length;
        pasteCharCount.textContent = len + " char" + (len !== 1 ? "s" : "");
        updateAnalyzeButton();
    });

    /* ===== Analyze Button ===== */
    function updateAnalyzeButton()
    {
        const hasFiles = uploadedFiles.length > 0;
        const hasPaste = pasteArea.value.trim().length > 0;

        analyzeBtn.disabled = !(hasFiles || hasPaste);
    }

    analyzeBtn.addEventListener("click", runAnalysis);

    async function runAnalysis()
    {
        const hasFiles = uploadedFiles.length > 0;
        const pastedText = pasteArea.value.trim();

        if (!hasFiles && !pastedText)
        {
            return;
        }

        analyzeBtn.disabled = true;
        btnLabel.textContent = "Analyzing...";
        btnSpinner.classList.remove("hidden");
        resultZone.classList.add("hidden");
        uploadStatus.textContent = "";
        uploadStatus.className = "upload-status";

        const body = {
            fileIds: uploadedFiles.map((f) => f.id),
            pastedText: pastedText,
            model: selectedModel
        };

        try
        {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);

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

            resultStatus.textContent = "Ready";
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
                showToast("Analysis timed out after 3 minutes. Try with less content.", "error");
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
        pasteArea.value = "";
        pasteCharCount.textContent = "0 chars";
        renderFileList();
        updateAnalyzeButton();
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

    /* ===== Initial State ===== */
    updateAnalyzeButton();
})();
