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

## frontmatter

See `src/types/frontmatter.ts` for details on the expected frontmatter fields in the markdown files. The example is as follows:

```markdown
---
url: https://example.com/research
pdf_url: https://example.com/research/thesis.pdf
published_at: 2026-01-23
abstract: Text
tags:
  - Test1
  - Test2
Conference: Example Conference
status: read
---
```

## License

Dual-licensed; MIT (`LICENSE-MIT` or [The MIT License – Open Source Initiative](https://opensource.org/license/mit/)) or MIT SUSHI-WARE LICENSE (`LICENSE-MIT_SUSHI.md`)
