# Exam Seating + RFID Attendance

A web app for exam operations, live at **https://www.seatingplan496.online**. Instructors pick the courses and the room, then generate a seating plan from rules they can combine: an empty seat or row between students, a checkerboard layout, spreading students across the room, alternating courses, and seating by student ID or name. Male and female students always sit on separate sides of the room, and students who need it (for a disability or an injury) can be given front-row seats. The instructor reviews the plan on a seat map, moves anyone by dragging or tapping, approves it, and emails each student their seat with the seating plan PDF attached. During the exam, students tap their ID card on the RFID reader at their seat and the seat map shows who has checked in. When the exam is completed, the students who didn't check in are listed, and the instructor can create a makeup exam for them.

## How it works

```
Reader  -> Seat          (one reader per seat)
Card    -> Student       (registered once)
Exam    -> Student -> Seat (generated seating plan)

reader's seat == student's assigned seat  ->  present
otherwise                                  ->  rejected
```

Readers can report `{ exam_id, reader_id, card_uid }` to the backend, which does all the checking (see Card readers). The demo hardware works the other way round: it receives the seating plan through HiveMQ, checks each card itself, and reports the result (see Live check-in).

## Stack

- **Database:** Supabase (PostgreSQL)
- **Web app:** Next.js (App Router, TypeScript, Tailwind CSS), hosted on Vercel at https://www.seatingplan496.online
- **RFID hardware:** ESP32 with 5 card readers and 5 cards, connected through HiveMQ Cloud (MQTT)
- **Email:** Microsoft 365 / Outlook, through Microsoft Graph
- **PDF:** `@react-pdf/renderer`

## Getting started

Requires Node.js 22 (20 still works, with a warning from Supabase).

```bash
npm install
cp .env.example .env.local   # then fill in the keys: Supabase (Project Settings -> API Keys), Microsoft, HiveMQ
npm run dev
```

Open http://localhost:3000.

The secret keys are only used on the server. Never prefix them with `NEXT_PUBLIC_` and never commit `.env.local`. The live site gets the same keys from the Vercel project's Environment Variables, and every push to `main` deploys it.

## Seat emails

Once a seating plan is approved, the exam page can email each student their seat, with the seating plan PDF attached, from an Outlook account.

1. Fill in the `MICROSOFT_*` keys in `.env.local` from the "Exam Seating MVP" app registration in the Microsoft Entra admin center (Overview, and Certificates & secrets). The app needs the delegated Graph permissions `Mail.Send`, `offline_access` and `User.Read`, and the redirect URIs `http://localhost:3000/api/auth/microsoft/callback` and `https://www.seatingplan496.online/api/auth/microsoft/callback`.
2. On an approved exam, click **Connect Outlook account** and sign in. The app keeps the sign-in, so this only happens once.
3. Click **Email students**. The Email column shows who was sent their seat. Running it again only retries students who weren't.

Students with test addresses (`@example.com` and similar) are skipped.

## Card readers

A reader that sits at one seat (`readers.seat_id`) can post every card tap to the app:

```http
POST /api/attendance/scan
Authorization: Bearer <READER_API_KEY>
Content-Type: application/json

{ "exam_id": "<exam uuid>", "reader_id": "R01", "card_uid": "04A1B2C3" }
```

`reader_id` is the reader's `hardware_identifier`, and `card_uid` must match a student's `rfid_uid` (letter case doesn't matter). The answer is `{ "result": "accepted" | "rejected", "message": "...", "student": "...", "seat": "..." }`: show green for accepted, red for rejected. A wrong-seat rejection includes the seat the student should go to.

A card is accepted only at the seat its student is assigned right now. Instructors can move students during the exam, and readers follow the new seats from the next scan. Every scan is logged in `attendance_scans`, and `attendance` keeps the time each student first checked in. The first accepted scan moves the exam to "In progress", and completing the exam stops check-in.

## Live check-in (ESP32 + HiveMQ)

The demo hardware is an ESP32 with five card readers, connected through HiveMQ Cloud. When a plan is approved or a student is moved, the app publishes the seating plan to `access/plan`; the ESP32 shows green or red itself and reports each tap on `access/seat<N>/granted` or `access/seat<N>/alert`. The exam page and the live feed (`/exams/<id>/live`) show taps as they happen. Set the `HIVEMQ_*` keys in `.env.local` (see `.env.example`).

To keep attendance, run the listener next to the app during the exam:

```bash
npm run listen
```

It saves every tap: accepted ones mark the student present in `attendance` (with the time they first checked in), and every tap goes into `attendance_scans`. It runs on a computer, not on Vercel, so taps made while it isn't running still show on the readers but aren't saved. When the instructor clicks **Complete exam**, students without a `present` row are listed as absent, and the instructor can pick who sits a makeup exam and choose its room and time. A makeup exam seats only those students and then works like any other exam.

## Database changes

Add a new file to `supabase/migrations/` named `<timestamp>_<description>.sql`. When it's merged into `main`, Supabase applies it automatically. Don't edit migrations that have already been applied; add a new one instead.

## Repo layout

```
src/
  app/            pages and routes (exams, seat maps, live feed, Outlook sign-in, card scans)
  lib/            seating rules, seat emails, PDF, live seating plan
  lib/supabase/   database client (server-side)
scripts/          attendance listener, demo card setup
supabase/
  migrations/     SQL schema migrations and the real rooms, applied in order
  seed.sql        demo data (30 students, 2 courses, 3 demo rooms)
```

## Status

Proof of concept, live at https://www.seatingplan496.online. The full flow works end to end: create an exam, generate and adjust the seating plan, approve it, email students, check them in with the ESP32 card readers, complete the exam and create a makeup exam for the students who missed it. The rooms include Princess Haya Auditorium, BG-68, BG-65, BG-63 and the Double-Floor Room, and the hardware demo uses 5 readers and 5 cards in the Demo Room. Not done yet: instructor login, so the app shouldn't hold real student data until that's added.
