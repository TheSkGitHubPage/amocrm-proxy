# amoCRM Proxy — Claude Sales Agent

A lightweight local proxy that relays Claude Sales Agent requests to amoCRM API,
bypassing browser CORS restrictions.

---

## Requirements

- Node.js 18+ (download: https://nodejs.org)
- 2 minutes

---

## Setup (one-time)

1. Unzip this folder anywhere on your computer
2. Open Terminal (Mac) or Command Prompt (Windows) inside the folder
3. Run:

```
npm install
```

---

## Start the proxy

```
npm start
```

You should see:
```
✓ amoCRM proxy running on http://localhost:3001
  Subdomain: robosellcallcenter.amocrm.ru
  Test: http://localhost:3001/health
```

---

## Verify it works

Open your browser and go to:
```
http://localhost:3001/health
```

You should see: `{"status":"ok","subdomain":"robosellcallcenter"}`

---

## How it works

```
Claude Agent (browser)
        ↓
http://localhost:3001/amo/leads   ← your proxy
        ↓
https://robosellcallcenter.amocrm.ru/api/v4/leads
```

The proxy adds your Bearer token to every request so the browser never needs to handle auth directly.

---

## API endpoints proxied

| Proxy URL                          | amoCRM endpoint               |
|------------------------------------|-------------------------------|
| /amo/leads                         | /api/v4/leads                 |
| /amo/contacts                      | /api/v4/contacts              |
| /amo/tasks                         | /api/v4/tasks                 |
| /amo/leads/pipelines               | /api/v4/leads/pipelines       |
| /amo/account                       | /api/v4/account               |
| /amo/users                         | /api/v4/users                 |

---

## Security note

This proxy runs only on your local machine (localhost:3001).
It is NOT accessible from the internet. Safe to run locally.

Your token is stored in `.env` — never commit this file to git.

---

## Keep it running

Run `npm start` every time you want to use the Claude Sales Agent.
Or use a process manager to keep it always on:

```
npm install -g pm2
pm2 start server.js --name amocrm-proxy
pm2 save
pm2 startup
```

After `pm2 startup`, the proxy starts automatically when your computer boots.
