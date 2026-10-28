// ===== CONFIGURATION =====
const APP_PIN = "7251"; // <-- PIN to lock the app
const DEFAULT_COUNTRY_CODE = "91"; // For India. Set to "" to disable.

// App State
let WHATSAPP_MESSAGE = "Hello, I am Atmoratech Pvt Ltd";
let EMAIL_SUBJECT = "Business Inquiry – Atmoratech Pvt Ltd";
let EMAIL_BODY = "Hello,\n\nI am reaching out from Atmoratech Pvt Ltd.\n\nBest regards";
let stream = null;
let lastProcessedDataUrl = null;

// DOM Elements
const pinScreen = document.getElementById("pinScreen");
const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const pinError = document.getElementById("pinError");
const mainApp = document.getElementById("mainApp");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const messageInput = document.getElementById("messageInput");
const emailSubjectInput = document.getElementById("emailSubjectInput");
const emailBodyInput = document.getElementById("emailBodyInput");
const saveSettings = document.getElementById("saveSettings");
const closeSettings = document.getElementById("closeSettings");

const mainControls = document.getElementById("mainControls");
const startCameraBtn = document.getElementById("startCameraBtn");
const fileInput = document.getElementById("fileInput");
const debugBtn = document.getElementById("debugBtn");

const cameraContainer = document.getElementById("cameraContainer");
const video = document.getElementById("video");
const captureBtn = document.getElementById("captureBtn");
const cancelCameraBtn = document.getElementById("cancelCameraBtn");

const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const result = document.getElementById("result");
const numbersEl = document.getElementById("numbers");
const emailsEl = document.getElementById("emails");
const emailHeading = document.getElementById("emailHeading");
const rawTextEl = document.getElementById("rawText");
const retakeContainer = document.getElementById("retakeContainer");
const retakeBtn = document.getElementById("retakeBtn");

// ==========================================
// 1. LOCK SCREEN & SETTINGS LOGIC
// ==========================================

if (sessionStorage.getItem("app_unlocked") === "true") {
  unlockApp();
}

pinSubmit.addEventListener("click", checkPin);
pinInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") checkPin();
});

function checkPin() {
  if (pinInput.value === APP_PIN) {
    sessionStorage.setItem("app_unlocked", "true");
    unlockApp();
  } else {
    pinError.classList.remove("hidden");
    pinInput.value = "";
  }
}

function unlockApp() {
  pinScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");

  const savedMsg = localStorage.getItem("wa_message");
  if (savedMsg) WHATSAPP_MESSAGE = savedMsg;

  const savedSub = localStorage.getItem("email_subject");
  if (savedSub) EMAIL_SUBJECT = savedSub;

  const savedBody = localStorage.getItem("email_body");
  if (savedBody) EMAIL_BODY = savedBody;

  messageInput.value = WHATSAPP_MESSAGE;
  emailSubjectInput.value = EMAIL_SUBJECT;
  emailBodyInput.value = EMAIL_BODY;
}

// Settings Logic
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

saveSettings.addEventListener("click", () => {
  WHATSAPP_MESSAGE = messageInput.value.trim() || "Hello";
  localStorage.setItem("wa_message", WHATSAPP_MESSAGE);

  EMAIL_SUBJECT = emailSubjectInput.value.trim();
  localStorage.setItem("email_subject", EMAIL_SUBJECT);

  EMAIL_BODY = emailBodyInput.value;
  localStorage.setItem("email_body", EMAIL_BODY);

  settingsPanel.classList.add("hidden");
  alert("Settings saved successfully!");
});

closeSettings.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
  messageInput.value = WHATSAPP_MESSAGE;
  emailSubjectInput.value = EMAIL_SUBJECT;
  emailBodyInput.value = EMAIL_BODY;
});

// ==========================================
// 2. IMAGE PREPROCESSING & OCR LOGIC
// ==========================================

function setStatus(text) {
  status.textContent = text;
  status.classList.remove("hidden");
}
function hideStatus() { status.classList.add("hidden"); }

function preprocessImage(imageSource) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MIN_WIDTH = 1600;
      const scale = Math.max(1, MIN_WIDTH / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (g < min) min = g;
        if (g > max) max = g;
      }
      const range = Math.max(1, max - min);

      for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        let v = ((g - min) / range) * 255;
        v = v < 100 ? 0 : v > 180 ? 255 : v;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(c);
    };
    img.src = imageSource;
  });
}

// Extract phone numbers
function extractPhoneNumbers(text) {
  if (!text) return [];
  const normalized = text.replace(/\r/g, "\n").replace(/[–—−]/g, "-");
  const chunkRegex = /(?:\+?\d[\d\s().\-]{6,20}\d)/g;
  const rawCandidates = normalized.match(chunkRegex) || [];
  const results = [];

  for (const raw of rawCandidates) {
    let digits = raw.replace(/\D/g, "");
    if (digits.length < 8) continue;

    if (digits.length > 15) {
      if (digits.length > 18) continue;
      digits = digits.slice(-13);
    }

    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.substring(1);
    }

    const hadPlus = /^\s*\+/.test(raw) || /^\s*00/.test(raw);
    let formatted = hadPlus ? "+" + digits : digits;

    if (DEFAULT_COUNTRY_CODE && !formatted.startsWith("+") && digits.length === 10) {
      formatted = "+" + DEFAULT_COUNTRY_CODE + digits;
    }

    const key = formatted.replace(/\D/g, "");
    if (!results.find((r) => r.replace(/\D/g, "") === key)) {
      results.push(formatted);
    }
  }
  return results;
}

// Extract emails (handles common OCR misreads)
function extractEmails(text) {
  if (!text) return [];
  // Clean common OCR mistakes around emails
  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    // common misreads inside email-only segments
    .replace(/\[at\]/gi, "@")
    .replace(/\(at\)/gi, "@")
    .replace(/\[dot\]/gi, ".")
    .replace(/\(dot\)/gi, ".");

  const emailRegex = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;
  const matches = cleaned.match(emailRegex) || [];

  const results = [];
  for (let m of matches) {
    let email = m.trim().replace(/[.,;:]+$/, "").toLowerCase();

    // Fix "gmail.com" being read as "gmall.com" etc.
    email = email
      .replace(/@gmai1\.com$/, "@gmail.com")
      .replace(/@gma1l\.com$/, "@gmail.com")
      .replace(/@gmai\.com$/, "@gmail.com")
      .replace(/@gmail\.corn$/, "@gmail.com")
      .replace(/@yahoo\.corn$/, "@yahoo.com")
      .replace(/@outlook\.corn$/, "@outlook.com")
      .replace(/@hotmail\.corn$/, "@hotmail.com");

    // Basic sanity check: TLD should be letters
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email)) continue;
    // Reject obvious garbage (very short local part)
    if (email.split("@")[0].length < 2) continue;

    if (!results.includes(email)) results.push(email);
  }
  return results;
}

// WhatsApp Link
function openWhatsApp(number) {
  let digits = number.replace(/\D/g, "");
  if (DEFAULT_COUNTRY_CODE && !number.startsWith("+") && digits.length === 10) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  window.open(url, "_blank");
}

// Email Link (opens default mail app / Gmail / Outlook)
function openEmail(email) {
  const subject = EMAIL_SUBJECT || "";
  const body = EMAIL_BODY || "";
  const url =
    `mailto:${encodeURIComponent(email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  // Using window.location for mailto is more reliable on mobile
  // (window.open often blocked). Fall back to open if needed.
  window.location.href = url;
}

// ==========================================
// 3. PROCESSING & UI
// ==========================================

async function processImage(imageSource) {
  hideStatus();
  result.classList.add("hidden");
  preview.classList.add("hidden");
  mainControls.classList.add("hidden");
  setStatus("🔍 Preparing image...");

  try {
    const processedCanvas = await preprocessImage(imageSource);
    lastProcessedDataUrl = processedCanvas.toDataURL("image/png");

    setStatus("🔍 Reading card... 0%");
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setStatus(`🔍 Reading card... ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(processedCanvas);
    await worker.terminate();

    hideStatus();
    const text = data.text || "";
    rawTextEl.textContent = text || "(no text detected)";

    const numbers = extractPhoneNumbers(text);
    const emails = extractEmails(text);

    // ---- Render phone numbers ----
    numbersEl.innerHTML = "";
    if (numbers.length === 0) {
      const div = document.createElement("div");
      div.className = "no-numbers";
      div.innerHTML = "No phone numbers found.<br><small>Try a sharper photo.</small>";
      numbersEl.appendChild(div);
    } else {
      numbers.forEach((num) => {
        const card = document.createElement("div");
        card.className = "number-card";
        card.innerHTML = `<span class="number-text">${num}</span><span class="wa-icon">💬</span>`;
        card.addEventListener("click", () => {
          document.querySelectorAll(".number-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          openWhatsApp(num);
        });
        numbersEl.appendChild(card);
      });
    }

    // ---- Render emails ----
    emailsEl.innerHTML = "";
    if (emails.length === 0) {
      emailHeading.classList.add("hidden");
    } else {
      emailHeading.classList.remove("hidden");
      emails.forEach((email) => {
        const card = document.createElement("div");
        card.className = "number-card email-card";
        card.innerHTML = `<span class="number-text">${email}</span><span class="wa-icon">✉️</span>`;
        card.addEventListener("click", () => {
          document.querySelectorAll(".email-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          openEmail(email);
        });
        emailsEl.appendChild(card);
      });
    }

    result.classList.remove("hidden");
    retakeContainer.classList.remove("hidden");
    debugBtn.hidden = text.trim().length > 30;
  } catch (err) {
    console.error(err);
    setStatus("❌ OCR failed: " + err.message);
    mainControls.classList.remove("hidden");
  }
}

// ==========================================
// 4. CAMERA & FILE UPLOAD
// ==========================================

startCameraBtn.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    video.srcObject = stream;

    mainControls.classList.add("hidden");
    cameraContainer.classList.remove("hidden");
    preview.classList.add("hidden");
  } catch (err) {
    alert("Camera error: " + err.message);
  }
});

captureBtn.addEventListener("click", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  stopCamera();
  preview.src = canvas.toDataURL("image/png");
  preview.classList.remove("hidden");
  processImage(canvas.toDataURL("image/png"));
});

cancelCameraBtn.addEventListener("click", () => {
  stopCamera();
  mainControls.classList.remove("hidden");
  cameraContainer.classList.add("hidden");
});

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  cameraContainer.classList.add("hidden");
}

// File Upload
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    preview.src = ev.target.result;
    preview.classList.remove("hidden");
    processImage(ev.target.result);
  };
  reader.readAsDataURL(file);
});

// Retake Button
retakeBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  preview.classList.add("hidden");
  mainControls.classList.remove("hidden");
  fileInput.value = "";
});

// Debug
debugBtn.addEventListener("click", () => {
  if (!lastProcessedDataUrl) return;
  const existing = document.querySelector(".debug-img");
  if (existing) existing.remove();
  const img = document.createElement("img");
  img.src = lastProcessedDataUrl;
  img.className = "debug-img";
  result.appendChild(img);
});

// Toggle raw text
rawTextEl.addEventListener("click", () => {
  rawTextEl.style.display = rawTextEl.style.display === "none" ? "block" : "none";
});
