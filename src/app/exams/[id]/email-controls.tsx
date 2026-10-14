"use client";

import { startTransition, useActionState } from "react";
import { sendSeatEmails, type SendSeatEmailsState } from "../actions";

const initialState: SendSeatEmailsState = { error: null, message: null };

const primaryButton =
  "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";

export function EmailControls({
  examId,
  sender,
  remaining,
  testAddresses,
  sentCount,
  started,
  connectError,
}: {
  examId: string;
  // The connected Outlook address, or null if none is connected yet.
  sender: string | null;
  // Students who haven't been sent their seat yet, not counting test addresses.
  remaining: number;
  // Students who haven't been sent their seat and have a test address, so won't be.
  testAddresses: number;
  // Students who have been sent their seat.
  sentCount: number;
  // Whether any emails have been tried for this exam.
  started: boolean;
  connectError: string | null;
}) {
  const [state, send, sending] = useActionState(() => sendSeatEmails(examId), initialState);
  const connectHref = `/api/auth/microsoft?returnTo=${encodeURIComponent(`/exams/${examId}`)}`;
  const error = state.error ?? connectError;

  return (
    <div>
      {sender ? (
        <p className="text-sm text-muted">
          Sent from <span className="text-ink">{sender}</span> ·{" "}
          <a href={connectHref} className="underline underline-offset-2 hover:text-ink">
            Use a different account
          </a>
        </p>
      ) : (
        <p className="text-muted">Connect the Outlook account that seat emails are sent from.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!sender ? (
          <a href={connectHref} className={primaryButton}>
            Connect Outlook account
          </a>
        ) : remaining > 0 ? (
          <button
            type="button"
            onClick={() => startTransition(send)}
            disabled={sending}
            className={primaryButton}
          >
            {sending
              ? "Sending…"
              : started
                ? `Email remaining ${remaining === 1 ? "student" : `${remaining} students`}`
                : `Email ${remaining === 1 ? "1 student" : `${remaining} students`}`}
          </button>
        ) : null}
      </div>

      {sender && (sentCount > 0 || testAddresses > 0) && (
        <p className="mt-3 text-sm text-muted">
          {[
            sentCount > 0 &&
              (remaining === 0 && testAddresses === 0
                ? "Every student has been emailed their seat."
                : `${sentCount} ${sentCount === 1 ? "student has" : "students have"} been emailed.`),
            testAddresses > 0 &&
              `${testAddresses} ${testAddresses === 1 ? "student has a test address" : "students have test addresses"} (like @example.com) and won't be emailed. Change their email to a real address to send them their seat.`,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}

      {state.message && !error && <p className="mt-3 text-sm">{state.message}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
