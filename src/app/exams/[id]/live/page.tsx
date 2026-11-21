import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECK_IN_STATUSES, isUuid, statusLabel } from "@/lib/exams";
import { loadLivePlan } from "@/lib/live-plan";
import { getExamDetail } from "@/lib/queries";
import { LiveFeed } from "./live-feed";

// The exam day screen: the room's seats, who should sit where, and every card
// scan as it happens. Scans arrive from HiveMQ in the browser.
export default async function LiveFeedPage({ params }: PageProps<"/exams/[id]/live">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [exam, plan] = await Promise.all([getExamDetail(id), loadLivePlan(id)]);
  if (!exam || !plan) notFound();

  const heading =
    exam.title ??
    exam.exam_courses
      .map((ec) => ec.courses.course_code)
      .sort()
      .join(", ");

  const back = (
    <Link href={`/exams/${exam.id}`} className="text-sm text-muted hover:text-ink">
      ← {heading}
    </Link>
  );

  if (!(CHECK_IN_STATUSES as string[]).includes(exam.status)) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-2xl font-medium tracking-tight">Live feed</h1>
        <p className="mt-3 text-muted">
          The live feed opens once the seating plan is approved. This exam is: {statusLabel(exam.status)}.
        </p>
      </>
    );
  }

  const host = process.env.HIVEMQ_HOST;
  const user = process.env.HIVEMQ_VIEWER_USER;
  const pass = process.env.HIVEMQ_VIEWER_PASS;
  if (!host || !user || !pass) {
    return (
      <>
        {back}
        <h1 className="mt-4 text-2xl font-medium tracking-tight">Live feed</h1>
        <p className="mt-3 text-muted">
          HiveMQ isn&apos;t set up. Add HIVEMQ_HOST, HIVEMQ_VIEWER_USER and HIVEMQ_VIEWER_PASS to
          .env.local and restart the app.
        </p>
      </>
    );
  }

  const seats = exam.rooms.seats
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, code: s.seat_code, row: s.row_index, col: s.column_index }));

  return (
    <>
      {back}
      <h1 className="mt-4 text-2xl font-medium tracking-tight">Live feed</h1>
      <p className="mt-1 text-muted">
        {heading} · {exam.rooms.name}
      </p>

      <div className="mt-8">
        <LiveFeed
          examId={exam.id}
          seats={seats}
          initialReaders={plan.readers}
          broker={{ host, user, pass }}
        />
      </div>
    </>
  );
}
