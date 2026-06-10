"use strict";

/* ---------- before/after slider ---------- */
function initSlider(root) {
  const beforeWrap = root.querySelector(".ba-before-wrap");
  const beforeImg = root.querySelector(".ba-before");
  const handle = root.querySelector(".ba-handle");

  function sizeBefore() {
    beforeImg.style.width = root.clientWidth + "px";
  }
  function setPct(pct) {
    pct = Math.max(2, Math.min(98, pct));
    beforeWrap.style.width = pct + "%";
    handle.style.left = pct + "%";
  }
  function pctFromEvent(e) {
    const rect = root.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  }

  let dragging = false;
  root.addEventListener("pointerdown", (e) => {
    dragging = true;
    root.setPointerCapture(e.pointerId);
    setPct(pctFromEvent(e));
  });
  root.addEventListener("pointermove", (e) => dragging && setPct(pctFromEvent(e)));
  root.addEventListener("pointerup", () => (dragging = false));
  root.addEventListener("pointercancel", () => (dragging = false));

  new ResizeObserver(sizeBefore).observe(root);
  root.querySelectorAll("img").forEach((img) => img.addEventListener("load", sizeBefore));
  sizeBefore();
  setPct(50);
}

/* ---------- elements ---------- */
const el = (id) => document.getElementById(id);
const panels = {
  upload: el("panel-upload"),
  processing: el("panel-processing"),
  result: el("panel-result"),
};
const dropzone = el("dropzone");
const fileInput = el("file-input");
const toolError = el("tool-error");
const statusLine = el("processing-status");

let currentJob = null;

function showPanel(name) {
  Object.entries(panels).forEach(([key, node]) => node.classList.toggle("hidden", key !== name));
  toolError.classList.add("hidden");
}

function fail(message) {
  showPanel("upload");
  toolError.textContent = message;
  toolError.classList.remove("hidden");
}

/* ---------- upload ---------- */
const MAX_EDGE = 2400;

function fileToJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like an image we can read."));
    };
    img.src = url;
  });
}

const STATUS_LINES = [
  "Analyzing the damage…",
  "Mending scratches and creases…",
  "Recovering faded detail…",
  "Bringing back the color…",
  "Polishing the final result…",
];
let statusTimer = null;
function startStatusLoop() {
  let i = 0;
  statusLine.textContent = STATUS_LINES[0];
  statusTimer = setInterval(() => {
    i = (i + 1) % STATUS_LINES.length;
    statusLine.textContent = STATUS_LINES[i];
  }, 2200);
}
function stopStatusLoop() {
  clearInterval(statusTimer);
}

async function handleFile(file) {
  if (!file) return;
  showPanel("processing");
  startStatusLoop();
  try {
    const image = await fileToJpegDataUrl(file);
    const res = await fetch("/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Restoration failed. Please try again.");
    currentJob = data;
    renderResult(data);
  } catch (err) {
    fail(err.message || "Something went wrong. Please try again.");
  } finally {
    stopStatusLoop();
  }
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

/* ---------- result + unlock ---------- */
function renderResult(job) {
  el("result-before").src = job.beforePreview;
  el("result-after").src = job.preview;
  el("result-chip").textContent = "Watermarked preview";
  el("result-chip").classList.remove("chip-unlocked");
  el("result-title").textContent = "Your restoration is ready";
  el("unlock-box").classList.remove("hidden");
  el("done-actions").classList.add("hidden");
  el("unlock-error").classList.add("hidden");

  const actions = el("unlock-actions");
  actions.innerHTML = "";
  const licenseForm = el("license-form");

  if (job.checkout) {
    if (job.checkout.single) {
      actions.appendChild(buyButton(job.checkout.single, "Unlock this photo — $9", true));
    }
    if (job.checkout.pack) {
      actions.appendChild(buyButton(job.checkout.pack, "Five photos — $19", false));
    }
    const haveKey = document.createElement("button");
    haveKey.type = "button";
    haveKey.className = "license-link";
    haveKey.textContent = "Already have a license key?";
    haveKey.addEventListener("click", () => {
      licenseForm.classList.remove("hidden");
      el("license-input").focus();
    });
    actions.appendChild(haveKey);
    licenseForm.classList.add("hidden");
  } else {
    const demoBtn = document.createElement("button");
    demoBtn.type = "button";
    demoBtn.className = "btn btn-primary";
    demoBtn.textContent = "Unlock full resolution (free in demo mode)";
    demoBtn.addEventListener("click", () => unlock(demoBtn, null));
    actions.appendChild(demoBtn);
    licenseForm.classList.add("hidden");
  }

  showPanel("result");
  initSlider(el("result-slider"));
}

function buyButton(url, label, primary) {
  const a = document.createElement("a");
  a.className = primary ? "btn btn-primary" : "btn btn-ghost";
  a.textContent = label;
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

async function unlock(button, licenseKey) {
  const errBox = el("unlock-error");
  errBox.classList.add("hidden");
  if (button) button.disabled = true;
  try {
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentJob.id, licenseKey }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unlock failed.");

    el("result-after").src = data.resultUrl;
    el("result-chip").textContent = "Unlocked — full resolution";
    el("result-chip").classList.add("chip-unlocked");
    el("result-title").textContent = "All yours";
    el("unlock-box").classList.add("hidden");
    el("done-actions").classList.remove("hidden");
    el("download-btn").href = data.resultUrl + "&download=1";
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove("hidden");
  } finally {
    if (button) button.disabled = false;
  }
}

el("license-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const key = el("license-input").value.trim();
  if (key) unlock(e.submitter, key);
});

el("restart-btn").addEventListener("click", () => {
  currentJob = null;
  fileInput.value = "";
  showPanel("upload");
});

/* ---------- boot ---------- */
initSlider(el("hero-slider"));
showPanel("upload");
