"use client";

import { startTransition, useActionState, useId, useState } from "react";
import {
  ORDER_LABELS,
  RULE_LABELS,
  roomCapacity,
  SEATING_ORDERS,
  SEATING_RULES,
  type SeatingOrder,
  type SeatingRule,
} from "@/lib/seating";
import { approveSeatingPlan, generateSeatingPlan, type GenerateSeatingState } from "../actions";
import { RuleDiagram, type Diagram } from "./rule-diagram";

const initialState: GenerateSeatingState = { error: null };

const primaryButton =
  "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";
const secondaryButton =
  "rounded-[5px] border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-faint";

const RULE_HELP: Record<SeatingRule, { description: string; diagram: Diagram; caption?: string }> = {
  spacing: {
    description: "No two students sit side by side.",
    diagram: { kind: "seats", rows: ["S . S . S . S", "S . S . S . S", "S . S . S . S"] },
  },
  checkerboard: {
    description:
      "Every other seat, shifted by one in each row, so nobody sits beside, in front of or behind another student.",
    diagram: { kind: "seats", rows: ["S . S . S . S", ". S . S . S .", "S . S . S . S"] },
  },
  rows: {
    description: "Students sit in every other row, so nobody sits right behind another student.",
    diagram: { kind: "seats", rows: ["S S S S S S S", ". . . . . . .", "S S S S S S S"] },
  },
  spread: {
    description:
      "Students are spread evenly over the whole room instead of filling it from the front. Best when the room is much bigger than the class.",
    diagram: {
      kind: "seats",
      rows: ["S . . S . . S", ". . . . . . .", ". S . . . S .", ". . . . . . .", "S . . S . . S"],
    },
    caption: "A small class in a large room",
  },
  alternate: {
    description: "No two students from the same course sit next to each other in a row.",
    diagram: { kind: "courses", rows: ["A B A B A B A", "B A B A B A B"] },
    caption: "A and B are two courses",
  },
};

const ORDER_HELP: Record<SeatingOrder, { description: string; diagram: Diagram; caption?: string }> = {
  random: {
    description: "Students are seated in a random order.",
    diagram: { kind: "labels", rows: ["7 2 9 4 1 8 3", "10 5 13 11 6 14 12"] },
    caption: "Numbers are student IDs",
  },
  id: {
    description:
      "In student ID order, from the front left to the back right, so students find their seat quickly.",
    diagram: { kind: "labels", rows: ["1 2 3 4 5 6 7", "8 9 10 11 12 13 14"] },
    caption: "Numbers are student IDs",
  },
  name: {
    description: "Alphabetically by name, from the front left to the back right.",
    diagram: { kind: "labels", rows: ["Ali Dana Hamad Joud", "Lama Maha Naif Omar"] },
  },
};

export function SeatingControls({
  examId,
  planRules,
  planOrder,
  hasPlan,
  courseCount,
  rowSizes,
  frontRowChanged,
}: {
  examId: string;
  // The rules and order the current plan was generated with, or null if
  // there's no plan.
  planRules: SeatingRule[] | null;
  planOrder: SeatingOrder | null;
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
  const [order, setOrder] = useState<SeatingOrder>(planOrder ?? "random");

  const busy = generating || approving;
  // Approve applies to the plan on screen, so it waits until newly selected
  // rules or order have been used to regenerate.
  const settingsChanged =
    hasPlan &&
    planRules !== null &&
    (rules.join() !== planRules.join() || (planOrder !== null && order !== planOrder));
  const error = approveState.error ?? generateState.error;
  const spaced = rules.some((rule) => rule === "spacing" || rule === "checkerboard" || rule === "rows");

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
            <Option
              key={rule}
              label={RULE_LABELS[rule]}
              {...RULE_HELP[rule]}
              input={
                <input
                  type="checkbox"
                  name="rule"
                  value={rule}
                  checked={rules.includes(rule)}
                  onChange={() => toggle(rule)}
                  className="translate-y-[5px] accent-accent"
                />
              }
            />
          ))}
        </ul>
        {(rules.length === 0 || spaced) && (
          <p className="mt-2 text-sm text-muted tabular-nums">
            {rules.length === 0
              ? "With no rules, students fill the room from the front."
              : `With these rules, this room fits up to ${roomCapacity(rowSizes, rules)} students.`}
          </p>
        )}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm text-muted">Seat order</legend>
        <ul>
          {SEATING_ORDERS.map((option) => (
            <Option
              key={option}
              label={ORDER_LABELS[option]}
              {...ORDER_HELP[option]}
              input={
                <input
                  type="radio"
                  name="order"
                  value={option}
                  checked={order === option}
                  onChange={() => setOrder(option)}
                  className="translate-y-[5px] accent-accent"
                />
              }
            />
          ))}
        </ul>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasPlan && (
          <button
            type="button"
            onClick={() => startTransition(approve)}
            disabled={busy || settingsChanged || frontRowChanged}
            className={primaryButton}
          >
            {approving ? "Approving…" : "Approve plan"}
          </button>
        )}
        <button type="submit" disabled={busy} className={hasPlan ? secondaryButton : primaryButton}>
          {generating ? "Generating…" : hasPlan ? "Regenerate" : "Generate seating"}
        </button>
      </div>

      {settingsChanged && (
        <p className="mt-3 text-sm text-muted">
          Regenerate to use the selected rules and order, or change them back to approve the
          current plan.
        </p>
      )}
      {frontRowChanged && !settingsChanged && (
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

// One rule or order option: its checkbox or radio, name and description, with
// a button at the end of the sentence that shows a small diagram of what the
// option does. The diagram opens below the label, so clicking it doesn't
// tick the option.
function Option({
  input,
  label,
  description,
  diagram,
  caption,
}: {
  input: React.ReactNode;
  label: string;
  description: string;
  diagram: Diagram;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const diagramId = useId();

  return (
    <li>
      <label className="-mx-3 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-[5px] px-3 py-2 hover:bg-hover">
        {input}
        <span>
          {label}
          <span className="block text-sm text-muted">
            {description}{" "}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={diagramId}
              onClick={(e) => {
                // Inside the <label>: don't also tick or untick the option.
                e.preventDefault();
                setOpen((o) => !o);
              }}
              className="whitespace-nowrap text-accent underline underline-offset-2 hover:text-accent-hover dark:text-ink"
            >
              {open ? "Hide example" : "Show example"}
            </button>
          </span>
        </span>
      </label>
      {open && (
        // Lined up with the option's text, past the checkbox.
        <div id={diagramId} className="pb-2 pl-7">
          <RuleDiagram diagram={diagram} caption={caption} />
        </div>
      )}
    </li>
  );
}
