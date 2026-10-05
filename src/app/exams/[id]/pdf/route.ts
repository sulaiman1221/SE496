import { isUuid } from "@/lib/exams";
import { getExamDetail } from "@/lib/queries";
import { createSeatingPlanPdf } from "@/lib/seating-pdf";

// Downloads the seating plan as a PDF. Only approved plans can be downloaded,
// since that's the version that gets printed and sent to students.
export async function GET(_request: Request, ctx: RouteContext<"/exams/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Exam not found.", { status: 404 });

  const exam = await getExamDetail(id);
  if (!exam) return new Response("Exam not found.", { status: 404 });

  const approved = exam.status !== "draft" && exam.status !== "generated";
  if (!approved || exam.seat_assignments.length === 0) {
    return new Response("Approve the seating plan before downloading it.", { status: 409 });
  }

  const { pdf, filename } = await createSeatingPlanPdf(exam);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
