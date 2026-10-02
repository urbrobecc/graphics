// Parallel Search feedback collector. No dependencies, Node 18+.
// Run: PARALLEL_API_KEY=... node server.js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PARALLEL_API_KEY || "";
const API_URL = process.env.PARALLEL_API_URL || "https://api.parallel.ai/v1beta/search";
const BETA = process.env.PARALLEL_BETA || "search-extract-2025-10-10";
const DATA_DIR = path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "evaluations.jsonl");
fs.mkdirSync(DATA_DIR, { recursive: true });

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { reject(e); } });
  });

// Latest evaluation per (query, url) wins, so changing a vote just appends a new line.
const loadAll = () => {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
};
const latest = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(r.query + "\u0000" + r.url, r);
  return [...m.values()].filter((r) => r.label !== "cleared");
};

async function search(query) {
  if (!API_KEY) {
    return {
      demo: true,
      search_id: "demo",
      results: [1, 2, 3].map((i) => ({
        url: `https://example.com/demo-${i}`,
        title: `Demo result ${i} for "${query}"`,
        excerpts: ["Set PARALLEL_API_KEY to see real results. This is placeholder text."],
      })),
    };
  }
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "parallel-beta": BETA },
    body: JSON.stringify({ objective: query, search_queries: [query], max_results: 10 }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Parallel API ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const toCsv = (rows) => {
  const cols = ["timestamp", "reviewer", "query", "search_id", "rank", "url", "title", "label", "note"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "POST" && url.pathname === "/api/search") {
      const { query } = await readBody(req);
      if (!query || !query.trim()) return json(res, 400, { error: "Query required" });
      const data = await search(query.trim());
      const prior = new Map(latest(loadAll()).filter((r) => r.query === query.trim()).map((r) => [r.url, r]));
      const results = (data.results || []).map((x, i) => ({
        rank: i + 1,
        url: x.url,
        title: x.title || x.url,
        excerpts: x.excerpts || [],
        label: prior.get(x.url)?.label || null,
        note: prior.get(x.url)?.note || "",
      }));
      return json(res, 200, { query: query.trim(), search_id: data.search_id || null, demo: !!data.demo, results });
    }
    if (req.method === "POST" && url.pathname === "/api/evaluations") {
      const b = await readBody(req);
      if (!b.query || !b.url || !["relevant", "not_relevant", "cleared"].includes(b.label))
        return json(res, 400, { error: "query, url and a valid label are required" });
      const row = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        reviewer: String(b.reviewer || "").slice(0, 100),
        query: b.query, search_id: b.search_id || null, rank: b.rank ?? null,
        url: b.url, title: b.title || "", label: b.label, note: String(b.note || "").slice(0, 2000),
      };
      fs.appendFileSync(FILE, JSON.stringify(row) + "\n");
      return json(res, 200, { ok: true, id: row.id });
    }
    if (req.method === "GET" && url.pathname === "/api/evaluations") {
      const rows = latest(loadAll());
      if (url.searchParams.get("format") === "csv") {
        res.writeHead(200, { "content-type": "text/csv", "content-disposition": "attachment; filename=evaluations.csv" });
        return res.end(toCsv(rows));
      }
      return json(res, 200, rows);
    }
    if (req.method === "GET") {
      const f = url.pathname === "/" ? "index.html" : path.basename(url.pathname);
      const p = path.join(__dirname, "public", f);
      if (fs.existsSync(p)) {
        res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html" : "text/plain" });
        return res.end(fs.readFileSync(p));
      }
    }
    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () =>
  console.log(`http://localhost:${PORT}  ${API_KEY ? "(live Parallel API)" : "(DEMO mode: set PARALLEL_API_KEY)"}`));
