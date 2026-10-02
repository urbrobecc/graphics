# Search Feedback

A small web app for collecting human judgments on Parallel Search API results.

## Run

```sh
cd feedback-app
PARALLEL_API_KEY=your_key node server.mjs   # http://localhost:3000
```

Without a key it serves sample results so you can try the flow. Needs Node 18+, no dependencies.

Optional env vars: `PORT`, `DATA_DIR`, `PARALLEL_SEARCH_URL` (default `https://api.parallel.ai/v1beta/search`), `PARALLEL_BETA` (default `search-extract-2025-10-10`). Check these against the current Parallel docs, since the endpoint and beta header may change.

## How it works

1. Enter a query, the server calls Parallel (the key never reaches the browser).
2. Mark each result Relevant or Not relevant, with an optional note. Click again to clear.
3. Each click is appended to `data/evaluations.jsonl` with query, search id, url, rank, label, note, reviewer and timestamp. The latest label per result wins.
4. Export as CSV or JSONL from the page, or read `/api/evaluations`.
