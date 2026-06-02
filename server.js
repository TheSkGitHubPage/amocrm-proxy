const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

const AMO_SUBDOMAIN = process.env.AMO_SUBDOMAIN;
const AMO_TOKEN = process.env.AMO_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BASE_URL = `https://${AMO_SUBDOMAIN}.amocrm.ru`;

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", subdomain: AMO_SUBDOMAIN });
});

// Proxy amoCRM API calls
app.all("/amo/*", async (req, res) => {
  const amoPath = req.params[0];
  const queryString = new URLSearchParams(req.query).toString();
  const url = `${BASE_URL}/api/v4/${amoPath}${queryString ? "?" + queryString : ""}`;
  try {
    const amoRes = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${AMO_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });
    const data = await amoRes.json();
    res.status(amoRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI chat endpoint - fetches amoCRM data + calls Claude
app.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });

  // Fetch relevant amoCRM data based on message
  const lower = message.toLowerCase();
  const amoData = {};

  try {
    const fetches = [];
    if (lower.match(/lead|pipeline|warm|demo|stage|active|follow|negot|qualif|overview|risk|seller/)) {
      fetches.push(
        fetch(`${BASE_URL}/api/v4/leads?limit=50&with=contacts`, {
          headers: { Authorization: `Bearer ${AMO_TOKEN}` }
        }).then(r => r.json()).then(d => { if (d?._embedded?.leads) amoData.leads = d._embedded.leads; }).catch(() => {})
      );
    }
    if (lower.match(/task|today|due|overdue/)) {
      fetches.push(
        fetch(`${BASE_URL}/api/v4/tasks?limit=50&filter[is_completed]=0`, {
          headers: { Authorization: `Bearer ${AMO_TOKEN}` }
        }).then(r => r.json()).then(d => { if (d?._embedded?.tasks) amoData.tasks = d._embedded.tasks; }).catch(() => {})
      );
    }
    if (lower.match(/pipeline|stage|funnel|stats|summary|count/)) {
      fetches.push(
        fetch(`${BASE_URL}/api/v4/leads/pipelines`, {
          headers: { Authorization: `Bearer ${AMO_TOKEN}` }
        }).then(r => r.json()).then(d => { if (d?._embedded?.pipelines) amoData.pipelines = d._embedded.pipelines; }).catch(() => {})
      );
    }
    if (lower.match(/user|agent|manager|workload|responsible/)) {
      fetches.push(
        fetch(`${BASE_URL}/api/v4/users?limit=50`, {
          headers: { Authorization: `Bearer ${AMO_TOKEN}` }
        }).then(r => r.json()).then(d => { if (d?._embedded?.users) amoData.users = d._embedded.users; }).catch(() => {})
      );
    }
    // Always fetch account on first message
    if (history.length === 0) {
      fetches.push(
        fetch(`${BASE_URL}/api/v4/account`, {
          headers: { Authorization: `Bearer ${AMO_TOKEN}` }
        }).then(r => r.json()).then(d => { if (d?.id) amoData.account = { id: d.id, name: d.name }; }).catch(() => {})
      );
    }
    await Promise.all(fetches);
  } catch (e) {
    console.error("amoCRM fetch error:", e.message);
  }

  const system = `You are Claude Sales Agent — an expert AI assistant for Robohub's sales team at robosellcallcenter.amocrm.ru.

You help Head of Sales Shoxrux manage and analyze the amoCRM pipeline in real time.

Pipeline stages: Yangi lead → Sellerlar bazasi → Bog'lanib bo'lmadi → Saralash → KP tashlandi → Uchrashuv belgilandi → Maslaxat/o'ylab ko'rilmoqda → To'lov kutilmoqda → Won (status_id=142) / Lost (status_id=143).

Key CRM rules:
- KP tashlandi and Uchrashuv belgilandi leads: NEVER close as lost — transfer to another agent
- Bog'lanib bo'lmadi leads: NEVER move to Sellerlar bazasi
- Calls under 3 minutes: do NOT count as a dialogue
- Daily minimum: 40 qualifying dialogues per agent
- Lead transfer requires manager approval

Analyze the data, name specific leads, flag risks, suggest next actions. Use **bold** for key figures. Be concise. Respond in English.

Live amoCRM data fetched right now:
${JSON.stringify(amoData, null, 2)}`;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system,
        messages: [...history, { role: "user", content: message }]
      })
    });
    const claudeData = await claudeRes.json();
    const reply = claudeData.content?.[0]?.text || "No response from Claude.";
    res.json({ reply, amoData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ amoCRM proxy running on http://localhost:${PORT}`);
  console.log(`  Subdomain: ${AMO_SUBDOMAIN}.amocrm.ru`);
  console.log(`  Test: http://localhost:${PORT}/health`);
});
