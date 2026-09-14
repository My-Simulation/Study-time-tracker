# 📚 Study Time Tracker

A Progressive Web App-style, mobile-first, dark-themed stopwatch for tracking daily study sessions.

**Tech Stack:** React (Vite) + Tailwind CSS + Firebase Firestore + Firebase Storage + React Router + html2canvas

---

## 🚀 Setup Steps

### 1. Install Node.js

Download and install Node.js (v18 or later) from [nodejs.org](https://nodejs.org/).

Verify installation:
```bash
node --version   # should print v18.x.x or later
npm --version    # should print 9.x.x or later
```

---

### 2. Install dependencies

```bash
cd study-time-tracker
npm install
```

---

### 3. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **"Add project"** → name it (e.g. `study-time-tracker`) → Continue
3. Disable Google Analytics (optional) → **Create project**

#### Enable Firestore
- In the left sidebar → **Build → Firestore Database**
- Click **"Create database"**
- Choose **"Start in test mode"** (you'll add real rules shortly)
- Select your region → **Enable**

#### Enable Storage
- In the left sidebar → **Build → Storage**
- Click **"Get started"**
- Choose **"Start in test mode"** → **Next** → **Done**

#### Get your web app config
- Go to **Project Settings** (gear icon) → **Your apps** section
- Click the **`</>`** (web) icon to register a web app
- Give it a nickname → **Register app**
- Copy the `firebaseConfig` object shown

---

### 4. Paste your Firebase config

Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
}
```

---

### 5. Apply Firestore security rules

1. Firebase Console → **Firestore → Rules tab**
2. Replace the existing rules with the contents of `firestore.rules` in this project
3. Click **Publish**

---

### 6. Apply Storage security rules

1. Firebase Console → **Storage → Rules tab**
2. Replace the existing rules with the contents of `storage.rules` in this project
3. Click **Publish**

---

### 7. Create Firestore indexes (if prompted)

When you first load the history page, Firestore may prompt you to create a composite index. Click the link in the browser console error to auto-create it, or manually create:

- Collection: `sessions`
- Fields: `userName ASC`, `createdAt DESC`

---

### 8. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📱 Features

| Feature | Description |
|---|---|
| **Name-based login** | Enter any name → stored in localStorage + Firestore |
| **Accurate stopwatch** | Uses `Date.now()` + `requestAnimationFrame` (no drift) |
| **Lap tracking** | Fastest lap → green, slowest → red, newest on top |
| **Session save** | Screenshot capture (html2canvas) → Firebase Storage upload → Firestore save |
| **History** | Total days, total hours, best day stats + per-date session list |
| **Session detail** | Read-only timer + lap table + saved screenshot per date |
| **Dark theme** | Full dark UI, #0d0d0d background, system monospace font for digits |

---

## 📁 Project Structure

```
src/
├── firebase.js              ← Firebase init + security rule comments
├── App.jsx                  ← Routing (BrowserRouter)
├── main.jsx
├── index.css                ← Tailwind + global styles
├── pages/
│   ├── Login.jsx            ← Name input login screen
│   ├── Stopwatch.jsx        ← Main stopwatch page
│   ├── History.jsx          ← History list with stats
│   └── HistoryDetail.jsx    ← Per-date session detail
├── hooks/
│   └── useStopwatch.js      ← All timer logic
├── components/
│   ├── StopwatchDisplay.jsx ← Large timer with glow
│   ├── LapTable.jsx         ← Animated lap rows (+ read-only variant)
│   ├── SaveModal.jsx        ← Save modal with date picker
│   └── Toast.jsx            ← Auto-dismiss notification
└── utils/
    ├── formatTime.js        ← ms → H:MM:SS.CC and date helpers
    └── firestoreHelpers.js  ← Firestore + Storage operations
```

---

## 🔒 Security Notes

- Auth is name-based (no password, no Firebase Auth tokens). Anyone who knows your name can access your sessions.
- Storage rules allow read/write to `screenshots/{userName}/**` by anyone. Treat this as a **personal/demo app**.
- For production use, integrate **Firebase Authentication** and update rules to check `request.auth.uid`.

---

## 🛠 Build for production

```bash
npm run build
# Output is in the dist/ folder — deploy to Firebase Hosting, Vercel, Netlify, etc.
```

### Deploy to Firebase Hosting (optional)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set dist/ as public dir, SPA: yes
npm run build
firebase deploy
```
