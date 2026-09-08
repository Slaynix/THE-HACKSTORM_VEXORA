# Sanchay+ — Smart Family Micro-Savings Planner

> **"Small savings. Big goals." (छोटी बचत। बड़े लक्ष्य।)**  
> A mobile-first, multilingual, offline-capable savings companion designed for rural and first-time smartphone families to build consistent micro-saving habits, track goals, and recover smoothly when savings are missed.

---

## 🌟 Key Features

### 1. 📅 Savings Calendar
- **Interactive Monthly Grid**: View day-by-day savings activity with color-coded status:
  - 🟢 **Green**: Saving successfully added (+ amount badge e.g. `+₹50`).
  - 🔴 **Red**: Planned saving day missed.
  - 🔵 **Blue Highlight**: Today's active date.
  - ⚪ **Grey**: Future / planned days.
- **Monthly Target Tracking**: Switch between **Daily View** and **Monthly Target View** to track monthly family saving progress vs. aggregate targets.
- **Day Detail Bottom Sheet**: Tap any date to view itemized deposits, goal names, saving sources, and quick "Catch Up" or "Add Saving" actions.
- **Persistent Storage**: Retained across sessions via `localStorage` and IndexedDB.

### 2. 📈 Automatic Savings Recovery & Plan Adjustment
- **Dynamic Recalculation**: When savings days are missed, Sanchay+ doesn't just label the goal as "Behind" — it automatically recalculates the future required plan:
  $$\text{New Required Daily} = \frac{\text{Remaining Amount}}{\text{Days Remaining}}$$
- **3 Actionable Recovery Options**:
  - **Option 1: Increase Daily Saving**: Save at the adjusted rate to finish on schedule by the original deadline.
  - **Option 2: Extend Deadline**: Keep daily saving at the comfortable original rate and extend the target date.
  - **Option 3: Adjust Goal Target**: Set a realistic feasible target achievable by the deadline at the current pace.
- **Dynamic Invariants & In-Flight Catch-Up**:
  - Never alters the user's actual saved balance.
  - Adding extra savings (e.g. ₹300) dynamically reduces future required rates with celebratory notifications.
  - Maintains a persistent `planAdjustments` audit log.
  - Automatically halts recovery calculations when goals are completed.
  - Deduplicated reminders: never spams or alerts on future dates.

### 3. 🤖 Conversational AI Assistant (Gemini API)
- Multilingual voice & text savings companion powered by the **Google Gemini API** (`gemini-1.5-flash`).
- Natural language queries in **10 Indian languages** (Hindi, Marathi, English, Bengali, Gujarati, Tamil, Telugu, Kannada, Malayalam, Punjabi).
- **Two-step deposit confirmation card**: Interactive `Confirm` / `Edit` flow prevents unintended writes.
- **Zero Hallucination Guarantee**: All financial metrics, balances, deadlines, and streak counts are strictly read from live backend services.
- **Offline Fallback**: Includes rule-based multilingual regex parser that works even without an API key or internet connection.

### 4. 📴 Offline-First Architecture & Idempotent Sync
- **App Shell Caching**: Service Worker (`client/sw.js`) caches HTML, CSS, JS, and icons for instant offline loads (airplane mode).
- **IndexedDB**: Local cache of goals, deposits, and pending sync queue (`sanchay_offline_db`).
- **Dual-Check Reachability**: Combines `navigator.onLine` with a lightweight `/health` ping.
- **Idempotency Key (`clientTxnId`)**: UUID v4 generated on-device at creation time prevents duplicate deposits, balance corruption, or repeated milestone celebrations upon sync retries.

### 5. 🎯 Savings Goals, Milestones & Asia/Kolkata Streaks
- Complete Goals lifecycle (School Fees, Farming Equipment, Phone, Festival, Emergency).
- Quick deposit buttons (₹10, ₹20, ₹50, ₹100, ₹200) and custom amounts.
- Multi-member family contributions breakdown (Arun, Sunita, Riya).
- 4-stage milestones (25%, 50%, 75%, 100%) with celebration animations.
- Calendar-day saving streaks calculated strictly in `Asia/Kolkata` timezone.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules) |
| **Backend** | Node.js, Express.js |
| **Database** | Firebase Firestore, Firebase Authentication |
| **AI / LLM** | Google Gemini API (`@google/generative-ai`) |
| **Offline / Storage** | Service Worker, IndexedDB, localStorage |
| **Audio / Speech** | Web Speech API (`SpeechRecognition`, `SpeechSynthesis`) |
| **Localization** | 100% parity across English (`en`), Hindi (`hi`), Marathi (`mr`) + 7 Indic fallbacks |

---

## 🚀 Quick Start & Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Slaynix/THE-HACKSTORM_VEXORA.git
cd THE-HACKSTORM_VEXORA
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and supply your configuration:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5500

# Optional: Gemini API Key for AI Assistant (falls back to Indic rule-parser if omitted)
LLM_API_KEY=your_gemini_api_key_here
LLM_PROVIDER=gemini

# Optional: Firebase credentials (defaults to in-memory Firestore emulator/mock for instant dev)
FIREBASE_PROJECT_ID=sanchay-plus-demo
```

### 3. Seed Demo Data

Pre-populate the database with the Patil family, active goals, realistic deposit history, and streak records:

```bash
npm run seed
```

### 4. Start the Application

#### Start Backend Server:
```bash
npm start
# Server runs on http://localhost:3000
```

#### Serve Frontend:
In a second terminal, serve the `client/` folder:
```bash
# Using Python
python -m http.server 5500 --directory client

# Or using Node npx serve
npx serve client -p 5500
```

Open your browser at **`http://localhost:5500`** (or `http://localhost:5500/pages/dashboard.html`).

---

## 🧪 Running Automated Tests

Run the complete 7-suite test battery covering all engine math, APIs, Firebase integration, workflows, AI assistant, offline sync, and the savings calendar / plan recovery engine:

```bash
npm test
```

### Test Suites Included:
1. `savingsEngine.test.js`: Mathematical formulas, health classifications, progress calculations.
2. `api.test.js`: REST endpoints for Auth, Family, Goals, Deposits, Notifications, Sync.
3. `phase3Firebase.test.js`: Firestore security rules, seed verification, cross-family isolation.
4. `phase5EndToEnd.test.js`: Multi-member deposits, milestone idempotency, streak invariants, cascade deletes.
5. `phase6Chat.test.js`: Multilingual parsing, deposit confirmation cards, zero hallucinations, Firestore audit log.
6. `phase7OfflineSync.test.js`: Reachability probe, batch queue sync, idempotency replay with `clientTxnId`.
7. `phase8CalendarRecovery.test.js`: Missed days detection, plan adjustment calculation, Option 1/2/3 execution, catch-up extra deposits, notification deduplication.

---

## 📂 Project Directory Structure

```
sanchay-plus/
├── client/                     # Frontend App Shell
│   ├── index.html              # Landing page
│   ├── sw.js                   # Service Worker (offline caching)
│   ├── css/
│   │   ├── input.css           # Tailwind source
│   │   └── output.css          # Compiled production styles
│   ├── pages/                  # Application screens
│   │   ├── dashboard.html      # Main savings dashboard
│   │   ├── calendar.html       # Savings Calendar & Plan Recovery screen
│   │   ├── goals.html          # Goals list
│   │   ├── goal-details.html   # Goal progress, milestones & plan recovery
│   │   ├── add-saving.html     # Quick & custom deposit recording
│   │   ├── create-goal.html    # Goal creator
│   │   ├── assistant.html      # Conversational AI Assistant
│   │   ├── notifications.html  # Alerts & reminders
│   │   ├── settings.html       # Language & preferences
│   │   └── onboarding.html     # User setup
│   └── js/                     # Client ES modules
│       ├── app.js              # Service Worker & App initialization
│       ├── calendar.js         # Savings Calendar & Recovery controller
│       ├── assistant.js        # Voice & Text AI chat controller
│       ├── connectivity.js     # Dual-check reachability monitor
│       ├── db.js               # IndexedDB local storage & queue
│       ├── sync.js             # Reconnect sync engine
│       ├── goals.js            # Goals client service
│       ├── deposits.js         # Deposits client service
│       ├── notifications.js    # Notifications controller
│       └── i18n.js             # Multilingual dictionary & INR formatters
├── server/                     # Express.js Backend
│   ├── server.js               # Server entry point
│   ├── config/                 # Firebase & environment config
│   ├── controllers/            # Route controllers (goals, chat, deposits...)
│   ├── middleware/             # Auth, validators, error handlers
│   ├── routes/                 # Express API routes
│   ├── services/               # Core business services
│   │   ├── savingsEngine.js    # Core mathematical formulas
│   │   ├── recoveryService.js  # Automatic savings recovery & plan adjustments
│   │   ├── llmService.js       # Gemini 1.5 API integration
│   │   ├── chatService.js      # Assistant orchestrator & intent router
│   │   ├── goalsService.js     # Goals CRUD & Firestore operations
│   │   ├── depositsService.js  # Deposits & catch-up recalculation
│   │   ├── notificationService.js # Deduplicated notifications
│   │   ├── streakService.js    # Asia/Kolkata streak calculation
│   │   └── syncService.js      # Idempotent batch synchronization
│   └── tests/                  # Automated test suites
├── firebase/
│   └── firestore.rules         # Production Firestore security rules
├── package.json
└── README.md
```

---

## 🔒 Security & Data Privacy

- **No Secrets in Frontend**: Zero API keys or service account credentials exist in client code.
- **Idempotency Protected**: Duplicate sync requests or network retries are safe no-ops (`status: 'EXISTS'`).
- **Environment Driven**: Sensitive credentials live exclusively in `.env` (excluded by `.gitignore`).

---

## 📄 License

MIT License — Built for the Hackathon by Sanchay+ Team.
