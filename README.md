# Trip Splitter — React Web App

A full-featured trip expense splitter built with React + Vite + Tailwind CSS + Supabase.

## Tech Stack
- **React 18** + React Router v6
- **Vite** — fast dev server and build tool
- **Tailwind CSS** — utility-first styling
- **Supabase** — database + authentication
- **Lucide React** — icons
- **date-fns** — date formatting

## Project Structure
```
src/
├── lib/
│   ├── supabase.js      ← Supabase client
│   ├── db.js            ← All database functions
│   └── utils.js         ← Formatters and helpers
├── hooks/
│   └── useAuth.jsx      ← Auth context + hook
├── components/
│   └── ui.jsx           ← Reusable UI components
├── pages/
│   ├── AuthPage.jsx
│   ├── HomePage.jsx
│   ├── CreateTripPage.jsx
│   ├── TripDetailPage.jsx
│   ├── AddExpensePage.jsx
│   ├── ExpenseDetailPage.jsx
│   └── TripSummaryPage.jsx
├── App.jsx              ← Router
├── main.jsx             ← Entry point
└── index.css            ← Tailwind + global styles
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Run development server
```bash
npm run dev
```
Open http://localhost:5173

### 3. Build for production
```bash
npm run build
```
Output goes to `dist/` — deploy this folder to Netlify, Vercel, or any static host.

## Features
- ✅ Sign up / Sign in with email & password
- ✅ Create trips with dates and members
- ✅ Add/edit/delete expenses
- ✅ Equal or custom split
- ✅ Single or multiple payers
- ✅ Remove/re-add trip members
- ✅ Balances summary
- ✅ Minimum-transaction settlement algorithm
- ✅ Mark/unmark payments as settled
- ✅ Per-member spending breakdown
- ✅ Each user's data is private (Row Level Security)
