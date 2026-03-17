# The Ballpark

Event production cost planning platform for exhibition agencies and their suppliers.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (brief parsing)

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

Edit `.env` in the project root with your Supabase and Anthropic credentials:

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### 3. Run database migration

```bash
npm run db:migrate
```

### 4. Seed sample data

```bash
npm run db:seed
```

### 5. Start development servers

```bash
npm run dev
```

This starts both the Express API (port 3001) and the React dev server (port 5173).

## Project Structure

```
├── server/
│   └── src/
│       ├── index.js          # Express entry point
│       ├── db/
│       │   ├── pool.js       # PostgreSQL connection pool
│       │   ├── migrate.js    # Schema migration
│       │   └── seed.js       # Sample data
│       └── routes/
│           ├── ai.js         # AI brief parsing
│           ├── orgs.js
│           ├── users.js
│           ├── clients.js
│           ├── categories.js
│           ├── items.js
│           ├── projects.js
│           ├── projectCategories.js
│           ├── estimates.js
│           ├── estimateItems.js
│           ├── messages.js
│           ├── ballsTransactions.js
│           └── statuses.js
├── client/
│   └── src/
│       ├── App.jsx
│       ├── layouts/Sidebar.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── ProjectList.jsx
│       │   ├── ProjectCreate.jsx
│       │   ├── ProjectDetail.jsx
│       │   ├── SupplierList.jsx
│       │   ├── ClientList.jsx
│       │   ├── ClientDetail.jsx
│       │   └── Settings.jsx
│       ├── components/
│       │   ├── StatusBadge.jsx
│       │   ├── Modal.jsx
│       │   └── CurrencyDisplay.jsx
│       └── lib/api.js
└── .env
```

## API Endpoints

All endpoints are prefixed with `/api`:

| Resource | Endpoints |
|---|---|
| Orgs | GET/POST/PUT/DELETE `/api/orgs` |
| Users | GET/POST/PUT/DELETE `/api/users` |
| Clients | GET/POST/PUT/DELETE `/api/clients` |
| Categories | GET/POST/PUT/DELETE `/api/categories` |
| Items | GET/POST/PUT/DELETE `/api/items` |
| Projects | GET/POST/PUT/DELETE `/api/projects` |
| Project Categories | GET/POST/PUT/DELETE `/api/project-categories` |
| Estimates | GET/POST/PUT/DELETE `/api/estimates` |
| Estimate Items | GET/POST/PUT/DELETE `/api/estimate-items` |
| Messages | GET/POST/PUT/DELETE `/api/messages` |
| Balls Transactions | GET/POST `/api/balls-transactions` |
| Statuses | GET/POST/PUT/DELETE `/api/statuses` |
| AI Parse Brief | POST `/api/ai/parse-brief` |

## Balls System

The platform uses a "Balls" credit system for estimate requests:

| Estimate Value | Ball Cost |
|---|---|
| Under £2,000 | 1 Ball |
| £2,000 - £10,000 | 2 Balls |
| £10,000 - £30,000 | 3 Balls |
| £30,000+ | 4 Balls |
