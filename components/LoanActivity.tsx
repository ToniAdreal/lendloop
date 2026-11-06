"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Per-loan automation activity (webhook dispatches, reminder write-backs),
 * backed by the automationEvents + reminders tables. The Convex query checks
 * server-side that the viewer is the borrower, the owner, or an admin.
 */
export default function LoanActivity({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const activity = useQuery(
    api.automation.listForLoan,
    open ? { requestId: requestId as any } : "skip",
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-medium text-emerald-800 hover:underline"
      >
        Show automation activity
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-md bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Automation activity
      </p>
      {activity === undefined ? (
        <p className="mt-1 text-xs text-stone-500">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="mt-1 text-xs text-stone-500">No automation events yet.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {activity.map((a: any, i: number) => (
            <li key={i} className="text-xs text-stone-600">
              <span className="font-medium">{a.kind}</span> ·{" "}
              {new Date(a.createdAt).toLocaleString()} · {a.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
