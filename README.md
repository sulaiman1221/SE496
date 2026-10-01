# Exam Seating + RFID Attendance

A web app for exam operations. Instructors pick the courses and the room, generate a seating plan with rules like "no same-course neighbours", review and approve it, and email each student their seat. During the exam, students tap their ID card on the RFID reader at their seat. The backend checks that the card belongs to the student assigned to that seat and marks them present.

## How it works

```
Reader  -> Seat          (fixed, one reader per seat)
Card    -> Student       (registered once)
Exam    -> Student -> Seat (generated seating plan)

reader's seat == student's assigned seat  ->  present
otherwise                                  ->  rejected
```

Readers only report `{ exam_id, reader_id, card_uid }`. All validation happens on the backend.

## Stack

- **Database:** Supabase (PostgreSQL)
- **Web app:** Next.js (App Router, TypeScript, Tailwind CSS)
- **RFID hardware:** TBD (prototype: 5 readers, 5 cards)
- **Email:** Microsoft 365 / Outlook (mocked during early prototype)

## Getting started

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys from Supabase -> Project Settings -> API Keys
npm run dev
```

Open http://localhost:3000.

The secret key is only used on the server. Never prefix it with `NEXT_PUBLIC_` and never commit `.env.local`.

## Database changes

Add a new file to `supabase/migrations/` named `<timestamp>_<description>.sql`. When it's merged into `main`, Supabase applies it automatically. Don't edit migrations that have already been applied; add a new one instead.

## Repo layout

```
src/
  app/            pages and routes
  lib/supabase/   database client (server-side)
supabase/
  migrations/     SQL schema migrations, applied in order
  seed.sql        demo data (30 students, 2 courses, 3 rooms)
```

## Status

MVP in progress. Current milestone: thin end-to-end prototype with 5 students, 5 seats and 5 readers.
