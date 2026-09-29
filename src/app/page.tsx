import { connection } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const TABLES = ["students", "courses", "enrollments", "rooms", "seats", "readers", "exams"] as const;

async function getTableCounts() {
  const supabase = createServerClient();
  return Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return { table, count, error: error?.message };
    }),
  );
}

export default async function Home() {
  await connection();

  let counts: Awaited<ReturnType<typeof getTableCounts>> | null = null;
  let setupError: string | null = null;

  try {
    counts = await getTableCounts();
  } catch (err) {
    setupError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Exam Seating</h1>
      <p className="mt-1 text-sm text-zinc-500">Database connection check</p>

      {setupError ? (
        <p className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {setupError}
        </p>
      ) : (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="py-2 font-medium">Table</th>
              <th className="py-2 font-medium">Rows</th>
            </tr>
          </thead>
          <tbody>
            {counts?.map(({ table, count, error }) => (
              <tr key={table} className="border-b last:border-0">
                <td className="py-2 font-mono">{table}</td>
                <td className="py-2">
                  {error ? <span className="text-red-600">{error}</span> : count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
