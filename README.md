# MaiGuard

**A verified voice that travels faster than the rumour.**

It's 6:40 PM. Amara is closing her shop and needs to know whether the road home is safe. A WhatsApp forward says one thing, a neighbour says another. Someone in town already knows the truth. It just doesn't reach her in time.

MaiGuard treats this as a **distribution problem, not a knowledge problem**. A person the community already trusts speaks one rushed report. AI turns it into a clear alert and gets it to the right phones in seconds. Anyone can check a rumour against what trusted people have actually said.

**Live:** [maiguard-app.web.app](https://maiguard-app.web.app)

> We didn't use AI to decide what is true. We used it to make the truth travel faster than the rumour.

## What it does

| Screen | What happens |
|---|---|
| **Trusted voice** (`/voice`) | Speak (or type) a messy report. The AI structures it into *what / where / what to do*, ties every line to the speaker's own words, picks the affected roads, and decides whether it should interrupt people or wait quietly. The person reviews it, then publishes. The **Delivery** log below shows who each alert reached (by SMS, email and WhatsApp) and any follow-ups kept; only people linked to the affected roads get it. |
| **Check a rumour** (`/check`) | Paste, type or speak a forward and get one of three honest answers: **confirmed**, **contradicted**, or **nothing verified yet**. In the last case it names the trusted person for that road and promises to message you when there's news, then keeps that promise. |
| **WhatsApp** | Forward a rumour to MaiGuard's WhatsApp number and get the same honest answer in the chat. The follow-up promise is kept there too, and the WhatsApp number becomes the contact, with no sign-up. Uses Meta's official WhatsApp Business Platform (Cloud API); reading WhatsApp groups remains impossible and out of scope. |
| **Account** (`/account`) | Optional. Sign up with a phone number and/or email and a password, choose the roads you want alerts for, and see the messages you've received. |

**Who can do what.** Anyone can check a rumour: the first time, they leave a phone number (once per device, no name, no password). That's how MaiGuard builds its contact list, and each road someone asks about is added to their alerts. Members can optionally create an account (phone and/or email + password) to manage their roads from any device and get alerts by email too. Publishing is only for trusted voices, who sign in with a phone number and PIN (or, for the coordinator desk, an email and password). MaiGuard stores no names for community members, and trusted voices only ever see members' contacts masked (`+234 ••• ••• 0101`, `a•••@example.com`).

Rumour checks are grouped into a *"What the town is asking"* panel, so the trusted voice sees what people are worried about before it spreads.

## Where the AI sits and where it doesn't

The AI does four jobs: **structure** the report, **route** it by place, **judge urgency**, and **match** rumours to verified alerts. It never decides what's true. These rules are enforced in code, not just in the prompt:

- **Only trusted voices can publish.** Drafting, publishing and the rumour-trend feed need a signed-in trusted voice (phone number + PIN or desk email + password, signed 12-hour session, rate-limited sign-in). Every alert is attributed to whoever is signed in, never to a name the request supplies.
- **Nothing is published without a human.** The AI only drafts; a person presses Publish.
- **No invented facts.** Each drafted line must quote the transcript, and the server checks the quote is really there. Lines that can't be traced back are flagged in red.
- **"Safe" needs a source.** A *confirmed* or *contradicted* result must point to a real alert in the verified store. Otherwise it becomes *unverified*.
- **Outdated rumours get the correction.** A rumour that repeats a superseded alert is answered with the newer one.
- **Silence isn't an answer.** An unverified result always says what is and isn't known, gives safe guidance, and names who to ask.
- **It always works.** If the primary Gemini model is busy, a second model takes over; if both fail, or no key is set, a rule-based fallback gives the same kind of answers.

## Set it up yourself

MaiGuard runs with no accounts or keys at all: without an AI key it uses its rule-based fallback, so you can try everything locally in a few minutes. Add a Gemini key, WhatsApp and a real deployment when you need them.

### 1. Prerequisites

- **Node.js 20 or newer** (`node -v`) and npm
- **Git**
- Optional: a **Google Gemini API key** (free tier works): create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- For voice input: **Chrome, Edge or Safari** (the browser's Web Speech API). Typing always works.

### 2. Install and run

```bash
git clone https://github.com/Tronixtek/MaiGuard.git
cd MaiGuard
npm install
cp .env.example .env      # then fill in what you need (step 3)
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:8787** and the web app proxies to it. Sign in as a trusted voice with any account under [Demo sign-in](#demo-sign-in) (for example `0806 555 0172`, PIN `529617`).

```bash
npm test                  # server tests: the three outcomes, routing, follow-ups, auth, WhatsApp
npm run typecheck         # both server and client
```

### 3. Configure `.env`

Everything is optional. The server reads `.env` from the repo root (or `server/.env`); `npm run dev` restarts when it changes.

| Variable | What it does |
|---|---|
| `GEMINI_API_KEY` | Uses Google Gemini for drafting alerts and checking rumours. Without it (and without `ANTHROPIC_API_KEY`), the rule-based fallback answers. |
| `GEMINI_MODEL` | Primary model (default `gemini-3.1-flash-lite`); `gemini-3-flash-preview` takes over when it's busy. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Alternative provider (Claude, default `claude-opus-5`), used only when no Gemini key is set. |
| `AUTH_SECRET` | Signs sign-in sessions. **Set it in production** (e.g. `openssl rand -hex 32`); otherwise everyone is signed out on restart. |
| `DESK_PASSWORD_HASH` | Enables the coordinator desk's email sign-in. Create it with `npm run hash-password -- "your password"` and paste the output. `DESK_EMAIL` changes the email (default `trustedvoice@local.com`). |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | Turn on WhatsApp. See [step 6](#6-optional-whatsapp). |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` | Optional. The app secret verifies Meta's signature on each webhook; version defaults to `v25.0`. |
| `CORS_ORIGINS` | Comma-separated web origins allowed to call the API when the web app is hosted separately, e.g. `https://your-app.web.app`. |
| `TOWN_TZ` | Town clock for SMS times and night-time urgency (default `Africa/Lagos`). |
| `PORT` | API port (default `8787`). |

The web app has two build-time settings, set in the shell or in `client/.env.local`:

| Variable | What it does |
|---|---|
| `VITE_API_BASE` | The API's address when it is hosted separately (e.g. `https://api.example.com`). Leave unset when the API serves the web app itself. |
| `VITE_WHATSAPP_NUMBER` | Your WhatsApp number, e.g. `+234 800 000 0000`. Shows the "Chat on WhatsApp" button and section on the landing page. |

### 4. Make it yours

The demo town is seeded data, not a database. To adapt it to a real place:

- **Roads and areas, trusted voices, and subscribers:** edit `server/src/data/seed.ts`. Each area has a name, the other names people use for it (landmarks, junctions), and the trusted voice responsible for it.
- **Trusted-voice PINs:** edit `DEMO_PINS` in `server/src/auth.ts`. **Change them before any real use**: the demo PINs are public in this README.
- **Desk password:** set `DESK_PASSWORD_HASH` (step 3). The password itself never goes in the repo.
- Data lives in memory: restarting the server resets it to the seed. For real use, back `server/src/store.ts` with a database.

### 5. Deploy

**Option A: one server (simplest).** The API also serves the built web app, so there is one address and no CORS to configure.

```bash
npm ci
npm run build
NODE_ENV=production npm start     # serves the app and /api on $PORT (default 8787)
```

Put it behind a reverse proxy with HTTPS (nginx, Caddy). For live updates (`/api/stream`), turn proxy buffering off and use a long read timeout; see `deploy/nginx-maiguard-api.conf`.

**Option B: API in Docker, web app on static hosting.** This is how the live demo runs.

1. **API:** copy the repo to your server, create `.env` next to `deploy/docker-compose.yml` (with at least `AUTH_SECRET` and `CORS_ORIGINS`), then:
   ```bash
   mkdir -p /opt/maiguard && cp deploy/docker-compose.yml /opt/maiguard/ && cp -r . /opt/maiguard/src
   cd /opt/maiguard && docker compose up -d --build     # API on 127.0.0.1:8787
   ```
   Add the nginx site from `deploy/nginx-maiguard-api.conf` (change `server_name`), then get a certificate with `certbot --nginx -d your-api-domain`.
2. **Web app:** build it pointing at the API, then upload `client/dist` to any static host (Firebase Hosting, Netlify, Vercel, S3). Route all paths to `index.html`, since the app handles its own routes.
   ```bash
   VITE_API_BASE=https://your-api-domain npm run build -w @maiguard/client
   ```
   For Firebase: copy `.firebaserc.example` to `.firebaserc`, set your project and site, then `firebase deploy --only hosting`.
3. Add the web app's address to `CORS_ORIGINS` on the API and restart it.

`deploy/deploy.sh` automates Option B: copy `deploy/deploy.env.example` to `deploy/deploy.env` (git-ignored), fill in your server and API address, then run `deploy/deploy.sh api`, `deploy/deploy.sh web`, or `deploy/deploy.sh` for both.

### 6. Optional: WhatsApp

Residents forward rumours to your WhatsApp number and get answers in the chat. This uses Meta's official [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/cloud-api) and needs the API reachable over **public HTTPS** (step 5).

1. At [developers.facebook.com](https://developers.facebook.com/apps), **Create app** → use case **Connect with customers through WhatsApp** → choose or create a business portfolio.
2. In the app, open **WhatsApp → API Setup** (or **Step 1. Try it out**). Note the **Phone number ID** and generate an access token. For anything lasting more than a day, create a permanent token: **Business settings → Users → System users → Add**, assign the app and WhatsApp account with full control, then **Generate token** (expiry *Never*, permissions `whatsapp_business_messaging` and `whatsapp_business_management`).
3. Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and a random `WHATSAPP_VERIFY_TOKEN` (e.g. `openssl rand -hex 16`) on the server, and restart it.
4. In the app's **WhatsApp → Configuration**, set the webhook **Callback URL** to `https://your-api-domain/api/whatsapp/webhook` with your verify token, click **Verify and save**, and **subscribe** to the **messages** field.
5. Link the app to your WhatsApp Business account (once):
   ```bash
   curl -X POST -H "Authorization: Bearer $WHATSAPP_TOKEN" \
     "https://graph.facebook.com/v25.0/<WHATSAPP_BUSINESS_ACCOUNT_ID>/subscribed_apps"
   ```
6. Recommended: set `WHATSAPP_APP_SECRET` (**App settings → Basic**) so each webhook's signature is checked.
7. Send your number a message, e.g. *"kidnappers at Old Bridge Road"*.

Meta's free **test number** only replies to up to 5 numbers you verify in the dashboard. To let anyone chat, add a real number under **Production setup → Add phone number** (a SIM not already registered on WhatsApp).

## Demo sign-in

All accounts are fictional.

| Trusted voice | Area | Phone | PIN |
|---|---|---|---|
| Musa Bello | Old Bridge Road | +234 806 555 0172 | 529617 |
| Hauwa Danjuma | Market Road | +234 803 555 0141 | 418203 |
| Ifeanyi Okafor | Ward 3 (Hilltop) | +234 809 555 0118 | 630482 |
| Grace Adeyemi | North Gate Road | +234 812 555 0190 | 741936 |
| Yusuf Garba | Riverside Way | +234 815 555 0163 | 852074 |

There is also a coordinator desk account, **MaiGuard Desk**, that can publish for any road. It signs in with `trustedvoice@local.com` and a password that is not in this repo: the server stores only its hash (`DESK_PASSWORD_HASH`).

## Live deployment

The live demo follows Option B above: the web app on Firebase Hosting, and the API in Docker behind nginx with HTTPS on a separate server. Secrets live only in the server's `.env`. Redeploying the API resets the demo data.

## A two-minute demo

1. Start from the seeded data (restart the server).
2. **Check a rumour**: enter any phone number once, then try the three sample chips to see *confirmed*, *contradicted*, and *nothing verified yet*. On the last one you get Musa's number and a promise to be messaged when there is news.
3. **Trusted voice**: sign in as Musa, pick *Armed men at Old Bridge*, press **Draft alert**, review the draft, then **Publish**.
4. The **Delivery** section on the Trusted voice page shows the alert *and* the follow-up reaching your number, and that North Gate numbers got nothing.
5. Tick **Simulate 02:00** and draft *Repairs tomorrow*: it waits quietly instead of waking the town.

## Architecture

```
server/  Express + TypeScript
  src/ai/            draftAlert (structure + route + urgency), matchClaim, fallback engine
  src/services/      broadcast + follow-ups, 3-outcome response builder, check trends
  src/routes/        REST API, member accounts, WhatsApp webhook, Server-Sent Events (/api/stream)
  src/auth.ts        trusted-voice PINs, member passwords, signed sessions
  src/store.ts       in-memory verified alert store, seeded on start and on reset
client/  React 19 + Vite + Tailwind 4 + Motion
  src/pages/         Landing, TrustedVoice (with Delivery), CheckRumour, Account, SignIn
deploy/  docker-compose.yml, nginx site, deploy.sh
```

Both paths share a single source of truth, the verified alert store, and only a trusted voice's confirmation writes to it.

## Deliberately left out

Real SMS (the simulated gateway shows the same routing logic), WhatsApp ingestion (end-to-end encrypted), password reset and verifying that a phone number or email really belongs to the person (both need a real SMS or email provider), multiple languages (the brief doesn't describe a language barrier), and a database (seeded in-memory data makes the demo reliable).

## Next

A real SMS and email provider, with one-time codes to confirm members' numbers and emails and inbound rumour checks by text; deputy and night cover for trusted voices; protecting trusted voices from being targeted; measuring alert fatigue in the field.

*The town, people and phone numbers in this prototype are fictional.*
