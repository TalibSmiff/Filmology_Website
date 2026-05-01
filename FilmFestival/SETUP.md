# Film Festival — Stripe Payment Setup Guide

## File overview

```
FilmFestival/
├── Submitfilm.html              ← Updated HTML (Stripe Elements mount point)
├── Submit.js                   ← Frontend logic (Stripe + EmailJS)
├── PaymentModal.css            ← Modal styles (unchanged)
└── server/
    ├── create-payment-intent.js ← Serverless function (runs on Netlify or Vercel)
    ├── package.json             ← Server dependencies
    └── .env.example             ← Copy to .env and fill in secrets
```

---

## Step 1 — Stripe account

1. Create a free account at https://stripe.com
2. Go to **Developers → API Keys**
3. Copy your **Publishable key** (`pk_test_...` or `pk_live_...`)
4. Copy your **Secret key** (`sk_test_...` or `sk_live_...`)

> Use `pk_test_` / `sk_test_` keys while testing. Switch to live keys when you go live.

---

## Step 2 — Fill in Submit.js

Open `Submit.js` and update the `CONFIG` block at the top:

```js
const CONFIG = {
  stripe: {
    publicKey: "pk_live_YOUR_PUBLISHABLE_KEY", // ← paste here
  },
  payment: {
    endpoint: "/.netlify/functions/create-payment-intent", // Netlify
    // endpoint: "/api/create-payment-intent",             // Vercel
  },
  emailjs: {
    serviceId: "YOUR_SERVICE_ID",
    publicKey: "YOUR_PUBLIC_KEY",
    adminTemplateId: "YOUR_ADMIN_TEMPLATE",
    thankYouTemplateId: "YOUR_THANKYOU_TEMPLATE",
  },
};
```

**Only the publishable key goes in Submit.js. The secret key stays server-side.**

---

## Step 3 — Deploy the serverless function

### Option A: Netlify (recommended)

1. Place `server/create-payment-intent.js` at:
   ```
   netlify/functions/create-payment-intent.js
   ```
2. In **Netlify Dashboard → Site → Environment Variables**, add:
   ```
   STRIPE_SECRET_KEY = sk_live_...
   ALLOWED_ORIGIN    = https://yourfestival.com
   ```
3. Install the Stripe package:
   ```bash
   cd netlify/functions
   npm install stripe
   ```
4. Deploy. The endpoint is live at:
   ```
   https://yoursite.netlify.app/.netlify/functions/create-payment-intent
   ```

### Option B: Vercel

1. Place `server/create-payment-intent.js` at:
   ```
   api/create-payment-intent.js
   ```
2. In **Vercel Dashboard → Project → Settings → Environment Variables**, add:
   ```
   STRIPE_SECRET_KEY = sk_live_...
   ALLOWED_ORIGIN    = https://yourfestival.com
   ```
3. Update the `endpoint` in Submit.js to `/api/create-payment-intent`
4. Deploy — Vercel detects the `api/` folder automatically.

---

## Step 4 — EmailJS templates

1. Create a free account at https://www.emailjs.com
2. Add a Gmail service → copy your **Service ID**
3. Go to **Account → API Keys** → copy your **Public Key**
4. Create **Template 1 — Admin notification** (goes to talibsmith77@gmail.com):
   - Set _To Email_: `talibsmith77@gmail.com`
   - Available variables in the body:
     ```
     {{filmmaker_name}}, {{email}}, {{phone}}, {{film_title}},
     {{film_category}}, {{film_description}}, {{film_duration}},
     {{submission_date}}, {{film_link}}, {{fee_paid}}
     ```
5. Create **Template 2 — Thank-you email** (goes to the filmmaker):
   - Set _To Email_: `{{to_email}}`
   - Available variables:
     ```
     {{filmmaker_name}}, {{film_title}}, {{film_category}}, {{fee_paid}}
     ```

---

## Step 5 — Local testing

1. Copy `.env.example` to `.env` inside the `server/` folder:
   ```bash
   cp server/.env.example server/.env
   ```
2. Fill in your `sk_test_...` key in `.env`
3. Install and run:
   ```bash
   cd server
   npm install
   npx netlify dev       # or: npx vercel dev
   ```
4. Use Stripe's test card numbers:
   - **Succeeds:** `4242 4242 4242 4242`
   - **Requires auth (3D Secure):** `4000 0025 0000 3155`
   - **Declined:** `4000 0000 0000 9995`
   - Expiry: any future date (e.g. `12 / 26`) | CVV: any 3 digits

---

## Fees

| Category                                             | Amount |
| ---------------------------------------------------- | ------ |
| Feature Film / Feature Documentary (50 min+)         | $25    |
| Narrative Short / Documentary Short (20 min or less) | $15    |
| Student Film / Documentary (10 min or less)          | $10    |

Fees are enforced **server-side** in `create-payment-intent.js` — users cannot manipulate the price by editing client-side code.

---

## Security checklist

- [x] Secret key lives only in environment variables, never in frontend code
- [x] Prices are set server-side — client only sends category name
- [x] Stripe.js tokenises the card number — raw card data never touches your server
- [x] `stripe.confirmCardPayment()` handles 3D Secure / SCA automatically
- [x] CORS origin is locked to your domain in production via `ALLOWED_ORIGIN`
- [ ] **Before going live:** switch `pk_test_` → `pk_live_` in Submit.js and `sk_test_` → `sk_live_` in your env vars
