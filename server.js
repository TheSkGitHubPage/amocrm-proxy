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
const BASE_URL = `https://${AMO_SUBDOMAIN}.amocrm.ru`;

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", subdomain: AMO_SUBDOMAIN });
});

// Proxy all /api/v4/* calls to amoCRM
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
    console.error("amoCRM fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ amoCRM proxy running on http://localhost:${PORT}`);
  console.log(`  Subdomain: ${AMO_SUBDOMAIN}.amocrm.ru`);
  console.log(`  Test: http://localhost:${PORT}/health`);
});
