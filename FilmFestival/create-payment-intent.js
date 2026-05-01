/**
 * server/create-payment-intent.js
 *
 * Serverless function that creates a Stripe PaymentIntent.
 * The client NEVER sees your Stripe secret key — it only lives here.
 *
 * ── Deployment ──────────────────────────────────────────────────────────────
 *
 *  NETLIFY
 *  -------
 *  1. Place this file at:  netlify/functions/create-payment-intent.js
 *  2. In Netlify dashboard → Site Settings → Environment Variables, add:
 *       STRIPE_SECRET_KEY = sk_live_...   (or sk_test_... for testing)
 *  3. The function is called at:
 *       /.netlify/functions/create-payment-intent
 *  4. Update PAYMENT_ENDPOINT in Submit.js to match ↑
 *
 *  VERCEL
 *  ------
 *  1. Place this file at:  api/create-payment-intent.js
 *  2. In Vercel dashboard → Project Settings → Environment Variables, add:
 *       STRIPE_SECRET_KEY = sk_live_...
 *  3. The function is called at:
 *       /api/create-payment-intent
 *  4. Update PAYMENT_ENDPOINT in Submit.js to match ↑
 *
 *  LOCAL TESTING
 *  -------------
 *  Netlify: `npx netlify dev`  (uses .env file automatically)
 *  Vercel:  `npx vercel dev`
 *  Create a .env file in the project root:
 *       STRIPE_SECRET_KEY=sk_test_...
 *
 * ── Install ──────────────────────────────────────────────────────────────────
 *  npm install stripe   (see package.json)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Stripe = require("stripe");

// ─── Allowed film categories & their amounts in cents ────────────────────────
// Keeping this on the SERVER means users cannot manipulate the price client-side.

const FEE_SCHEDULE = {
  "feature-film":        { label: "Feature Film (50 min+)",                     amountCents: 2500 },
  "feature-documentary": { label: "Feature Documentary (50 min+)",               amountCents: 2500 },
  "narrative-short":     { label: "Narrative Short Film (20 min or less)",       amountCents: 1500 },
  "documentary-short":   { label: "Documentary Short (20 min or less)",          amountCents: 1500 },
  "student-film":        { label: "Student Film / Documentary (10 min or less)", amountCents: 1000 },
};

// ─── CORS headers — update origin to your live domain in production ───────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Helper: build a JSON HTTP response ──────────────────────────────────────

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  // ── Parse request body ──────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const { filmCategory, filmTitle, filmmakerName, filmmakerEmail } = body;

  // ── Validate category (server-side — never trust client price) ──────────────
  const categoryConfig = FEE_SCHEDULE[filmCategory];
  if (!categoryConfig) {
    return jsonResponse(400, { error: "Invalid film category." });
  }

  // ── Validate required metadata fields ───────────────────────────────────────
  if (!filmTitle || !filmmakerName || !filmmakerEmail) {
    return jsonResponse(400, { error: "Missing required submission fields." });
  }

  // ── Guard: secret key must be set ───────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY environment variable is not set.");
    return jsonResponse(500, { error: "Payment service is not configured." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  try {
    // Create the PaymentIntent
    // `automatic_payment_methods` lets Stripe handle card brand detection automatically.
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   categoryConfig.amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      // Metadata is visible in your Stripe dashboard — not charged or exposed to users
      metadata: {
        film_category:   categoryConfig.label,
        film_title:      filmTitle,
        filmmaker_name:  filmmakerName,
        filmmaker_email: filmmakerEmail,
      },
      // Pre-fill receipt email so Stripe can send its own receipt if you enable it
      receipt_email: filmmakerEmail,
      description: `Film Festival Submission — ${filmTitle} (${categoryConfig.label})`,
    });

    console.log(`PaymentIntent created: ${paymentIntent.id} | $${categoryConfig.amountCents / 100} | ${filmmakerEmail}`);

    // Only send the client_secret back — never the full PaymentIntent object
    return jsonResponse(200, {
      clientSecret: paymentIntent.client_secret,
      amountCents:  categoryConfig.amountCents,
    });

  } catch (stripeError) {
    console.error("Stripe error:", stripeError.message);
    return jsonResponse(500, { error: "Failed to initialise payment. Please try again." });
  }
};
