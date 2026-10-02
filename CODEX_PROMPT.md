Build a simple, polished web app for collecting human feedback on results from the Parallel Search API.

DESIGN REFERENCE (LOOK AT THESE FIRST)
Two screenshots are in the repo at these paths. Open and study both before writing any UI code, and use them as the design principles for the whole app.

1. design-reference/screenshot-1-hero.png
2. design-reference/screenshot-2-platform-grid.png

If you cannot open images, here is what they show. Both use a near black background with a dark, modern, premium feel. Screenshot 1 has a bold white headline with the second line in a soft blue to white gradient, and below it a glowing blue interface panel with a pill shaped tab row (Pages, Layers, Assets), a rounded search field with a magnifier icon, and bright blue glowing icon buttons. The one saturated blue accent is what pulls your eye to the important controls. Screenshot 2 shows a clean grid of rounded cards separated by thin, subtle borders. Each card has a small, readable title, a simple preview of its content (a progress bar list with a green "GOOD" badge, a table with small thumbnails, a list with item counts on the right), and a quiet label with an arrow at the bottom. Text is white for primary information and muted gray for secondary information, spacing is generous, and nothing feels crowded. Take these principles from them: dark theme, one strong accent color, rounded corners, thin borders, soft glow on the primary actions, muted secondary text, small status badges, and cards that show a lot of information without clutter.

WHO IT'S FOR
The users are technical enablement specialists and product managers who review Parallel's search quality. They want to understand where results are good, where they fall short, and what is frustrating customers. They are short on time, so the app should save them effort and never add manual work. Someone should be able to open it, run a query, and review results in under a minute without any instructions.

CORE FLOW
1. The user types a search query into a large, obvious search box and presses a prominent primary button (or Enter) to run it. This button should be the brightest element on the page, using the accent blue with a subtle glow like the reference.
2. The app calls the Parallel Search API from the backend and shows the returned results as clean cards. Each card shows the title, the URL or domain, and a short excerpt, with the most important information first.
3. Every card has two big, clearly colored buttons: "Relevant" (green) and "Not relevant" (red). One click records the judgment, and the card visibly changes state so the user can see what is done and what is left.
4. When the user marks a result as Not relevant, show an optional row of quick reason chips such as "Off topic", "Outdated", "Low quality source", "Wrong answer", and "Duplicate", plus an optional short note field. Reasons must be one click and never required, so review stays fast.
5. Every judgment is saved automatically the moment it is clicked. There is no separate Save button and no lost work. Show a small, quiet "Saved" confirmation.
6. Show a progress indicator for the current query (for example "6 of 10 reviewed") so the user knows where they are.

STORAGE
Use SQLite (or another simple local database) so the app runs with zero setup. Store, for each evaluation: query text, result URL, result title, rank position, the excerpt shown, the verdict (relevant or not relevant), the reason tags, the optional note, a timestamp, and the search run ID. Also store each search run itself (query, timestamp, and the parameters used) so evaluations can be tied back to exactly what Parallel returned. If the user searches the same query again, show their earlier judgments on matching URLs so they don't redo work.

REVIEW AND INSIGHTS PAGE
Add a second page called "Insights" that turns the raw feedback into something a product manager can act on. Lay it out as a grid of rounded cards like screenshot 2. It should include the overall relevance rate, the relevance rate by rank position (to show whether top results are actually better), the most common "not relevant" reasons, the domains that are most often marked wrong, and a list of the worst performing queries. Use small status badges and thin progress bars in the style of the Core Web Vitals card. Add filters for date range and verdict, and an "Export CSV" button so the data can be taken into other tools. A History view should let the user browse and edit past evaluations.

DESIGN AND USABILITY
The interface should feel calm, modern, and uncluttered, never like a dense admin panel. Use plenty of whitespace and a clear visual hierarchy so it is obvious where to look first. The search button and the Relevant and Not relevant buttons should be the most visually dominant elements on screen. Use color with purpose: one strong blue accent for the main action, green and red reserved for verdicts, and soft muted grays for everything else. Do not use color decoratively. Support keyboard shortcuts for speed (for example J and K to move between results, Y for relevant, N for not relevant) and show a small hint for them. The layout must work well on a laptop screen and remain usable on a tablet. Include loading, empty, and error states that are friendly and explain what to do next.

TECHNICAL REQUIREMENTS
Use a lightweight stack you think best fits (for example Next.js, or a small Node/Express or Python/FastAPI backend with a simple React frontend), and keep dependencies minimal. The Parallel API key must live on the server in a .env file and must never be exposed to the browser. Look up the current Parallel Search API documentation before implementing, and confirm the exact endpoint, required headers, request body, and response shape instead of guessing them. Handle API errors, rate limits, and empty results gracefully. Provide a .env.example file, and make the whole app start with a single install command and a single run command.

DELIVERABLES
The full working code, a short README that explains setup, how to run it, and where the data is stored, and a few seeded sample queries so the Insights page looks meaningful on first launch. Before finishing, run the app and test the full flow of searching, rating, reloading the page to confirm persistence, viewing Insights, and exporting CSV, and fix anything that is broken. Compare the final UI against the two screenshots in design-reference/ and adjust until it matches their look and feel.
