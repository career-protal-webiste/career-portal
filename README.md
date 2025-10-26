# 🎯 Careers Portal (Vercel + Next.js)

A lightweight, noise-free **careers portal** that automatically pulls fresh job postings from major ATS platforms — **Lever**, **Greenhouse**, **Ashby**, **Recruitee**, and **Workable** — and removes duplicates across sources.  
Designed for **Indian students studying in the U.S. (0–5 yrs experience)** looking for roles in **APM, Analytics, Data Engineering, SDE, and Biomedical**.

---

## 🌐 Live Architecture Overview

- **Frontend:** Next.js (App Router)
- **Database:** Vercel Postgres (via Prisma)
- **Scheduler:** Vercel Cron Jobs (serverless automation)
- **Data Sources:**
  - Lever → `https://api.lever.co/v0/postings/{company}?mode=json`
  - Greenhouse → `https://boards-api.greenhouse.io/v1/boards/{company}/jobs`
  - Ashby → `https://api.ashbyhq.com/posting-api/job-board/{company}`
  - Recruitee → `https://{company}.recruitee.com/api/offers/`
  - Workable → `https://apply.workable.com/api/v3/accounts/{company}/jobs`

All APIs are **public** — the app doesn’t store or modify any proprietary data.

---

## ⚙️ Features

✅ **Auto job fetchers (CRON):**
Fetches every 15–20 mins and updates your Postgres database on Vercel.  
Duplicates are detected automatically using a cross-provider fingerprint.

✅ **Cross-provider deduplication:**
Jobs with the same `company + title + location + URL` are considered identical.

✅ **Simple browsing UI:**
A clean, responsive job list under `/jobs`.

✅ **Easy hosting:**
Everything runs on **Vercel** — no terminal, no manual setup.

---

## 🪜 Setup Guide (Non-Coder Friendly)

### Step 1 — Create your GitHub repository
1. Go to [https://github.com/new](https://github.com/new)
2. Name it **career-portal**
3. Keep it Public
4. Don’t add any README or .gitignore
5. Click **Create Repository**

### Step 2 — Upload project files
1. Unzip this folder on your computer.
2. Drag and drop all folders (`app/`, `pages/`, `lib/`, `styles/`, `prisma/`, etc.) into the repo.
3. Click **Commit changes**.

### Step 3 — Deploy to Vercel
1. Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New → Project → Import Git Repository**
3. Choose your GitHub repo.
4. When prompted:
   - **Framework preset:** Next.js (auto)
   - **Add Environment Variable:**  
     `DATABASE_URL` → paste your Postgres connection string (from Vercel Storage → Postgres)

---

## 🕓 Cron Jobs Setup on Vercel

After your first deploy:
1. Go to **Settings → Cron Jobs → Add**  
   Add these:

| Source | Path | Schedule |
|---------|------|-----------|
| Lever | `/api/cron/lever` | `*/15 * * * *` |
| Greenhouse | `/api/cron/greenhouse` | `*/15 * * * *` |
| Ashby | `/api/cron/ashby` | `*/20 * * * *` |
| Recruitee | `/api/cron/recruitee` | `*/20 * * * *` |
| Workable | `/api/cron/workable` | `*/25 * * * *` |

> ⏰ *Cron jobs only run on production deployments.*

---

## 🧩 File Structure

