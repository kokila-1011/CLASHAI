# ClashAI

> Multi-agent AI decision-debate app — 24h hackathon project.
> DEMO VIDEO FLOW="https://drive.google.com/drive/folders/1zxPeqavUpiAZ3LNWL5GMBz2O_psMJDo-?usp=sharing"

## Structure

```
ClashAI/
├── client/          # Vite + React + Tailwind frontend
└── server/          # Express + SSE + Gemini orchestrator
```

## Quick Start

### 1. Server

```bash
cd server
cp .env.example .env        # fill in your GEMINI_API_KEY
npm install                  # already done if you ran setup
npm run dev
```

Server runs on **http://localhost:3001**

### 2. Client

```bash
cd client
npm install                  # already done
npm run dev
```

Frontend runs on **http://localhost:5173**

### 3. Open the app

Visit `http://localhost:5173`, type a decision, click **⚔️ Start Debate**.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API — all agents |
| `TAVILY_API_KEY` | ⏳ | Fact-Checker web search (step 2) |
| `PORT` | optional | Server port (default `3001`) |

---

## Agent Personas

| Agent | Role |
|---|---|
| 🌟 Optimist | Argues FOR the decision |
| 🔍 Skeptic | Challenges risks and blind spots |
| 📊 Fact-Checker | Grounds claims in reality |
| ⚖️ Moderator | Synthesises and decides if debate continues |

---

## Roadmap

- [x] Step 1 — Core SSE streaming loop (this PR)
- [ ] Step 2 — Tavily fact-checking for the Fact-Checker agent
- [ ] Step 3 — Verdict + confidence score synthesis
- [ ] Step 4 — React Flow node-graph visualization
