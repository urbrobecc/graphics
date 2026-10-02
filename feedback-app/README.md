# Search Feedback

A small app for collecting human relevance judgments on Parallel Search API results.

```
cd feedback-app
PARALLEL_API_KEY=your_key node server.js
```

Open http://localhost:3000. Without a key it runs in demo mode with placeholder results.

Search, mark each result relevant or not relevant, optionally add a note. Judgments are
appended to `data/evaluations.jsonl` (one JSON object per line) and can be exported as CSV
from the page. The latest vote per query and URL wins, and clicking a vote again clears it.

Optional env vars: `PORT`, `PARALLEL_API_URL`, `PARALLEL_BETA`. The request shape follows
Parallel's search endpoint (`objective`, `search_queries`, `max_results`); adjust `search()`
in `server.js` if your API version differs.
