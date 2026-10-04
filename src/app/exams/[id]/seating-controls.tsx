"use client";

import { startTransition, useActionState, useState } from "react";
import { RULE_LABELS, type SeatingRule } from "@/lib/seating";
import { approveSeatingPlan, generateSeatingPlan, type GenerateSeatingState } from "../actions";

const initialState: GenerateSeatingState = { error: null };

const primaryButton =
  "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";
const secondaryButton =
  "rounded-[5px] border border-line bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-faint";

export function SeatingControls({
  examId,
  planRule,
  hasPlan,
  courseCount,
  spacingCapacity,
}: {
  examId: string;
  planRule: SeatingRule | null;
  hasPlan: boolean;
  courseCount: number;
  spacingCapacity: number;
}) {
  const [generateState, generate, generating] = useActionState(
    generateSeatingPlan.bind(null, examId),
    initialState,
  );
  const [approveState, approve, approving] = useActionState(
    () => approveSeatingPlan(examId),
    initialState,
  );
  const [rule, setRule] = useState<SeatingRule>(
    planRule === "alternate" && courseCount < 2 ? "none" : (planRule ?? "none"),
  );

  const busy = generating || approving;
  // Approve applies to the plan on screen, so it waits until a newly selected
  // rule has been used to regenerate.
  const ruleChanged = hasPlan && planRule !== null && rule !== planRule;
  const error = approveState.error ?? generateState.error;

  const options: { value: SeatingRule; description: string }[] = [
    { value: "none", description: "Students fill the room from the front in random order." },
    {
      value: "spacing",
      description: `No two students sit side by side. Fits up to ${spacingCapacity} students in this room.`,
    },
  ];
  if (courseCount >= 2) {
    options.push({
      value: "alternate",
      description: "No two students from the same course sit side by side.",
    });
  }

  // Submit manually rather than via <form action>, which resets the form after
  // the action and would put the radio back to its initial rule.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => generate(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Rule</legend>
        <ul>
          {options.map((option) => (
            <li key={option.value}>
              <label className="-mx-3 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-[5px] px-3 py-2 hover:bg-hover">
                <input
                  type="radio"
                  name="rule"
                  value={option.value}
                  checked={rule === option.value}
                  onChange={() => setRule(option.value)}
                  className="translate-y-[5px] accent-accent"
                />
                <span>
                  {RULE_LABELS[option.value]}
                  <span className="block text-sm text-muted">{option.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasPlan && (
          <button
            type="button"
            onClick={() => startTransition(approve)}
            disabled={busy || ruleChanged}
            className={primaryButton}
          >
            {approving ? "Approving…" : "Approve plan"}
          </button>
        )}
        <button type="submit" disabled={busy} className={hasPlan ? secondaryButton : primaryButton}>
          {generating ? "Generating…" : hasPlan ? "Regenerate" : "Generate seating"}
        </button>
      </div>

      {ruleChanged && (
        <p className="mt-3 text-sm text-muted">
          Regenerate to use the selected rule, or select {RULE_LABELS[planRule!]} again to
          approve the current plan.
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
