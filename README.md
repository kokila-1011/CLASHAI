# CLASHAI
ClashAI is a multi-agent AI decision app. You enter a decision, and agents with distinct personas (Optimist, Skeptic, Fact-Checker, Moderator) debate it live, each responding to the last. The Fact-Checker verifies claims via web search. The debate appears as an animated argument tree and ends with a verdict and confidence score.
# ⚔️ ClashAI

> Don't ask one AI. Watch a council of them argue it out.

ClashAI is a multi-agent AI decision-making app. You type in a decision, and AI agents with distinct personas debate it live, ending with a synthesized verdict and a confidence score.

## 🎯 Problem
People decide on gut feeling or ask a single AI that tends to agree with them. This leads to blind spots and confirmation bias.

## 💡 Solution
ClashAI builds disagreement and fact-checking into the process. Agents challenge each other in real time, so you see the strongest arguments on every side before committing.

## 🤖 The Agents
| Agent | Role |
|---|---|
| Optimist | Argues the upside and opportunities |
| Skeptic | Probes risks and weak assumptions |
| Fact-Checker | Verifies claims using live web search |
| Moderator | Steers the debate and writes the final verdict |

Agents speak sequentially, and each one receives the previous turns, so they respond to each other instead of talking in parallel.

## ✨ Features
- Live streaming debate (SSE/WebSockets)
- Animated conversation / argument tree visualization
- Real web-search fact-checking
- Final verdict with confidence score
- [Any extras: history, shareable results, etc.]

## 🛠️ Tech Stack
- **Frontend:** React, Tailwind CSS, [D3 / React Flow]
- **Backend:** Node.js, Express, [SSE / WebSockets]
- **AI:** Gemini API (one model, different system prompts per persona)
- **Search:** Tavily API

## 🏗️ Architecture / Workflow
1. User submits a decision
2. Backend orchestrator runs agents in sequence, passing context forward
3. Each agent's response streams to the frontend
4. Fact-Checker calls Tavily to verify claims
5. Moderator synthesizes the verdict and confidence score

[Add workflow diagram image here]

## 🚀 Getting Started
```bash
git clone [repo-url]
cd clashai

# Backend
cd server && npm install
cp .env.example .env   # add your keys
npm run dev

# Frontend
cd ../client && npm install
npm run dev
```

## 🔑 Environment Variables
```
GEMINI_API_KEY=
TAVILY_API_KEY=
PORT=
```

## 📸 Screenshots / Demo
[Screenshots, GIF, or demo video link]

## 🧗 Challenges & Future Scope
- Challenges: keeping agent personas distinct, streaming sync, verdict consistency
- Future: more personas, user-defined agents, debate history, voice mode

## 👥 Team
- Kokila S
- Dhanya Priya S
- Nithishkumar S

Built for HackITon'26.
