// Zero dependency server: serves the UI, proxies Parallel Search, stores feedback.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.PARALLEL_API_KEY || "";
const SEARCH_URL = process.env.PARALLEL_SEARCH_URL || "https://api.parallel.ai/v1beta/search";
const BETA_HEADER = process.env.PARALLEL_BETA || "search-extract-2025-10-10";
const DATA_DIR = process.env.DATA_DIR || path.join(here, "data");
const EVAL_FILE = path.join(DATA_DIR, "evaluations.jsonl");
fs.mkdirSync(DATA_DIR, { recursive: true });

const MOCK = [
  ["Example Domain", "https://example.com", "This domain is for use in illustrative examples in documents."],
  ["Wikipedia: Information retrieval", "https://en.wikipedia.org/wiki/Information_retrieval", "Information retrieval is the task of obtaining relevant information resources."],
  ["Precision and recall", "https://en.wikipedia.org/wiki/Precision_and_recall", "Precision is the fraction of relevant instances among the retrieved instances."],
];

async function search(query, maxResults) {
  if (!API_KEY) {
    return {
      search_id: "mock_" + randomUUID(),
      mock: true,
      results: MOCK.map(([title, url, ex]) => ({ title, url, excerpts: [ex] })),
    };
  }
  const r = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "parallel-beta": BETA_HEADER },
    body: JSON.stringify({
      objective: query,
      search_queries: [query],
      max_results: maxResults,
      excerpts: { max_chars_per_result: 1500 },
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Parallel API ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// Evaluations are append only. The latest event per (search_id, url) wins.
function readEvents() {
  if (!fs.existsSync(EVAL_FILE)) return [];
  return fs.readFileSync(EVAL_FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
function currentEvaluations() {
  const map = new Map();
  for (const e of readEvents()) map.set(e.search_id + "|" + e.url, e);
  return [...map.values()].filter((e) => e.label !== "cleared");
}
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((ok, bad) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { bad(e); } });
  });

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "POST" && url.pathname === "/api/search") {
      const { query, maxResults = 10 } = await readBody(req);
      if (!query || !query.trim()) return json(res, 400, { error: "Query is required" });
      const out = await search(query.trim(), Math.min(Number(maxResults) || 10, 20));
      return json(res, 200, { ...out, query: query.trim() });
    }
    if (req.method === "POST" && url.pathname === "/api/feedback") {
      const b = await readBody(req);
      if (!["relevant", "not_relevant", "cleared"].includes(b.label) || !b.search_id || !b.url)
        return json(res, 400, { error: "Invalid feedback" });
      const event = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        query: b.query, search_id: b.search_id, url: b.url, title: b.title,
        rank: b.rank, label: b.label, note: b.note || "", reviewer: b.reviewer || "anonymous",
      };
      fs.appendFileSync(EVAL_FILE, JSON.stringify(event) + "\n");
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/evaluations") {
      const rows = currentEvaluations();
      if (url.searchParams.get("format") === "csv") {
        const cols = ["ts", "query", "search_id", "rank", "title", "url", "label", "note", "reviewer"];
        res.writeHead(200, { "content-type": "text/csv", "content-disposition": "attachment; filename=evaluations.csv" });
        return res.end([cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n"));
      }
      if (url.searchParams.get("format") === "jsonl") {
        res.writeHead(200, { "content-type": "application/x-ndjson", "content-disposition": "attachment; filename=evaluations.jsonl" });
        return res.end(rows.map((r) => JSON.stringify(r)).join("\n"));
      }
      const rel = rows.filter((r) => r.label === "relevant").length;
      return json(res, 200, { total: rows.length, relevant: rel, not_relevant: rows.length - rel, rows });
    }
    if (req.method === "GET") {
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const full = path.join(here, "public", path.normalize(file));
      if (!full.startsWith(path.join(here, "public")) || !fs.existsSync(full)) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "content-type": full.endsWith(".html") ? "text/html" : "text/plain" });
      return res.end(fs.readFileSync(full));
    }
    res.writeHead(405); res.end();
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, () =>
  console.log(`Feedback app on http://localhost:${PORT}  (${API_KEY ? "live Parallel API" : "MOCK results, set PARALLEL_API_KEY for live"})`));
