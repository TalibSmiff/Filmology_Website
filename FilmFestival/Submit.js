/**
 * Submit.js
 * Handles film submission form: validation, JSON output,
 * console logging, error handling, and email notification via EmailJS.
 *
 * SETUP REQUIRED (one-time):
 *  1. Create a free account at https://www.emailjs.com
 *  2. Add an Email Service (Gmail recommended) — copy your Service ID
 *  3. Create an Email Template — copy your Template ID
 *  4. Copy your Public Key from Account > API Keys
 *  5. Replace the three placeholder strings below with your real values
 */

const EMAILJS_SERVICE_ID = "service_k44zox9"; // e.g. "service_abc123"
const EMAILJS_TEMPLATE_ID = "template_fuwyrtc"; // e.g. "template_xyz789"
const EMAILJS_PUBLIC_KEY = "EBdFHT24XpBpYf0Vc"; // e.g. "aB1cD2eF3gH4iJ5k"

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Reads every named input/textarea/select in the form and returns a plain object.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function extractFormData(form) {
  const raw = new FormData(form);
  const data = {};
  for (const [key, value] of raw.entries()) {
    data[key] = value.trim();
  }
  return data;
}

/**
 * Basic field-level validation beyond what the browser already enforces.
 * Returns an array of human-readable error strings (empty = valid).
 * @param {Object} data
 * @returns {string[]}
 */
function validateFormData(data) {
  const errors = [];

  if (!data["filmmaker-name"]) {
    errors.push("Filmmaker name is required.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data["email"])) {
    errors.push("A valid email address is required.");
  }

  if (!data["film-title"]) {
    errors.push("Film title is required.");
  }

  if (!data["film-description"]) {
    errors.push("Film description is required.");
  }

  const duration = Number(data["film-duration"]);
  if (!data["film-duration"] || isNaN(duration) || duration < 1) {
    errors.push("Duration must be a positive number.");
  }

  if (!data["submission-date"]) {
    errors.push("Submission date is required.");
  }

  const urlRegex = /^https?:\/\/.+/i;
  if (!data["film-link"] || !urlRegex.test(data["film-link"])) {
    errors.push("Film link must be a valid URL starting with http:// or https://.");
  }

  return errors;
}

/**
 * Sends an email notification via EmailJS.
 * The template in your EmailJS dashboard should reference these variables:
 *   {{filmmaker_name}}, {{email}}, {{film_title}}, {{film_description}},
 *   {{film_duration}}, {{submission_date}}, {{film_link}}, {{phone}}
 * @param {Object} data  — the validated form data object
 * @returns {Promise}
 */
function sendEmailNotification(data) {
  const templateParams = {
    filmmaker_name: data["filmmaker-name"],
    email: data["email"],
    phone: data["phone"] || "Not provided",
    film_title: data["film-title"],
    film_description: data["film-description"],
    film_duration: data["film-duration"] + " min",
    submission_date: data["submission-date"],
    film_link: data["film-link"],
    to_email: "talibsmith77@gmail.com",
  };

  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

/**
 * Displays a visible success or error message below the form button.
 * @param {HTMLElement} container
 * @param {"success"|"error"} type
 * @param {string} message
 */
function showStatusMessage(container, type, message) {
  // Remove any previous status message
  const existing = container.querySelector(".status-message");
  if (existing) existing.remove();

  const el = document.createElement("p");
  el.className = `status-message status-${type}`;
  el.textContent = message;

  // Inline fallback styles (your CSS can override these)
  el.style.marginTop = "1rem";
  el.style.padding = "0.75rem 1rem";
  el.style.borderRadius = "6px";
  el.style.fontWeight = "600";

  if (type === "success") {
    el.style.background = "#d4edda";
    el.style.color = "#155724";
  } else {
    el.style.background = "#f8d7da";
    el.style.color = "#721c24";
  }

  container.appendChild(el);
}

// ─── Main submit handler ─────────────────────────────────────────────────────

/**
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const container = form.closest(".container") || form;
  const submitBtn = form.querySelector(".submit-button");

  // 1. Extract data
  const formData = extractFormData(form);

  // 2. Validate
  const errors = validateFormData(formData);
  if (errors.length > 0) {
    console.warn("Film submission validation failed:", errors);
    showStatusMessage(container, "error", errors.join(" "));
    return;
  }

  // 3. Log JSON to console
  const jsonOutput = JSON.stringify(formData, null, 2);
  console.log("Film submission JSON:\n", jsonOutput);

  // 4. Disable button while sending
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    // 5. Send email notification
    await sendEmailNotification(formData);

    // 6. Success feedback
    console.log("Film submission successful — email notification sent to talibsmith77@gmail.com");
    showStatusMessage(container, "success", "Your film has been submitted! We'll be in touch soon.");
    form.reset();
  } catch (error) {
    // 7. Error handling
    console.error("Film submission failed — email could not be sent.", error);
    showStatusMessage(container, "error", "Submission failed. Please try again or contact us directly.");
  } finally {
    // 8. Re-enable button regardless of outcome
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Film";
  }
}

// ─── Initialise ─────────────────────────────────────────────────────────────

function init() {
  // Load EmailJS SDK dynamically (avoids an extra <script> tag in the HTML)
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  script.onload = () => {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    console.log("EmailJS initialised.");
  };
  script.onerror = () => {
    console.error("Failed to load EmailJS SDK. Check your internet connection.");
  };
  document.head.appendChild(script);

  const form = document.getElementById("submit-film-form");
  if (!form) {
    console.error("submit-film-form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", handleFormSubmit);
}

document.addEventListener("DOMContentLoaded", init);
