/**
 * Submit.js
 * Film submission flow:
 *  1. Validate the form
 *  2. Open a payment popup with the correct fee for the chosen category
 *  3. Validate card fields (client-side only — wire up Stripe/Square for real charges)
 *  4. On "payment confirmed":
 *       a. Send admin notification → talibsmith77@gmail.com  (ADMIN_TEMPLATE_ID)
 *       b. Send filmmaker thank-you → submitter's email      (THANKYOU_TEMPLATE_ID)
 *  5. Log JSON to console, show success banner, reset form
 *
 * ── EmailJS setup (one-time) ────────────────────────────────────────────────
 *  1. https://www.emailjs.com → free account
 *  2. Add a Gmail service → copy Service ID
 *  3. Create TWO templates (see variable names below for placeholders)
 *  4. Account > API Keys → copy Public Key
 *  5. Fill in the four constants below
 * ──────────────────────────────────────────────────────────────────────────────
 */

const EMAILJS_SERVICE_ID = "service_k44zox9"; // e.g. "service_abc123"
const EMAILJS_PUBLIC_KEY = "EBdFHT24XpBpYf0Vc"; // e.g. "aB1cD2eF3gH4iJ5k"
const ADMIN_TEMPLATE_ID = "template_fuwyrtc"; // notifies talibsmith77@gmail.com
const THANKYOU_TEMPLATE_ID = "template_uoshei6"; // goes to the filmmaker

// ─── Fee schedule ─────────────────────────────────────────────────────────────

const FEE_SCHEDULE = {
  "feature-film": { label: "Feature Film (50 min+)", fee: 25 },
  "feature-documentary": { label: "Feature Documentary (50 min+)", fee: 25 },
  "narrative-short": { label: "Narrative Short Film (20 min or less)", fee: 15 },
  "documentary-short": { label: "Documentary Short (20 min or less)", fee: 15 },
  "student-film": { label: "Student Film / Documentary (10 min or less)", fee: 10 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reads all named form fields into a plain object.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function extractFormData(form) {
  const raw = new FormData(form);
  const data = {};
  for (const [key, value] of raw.entries()) {
    data[key] = typeof value === "string" ? value.trim() : value;
  }
  return data;
}

/**
 * Validates the main film submission fields.
 * Returns an array of human-readable error strings (empty = valid).
 * @param {Object} data
 * @returns {string[]}
 */
function validateFormData(data) {
  const errors = [];
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const urlRx = /^https?:\/\/.+/i;
  const duration = Number(data["film-duration"]);

  if (!data["filmmaker-name"]) errors.push("Filmmaker name is required.");
  if (!emailRx.test(data["email"])) errors.push("A valid email address is required.");
  if (!data["film-title"]) errors.push("Film title is required.");
  if (!data["film-description"]) errors.push("Film description is required.");
  if (!data["film-category"]) errors.push("Please select a film category.");
  if (!data["film-duration"] || isNaN(duration) || duration < 1) errors.push("Duration must be a positive number.");
  if (!data["submission-date"]) errors.push("Submission date is required.");
  if (!data["film-link"] || !urlRx.test(data["film-link"]))
    errors.push("Film link must be a valid URL (http:// or https://).");

  return errors;
}

/**
 * Validates card fields inside the payment modal (UI-only).
 * Real charge processing requires a server-side integration (Stripe, Square, etc.).
 * @returns {string[]}
 */
function validateCardFields() {
  const errors = [];
  const name = document.getElementById("card-name").value.trim();
  const number = document.getElementById("card-number").value.replace(/\s/g, "");
  const expiry = document.getElementById("card-expiry").value.trim();
  const cvv = document.getElementById("card-cvv").value.trim();

  if (!name) errors.push("Name on card is required.");
  if (!/^\d{13,19}$/.test(number)) errors.push("Enter a valid card number.");
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) errors.push("Enter expiry as MM / YY.");
  if (!/^\d{3,4}$/.test(cvv)) errors.push("Enter a valid CVV (3–4 digits).");

  return errors;
}

/**
 * Displays an inline status banner appended to a container element.
 * @param {HTMLElement} container
 * @param {"success"|"error"} type
 * @param {string} message
 */
function showStatusMessage(container, type, message) {
  const existing = container.querySelector(".status-message");
  if (existing) existing.remove();

  const el = document.createElement("p");
  el.className = `status-message status-${type}`;
  el.textContent = message;
  Object.assign(el.style, {
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    fontWeight: "600",
    background: type === "success" ? "#d4edda" : "#f8d7da",
    color: type === "success" ? "#155724" : "#721c24",
  });
  container.appendChild(el);
}

// ─── Email senders ────────────────────────────────────────────────────────────

/**
 * Sends the admin notification to talibsmith77@gmail.com.
 *
 * Required EmailJS template variables:
 *   {{to_email}}, {{filmmaker_name}}, {{email}}, {{phone}},
 *   {{film_title}}, {{film_category}}, {{film_description}},
 *   {{film_duration}}, {{submission_date}}, {{film_link}}, {{fee_paid}}
 *
 * @param {Object} data
 * @param {number} fee
 * @returns {Promise}
 */
function sendAdminEmail(data, fee) {
  return emailjs.send(EMAILJS_SERVICE_ID, ADMIN_TEMPLATE_ID, {
    to_email: "talibsmith77@gmail.com",
    filmmaker_name: data["filmmaker-name"],
    email: data["email"],
    phone: data["phone"] || "Not provided",
    film_title: data["film-title"],
    film_category: FEE_SCHEDULE[data["film-category"]].label,
    film_description: data["film-description"],
    film_duration: data["film-duration"] + " min",
    submission_date: data["submission-date"],
    film_link: data["film-link"],
    fee_paid: `$${fee}.00`,
  });
}

/**
 * Sends a thank-you confirmation to the filmmaker.
 *
 * Required EmailJS template variables:
 *   {{to_email}}, {{filmmaker_name}}, {{film_title}},
 *   {{film_category}}, {{fee_paid}}
 *
 * @param {Object} data
 * @param {number} fee
 * @returns {Promise}
 */
function sendThankYouEmail(data, fee) {
  return emailjs.send(EMAILJS_SERVICE_ID, THANKYOU_TEMPLATE_ID, {
    to_email: data["email"],
    filmmaker_name: data["filmmaker-name"],
    film_title: data["film-title"],
    film_category: FEE_SCHEDULE[data["film-category"]].label,
    fee_paid: `$${fee}.00`,
  });
}

// ─── Payment modal helpers ────────────────────────────────────────────────────

/** Thin wrappers so we never repeat getElementById strings. */
const modal = {
  overlay: () => document.getElementById("payment-overlay"),
  closeBtn: () => document.getElementById("modal-close-btn"),
  categoryLabel: () => document.getElementById("modal-category-label"),
  feeDisplay: () => document.getElementById("modal-fee"),
  payBtnAmount: () => document.getElementById("pay-btn-amount"),
  payBtn: () => document.getElementById("pay-btn"),
  errorEl: () => document.getElementById("payment-error"),
};

/**
 * Opens the payment modal, populating it for the selected film category.
 * @param {string} categoryKey
 */
function openPaymentModal(categoryKey) {
  const { label, fee } = FEE_SCHEDULE[categoryKey];

  modal.categoryLabel().textContent = label;
  modal.feeDisplay().textContent = `$${fee}.00`;
  modal.payBtnAmount().textContent = `$${fee}.00`;
  modal.errorEl().hidden = true;

  ["card-name", "card-number", "card-expiry", "card-cvv"].forEach((id) => {
    document.getElementById(id).value = "";
  });

  modal.overlay().hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("card-name").focus();
}

/** Closes the payment modal and restores page scrolling. */
function closePaymentModal() {
  modal.overlay().hidden = true;
  document.body.style.overflow = "";
}

/**
 * Shows an error message inside the payment modal.
 * @param {string} message
 */
function showModalError(message) {
  const el = modal.errorEl();
  el.textContent = message;
  el.hidden = false;
}

// ─── Card input auto-formatting ───────────────────────────────────────────────

function formatCardNumber(e) {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
  e.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(e) {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
  e.target.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

function formatCVV(e) {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
}

// ─── Form submit handler ──────────────────────────────────────────────────────

/** Holds validated form data while the user completes payment. */
let pendingFormData = null;

/**
 * Handles the main form submission event.
 * Validates fields, then opens the payment modal.
 * @param {SubmitEvent} event
 */
function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const container = form.closest(".container") || form;
  const formData = extractFormData(form);
  const errors = validateFormData(formData);

  if (errors.length > 0) {
    console.warn("Validation failed:", errors);
    showStatusMessage(container, "error", errors.join(" "));
    return;
  }

  // Clear any previous status banner before the modal opens
  const existing = container.querySelector(".status-message");
  if (existing) existing.remove();

  pendingFormData = formData;
  openPaymentModal(formData["film-category"]);
}

// ─── Pay button handler ───────────────────────────────────────────────────────

/**
 * Handles the "Pay & Submit" click inside the payment modal.
 * Validates card fields, sends both emails, then finalises submission.
 */
async function handlePayment() {
  if (!pendingFormData) return;

  const cardErrors = validateCardFields();
  if (cardErrors.length > 0) {
    showModalError(cardErrors.join(" "));
    return;
  }

  const payBtn = modal.payBtn();
  payBtn.disabled = true;
  payBtn.textContent = "Processing…";
  modal.errorEl().hidden = true;

  const { fee } = FEE_SCHEDULE[pendingFormData["film-category"]];

  try {
    // ── Integrate Stripe / Square here to charge the card before sending emails ──

    // Fire both emails concurrently for speed
    await Promise.all([sendAdminEmail(pendingFormData, fee), sendThankYouEmail(pendingFormData, fee)]);

    // Console JSON output
    console.log(
      "Film submission successful ✓\n",
      JSON.stringify({ ...pendingFormData, fee_paid: `$${fee}.00` }, null, 2),
    );
    console.log("Admin notification sent → talibsmith77@gmail.com");
    console.log("Thank-you email sent    →", pendingFormData["email"]);

    closePaymentModal();

    const form = document.getElementById("submit-film-form");
    const container = form.closest(".container") || form;
    showStatusMessage(
      container,
      "success",
      "🎉 Your film has been submitted! Check your inbox for a confirmation email.",
    );
    form.reset();
    pendingFormData = null;
  } catch (error) {
    console.error("Submission error — email send failed:", error);
    showModalError("Something went wrong sending the confirmation. Please contact us directly.");
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = `Pay $${fee}.00 & Submit`;
  }
}

// ─── Initialise ───────────────────────────────────────────────────────────────

function init() {
  // Dynamically load EmailJS SDK
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  script.onload = () => {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    console.log("EmailJS ready.");
  };
  script.onerror = () => {
    console.error("Failed to load EmailJS SDK — check your connection.");
  };
  document.head.appendChild(script);

  // Main form → open payment modal
  const form = document.getElementById("submit-film-form");
  if (!form) {
    console.error("submit-film-form not found in the DOM.");
    return;
  }
  form.addEventListener("submit", handleFormSubmit);

  // Pay button inside modal
  modal.payBtn()?.addEventListener("click", handlePayment);

  // Close via X button
  modal.closeBtn()?.addEventListener("click", closePaymentModal);

  // Close when clicking the dark backdrop
  modal.overlay().addEventListener("click", (e) => {
    if (e.target === modal.overlay()) closePaymentModal();
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.overlay().hidden) closePaymentModal();
  });

  // Card field auto-formatting
  document.getElementById("card-number").addEventListener("input", formatCardNumber);
  document.getElementById("card-expiry").addEventListener("input", formatExpiry);
  document.getElementById("card-cvv").addEventListener("input", formatCVV);
}

document.addEventListener("DOMContentLoaded", init);
