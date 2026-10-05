import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { courseColor, formatExamDate, formatTimeRange, roomLabel } from "@/lib/exams";
import type { ExamDetail } from "@/lib/queries";
import { seatRows, type SeatInput } from "@/lib/seating";

// The seating plan PDF: page 1 is the room map, page 2 lists every student
// alphabetically so they can find their own seat. One shared plan for the
// whole room, sent to every student in the exam.

Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(process.cwd(), "src/assets/fonts/IBMPlexSans-Regular.ttf") },
    { src: path.join(process.cwd(), "src/assets/fonts/IBMPlexSans-Medium.ttf"), fontWeight: 500 },
  ],
});
// Never break names across lines with hyphens.
Font.registerHyphenationCallback((word) => [word]);

// As a file:// URL: react-pdf mistakes a Windows path ("C:\...") for a web
// address and silently drops the image.
const LOGO = pathToFileURL(path.join(process.cwd(), "public/alfaisal-logo.png")).href;

const INK = "#1d1c1a";
const MUTED = "#6b675f";
const FAINT = "#a29d94";
const LINE = "#e7e3db";

// A4 landscape, in points.
const PAGE_WIDTH = 841.89;
const MARGIN = 36;
const GAP = 6;
const MAP_HEIGHT = 340; // room left for the seat grid under the page header

type Occupant = { name: string; studentNumber: string; courseCode: string; courseIndex: number };

function buildPlan(exam: ExamDetail) {
  const courses = exam.exam_courses
    .map((ec) => ec.courses)
    .sort((a, b) => a.course_code.localeCompare(b.course_code));
  const courseIndex = new Map(courses.map((c, i) => [c.id, i]));
  const courseCode = new Map(courses.map((c) => [c.id, c.course_code]));

  const seats: SeatInput[] = exam.rooms.seats
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, code: s.seat_code, row: s.row_index, col: s.column_index }));
  const seatCode = new Map(seats.map((s) => [s.id, s.code]));

  const occupants = new Map<string, Occupant>(
    exam.seat_assignments.map((a) => [
      a.seat_id,
      {
        name: a.students.full_name,
        studentNumber: a.students.institution_student_id,
        courseCode: courseCode.get(a.course_id) ?? "",
        courseIndex: courseIndex.get(a.course_id) ?? 0,
      },
    ]),
  );

  const students = exam.seat_assignments
    .map((a) => ({
      name: a.students.full_name,
      studentNumber: a.students.institution_student_id,
      courseCode: courseCode.get(a.course_id) ?? "",
      seatCode: seatCode.get(a.seat_id) ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const seatedPerCourse = new Map<string, number>();
  for (const a of exam.seat_assignments) {
    seatedPerCourse.set(a.course_id, (seatedPerCourse.get(a.course_id) ?? 0) + 1);
  }

  return {
    heading: exam.title ?? courses.map((c) => c.course_code).join(", "),
    when: `${formatExamDate(exam.exam_date, { withYear: true })}, ${formatTimeRange(exam.start_time, exam.end_time)}`,
    room: roomLabel(exam.rooms.name, seats.length),
    courses: courses.map((c) => ({ ...c, seated: seatedPerCourse.get(c.id) ?? 0 })),
    seats,
    occupants,
    students,
  };
}

type Plan = ReturnType<typeof buildPlan>;

const styles = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9, color: INK, padding: MARGIN, paddingBottom: 54 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 18, fontWeight: 500 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 3 },
  logo: { height: 34 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 16, marginBottom: 2 },
  swatch: { width: 8, height: 8, borderWidth: 0.75, borderRadius: 2, marginRight: 5 },
  front: {
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
    textAlign: "center",
    paddingBottom: 3,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    marginBottom: 8,
  },
  gridRow: { flexDirection: "row", marginBottom: GAP },
  cell: { borderWidth: 0.75, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 4 },
  emptyCell: { borderStyle: "dashed", borderColor: LINE },
  cellTop: { flexDirection: "row", justifyContent: "space-between" },
  cellCode: { fontSize: 7, fontWeight: 500 },
  cellCourse: { fontSize: 6.5 },
  cellName: { fontSize: 8, marginTop: 2, textOverflow: "ellipsis" },
  listTitle: { fontSize: 16, fontWeight: 500 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginTop: 16,
    color: MUTED,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 4,
  },
  colName: { flex: 1 },
  colId: { width: 90 },
  colCourse: { width: 70 },
  colSeat: { width: 50 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: MARGIN,
    right: MARGIN,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: FAINT,
  },
});

function Footer({ plan }: { plan: Plan }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {plan.heading} · {plan.when} · {plan.room}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function RoomMap({ plan }: { plan: Plan }) {
  const rows = seatRows(plan.seats);
  const columns = Math.max(...plan.seats.map((s) => s.col)) + 1;
  const cellWidth = Math.min(110, (PAGE_WIDTH - 2 * MARGIN - GAP * (columns - 1)) / columns);
  const gridWidth = cellWidth * columns + GAP * (columns - 1);
  const rowHeight = Math.max(
    26,
    Math.min(48, (MAP_HEIGHT - GAP * (rows.length - 1)) / rows.length),
  );
  // Short rows only have room for one line of name.
  const nameLines = rowHeight >= 36 ? 2 : 1;

  return (
    <View style={{ width: gridWidth, alignSelf: "center" }}>
      <Text style={styles.front}>FRONT</Text>
      {rows.map((row) => (
        <View key={row[0].row} style={styles.gridRow} wrap={false}>
          {Array.from({ length: columns }, (_, col) => {
            const size = {
              width: cellWidth,
              height: rowHeight,
              marginRight: col < columns - 1 ? GAP : 0,
            };
            const seat = row.find((s) => s.col === col);
            if (!seat) return <View key={col} style={size} />; // aisle

            const occupant = plan.occupants.get(seat.id);
            if (!occupant) {
              return (
                <View key={col} style={[styles.cell, styles.emptyCell, size]}>
                  <Text style={[styles.cellCode, { color: FAINT }]}>{seat.code}</Text>
                </View>
              );
            }

            const color = courseColor(occupant.courseIndex);
            return (
              <View
                key={col}
                style={[styles.cell, size, { backgroundColor: color.bg, borderColor: color.border }]}
              >
                <View style={styles.cellTop}>
                  <Text style={[styles.cellCode, { color: color.text }]}>{seat.code}</Text>
                  <Text style={[styles.cellCourse, { color: color.text }]}>
                    {occupant.courseCode}
                  </Text>
                </View>
                <Text style={[styles.cellName, { maxLines: nameLines }]}>{occupant.name}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function SeatingPlanDocument({ plan }: { plan: Plan }) {
  return (
    <Document title={`Seating plan: ${plan.heading}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{plan.heading}</Text>
            <Text style={styles.subtitle}>
              {plan.when} · {plan.room}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images have no alt */}
          <Image src={LOGO} style={styles.logo} />
        </View>

        <View style={styles.legend}>
          {plan.courses.map((course, i) => (
            <View key={course.id} style={styles.legendItem}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: courseColor(i).bg, borderColor: courseColor(i).border },
                ]}
              />
              <Text>
                {course.course_code} {course.course_name} · {course.seated}{" "}
                {course.seated === 1 ? "student" : "students"}
              </Text>
            </View>
          ))}
        </View>

        <RoomMap plan={plan} />
        <Footer plan={plan} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.listTitle}>Find your seat</Text>
        <Text style={styles.subtitle}>
          Students are listed alphabetically by name. Find your name, then your seat on the room
          map.
        </Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colName}>Name</Text>
          <Text style={styles.colId}>Student ID</Text>
          <Text style={styles.colCourse}>Course</Text>
          <Text style={styles.colSeat}>Seat</Text>
        </View>
        {plan.students.map((s) => (
          <View key={s.studentNumber} style={styles.tableRow} wrap={false}>
            <Text style={styles.colName}>{s.name}</Text>
            <Text style={styles.colId}>{s.studentNumber}</Text>
            <Text style={styles.colCourse}>{s.courseCode}</Text>
            <Text style={[styles.colSeat, { fontWeight: 500 }]}>{s.seatCode}</Text>
          </View>
        ))}
        <Footer plan={plan} />
      </Page>
    </Document>
  );
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createSeatingPlanPdf(exam: ExamDetail) {
  const plan = buildPlan(exam);
  const buffer = await renderToBuffer(<SeatingPlanDocument plan={plan} />);
  return {
    pdf: new Uint8Array(buffer),
    filename: `seating-plan-${slugify(plan.heading) || "exam"}-${exam.exam_date}.pdf`,
  };
}
