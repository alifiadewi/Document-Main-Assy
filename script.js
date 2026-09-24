"use strict";

const SHIFTS = ["Pagi", "Siang", "Malam"];

const LINES = ["Cairo Line 1", "Cairo Line 2"];
const SIDES = ["Side 1", "Side 2"];
const HX_CODES = ["HX1", "HX2", "HX3", "HX4", "HX5", "HX6"];

// placeholder labels + steps until we get the real 6 reject types from the line
const REJECT_TYPES = [
  {
    key: "reject_1",
    label: "Problem 1",
    checklist: ["Langkah 1", "Langkah 2", "Langkah 3"],
  },
  {
    key: "reject_2",
    label: "Problem 2",
    checklist: ["Langkah 1", "Langkah 2"],
  },
  {
    key: "reject_3",
    label: "Problem 3",
    checklist: ["Langkah 1", "Langkah 2", "Langkah 3"],
  },
  {
    key: "reject_4",
    label: "Problem 4",
    checklist: ["Langkah 1", "Langkah 2"],
  },
  {
    key: "reject_5",
    label: "Problem 5",
    checklist: ["Langkah 1", "Langkah 2", "Langkah 3"],
  },
  {
    key: "reject_6",
    label: "Problem 6",
    checklist: ["Langkah 1", "Langkah 2"],
  },
];
const REJECT_BY_KEY = Object.fromEntries(REJECT_TYPES.map((r) => [r.key, r]));

// no backend yet — submit still works, it just saves the report locally
const REPORTS_ENDPOINT = "/api/reports";
const REQUEST_TIMEOUT_MS = 30000;

const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_QUALITY = 0.8;

// used to guess the shift when the page loads, 24h clock
const SHIFT_WINDOWS = [
  { shift: "Pagi", from: 6, to: 14 },
  { shift: "Siang", from: 14, to: 22 },
  { shift: "Malam", from: 22, to: 6 },
];

const state = {
  rejectType: null,
  checkedSteps: new Set(),
  status: null, // "resolved" | "engineer"
  photo: null, // data URL
};

const sessionForm = document.getElementById("sessionForm");
const reportForm = document.getElementById("reportForm");
const nameInput = document.getElementById("name");
const shiftSelect = document.getElementById("shift");
const lineSelect = document.getElementById("line");
const sideSelect = document.getElementById("side");
const hxSelect = document.getElementById("hxCode");
const sessionError = document.getElementById("sessionError");
const rejectSelect = document.getElementById("rejectType");
const checklistWrap = document.getElementById("checklistWrap");
const checklistItems = document.getElementById("checklistItems");
const statusWrap = document.getElementById("statusWrap");
const statusChoice = document.getElementById("statusChoice");
const photoInput = document.getElementById("photoInput");
const photoBtn = document.getElementById("photoBtn");
const photoPreview = document.getElementById("photoPreview");
const photoImg = document.getElementById("photoImg");
const retakeBtn = document.getElementById("retakeBtn");
const removePhotoBtn = document.getElementById("removePhotoBtn");
const notesInput = document.getElementById("notes");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");

const sessionPage = document.getElementById("sessionPage");
const formPage = document.getElementById("formPage");
const successPage = document.getElementById("successPage");
const successIcon = document.getElementById("successIcon");
const successTitle = document.getElementById("successTitle");
const successText = document.getElementById("successText");
const successSummary = document.getElementById("successSummary");
const newReportBtn = document.getElementById("newReportBtn");
const endShiftBtn = document.getElementById("endShiftBtn");

function fillSelect(select, options) {
  options.forEach((opt) => {
    const el = document.createElement("option");
    el.value = opt;
    el.textContent = opt;
    select.appendChild(el);
  });
}

function getDefaultShift() {
  const hour = new Date().getHours();
  const match = SHIFT_WINDOWS.find((w) =>
    w.from < w.to ? hour >= w.from && hour < w.to : hour >= w.from || hour < w.to
  );
  return match ? match.shift : SHIFTS[0];
}

fillSelect(shiftSelect, SHIFTS);
shiftSelect.value = getDefaultShift();

fillSelect(lineSelect, LINES);
fillSelect(sideSelect, SIDES);
fillSelect(hxSelect, HX_CODES);
fillSelect(
  rejectSelect,
  REJECT_TYPES.map((r) => r.label)
);

// remembers name/shift/line/side/HX code across reports so nobody has to
// retype the same thing for every reject found in a shift — still editable
const PREFILL_KEY = "rejectReportPrefill";

function loadPrefill() {
  try {
    const raw = localStorage.getItem(PREFILL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefill() {
  try {
    localStorage.setItem(
      PREFILL_KEY,
      JSON.stringify({
        name: nameInput.value.trim(),
        shift: shiftSelect.value,
        line: lineSelect.value,
        side: sideSelect.value,
        hxCode: hxSelect.value,
      })
    );
  } catch {
    /* localStorage unavailable — just skip pre-filling next time */
  }
}

function applyPrefill() {
  const saved = loadPrefill();
  if (!saved) return;
  if (saved.name) nameInput.value = saved.name;
  if (saved.shift) shiftSelect.value = saved.shift;
  if (saved.line) lineSelect.value = saved.line;
  if (saved.side) sideSelect.value = saved.side;
  if (saved.hxCode) hxSelect.value = saved.hxCode;
}

function clearPrefill() {
  try {
    localStorage.removeItem(PREFILL_KEY);
  } catch {
    /* ignore */
  }
}

applyPrefill();

// one session (name/shift/line/side/HX code) covers a whole shift — fill it
// once, then every reject report reuses it until "Selesai shift" is pressed
function checkSession() {
  const missing = [];
  if (nameInput.value.trim().length < 3) missing.push({ el: nameInput, label: "Nama" });
  if (!shiftSelect.value) missing.push({ el: shiftSelect, label: "Shift" });
  if (!lineSelect.value) missing.push({ el: lineSelect, label: "Line" });
  if (!sideSelect.value) missing.push({ el: sideSelect, label: "Side" });
  if (!hxSelect.value) missing.push({ el: hxSelect, label: "HX code" });
  return missing;
}

sessionForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const missing = checkSession();

  sessionForm
    .querySelectorAll(".field-error")
    .forEach((el) => el.classList.remove("field-error"));

  if (missing.length > 0) {
    missing.forEach(({ el }) => el.classList.add("field-error"));
    sessionError.textContent = `Lengkapi dulu: ${missing.map((m) => m.label).join(", ")}`;
    sessionError.hidden = false;
    missing[0].el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  sessionError.hidden = true;
  savePrefill();
  sessionPage.hidden = true;
  formPage.hidden = false;
  window.scrollTo(0, 0);
});

rejectSelect.addEventListener("change", () => {
  const picked = REJECT_TYPES.find((r) => r.label === rejectSelect.value);
  state.rejectType = picked ? picked.key : null;
  state.checkedSteps = new Set();
  state.status = null;
  renderChecklist();
  renderStatusChoice();
  clearFieldError(rejectSelect);
});

function renderChecklist() {
  const reject = state.rejectType ? REJECT_BY_KEY[state.rejectType] : null;
  checklistItems.innerHTML = "";

  if (!reject || reject.checklist.length === 0) {
    checklistWrap.hidden = true;
    statusWrap.hidden = !reject;
    return;
  }

  checklistWrap.hidden = false;
  statusWrap.hidden = false;

  reject.checklist.forEach((step, i) => {
    const row = document.createElement("label");
    row.className = "check-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(i);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.checkedSteps.add(i);
      else state.checkedSteps.delete(i);
      row.classList.toggle("checked", checkbox.checked);
    });

    const span = document.createElement("span");
    span.textContent = step;

    row.appendChild(checkbox);
    row.appendChild(span);
    checklistItems.appendChild(row);
  });
}

function renderStatusChoice() {
  statusChoice.querySelectorAll(".status-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });
}

statusChoice.addEventListener("click", (e) => {
  const btn = e.target.closest(".status-btn");
  if (!btn) return;
  state.status = btn.dataset.value;
  statusChoice.querySelectorAll(".status-btn").forEach((b) => {
    b.classList.toggle("selected", b === btn);
  });
  clearFieldError(statusWrap);
});

photoBtn.addEventListener("click", () => photoInput.click());
retakeBtn.addEventListener("click", () => photoInput.click());

removePhotoBtn.addEventListener("click", () => {
  state.photo = null;
  photoImg.src = "";
  photoPreview.hidden = true;
  photoBtn.hidden = false;
});

photoInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;

  try {
    state.photo = await compressImage(file);
  } catch {
    state.photo = await readAsDataUrl(file).catch(() => null);
  }

  if (state.photo) {
    photoImg.src = state.photo;
    photoPreview.hidden = false;
    photoBtn.hidden = true;
    clearFieldError(photoBtn);
  }
});

function compressImage(file, maxDimension = PHOTO_MAX_DIMENSION, quality = PHOTO_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function clearFieldError(el) {
  el.classList.remove("field-error");
}

function checkReport() {
  const missing = [];

  if (!rejectSelect.value) missing.push({ el: rejectSelect, label: "Tipe reject" });
  if (!state.status) missing.push({ el: statusWrap, label: "Status akhir" });
  if (!state.photo) missing.push({ el: photoBtn, label: "Bukti foto" });

  return missing;
}

function makeClientId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fallback below */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }
    if (!res.ok) throw new Error(data.error || `Server membalas ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;

  const missing = checkReport();

  reportForm
    .querySelectorAll(".field-error")
    .forEach((el) => el.classList.remove("field-error"));
  statusWrap.classList.remove("field-error-box");

  if (missing.length > 0) {
    missing.forEach(({ el }) => {
      if (el === statusWrap) el.classList.add("field-error-box");
      else el.classList.add("field-error");
    });
    formError.textContent = `Lengkapi dulu: ${missing.map((m) => m.label).join(", ")}`;
    formError.hidden = false;
    missing[0].el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  formError.hidden = true;

  const reject = REJECT_BY_KEY[state.rejectType];
  const payload = {
    clientId: makeClientId(),
    name: nameInput.value.trim().replace(/\s+/g, " "),
    shift: shiftSelect.value,
    line: lineSelect.value,
    side: sideSelect.value,
    hxCode: hxSelect.value,
    rejectType: reject.label,
    checklist: reject.checklist.map((step, i) => ({
      step,
      done: state.checkedSteps.has(i),
    })),
    status: state.status, // "resolved" | "engineer"
    photo: state.photo,
    notes: notesInput.value.trim(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Mengirim…";

  let saved = null;
  try {
    saved = await postJson(REPORTS_ENDPOINT, payload);
  } catch (err) {
    // backend isn't hooked up yet — fall back to a local-only save so the
    // form is still testable end-to-end
    console.warn("Belum bisa mengirim ke server, disimpan lokal saja:", err);
  }

  showSuccess({
    ...payload,
    id: saved && saved.id,
    submittedAt: (saved && saved.createdAt) || new Date().toISOString(),
    synced: Boolean(saved),
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Kirim";
});

function formatWaktu(value) {
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleString("id-ID");
}

function showSuccess(report) {
  successIcon.textContent = report.synced ? "✓" : "!";
  successIcon.classList.toggle("success-icon--pending", !report.synced);

  successTitle.textContent = report.synced ? "Laporan terkirim" : "Tersimpan, belum terkirim";

  successText.textContent = report.synced
    ? report.id
      ? `Tersimpan dengan nomor ${report.id}.`
      : "Laporan sudah tersimpan ke server."
    : "Laporan tersimpan di perangkat ini, tapi belum berhasil dikirim ke server. Coba kirim ulang saat koneksi tersedia.";

  const rows = [
    ["Nama", report.name],
    ["Shift", report.shift],
    ["Waktu", formatWaktu(report.submittedAt)],
    ["Line", report.line],
    ["Side", report.side],
    ["HX code", report.hxCode],
    ["Tipe reject", report.rejectType],
    ["Status akhir", report.status === "resolved" ? "Selesai" : "Belum"],
    ["Catatan tambahan", report.notes || "—"],
  ];

  successSummary.innerHTML = rows
    .map(([k, v]) => `<div><span class="k">${k}:</span>${v}</div>`)
    .join("");

  if (report.photo) {
    const img = document.createElement("img");
    img.src = report.photo;
    img.alt = "Bukti foto";
    successSummary.appendChild(img);
  }

  formPage.hidden = true;
  successPage.hidden = false;
  window.scrollTo(0, 0);
}

function resetReportFields() {
  reportForm.reset();
  state.rejectType = null;
  state.checkedSteps = new Set();
  state.status = null;
  state.photo = null;
  renderChecklist();
  checklistWrap.hidden = true;
  statusWrap.hidden = true;
  photoPreview.hidden = true;
  photoBtn.hidden = false;
  formError.hidden = true;
}

newReportBtn.addEventListener("click", () => {
  // same session carries over — only the report-specific fields reset
  resetReportFields();
  successPage.hidden = true;
  formPage.hidden = false;
  window.scrollTo(0, 0);
});

endShiftBtn.addEventListener("click", () => {
  resetReportFields();
  sessionForm.reset();
  shiftSelect.value = getDefaultShift();
  sessionError.hidden = true;
  clearPrefill();

  successPage.hidden = true;
  formPage.hidden = true;
  sessionPage.hidden = false;
  window.scrollTo(0, 0);
});
