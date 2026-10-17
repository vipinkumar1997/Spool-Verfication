// Spool Verification System — Zebra scanner friendly.
// Surbhi sticker: VPN$lotcode$datecode$qty   |   Manufacturing sticker: VPN
// All state is live in-memory on the server (no database); this file only renders API responses.

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const surbhiInput = $("surbhiSticker");
  const manufacturingInput = $("manufacturingSticker");
  const verifyBtn = $("verifyBtn");
  const surbhiStatus = $("surbhiStatus");
  const manufacturingStatus = $("manufacturingStatus");
  const resultDiv = $("result");
  const resultIcon = resultDiv.querySelector(".result-icon");
  const resultText = resultDiv.querySelector(".result-text");
  const recentScansDiv = $("recentScans");
  const historyList = $("historyList");
  const statsEl = {
    total: $("totalScans"),
    pass: $("passCount"),
    fail: $("failCount"),
  };

  let currentField = "surbhi";
  let verifying = false; // guard against double-submit while a request is in flight

  // ---------- validation (mirrors app/validation.py) ----------

  function validateSurbhiFormat(data) {
    if (!data || typeof data !== "string") return { valid: false, error: "Empty" };
    const parts = data.trim().split("$");
    if (parts.length !== 4) return { valid: false, error: "Invalid format" };
    if (parts.some((p) => p.trim() === "")) return { valid: false, error: "Empty part" };
    return { valid: true, vpn: parts[0].trim() };
  }

  function validateManufacturingFormat(data) {
    if (!data || typeof data !== "string") return { valid: false, error: "Empty" };
    const value = data.trim();
    if (!value) return { valid: false, error: "Empty" };
    if (value.includes("$")) return { valid: false, error: "Invalid format" };
    return { valid: true, vpn: value };
  }

  // ---------- safe DOM helpers (no innerHTML with server data → no XSS) ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function emptyState(message) {
    const box = el("div", "empty-state");
    box.appendChild(el("span", "empty-icon", "📭"));
    box.appendChild(el("p", undefined, message));
    return box;
  }

  function scanItem(item, tag) {
    const row = el(tag, "scan-item");
    const info = el("div", "scan-info");
    info.appendChild(el("span", "scan-vpn", item.vpn || "N/A"));
    info.appendChild(el("span", "scan-time", item.timestamp || ""));
    row.appendChild(info);
    row.appendChild(
      el(
        "span",
        `scan-result ${item.result === "PASS" ? "PASS" : "FAIL"}`,
        item.result === "PASS" ? "✅ PASS" : "❌ FAIL"
      )
    );
    return row;
  }

  // ---------- API ----------

  async function api(url, options = {}, timeout = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (data === null) throw new Error("invalid_response");
      return data; // 4xx bodies carry the failure detail we want to show
    } finally {
      clearTimeout(timer);
    }
  }

  function updateStats(stats) {
    if (!stats) return;
    statsEl.total.textContent = stats.total_scans ?? 0;
    statsEl.pass.textContent = stats.pass_count ?? 0;
    statsEl.fail.textContent = stats.fail_count ?? 0;
  }

  function renderRecent(scans) {
    recentScansDiv.replaceChildren();
    if (!Array.isArray(scans) || scans.length === 0) {
      recentScansDiv.appendChild(emptyState("No scans yet"));
      return;
    }
    for (const s of scans) recentScansDiv.appendChild(scanItem(s, "div"));
  }

  function renderHistory(items) {
    if (!historyList) return;
    historyList.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      historyList.appendChild(emptyState("No history yet"));
      return;
    }
    for (const it of items) historyList.appendChild(scanItem(it, "li"));
  }

  async function refreshAll() {
    try {
      const [stats, recent, history] = await Promise.all([
        api("/api/stats", {}, 2000),
        api("/api/recent-scans", {}, 2000),
        api("/api/history", {}, 2000),
      ]);
      updateStats(stats);
      renderRecent(recent);
      renderHistory(history);
    } catch (e) {
      console.error("refresh failed:", e);
    }
  }

  // ---------- UI flow ----------

  function setStatus(node, ok) {
    node.textContent = ok ? "✓" : "✗";
    node.className = `input-status ${ok ? "valid" : "invalid"}`;
  }

  function clearStatus(node) {
    node.textContent = "";
    node.className = "input-status";
  }

  function updateVerifyButton() {
    const ready =
      validateSurbhiFormat(surbhiInput.value).valid &&
      manufacturingInput.value.trim() !== "";
    verifyBtn.disabled = !ready || verifying;
  }

  function enableManufacturingAndFocus() {
    manufacturingInput.disabled = false;
    currentField = "manufacturing";
    manufacturingInput.focus();
  }

  function onSurbhiInput() {
    const ok = validateSurbhiFormat(surbhiInput.value).valid;
    setStatus(surbhiStatus, ok);
    if (!ok) manufacturingInput.disabled = true;
    updateVerifyButton();
  }

  function onManufacturingInput() {
    const ok = validateManufacturingFormat(manufacturingInput.value).valid;
    setStatus(manufacturingStatus, ok);
    updateVerifyButton();
    // Auto-verify when both stickers are valid (the `verifying` flag
    // prevents duplicate submissions from rapid scanner input).
    if (ok && validateSurbhiFormat(surbhiInput.value).valid && !verifyBtn.disabled) {
      verifyStickers();
    }
  }

  function onKeyDown(e) {
    // Zebra scanners emit Enter after each barcode.
    if (e.key !== "Enter" && e.key !== "Tab") return;
    e.preventDefault();
    if (currentField === "surbhi") {
      if (validateSurbhiFormat(surbhiInput.value).valid) enableManufacturingAndFocus();
    } else if (validateManufacturingFormat(manufacturingInput.value).valid) {
      verifyStickers();
    }
  }

  function showResult(type, message) {
    resultDiv.className = `result-display ${type}`;
    resultText.textContent = message;
    resultIcon.textContent = type === "success" ? "✅" : type === "error" ? "❌" : "👆";
  }

  function resetInputs() {
    surbhiInput.value = "";
    manufacturingInput.value = "";
    clearStatus(surbhiStatus);
    clearStatus(manufacturingStatus);
    manufacturingInput.disabled = true;
    currentField = "surbhi";
    verifying = false;
    verifyBtn.innerHTML = '<span class="btn-icon">⚡</span> Verify';
    updateVerifyButton();
    surbhiInput.focus();
  }

  async function verifyStickers() {
    if (verifying) return;
    verifying = true;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="btn-icon">⏳</span> Checking...';

    try {
      const result = await api(
        "/api/verify",
        {
          method: "POST",
          body: {
            surbhi: surbhiInput.value.trim(),
            manufacturing: manufacturingInput.value.trim(),
          },
        },
        5000
      );
      updateStats(result);
      if (result.success) {
        showResult("success", "✅ PASS");
      } else {
        showResult("error", `❌ ${result.message || "FAIL"}`);
      }
      // Refresh lists from the server (source of truth).
      const [recent, history] = await Promise.all([
        api("/api/recent-scans", {}, 2000),
        api("/api/history", {}, 2000),
      ]);
      renderRecent(recent);
      renderHistory(history);
    } catch (e) {
      showResult("error", "❌ Server unreachable — check connection");
    } finally {
      setTimeout(resetInputs, 400); // brief pause so the operator sees the result
    }
  }

  async function clearAll() {
    if (!confirm("Clear all scan data on the server?")) return;
    try {
      const stats = await api("/api/clear", { method: "POST" });
      updateStats(stats);
      renderRecent([]);
      renderHistory([]);
      showResult("waiting", "Scan Surbhi first");
      resetInputs();
    } catch (e) {
      showResult("error", "❌ Could not clear data");
    }
  }

  // ---------- wiring (single source of listeners; inline handlers removed) ----------

  surbhiInput.addEventListener("input", onSurbhiInput);
  manufacturingInput.addEventListener("input", onManufacturingInput);
  surbhiInput.addEventListener("keydown", onKeyDown);
  manufacturingInput.addEventListener("keydown", onKeyDown);
  verifyBtn.addEventListener("click", verifyStickers);
  $("clearBtn").addEventListener("click", clearAll);

  // ---------- init ----------
  refreshAll();
  showResult("waiting", "Scan Surbhi first");
  surbhiInput.focus();
})();
