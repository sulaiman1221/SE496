"use client";

import { startTransition, useActionState, useState } from "react";
import { RULE_LABELS, roomCapacity, SEATING_RULES, type SeatingRule } from "@/lib/seating";
import { approveSeatingPlan, generateSeatingPlan, type GenerateSeatingState } from "../actions";

const initialState: GenerateSeatingState = { error: null };

const primaryButton =
  "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";
const secondaryButton =
  "rounded-[5px] border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-faint";

const RULE_DESCRIPTIONS: Record<SeatingRule, string> = {
  spacing: "No two students sit side by side.",
  rows: "Students sit in every other row, so nobody sits right behind another student.",
  alternate: "No two students from the same course sit next to each other in a row.",
};

export function SeatingControls({
  examId,
  planRules,
  hasPlan,
  courseCount,
  rowSizes,
  frontRowChanged,
}: {
  examId: string;
  // The rules the current plan was generated with, or null if there's no plan.
  planRules: SeatingRule[] | null;
  hasPlan: boolean;
  courseCount: number;
  // Number of seats in each row of the room, front row first.
  rowSizes: number[];
  // Whether the front-row students changed since the plan was generated.
  frontRowChanged: boolean;
}) {
  const [generateState, generate, generating] = useActionState(
    generateSeatingPlan.bind(null, examId),
    initialState,
  );
  const [approveState, approve, approving] = useActionState(
    () => approveSeatingPlan(examId),
    initialState,
  );
  const [rules, setRules] = useState<SeatingRule[]>(() =>
    (planRules ?? []).filter((rule) => rule !== "alternate" || courseCount >= 2),
  );

  const busy = generating || approving;
  // Approve applies to the plan on screen, so it waits until newly selected
  // rules have been used to regenerate.
  const rulesChanged = hasPlan && planRules !== null && rules.join() !== planRules.join();
  const error = approveState.error ?? generateState.error;
  const spaced = rules.includes("spacing") || rules.includes("rows");

  const options = SEATING_RULES.filter((rule) => rule !== "alternate" || courseCount >= 2);

  function toggle(rule: SeatingRule) {
    // Kept in SEATING_RULES order, so it can be compared with the plan's rules.
    setRules((current) =>
      SEATING_RULES.filter((r) => (r === rule ? !current.includes(r) : current.includes(r))),
    );
  }

  // Submit manually rather than via <form action>, which resets the form after
  // the action and would clear the ticked rules.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => generate(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Rules (pick any, or none)</legend>
        <ul>
          {options.map((rule) => (
            <li key={rule}>
              <label className="-mx-3 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-[5px] px-3 py-2 hover:bg-hover">
                <input
                  type="checkbox"
                  name="rule"
                  value={rule}
                  checked={rules.includes(rule)}
                  onChange={() => toggle(rule)}
                  className="translate-y-[5px] accent-accent"
                />
                <span>
                  {RULE_LABELS[rule]}
                  <span className="block text-sm text-muted">{RULE_DESCRIPTIONS[rule]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {(rules.length === 0 || spaced) && (
          <p className="mt-2 text-sm text-muted tabular-nums">
            {rules.length === 0
              ? "With no rules, students fill the room from the front in random order."
              : `With these rules, this room fits up to ${roomCapacity(rowSizes, rules)} students.`}
          </p>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasPlan && (
          <button
            type="button"
            onClick={() => startTransition(approve)}
            disabled={busy || rulesChanged || frontRowChanged}
            className={primaryButton}
          >
            {approving ? "Approving…" : "Approve plan"}
          </button>
        )}
        <button type="submit" disabled={busy} className={hasPlan ? secondaryButton : primaryButton}>
          {generating ? "Generating…" : hasPlan ? "Regenerate" : "Generate seating"}
        </button>
      </div>

      {rulesChanged && (
        <p className="mt-3 text-sm text-muted">
          Regenerate to use the selected rules, or change them back to approve the current plan.
        </p>
      )}
      {frontRowChanged && !rulesChanged && (
        <p className="mt-3 text-sm text-muted">
          The front-row students changed. Regenerate to seat them first.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
