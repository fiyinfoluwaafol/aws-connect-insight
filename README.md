# Amazon Connect Agent Supervisor Insights

A comprehensive MVP demo application for contact center supervisors and agents, built with React, TypeScript, and Tailwind CSS.

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

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Architecture

### Tech Stack
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts
- **State Management**: Zustand with localStorage persistence
- **Routing**: React Router DOM v6
- **PDF Export**: jsPDF + html2canvas

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui primitives
│   ├── AppHeader.tsx   # Main app header with user menu
│   ├── ProtectedRoute.tsx  # Auth route guard
│   └── ...
├── pages/
│   ├── SignIn.tsx      # Authentication page
│   ├── SupervisorLayout.tsx  # Supervisor shell
│   ├── AgentLayout.tsx      # Agent shell
│   ├── supervisor/     # Supervisor pages
│   └── agent/          # Agent pages
├── stores/
│   ├── auth-store.ts   # Authentication state
│   └── app-store.ts    # Application state
└── lib/
    ├── mock-data.ts    # Generated mock call data
    ├── mock-service.ts # Service layer for data operations
    ├── seed.ts         # Initial data seeding logic
    └── utils.ts        # Utility functions
```

## Mock Authentication

The app uses mock authentication with pre-defined demo users:

### Supervisors
- `supervisor.ada@demo.com` - Ada (Team East)
- `supervisor.lee@demo.com` - Lee (Team West)

### Agents
- `agent.jordan@demo.com` - Jordan
- `agent.sam@demo.com` - Sam
- `agent.renee@demo.com` - Renee

### How It Works

1. Navigate to `/signin` (or you'll be redirected there automatically)
2. Select a role tab (Supervisor or Agent)
3. Click on a user account to sign in
4. Session is stored in Zustand store + localStorage
5. Protected routes check for valid session and correct role
6. Sign out clears session and redirects to `/signin`

## Data Seeding

### Automatic Seeding
On first app load, if no data exists in localStorage, the app automatically seeds:
- ~300 mock calls across 12 agents with realistic data
- ~25 alerts based on negative sentiment and keywords
- Daily metrics for the past 30 days

### Data Structure

**Calls include:**
- Agent and customer information
- Sentiment score (-1 to 1) and label (positive/neutral/negative)
- Topics (billing, shipping, returns, etc.)
- Duration, resolution status, CSAT score
- Mock transcripts

**Alerts include:**
- Severity (high/medium/low)
- Rule labels (Negative Sentiment, High-Risk Keyword, Unresolved Long Call)
- Status (open/closed)
- Linked call reference

### Reset Demo Data
Use the "Reset Demo" button in Supervisor Settings to:
1. Clear all persisted data
2. Re-seed with fresh mock data
3. Reset all settings to defaults

## Routes

### Public
- `/` - Redirect based on auth state
- `/signin` - Sign in page

### Supervisor (requires supervisor role)
- `/supervisor` - Overview dashboard
- `/supervisor/overview` - Same as above
- `/supervisor/alerts` - Alerts management
- `/supervisor/search` - Call search
- `/supervisor/briefs` - Daily briefs
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
2. MockService picks a random call from the agent's history
3. Generates coaching tips based on call attributes:
   - Low sentiment → empathy suggestions
   - Long duration → efficiency tips
   - Unresolved → follow-up recommendations
   - Retention topics → alternatives suggestions
4. Creates a new tip card and notification

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

The following data persists across browser sessions via localStorage:

- **Auth Session**: Current user login
- **Alerts**: Status changes (open/closed)
- **Exemplar Flags**: Calls marked as exemplars
- **Call Notes**: Notes added to calls
- **Daily Briefs**: Generated brief history
- **Sent Emails**: Mock email log
- **Agent Tips**: Coaching tips and feedback
- **Agent Bookmarks**: Saved exemplars
- **Settings**: Threshold and keyword configurations
- **Notifications**: Agent notification feed

## Development

### Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Adding New Features

1. **New Pages**: Add to `src/pages/`, update routes in `App.tsx`
2. **New Components**: Add to `src/components/`
3. **State Changes**: Update stores in `src/stores/`
4. **Mock Data**: Extend `src/lib/mock-data.ts` or `mock-service.ts`

## Technologies Used

- [Vite](https://vitejs.dev/) - Build tool
- [React](https://react.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [React Router](https://reactrouter.com/) - Routing
- [Recharts](https://recharts.org/) - Charts
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation
- [html2canvas](https://html2canvas.hertzen.com/) - HTML to canvas
- [Lucide React](https://lucide.dev/) - Icons
- [date-fns](https://date-fns.org/) - Date utilities
