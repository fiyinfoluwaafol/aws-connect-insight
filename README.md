# Amazon Connect Agent Supervisor Insights

A comprehensive MVP demo application for contact center supervisors and agents. The UI is **React**, **TypeScript**, and **Tailwind CSS** (`frontend/`); the API is **FastAPI** (`backend/`).

> The web app lives in the **`frontend/`** directory.

## Features

### Supervisor Dashboard
- **Overview**: Real-time metrics including average sentiment, call volume, negative call percentage, and open alerts with interactive charts
- **Call Search**: Advanced filtering by agent, sentiment range, keywords, and date range with CSV export
- **Alerts Center**: Manage and triage call alerts with severity filtering and status management
- **Daily Briefs**: Generate daily performance summaries with PDF export and mock email functionality
- **Settings**: Configure alert thresholds, keywords, and integrations

### Agent Experience
- **Home**: Post-call coaching tips with feedback options (helpful/not helpful, save, dismiss)
- **Performance**: Personal metrics including sentiment trends, call volume, and team percentile comparison
- **Exemplars**: Library of high-quality call examples for learning
- **Notifications**: Activity feed for new coaching tips and updates

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or bun package manager
- Python 3.9+ (for the backend API)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:8080`

### Backend API

From the repository root, install dependencies and start the FastAPI server (equivalent to install + dev server):

```bash
cd backend
pip install -e ".[dev]"
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The API listens at `http://127.0.0.1:8000` by default (see `/health` and OpenAPI docs at `/docs`).

Create a `.env` file in the **`backend/`** directory (copy from the repo-root [`.env.example`](.env.example)). Required for a working API:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_ORIGIN` — must match the frontend origin (default in the example is `http://localhost:8080` for local dev)
- `ENVIRONMENT` — e.g. `development` or `production`

`OPENAI_API_KEY` is optional unless you need transcript analysis and other OpenAI-backed flows. Optional **Twilio** variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_DEMO_AGENT_EMAIL`) are only required for real call ingestion via `/api/twilio/*` (see [`backend/README.md`](backend/README.md) for Railway deploy notes).

## Architecture

### Tech Stack

**Frontend**
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts
- **Server State**: TanStack Query (React Query) for API-backed views
- **State Management**: Zustand
- **Routing**: React Router DOM v6
- **PDF Export**: jsPDF + html2canvas

**Backend**
- **Framework**: FastAPI (Python)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Call Analysis**: OpenAI API (GPT-based transcript analysis)
- **Optional ingestion**: Twilio webhooks under `/api/twilio/*`

### Project Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui primitives
│   ├── AppHeader.tsx   # Main app header with user menu
│   ├── ProtectedRoute.tsx  # Auth route guard
│   └── ...
├── pages/
│   ├── SignIn.tsx           # Sign in page
│   ├── SignUp.tsx           # Registration page
│   ├── ForgotPassword.tsx   # Password reset request
│   ├── ResetPassword.tsx    # Password reset confirmation
│   ├── SupervisorLayout.tsx # Supervisor shell
│   ├── AgentLayout.tsx      # Agent shell
│   ├── supervisor/          # Supervisor pages
│   └── agent/               # Agent pages
├── stores/
│   ├── auth-store.ts   # Authentication state (Bearer tokens + API)
│   └── app-store.ts    # Local UI state (persisted features not yet on API)
└── lib/
    ├── api.ts          # API client for backend communication
    ├── mock-data.ts    # Mock call data (used where backend not yet wired up)
    ├── mock-service.ts # Service layer for mock data operations
    └── utils.ts        # Utility functions

backend/
├── api/
│   ├── main.py         # FastAPI app entry point
│   ├── config.py       # Settings and environment config
│   ├── dependencies.py # Shared FastAPI dependencies (auth, DB client)
│   └── routers/        # Route handlers
│       ├── auth.py     # Registration, login, logout, password reset
│       ├── analysis.py # Transcript analysis endpoint
│       ├── calls.py    # Call simulation endpoint
│       ├── dashboard.py # Supervisor analytics and trends
│       ├── alerts.py   # Supervisor alerts, rules, manual alerts
│       ├── agent.py    # Agent performance metrics
│       ├── teams.py    # Team management
│       ├── twilio.py   # Optional Twilio webhook ingestion
│       └── health.py   # Health check
├── services/
│   ├── auth.py                 # Authentication service layer
│   └── transcript_analysis.py # OpenAI-backed transcript analysis helpers
└── database/                   # Supabase database access layer
    ├── auth.py, users.py, calls.py, analysis.py, metrics.py, teams.py, alerts.py
    ├── constants.py            # Table name constants, role enums
    └── exceptions.py           # Domain exception types
```

## Authentication

Authentication is backed by **Supabase Auth**. The API uses **Bearer tokens**: login and refresh return `access_token` and `refresh_token`. The frontend keeps the access token in memory and stores the refresh token in **localStorage** (no HTTP-only cookies). There are no pre-seeded demo accounts — users register themselves.

### How It Works

1. Navigate to `/signup` to create an account (email, password, name, and role)
   - Supervisors are automatically assigned a new team on registration
2. Sign in at `/signin` with your email and password (`POST /api/auth/login` returns user + tokens)
3. API requests send `Authorization: Bearer <access_token>`; `GET /api/auth/me` loads the current profile when the access token is valid
4. On `401`, the client may call `POST /api/auth/refresh` with the stored refresh token to obtain new tokens
5. Protected routes check for a valid session and correct role
6. Sign out calls `POST /api/auth/logout` (with Bearer access token), clears stored tokens, and redirects to `/signin`
7. Password reset is available via `/forgot-password` → email link → `/reset-password`

### Roles
- **Supervisor** — access to the supervisor dashboard, team management, and analytics
- **Agent** — access to personal performance metrics, coaching tips, and exemplars

## Core Call Analytics Pipeline

Transcript analysis is powered by **OpenAI** via `POST /api/analysis`. The pipeline:

1. Accepts a transcript as either a plain string or a structured list of `{ speaker, text }` turns
2. Calls OpenAI with a structured prompt that extracts:
   - **Sentiment score** (−1.0 to 1.0) and label (positive / neutral / negative)
   - **Summary** of the call
   - **Topics** matched against a preferred list (billing, refund, technical support, etc.)
   - **Keywords** extracted using pattern matching (frustrated, escalate, cancel, etc.)
   - **Key moves** — notable agent actions during the call
   - **Resolution status**
3. Returns a structured `TranscriptAnalysisResponse` to the caller

The `POST /api/calls/simulate` endpoint generates realistic call records in Supabase (with randomised sentiment, topics, and summaries) for testing and demo purposes.

## Data

### Live Data (Backend)
When the backend is running and connected to Supabase:
- Dashboard trends are fetched from `GET /api/dashboard/trends?days=N` (supervisor, scoped to their team)
- Alerts (list, rules, status updates, manual alerts, related calls) are served under `/api/alerts` and `/api/alerts/rules`
- Agent performance is fetched from `GET /api/agent/performance` (last 7 days)
- Team membership is managed via `GET/POST/DELETE /api/teams/members`

### Mock Data (Frontend Fallback)
`frontend/src/lib/mock-data.ts` and `mock-service.ts` still back parts of the UI that are not fully API-driven (for example daily briefs content, exemplar browsing, CSV export helpers, and some call-detail shapes). Alerts and alert rules use the live API when the backend is available.

### Local Development API URL
The Vite dev server runs on port **8080** and can proxy `/api` to the backend (see `frontend/vite.config.ts`). The default API client base URL is `http://localhost:8000` (`VITE_API_URL` overrides this for deployed or custom setups). CORS is configured on the backend using `FRONTEND_ORIGIN`, so keep it aligned with where you open the app.

### Optional: Twilio Ingestion
With Twilio environment variables set, inbound webhooks under `/api/twilio/*` can feed real call flows into the app. Details match the backend deployment and credential setup described in [`backend/README.md`](backend/README.md).

## Routes

### Public
- `/` - Redirect based on auth state
- `/signin` - Sign in
- `/signup` - Register a new account
- `/forgot-password` - Request a password reset email
- `/reset-password` - Set a new password via reset link

### Supervisor (requires supervisor role)
- `/supervisor` - Overview dashboard
- `/supervisor/overview` - Same as above
- `/supervisor/alerts` - Alerts management
- `/supervisor/search` - Call search
- `/supervisor/briefs` - Daily briefs
- `/supervisor/team` - Team management (add/remove agents)
- `/supervisor/settings` - App settings

### Agent (requires agent role)
- `/agent` - Home with coaching tips
- `/agent/home` - Same as above
- `/agent/performance` - Personal metrics
- `/agent/exemplars` - Example calls
- `/agent/notifications` - Activity feed

## Key Features Explained

### Simulate Call End (Agent)
Located in the Agent Home header:
1. Click "Simulate Call End" button
2. Calls `POST /api/calls/simulate` on the backend
3. A call record with randomised sentiment, topics, duration, and summary is written to Supabase
4. The response is used to generate a new coaching tip card and notification in the UI

### CSV Export (Search)
1. Perform a search with your desired filters
2. Click the "CSV" button next to Search
3. Browser downloads a CSV file with:
   - Call ID, agent, customer
   - Date, duration, sentiment
   - Topics, resolution status

### PDF Export (Daily Briefs)
1. Generate or view a daily brief
2. Click "Export PDF" in the brief dialog
3. Uses html2canvas to capture the brief content
4. Generates a PDF with jsPDF
5. Browser downloads the PDF file

### Email Brief (Mock)
1. View a daily brief
2. Click "Email Brief"
3. MockService logs the email to localStorage
4. View sent emails in Settings → Email Outbox
5. Shows toast notification confirming the action

## State Persistence

Authentication tokens: **refresh token** in localStorage; **access token** in memory (see [Authentication](#authentication)).

The following UI state still persists locally (Zustand `persist` / localStorage) for features not fully backed by the API:

- **Exemplar Flags**: Calls marked as exemplars
- **Call Notes**: Notes added to calls
- **Daily Briefs**: Generated brief history
- **Sent Emails**: Mock email log
- **Agent Tips**: Coaching tips and feedback
- **Agent Bookmarks**: Saved exemplars
- **Settings**: Data retention and similar preferences in the local store; supervisor alert rules and thresholds are stored via the API when the backend is available
- **Notifications**: Agent notification feed

## Development

### Scripts

From the `frontend/` directory:

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run test     # Run unit/component tests
npm run typecheck # TypeScript check
```

### Testing

**Frontend** (from `frontend/`):
```bash
npm run test         # Run Vitest tests
npm run test:watch  # Watch mode
npm run test:coverage # With coverage
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

**Backend** (from `backend/`):
```bash
pip install -e ".[dev]"
pytest                    # Run tests
pytest --cov=api          # With coverage
ruff check .              # Lint
ruff format --check .     # Format check
```

### Continuous Integration

Pull requests against `main` run [GitHub Actions](.github/workflows/ci.yml): frontend `npm ci`, lint, typecheck, and tests (Node 20); backend `pip install -e ".[dev]"`, Ruff check/format, and pytest with coverage (Python 3.11).

### Deployment

- **Backend**: Deploy from the `backend/` directory (for example [Railway](https://railway.app/) using [`backend/railway.toml`](backend/railway.toml)). See [`backend/README.md`](backend/README.md) for build/start commands and required environment variables.
- **Frontend**: The repo includes [`frontend/vercel.json`](frontend/vercel.json) (SPA rewrite to `index.html`). Point `VITE_API_URL` at your deployed API URL when hosting the static build separately from the backend.

### Adding New Features

1. **New Pages**: Add to `frontend/src/pages/`, update routes in `App.tsx`
2. **New Components**: Add to `frontend/src/components/`
3. **State Changes**: Update stores in `frontend/src/stores/`; for server-backed data prefer TanStack Query in page components
4. **New API Endpoints**: Add a router in `backend/api/routers/`, register it in `backend/api/main.py`, and add the corresponding client methods to `frontend/src/lib/api.ts`
5. **Database Queries**: Add helpers to the relevant file under `backend/database/`

## Technologies Used

**Frontend**
- [Vite](https://vitejs.dev/) - Build tool
- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [TanStack Query](https://tanstack.com/query) - Server state and caching for API-backed pages
- [Zustand](https://zustand-demo.pmnd.rs/) - Client state management
- [React Router](https://reactrouter.com/) - Routing
- [Recharts](https://recharts.org/) - Charts
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation
- [html2canvas](https://html2canvas.hertzen.com/) - HTML to canvas
- [Lucide React](https://lucide.dev/) - Icons
- [date-fns](https://date-fns.org/) - Date utilities

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) - API framework
- [Supabase](https://supabase.com/) - PostgreSQL database and authentication
- [OpenAI API](https://platform.openai.com/) - Transcript analysis (sentiment, topics, summaries)
- [Twilio](https://www.twilio.com/) - Optional webhook-based call ingestion (`twilio` Python package)
- [Pydantic](https://docs.pydantic.dev/) - Data validation
- [Ruff](https://docs.astral.sh/ruff/) - Linting and formatting
- [pytest](https://pytest.org/) - Testing
