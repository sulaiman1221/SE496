"use client";

import { startTransition, useActionState, useState } from "react";
import { RULE_LABELS, type SeatingRule } from "@/lib/seating";
import { generateSeatingPlan, type GenerateSeatingState } from "../actions";

const initialState: GenerateSeatingState = { error: null };

export function SeatingControls({
  examId,
  currentRule,
  hasPlan,
  courseCount,
  spacingCapacity,
}: {
  examId: string;
  currentRule: SeatingRule;
  hasPlan: boolean;
  courseCount: number;
  spacingCapacity: number;
}) {
  const [state, formAction, pending] = useActionState(
    generateSeatingPlan.bind(null, examId),
    initialState,
  );
  const [rule, setRule] = useState<SeatingRule>(
    currentRule === "alternate" && courseCount < 2 ? "none" : currentRule,
  );

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
    startTransition(() => formAction(formData));
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

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={
            hasPlan
              ? "rounded-[5px] border border-line bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-faint"
              : "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
          }
        >
          {pending ? "Generating…" : hasPlan ? "Regenerate" : "Generate seating"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
