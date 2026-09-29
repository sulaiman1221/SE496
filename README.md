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
- **Frontend / backend:** TBD
- **RFID hardware:** TBD (prototype: 5 readers, 5 cards)
- **Email:** Microsoft 365 / Outlook (mocked during early prototype)

## Repo layout

```
supabase/
  migrations/   SQL schema migrations, applied in order
  seed.sql      demo data (5 students, courses, demo room)
```

## Status

MVP in progress. Current milestone: thin end-to-end prototype with 5 students, 5 seats and 5 readers.
