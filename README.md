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
- **Email:** Microsoft 365 / Outlook, through Microsoft Graph

## Getting started

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys from Supabase -> Project Settings -> API Keys
npm run dev
```

Open http://localhost:3000.

The secret key is only used on the server. Never prefix it with `NEXT_PUBLIC_` and never commit `.env.local`.

## Seat emails

Once a seating plan is approved, the exam page can email each student their seat from an Outlook account.

1. Fill in the `MICROSOFT_*` keys in `.env.local` from the "Exam Seating MVP" app registration in the Microsoft Entra admin center (Overview, and Certificates & secrets). The app needs the delegated Graph permissions `Mail.Send`, `offline_access` and `User.Read`, and the redirect URI `http://localhost:3000/api/auth/microsoft/callback`.
2. On an approved exam, click **Connect Outlook account** and sign in. The app keeps the sign-in, so this only happens once.
3. Click **Email students**. The Email column shows who was sent their seat. Running it again only retries students who weren't.

Students with test addresses (`@example.com` and similar) are skipped.

## Card readers

Each reader sits at one seat (`readers.seat_id`) and posts every card tap to the app:

```http
POST /api/attendance/scan
Authorization: Bearer <READER_API_KEY>
Content-Type: application/json

{ "exam_id": "<exam uuid>", "reader_id": "R01", "card_uid": "04A1B2C3" }
```

`reader_id` is the reader's `hardware_identifier`, and `card_uid` must match a student's `rfid_uid` (letter case doesn't matter). The answer is `{ "result": "accepted" | "rejected", "message": "...", "student": "...", "seat": "..." }`: show green for accepted, red for rejected. A wrong-seat rejection includes the seat the student should go to.

A card is accepted only at the seat its student is assigned right now. Instructors can move students during the exam, and readers follow the new seats from the next scan. Every scan is logged in `attendance_scans`, and `attendance` keeps the time each student first checked in. The first accepted scan moves the exam to "In progress".

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
