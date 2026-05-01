/**
 * Submit.js — Film Festival Submission with Real Stripe Payments
 *
 * Flow:
 *  1. User submits form → client validates fields
 *  2. Payment modal opens → Stripe Elements renders a secure card input
 *  3. User clicks Pay → we call our serverless function to create a PaymentIntent
 *  4. stripe.confirmCardPayment() completes the charge using Stripe's SDK
 *  5. On success → send admin + thank-you emails via EmailJS in parallel
 *  6. Show success banner, reset form
 *
 * ── What to fill in ─────────────────────────────────────────────────────────
 *  STRIPE_PUBLIC_KEY    → Stripe Dashboard → Developers → API Keys → Publishable key
 *  PAYMENT_ENDPOINT     → URL of your serverless function (see create-payment-intent.js)
 *  EMAILJS_SERVICE_ID   → EmailJS Dashboard → Email Services
 *  EMAILJS_PUBLIC_KEY   → EmailJS Dashboard → Account → API Keys
 *  ADMIN_TEMPLATE_ID    → EmailJS template that notifies talibsmith77@gmail.com
 *  THANKYOU_TEMPLATE_ID → EmailJS template that thanks the filmmaker
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  stripe: {
    publicKey:
      "pk_test_51TRsWp2d92kR6KM9bdDb3vIwGFq1ZGYpghTxuljfQdBfB3rhwy8yWFHrs4AVoRimTwvdGPFbZBxR2F4qpgkaCSAJ00Cw17xeL1", // ← replace
    // For local testing use:  "pk_test_YOUR_PUBLISHABLE_KEY"
  },
  payment: {
    // Netlify:  "/.netlify/functions/create-payment-intent"
    // Vercel:   "/api/create-payment-intent"
    endpoint: "/.netlify/functions/create-payment-intent", // ← replace if using Vercel
  },
  emailjs: {
    serviceId: "service_k44zox9", // ← replace
    publicKey: "EBdFHT24XpBpYf0Vc", // ← replace
    adminTemplateId: "template_fuwyrtc", // ← replace
    thankYouTemplateId: "template_ff07wcf", // ← replace
  },
};

// ─── Fee schedule (display only — amounts are enforced server-side) ───────────

const FEE_SCHEDULE = {
  "feature-film": { label: "Feature Film (50 min+)", fee: 25 },
  "feature-documentary": { label: "Feature Documentary (50 min+)", fee: 25 },
  "narrative-short": { label: "Narrative Short Film (20 min or less)", fee: 15 },
  "documentary-short": { label: "Documentary Short (20 min or less)", fee: 15 },
  "student-film": { label: "Student Film / Documentary (10 min or less)", fee: 10 },
};

// ─── Module: Form ─────────────────────────────────────────────────────────────

const Form = {
  /** Reads all named form fields into a plain object. */
  extract(form) {
    const data = {};
    for (const [key, value] of new FormData(form).entries()) {
      data[key] = typeof value === "string" ? value.trim() : value;
    }
    return data;
  },

  /** Validates submission fields. Returns array of error strings (empty = valid). */
  validate(data) {
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
      errors.push("Film link must be a valid URL starting with http:// or https://.");

    return errors;
  },

  /** Shows or replaces a status banner inside a container. */
  showStatus(container, type, message) {
    container.querySelector(".status-message")?.remove();

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
  },
};

// ─── Module: EmailJS ──────────────────────────────────────────────────────────

const Email = {
  /** Loads EmailJS SDK and initialises it. Returns a Promise. */
  init() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      script.onload = () => {
        emailjs.init({ publicKey: CONFIG.emailjs.publicKey });
        console.log("EmailJS ready.");
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load EmailJS SDK."));
      document.head.appendChild(script);
    });
  },

  /**
   * Sends admin notification to talibsmith77@gmail.com.
   * Template variables: {{to_email}} {{filmmaker_name}} {{email}} {{phone}}
   *   {{film_title}} {{film_category}} {{film_description}}
   *   {{film_duration}} {{submission_date}} {{film_link}} {{fee_paid}}
   */
  sendAdminNotification(data, fee) {
    return emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.adminTemplateId, {
      to_email: "talibsmith77@gmail.com",
      filmmaker_name: data["filmmaker-name"],
      email: data["email"],
      phone: data["phone"] || "Not provided",
      film_title: data["film-title"],
      film_category: FEE_SCHEDULE[data["film-category"]].label,
      film_description: data["film-description"],
      film_duration: `${data["film-duration"]} min`,
      submission_date: data["submission-date"],
      film_link: data["film-link"],
      fee_paid: `$${fee}.00`,
    });
  },

  /**
   * Sends a thank-you email to the filmmaker.
   * Template variables: {{to_email}} {{filmmaker_name}} {{film_title}}
   *   {{film_category}} {{fee_paid}}
   */
  sendThankYou(data, fee) {
    return emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.thankYouTemplateId, {
      to_email: data["email"],
      filmmaker_name: data["filmmaker-name"],
      film_title: data["film-title"],
      film_category: FEE_SCHEDULE[data["film-category"]].label,
      fee_paid: `$${fee}.00`,
    });
  },
};

// ─── Module: Modal ────────────────────────────────────────────────────────────

const Modal = {
  // Cached element references (populated in Modal.init)
  els: {},

  init() {
    this.els = {
      overlay: document.getElementById("payment-overlay"),
      closeBtn: document.getElementById("modal-close-btn"),
      categoryLabel: document.getElementById("modal-category-label"),
      feeDisplay: document.getElementById("modal-fee"),
      payBtnAmount: document.getElementById("pay-btn-amount"),
      payBtn: document.getElementById("pay-btn"),
      errorEl: document.getElementById("payment-error"),
    };
  },

  open(categoryKey) {
    const { label, fee } = FEE_SCHEDULE[categoryKey];
    this.els.categoryLabel.textContent = label;
    this.els.feeDisplay.textContent = `$${fee}.00`;
    this.els.payBtnAmount.textContent = `$${fee}.00`;
    this.hideError();

    this.els.overlay.hidden = false;
    document.body.style.overflow = "hidden";
  },

  close() {
    this.els.overlay.hidden = true;
    document.body.style.overflow = "";
  },

  showError(message) {
    this.els.errorEl.textContent = message;
    this.els.errorEl.hidden = false;
  },

  hideError() {
    this.els.errorEl.hidden = true;
  },

  setPayButtonState(loading, fee) {
    this.els.payBtn.disabled = loading;
    this.els.payBtn.textContent = loading ? "Processing…" : `Pay $${fee}.00 & Submit`;
  },
};

// ─── Module: StripePayment ────────────────────────────────────────────────────

const StripePayment = {
  stripe: null,
  elements: null,
  cardElement: null,

  /** Initialises Stripe and mounts the card Element into the modal. */
  init() {
    // Stripe.js is loaded via <script> tag in the HTML
    if (typeof Stripe === "undefined") {
      throw new Error("Stripe.js failed to load. Check your internet connection.");
    }

    this.stripe = Stripe(CONFIG.stripe.publicKey);

    this.elements = this.stripe.elements({
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=DM+Sans&display=swap" }],
    });

    this.cardElement = this.elements.create("card", {
      style: {
        base: {
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "15px",
          color: "#e8e8e8",
          "::placeholder": { color: "#454954" },
          iconColor: "#9b9faa",
        },
        invalid: {
          color: "#f87171",
          iconColor: "#f87171",
        },
      },
      hidePostalCode: true,
    });

    this.cardElement.mount("#stripe-card-element");

    // Surface Stripe's real-time card validation errors
    this.cardElement.on("change", (event) => {
      if (event.error) {
        Modal.showError(event.error.message);
      } else {
        Modal.hideError();
      }
    });

    console.log("Stripe Elements mounted.");
  },

  /**
   * Calls the serverless function to create a PaymentIntent, then confirms
   * the card payment using the client secret returned.
   *
   * @param {Object} formData  — validated film submission data
   * @param {string} billingName — cardholder name for Stripe
   * @returns {Promise<{paymentIntent}>}
   */
  async charge(formData, billingName) {
    const { fee } = FEE_SCHEDULE[formData["film-category"]];

    // ── Step 1: Ask our server to create a PaymentIntent ──────────────────────
    const response = await fetch(CONFIG.payment.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filmCategory: formData["film-category"],
        filmTitle: formData["film-title"],
        filmmakerName: formData["filmmaker-name"],
        filmmakerEmail: formData["email"],
      }),
    });

    // Surface server errors clearly
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}. Please try again.`);
    }

    const { clientSecret } = await response.json();
    if (!clientSecret) {
      throw new Error("Invalid response from payment server. Please try again.");
    }

    // ── Step 2: Confirm the payment with Stripe ────────────────────────────────
    // stripe.confirmCardPayment handles 3D Secure, SCA, and other auth flows.
    const { paymentIntent, error } = await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: this.cardElement,
        billing_details: { name: billingName },
      },
    });

    if (error) {
      // error.message is already user-friendly (Stripe formats it)
      throw new Error(error.message);
    }

    if (paymentIntent.status !== "succeeded") {
      throw new Error(`Unexpected payment status: ${paymentIntent.status}. Please contact us.`);
    }

    console.log(`Payment succeeded: ${paymentIntent.id} | $${fee}.00`);
    return { paymentIntent };
  },
};

// ─── App: state + orchestration ──────────────────────────────────────────────

const App = {
  /** Holds validated form data while the user completes payment. */
  pendingFormData: null,

  // ── Initialise all modules ─────────────────────────────────────────────────
  async init() {
    Modal.init();

    try {
      StripePayment.init();
    } catch (err) {
      console.error("Stripe init failed:", err.message);
    }

    // EmailJS loads asynchronously — failure is non-fatal at init time
    Email.init().catch((err) => console.error(err.message));

    this.bindEvents();
  },

  // ── Wire up all event listeners in one place ───────────────────────────────
  bindEvents() {
    const form = document.getElementById("submit-film-form");
    if (!form) {
      console.error("submit-film-form not found.");
      return;
    }

    form.addEventListener("submit", (e) => this.handleFormSubmit(e));
    Modal.els.payBtn.addEventListener("click", () => this.handlePayment());
    Modal.els.closeBtn.addEventListener("click", () => Modal.close());

    // Close on backdrop click
    Modal.els.overlay.addEventListener("click", (e) => {
      if (e.target === Modal.els.overlay) Modal.close();
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !Modal.els.overlay.hidden) Modal.close();
    });
  },

  // ── Form submission → validate → open modal ────────────────────────────────
  handleFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const container = form.closest(".container") || form;
    const formData = Form.extract(form);
    const errors = Form.validate(formData);

    if (errors.length > 0) {
      console.warn("Validation failed:", errors);
      Form.showStatus(container, "error", errors.join(" "));
      return;
    }

    // Clear any leftover status banner from a previous attempt
    container.querySelector(".status-message")?.remove();

    this.pendingFormData = formData;
    Modal.open(formData["film-category"]);
  },

  // ── Pay button → charge card → send emails → success ──────────────────────
  async handlePayment() {
    if (!this.pendingFormData) return;

    const { fee } = FEE_SCHEDULE[this.pendingFormData["film-category"]];
    Modal.hideError();
    Modal.setPayButtonState(true, fee);

    try {
      // 1. Charge the card via Stripe
      await StripePayment.charge(this.pendingFormData, this.pendingFormData["filmmaker-name"]);

      // 2. Send both emails concurrently
      await Promise.all([
        Email.sendAdminNotification(this.pendingFormData, fee),
        Email.sendThankYou(this.pendingFormData, fee),
      ]);

      // 3. Console JSON output
      console.log(
        "Film submission complete ✓\n",
        JSON.stringify({ ...this.pendingFormData, fee_paid: `$${fee}.00` }, null, 2),
      );
      console.log("Admin notification → talibsmith77@gmail.com");
      console.log("Thank-you email    →", this.pendingFormData["email"]);

      // 4. Wrap up
      Modal.close();

      const form = document.getElementById("submit-film-form");
      const container = form.closest(".container") || form;
      Form.showStatus(
        container,
        "success",
        "🎉 Your film has been submitted! Check your inbox for a confirmation email.",
      );
      form.reset();
      this.pendingFormData = null;
    } catch (err) {
      // Stripe errors are already user-friendly; server errors are sanitised above
      console.error("Payment/submission error:", err.message);
      Modal.showError(err.message);
      Modal.setPayButtonState(false, fee);
    }
  },
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => App.init());
