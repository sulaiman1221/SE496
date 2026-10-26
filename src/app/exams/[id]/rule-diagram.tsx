import { courseColor } from "@/lib/exams";

// A tiny picture of a seating option, so instructors can see what it does.
// Each row is a string of space-separated cells:
//   "S"           a student
//   "."           an empty seat
//   "A", "B"      a student from the first or second course (kind "courses")
//   anything else a student labelled with that text (kind "labels")
export type Diagram = { kind: "seats" | "courses" | "labels"; rows: string[] };

export function RuleDiagram({ diagram, caption }: { diagram: Diagram; caption?: string }) {
  return (
    <figure className="mt-2 inline-block rounded-[5px] border border-line bg-surface px-3 py-2.5">
      <div className="mb-1.5 border-b border-ink/40 pb-0.5 text-center text-[10px] tracking-wide text-muted uppercase">
        Front
      </div>
      <div className="flex flex-col gap-1">
        {diagram.rows.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.split(" ").map((cell, c) => (
              <Cell key={c} cell={cell} kind={diagram.kind} />
            ))}
          </div>
        ))}
      </div>
      {caption && <figcaption className="mt-1.5 text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

function Cell({ cell, kind }: { cell: string; kind: Diagram["kind"] }) {
  const base = "grid h-5 min-w-5 place-items-center rounded-[3px] border text-[10px] leading-none";

  if (cell === ".") {
    return <span aria-hidden className={`${base} border-dashed border-line`} />;
  }
  if (kind === "courses") {
    const color = courseColor(cell === "A" ? 0 : 1);
    return (
      <span
        aria-hidden
        className={`${base} font-medium`}
        style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
      >
        {cell}
      </span>
    );
  }
  return (
    <span aria-hidden className={`${base} border-accent bg-accent px-1 font-medium text-white`}>
      {kind === "labels" ? cell : ""}
    </span>
  );
}
