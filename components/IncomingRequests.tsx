"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoanActivity from "@/components/LoanActivity";

/**
 * "Incoming requests": requests on MY tools. Approve / decline, and mark
 * loans returned. All rules are re-checked server-side in Convex.
 */
export default function IncomingRequests() {
  const requests = useQuery(api.requests.listIncoming);
  const respond = useMutation(api.requests.respond);
  const markReturned = useMutation(api.requests.markReturned);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Incoming requests</h2>
      {requests === undefined ? (
        <p className="text-sm text-stone-500">Loading incoming requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nobody has requested your tools yet.
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
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium capitalize">
                  {r.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {r.borrowerName} would like it from {r.startDate} to {r.endDate}
              </p>
              <div className="mt-2 flex gap-2">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() =>
                        respond({ requestId: r._id, decision: "approved" }).catch(
                          () => {},
                        )
                      }
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        respond({ requestId: r._id, decision: "declined" }).catch(
                          () => {},
                        )
                      }
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      Decline
                    </button>
                  </>
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
