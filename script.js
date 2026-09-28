"use strict";


// ==========================================================
// 1. APPLICATION DATA
// ==========================================================

const SHIFTS = [
  "Pagi",
  "Siang",
  "Malam",
];

const LINES = [
  "Cairo Line 1",
  "Cairo Line 2",
];

const SIDES = [
  "Side 1",
  "Side 2",
];

const HX_CODES = [
  "HX1",
  "HX2",
  "HX3",
  "HX4",
  "HX5",
  "HX6",
];


// Replace these placeholders later with the real reject types.
const REJECT_TYPES = [
  {
    key: "reject_1",
    label: "Problem 1",
    checklist: [
      "Langkah 1",
      "Langkah 2",
      "Langkah 3",
    ],
  },

  {
    key: "reject_2",
    label: "Problem 2",
    checklist: [
      "Langkah 1",
      "Langkah 2",
    ],
  },

  {
    key: "reject_3",
    label: "Problem 3",
    checklist: [
      "Langkah 1",
      "Langkah 2",
      "Langkah 3",
    ],
  },

  {
    key: "reject_4",
    label: "Problem 4",
    checklist: [
      "Langkah 1",
      "Langkah 2",
    ],
  },

  {
    key: "reject_5",
    label: "Problem 5",
    checklist: [
      "Langkah 1",
      "Langkah 2",
      "Langkah 3",
    ],
  },

  {
    key: "reject_6",
    label: "Problem 6",
    checklist: [
      "Langkah 1",
      "Langkah 2",
    ],
  },
];


const API_URL = "/api/reports";

const SESSION_STORAGE_KEY = "rejectReportSession";

const PHOTO_MAX_SIZE = 1600;
const PHOTO_QUALITY = 0.8;


// ==========================================================
// 2. APPLICATION STATE
// ==========================================================
//
// In Python, you can think of this like:
//
// state = {
//     "reject_key": "",
//     "checked_steps": set(),
//     "status": "",
//     "photo": None,
// }
//

const state = {
  rejectKey: "",
  checkedSteps: new Set(),
  status: "",
  photo: null,
};


// ==========================================================
// 3. GET HTML ELEMENTS
// ==========================================================

// Pages
const sessionPage = document.getElementById("sessionPage");
const formPage = document.getElementById("formPage");
const successPage = document.getElementById("successPage");


// Session form
const sessionForm = document.getElementById("sessionForm");

const nameInput = document.getElementById("name");
const shiftSelect = document.getElementById("shift");
const lineSelect = document.getElementById("line");
const sideSelect = document.getElementById("side");
const hxCodeSelect = document.getElementById("hxCode");

const sessionError = document.getElementById("sessionError");


// Report form
const reportForm = document.getElementById("reportForm");

const rejectSelect = document.getElementById("rejectType");

const checklistWrap = document.getElementById("checklistWrap");
const checklistItems = document.getElementById("checklistItems");

const statusWrap = document.getElementById("statusWrap");
const statusButtons = document.querySelectorAll(".status-btn");

const photoInput = document.getElementById("photoInput");
const photoButton = document.getElementById("photoBtn");
const photoPreview = document.getElementById("photoPreview");
const photoImage = document.getElementById("photoImg");

const retakeButton = document.getElementById("retakeBtn");
const removePhotoButton = document.getElementById("removePhotoBtn");

const notesInput = document.getElementById("notes");

const formError = document.getElementById("formError");
const submitButton = document.getElementById("submitBtn");


// Success page
const successIcon = document.getElementById("successIcon");
const successTitle = document.getElementById("successTitle");
const successText = document.getElementById("successText");
const successSummary = document.getElementById("successSummary");

const newReportButton = document.getElementById("newReportBtn");
const endShiftButton = document.getElementById("endShiftBtn");


// ==========================================================
// 4. START APPLICATION
// ==========================================================

function startApp() {
  fillSimpleSelect(shiftSelect, SHIFTS);
  fillSimpleSelect(lineSelect, LINES);
  fillSimpleSelect(sideSelect, SIDES);
  fillSimpleSelect(hxCodeSelect, HX_CODES);

  fillRejectSelect();

  loadSession();

  // If no saved shift exists, guess the shift from the current time.
  if (!shiftSelect.value) {
    shiftSelect.value = getDefaultShift();
  }
}


startApp();


// ==========================================================
// 5. SELECT HELPERS
// ==========================================================

function fillSimpleSelect(selectElement, values) {
  values.forEach(function (value) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    selectElement.appendChild(option);
  });
}


function fillRejectSelect() {
  REJECT_TYPES.forEach(function (reject) {
    const option = document.createElement("option");

    // The value is the key, not the visible label.
    option.value = reject.key;
    option.textContent = reject.label;

    rejectSelect.appendChild(option);
  });
}


// ==========================================================
// 6. SHIFT
// ==========================================================

function getDefaultShift() {
  const currentHour = new Date().getHours();

  if (currentHour >= 6 && currentHour < 14) {
    return "Pagi";
  }

  if (currentHour >= 14 && currentHour < 22) {
    return "Siang";
  }

  return "Malam";
}


// ==========================================================
// 7. SAVE / LOAD OPERATOR SESSION
// ==========================================================

function saveSession() {
  const sessionData = {
    name: nameInput.value.trim(),
    shift: shiftSelect.value,
    line: lineSelect.value,
    side: sideSelect.value,
    hxCode: hxCodeSelect.value,
  };

  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessionData)
    );
  } catch (error) {
    console.warn("Session tidak bisa disimpan:", error);
  }
}


function loadSession() {
  try {
    const savedText = localStorage.getItem(
      SESSION_STORAGE_KEY
    );

    if (!savedText) {
      return;
    }

    const savedSession = JSON.parse(savedText);

    nameInput.value = savedSession.name || "";
    shiftSelect.value = savedSession.shift || "";
    lineSelect.value = savedSession.line || "";
    sideSelect.value = savedSession.side || "";
    hxCodeSelect.value = savedSession.hxCode || "";

  } catch (error) {
    console.warn("Session tidak bisa dibaca:", error);
  }
}


function clearSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Session tidak bisa dihapus:", error);
  }
}


// ==========================================================
// 8. PAGE NAVIGATION
// ==========================================================

function showPage(pageToShow) {
  sessionPage.hidden = pageToShow !== sessionPage;
  formPage.hidden = pageToShow !== formPage;
  successPage.hidden = pageToShow !== successPage;

  window.scrollTo(0, 0);
}


// ==========================================================
// 9. SESSION FORM
// ==========================================================

sessionForm.addEventListener("submit", function (event) {
  event.preventDefault();

  clearFormErrors(sessionForm, sessionError);

  const missingFields = getMissingSessionFields();

  if (missingFields.length > 0) {
    showMissingFields(sessionError, missingFields);
    return;
  }

  saveSession();

  showPage(formPage);
});


function getMissingSessionFields() {
  const missing = [];

  if (nameInput.value.trim().length < 3) {
    missing.push({
      element: nameInput,
      label: "Nama",
    });
  }

  if (!shiftSelect.value) {
    missing.push({
      element: shiftSelect,
      label: "Shift",
    });
  }

  if (!lineSelect.value) {
    missing.push({
      element: lineSelect,
      label: "Line",
    });
  }

  if (!sideSelect.value) {
    missing.push({
      element: sideSelect,
      label: "Side",
    });
  }

  if (!hxCodeSelect.value) {
    missing.push({
      element: hxCodeSelect,
      label: "HX code",
    });
  }

  return missing;
}


// ==========================================================
// 10. REJECT TYPE
// ==========================================================

rejectSelect.addEventListener("change", function () {
  state.rejectKey = rejectSelect.value;

  // Changing reject type means the previous checklist/status
  // should no longer be used.
  state.checkedSteps.clear();
  state.status = "";

  renderChecklist();
  updateStatusButtons();

  rejectSelect.classList.remove("field-error");
});


function getSelectedReject() {
  return REJECT_TYPES.find(function (reject) {
    return reject.key === state.rejectKey;
  });
}


// ==========================================================
// 11. CHECKLIST
// ==========================================================

function renderChecklist() {
  // Remove the previous checklist.
  checklistItems.replaceChildren();

  const reject = getSelectedReject();

  if (!reject) {
    checklistWrap.hidden = true;
    statusWrap.hidden = true;
    return;
  }

  statusWrap.hidden = false;

  if (reject.checklist.length === 0) {
    checklistWrap.hidden = true;
    return;
  }

  checklistWrap.hidden = false;


  reject.checklist.forEach(function (step, index) {

    const row = document.createElement("label");
    row.className = "check-row";


    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";


    const text = document.createElement("span");
    text.textContent = step;


    checkbox.addEventListener("change", function () {

      if (checkbox.checked) {
        state.checkedSteps.add(index);
      } else {
        state.checkedSteps.delete(index);
      }

      row.classList.toggle(
        "checked",
        checkbox.checked
      );
    });


    row.appendChild(checkbox);
    row.appendChild(text);

    checklistItems.appendChild(row);
  });
}


// ==========================================================
// 12. FINAL STATUS
// ==========================================================

statusButtons.forEach(function (button) {

  button.addEventListener("click", function () {

    state.status = button.dataset.value;

    updateStatusButtons();

    statusWrap.classList.remove(
      "field-error-box"
    );
  });

});


function updateStatusButtons() {
  statusButtons.forEach(function (button) {

    const isSelected =
      button.dataset.value === state.status;

    button.classList.toggle(
      "selected",
      isSelected
    );
  });
}


// ==========================================================
// 13. PHOTO
// ==========================================================

photoButton.addEventListener("click", function () {
  photoInput.click();
});


retakeButton.addEventListener("click", function () {
  photoInput.click();
});


removePhotoButton.addEventListener("click", function () {
  state.photo = null;

  photoImage.src = "";

  photoPreview.hidden = true;
  photoButton.hidden = false;
});


photoInput.addEventListener(
  "change",
  async function (event) {

    const file = event.target.files[0];

    if (!file) {
      return;
    }

    try {

      state.photo = await compressImage(file);

    } catch (error) {

      console.warn(
        "Kompresi gagal. Menggunakan foto asli.",
        error
      );

      state.photo = await readFileAsDataUrl(file);
    }


    photoImage.src = state.photo;

    photoPreview.hidden = false;
    photoButton.hidden = true;

    photoButton.classList.remove("field-error");


    // Allows selecting the same file again.
    photoInput.value = "";
  }
);


// ==========================================================
// 14. IMAGE COMPRESSION
// ==========================================================
//
// Browser camera photos can be very large.
// This function resizes the image before sending it.
//

function compressImage(file) {

  return new Promise(function (resolve, reject) {

    const reader = new FileReader();


    reader.onerror = function () {
      reject(reader.error);
    };


    reader.onload = function () {

      const image = new Image();


      image.onerror = function () {
        reject(
          new Error("Gambar tidak bisa dibaca.")
        );
      };


      image.onload = function () {

        let width = image.width;
        let height = image.height;


        // Resize while keeping the same aspect ratio.
        if (
          width > PHOTO_MAX_SIZE ||
          height > PHOTO_MAX_SIZE
        ) {

          if (width > height) {

            height = Math.round(
              height * PHOTO_MAX_SIZE / width
            );

            width = PHOTO_MAX_SIZE;

          } else {

            width = Math.round(
              width * PHOTO_MAX_SIZE / height
            );

            height = PHOTO_MAX_SIZE;
          }
        }


        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;


        const context =
          canvas.getContext("2d");

        if (!context) {
          reject(
            new Error("Canvas tidak tersedia.")
          );
          return;
        }


        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );


        const compressedImage =
          canvas.toDataURL(
            "image/jpeg",
            PHOTO_QUALITY
          );


        resolve(compressedImage);
      };


      image.src = reader.result;
    };


    reader.readAsDataURL(file);
  });
}


function readFileAsDataUrl(file) {

  return new Promise(function (resolve, reject) {

    const reader = new FileReader();

    reader.onerror = function () {
      reject(reader.error);
    };

    reader.onload = function () {
      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}


// ==========================================================
// 15. REPORT VALIDATION
// ==========================================================

function getMissingReportFields() {
  const missing = [];

  if (!state.rejectKey) {
    missing.push({
      element: rejectSelect,
      label: "Tipe reject",
    });
  }

  if (!state.status) {
    missing.push({
      element: statusWrap,
      label: "Status akhir",
      boxError: true,
    });
  }

  if (!state.photo) {
    missing.push({
      element: photoButton,
      label: "Bukti foto",
    });
  }

  return missing;
}


// ==========================================================
// 16. SUBMIT REPORT
// ==========================================================

reportForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();


    if (submitButton.disabled) {
      return;
    }


    clearFormErrors(reportForm, formError);

    statusWrap.classList.remove(
      "field-error-box"
    );


    const missingFields =
      getMissingReportFields();


    if (missingFields.length > 0) {

      showMissingFields(
        formError,
        missingFields
      );

      return;
    }


    const reject = getSelectedReject();


    const report = {

      clientId: createClientId(),

      name: nameInput.value
        .trim()
        .replace(/\s+/g, " "),

      shift: shiftSelect.value,
      line: lineSelect.value,
      side: sideSelect.value,
      hxCode: hxCodeSelect.value,

      rejectType: reject.label,

      checklist: reject.checklist.map(
        function (step, index) {

          return {
            step: step,
            done: state.checkedSteps.has(index),
          };

        }
      ),

      status: state.status,

      photo: state.photo,

      notes: notesInput.value.trim(),
    };


    submitButton.disabled = true;
    submitButton.textContent = "Mengirim…";


    let serverResult = null;
    let synced = false;


    try {

      serverResult =
        await sendReportToServer(report);

      synced = true;

    } catch (error) {

      console.error(
        "Laporan gagal dikirim:",
        error
      );
    }


    const reportResult = {

      ...report,

      id:
        serverResult?.id || null,

      submittedAt:
        serverResult?.createdAt ||
        new Date().toISOString(),

      synced: synced,
    };


    showSuccess(reportResult);


    submitButton.disabled = false;
    submitButton.textContent = "Kirim";
  }
);


// ==========================================================
// 17. API
// ==========================================================

async function sendReportToServer(report) {

  const response = await fetch(
    API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(report),
    }
  );


  let responseData = {};


  try {
    responseData = await response.json();
  } catch {
    // The server may return an empty response.
  }


  if (!response.ok) {

    const errorMessage =
      responseData.error ||
      `Server error: ${response.status}`;

    throw new Error(errorMessage);
  }


  return responseData;
}


// ==========================================================
// 18. CLIENT ID
// ==========================================================

function createClientId() {

  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }


  // Fallback for older browsers.
  return (
    Date.now() +
    "-" +
    Math.random().toString(16).slice(2)
  );
}


// ==========================================================
// 19. SUCCESS PAGE
// ==========================================================

function showSuccess(report) {

  if (report.synced) {

    successIcon.textContent = "✓";

    successIcon.classList.remove(
      "success-icon--pending"
    );

    successTitle.textContent =
      "Laporan terkirim";


    if (report.id) {

      successText.textContent =
        `Tersimpan dengan nomor ${report.id}.`;

    } else {

      successText.textContent =
        "Laporan sudah tersimpan ke server.";
    }

  } else {

    successIcon.textContent = "!";

    successIcon.classList.add(
      "success-icon--pending"
    );

    successTitle.textContent =
      "Laporan belum terkirim";

    successText.textContent =
      "Server belum bisa menerima laporan. " +
      "Data ini belum disimpan permanen.";
  }


  renderSuccessSummary(report);

  showPage(successPage);
}


// ==========================================================
// 20. SUCCESS SUMMARY
// ==========================================================

function renderSuccessSummary(report) {

  // Remove the previous report.
  successSummary.replaceChildren();


  addSummaryRow(
    "Nama",
    report.name
  );

  addSummaryRow(
    "Shift",
    report.shift
  );

  addSummaryRow(
    "Waktu",
    formatTime(report.submittedAt)
  );

  addSummaryRow(
    "Line",
    report.line
  );

  addSummaryRow(
    "Side",
    report.side
  );

  addSummaryRow(
    "HX code",
    report.hxCode
  );

  addSummaryRow(
    "Tipe reject",
    report.rejectType
  );

  addSummaryRow(
    "Status akhir",
    report.status === "resolved"
      ? "Selesai"
      : "Belum"
  );

  addSummaryRow(
    "Catatan tambahan",
    report.notes || "—"
  );


  if (report.photo) {

    const image =
      document.createElement("img");

    image.src = report.photo;
    image.alt = "Bukti foto";

    successSummary.appendChild(image);
  }
}


function addSummaryRow(label, value) {

  const row =
    document.createElement("div");

  const labelElement =
    document.createElement("span");


  labelElement.className = "summary-label";

  labelElement.textContent =
    `${label}: `;


  row.appendChild(labelElement);

  row.appendChild(
    document.createTextNode(
      String(value)
    )
  );


  successSummary.appendChild(row);
}


// ==========================================================
// 21. TIME FORMAT
// ==========================================================

function formatTime(value) {

  const date = new Date(value);


  if (Number.isNaN(date.getTime())) {
    return value;
  }


  return date.toLocaleString("id-ID");
}


// ==========================================================
// 22. VALIDATION HELPERS
// ==========================================================

function showMissingFields(
  errorElement,
  missingFields
) {

  const fieldNames =
    missingFields.map(function (field) {
      return field.label;
    });


  errorElement.textContent =
    "Lengkapi dulu: " +
    fieldNames.join(", ");


  errorElement.hidden = false;


  missingFields.forEach(function (field) {

    if (field.boxError) {

      field.element.classList.add(
        "field-error-box"
      );

    } else {

      field.element.classList.add(
        "field-error"
      );
    }

  });


  missingFields[0].element.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}


function clearFormErrors(
  form,
  errorElement
) {

  const errorFields =
    form.querySelectorAll(".field-error");


  errorFields.forEach(function (element) {
    element.classList.remove(
      "field-error"
    );
  });


  errorElement.hidden = true;
}


// ==========================================================
// 23. RESET REPORT
// ==========================================================

function resetReport() {

  reportForm.reset();


  state.rejectKey = "";
  state.checkedSteps.clear();
  state.status = "";
  state.photo = null;


  checklistItems.replaceChildren();

  checklistWrap.hidden = true;
  statusWrap.hidden = true;


  updateStatusButtons();


  photoImage.src = "";

  photoPreview.hidden = true;
  photoButton.hidden = false;


  formError.hidden = true;

  statusWrap.classList.remove(
    "field-error-box"
  );
}


// ==========================================================
// 24. NEW REPORT
// ==========================================================

newReportButton.addEventListener(
  "click",
  function () {

    resetReport();

    showPage(formPage);
  }
);


// ==========================================================
// 25. END SHIFT
// ==========================================================

endShiftButton.addEventListener(
  "click",
  function () {

    resetReport();

    sessionForm.reset();

    clearSession();


    shiftSelect.value =
      getDefaultShift();


    sessionError.hidden = true;


    showPage(sessionPage);
  }
);
