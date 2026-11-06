"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoanActivity from "@/components/LoanActivity";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    declined: "bg-red-100 text-red-800",
    cancelled: "bg-stone-200 text-stone-600",
    returned: "bg-sky-100 text-sky-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-stone-100"}`}
    >
      {status}
    </span>
  );
}

/** "My requests": loans I have asked for, with cancel / mark-returned. */
export default function MyRequests() {
  const requests = useQuery(api.requests.listMyRequests);
  const cancel = useMutation(api.requests.cancel);
  const markReturned = useMutation(api.requests.markReturned);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">My requests</h2>
      {requests === undefined ? (
        <p className="text-sm text-stone-500">Loading your requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-stone-500">
          No requests yet. Find something in &quot;All tools&quot;.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r: any) => (
            <li
              key={r._id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.toolName}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {r.startDate} to {r.endDate}
              </p>
              <div className="mt-2 flex gap-2">
                {r.status === "pending" && (
                  <button
                    onClick={() => cancel({ requestId: r._id }).catch(() => {})}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    Cancel request
                  </button>
                )}
                {r.status === "approved" && (
                  <button
                    onClick={() =>
                      markReturned({ requestId: r._id }).catch(() => {})
                    }
                    className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
                  >
                    Mark as returned
                  </button>
                )}
              </div>
              {(r.status === "approved" || r.status === "returned") && (
                <LoanActivity requestId={r._id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
