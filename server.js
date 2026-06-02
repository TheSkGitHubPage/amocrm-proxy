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

app.get("/health", (req, res) => {
  res.json({ status: "ok", subdomain: AMO_SUBDOMAIN, version: "2.0-chat" });
});

app.all("/amo/*", async (req, res) => {
  const amoPath = req.params[0];
  const queryString = new URLSearchParams(req.query).toString();
  const url = `${BASE_URL}/api/v4/${amoPath}${queryString ? "?" + queryString : ""}`;
  try {
    const amoRes = await fetch(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${AMO_TOKEN}`, "Content-Type": "application/json" },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    });
    const data = await amoRes.json();
    res.status(amoRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "No message" });
  const lower = message.toLowerCase();
  const amoData = {};
  try {
    const fetches = [];
    if (lower.match(/lead|pipeline|warm|demo|stage|active|follow|negot|qualif|overview|risk|seller/))
      fetches.push(fetch(`${BASE_URL}/api/v4/leads?limit=50&with=contacts`, { headers: { Authorization: `Bearer ${AMO_TOKEN}` } }).then(r => r.json()).then(d => { if (d?._embedded?.leads) amoData.leads = d._embedded.leads; }).catch(() => {}));
    if (lower.match(/task|today|due|overdue/))
      fetches.push(fetch(`${BASE_URL}/api/v4/tasks?limit=50&filter[is_completed]=0`, { headers: { Authorization: `Bearer ${AMO_TOKEN}` } }).then(r => r.json()).then(d => { if (d?._embedded?.tasks) amoData.tasks = d._embedded.tasks; }).catch(() => {}));
    if (lower.match(/pipeline|stage|funnel|stats|summary|count/))
      fetches.push(fetch(`${BASE_URL}/api/v4/leads/pipelines`, { headers: { Authorization: `Bearer ${AMO_TOKEN}` } }).then(r => r.json()).then(d => { if (d?._embedded?.pipelines) amoData.pipelines = d._embedded.pipelines; }).catch(() => {}));
    if (lower.match(/user|agent|manager|workload|responsible/))
      fetches.push(fetch(`${BASE_URL}/api/v4/users?limit=50`, { headers: { Authorization: `Bearer ${AMO_TOKEN}` } }).then(r => r.json()).then(d => { if (d?._embedded?.users) amoData.users = d._embedded.users; }).catch(() => {}));
    if (history.length === 0)
      fetches.push(fetch(`${BASE_URL}/api/v4/account`, { headers: { Authorization: `Bearer ${AMO_TOKEN}` } }).then(r => r.json()).then(d => { if (d?.id) amoData.account = { id: d.id, name: d.name }; }).catch(() => {}));
    await Promise.all(fetches);
  } catch (e) { console.error("amoCRM error:", e.message); }

  const system = `You are Claude Sales Agent for Robohub at robosellcallcenter.amocrm.ru. Help Head of Sales Shoxrux. Pipeline: Yangi lead, Sellerlar bazasi, Bog'lanib bo'lmadi, Saralash, KP tashlandi, Uchrashuv belgilandi, Maslaxat, To'lov kutilmoqda, Won(142), Lost(143). Rules: KP tashlandi/Uchrashuv belgilandi never close as lost. Bog'lanib bo'lmadi never moves to Sellerlar bazasi. Calls under 3min don't count. Daily target 40 dialogues. Use **bold** for key figures. Respond in English. Live data: ${JSON.stringify(amoData)}`;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages: [...history, { role: "user", content: message }] })
    });
    const claudeData = await claudeRes.json();
    console.log("Claude response status:", claudeRes.status);
    if (claudeData.error) console.error("Claude error:", JSON.stringify(claudeData.error));
    const reply = claudeData.content?.[0]?.text || `Error: ${JSON.stringify(claudeData.error || "no content")}`;
    res.json({ reply, amoData });
  } catch (e) {
    console.error("Claude API error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ amoCRM+Claude proxy v2 running on http://localhost:${PORT}`);
  console.log(`  Subdomain: ${AMO_SUBDOMAIN}.amocrm.ru`);
  console.log(`  Claude API key set: ${!!ANTHROPIC_KEY}`);
});
