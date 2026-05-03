# TMIS

Thesis Management Integrated System (TMIS)

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env` from `.env.example` and set markdown source directory

```bash
cp .env.example .env
```

3. Start app

```bash
npm run dev
```

## Implemented features

- Frontmatter validation: `src/lib/schema/frontmatter.ts`
- Drizzle schema: `src/lib/db/schema.ts`
- SQLite connection/bootstrap: `src/lib/db/index.ts` (`data/sqlite.db`)
- Markdown parse + mtime differential sync: `src/lib/markdown/*`
- Sync API: `GET/POST /api/sync`
- Main tabs screen with list/error tabs and error count badge
- Grid/Table view switch and status-group DnD reorder persistence
- Search over `title` / `abstract` / `body` and tag filter
- Detail modal with intercepting routes (`/[title]`, `@modal/(.)[title]`)
