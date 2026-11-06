"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import LoanActivity from "@/components/LoanActivity";

/**
 * Admin panel. Every query/mutation used here re-checks the admin role
 * server-side in Convex; hiding this tab in the UI is only a convenience.
 * Admins can: remove any listing, view all loans, toggle "Trusted Lender".
 */
export default function AdminPanel() {
  const tools = useQuery(api.tools.listAll, {});
  const loans = useQuery(api.requests.listAllLoans);
  const users = useQuery(api.users.listAllUsers);
  const removeAny = useMutation(api.tools.removeAny);
  const setTrusted = useMutation(api.users.setTrustedLender);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Admin: all listings</h2>
        {tools === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {tools.map((tool: any) => (
              <li
                key={tool._id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{tool.name}</span> ·{" "}
                  {tool.ownerName} · {tool.status}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Remove listing "${tool.name}" (admin)?`)) {
                      removeAny({ toolId: tool._id }).catch(() => {});
                    }
                  }}
                  className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                >
                  Remove listing
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Admin: lenders</h2>
        {users === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u: any) => (
              <li
                key={u._id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{u.name}</span> · {u.email} ·{" "}
                  {u.role}
                  {u.isTrustedLender && " · Trusted Lender"}
                </span>
                <button
                  onClick={() =>
                    setTrusted({
                      userId: u._id,
                      trusted: !u.isTrustedLender,
                    }).catch(() => {})
                  }
                  className="rounded-md border border-stone-300 px-3 py-1 text-sm"
                >
                  {u.isTrustedLender ? "Revoke trusted" : "Make Trusted Lender"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Admin: all loans</h2>
        {loans === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-stone-500">No loans yet.</p>
        ) : (
          <ul className="space-y-2">
            {loans.map((loan: any) => (
              <li
                key={loan._id}
                className="rounded-lg border border-stone-200 bg-white px-4 py-3"
              >
                <p className="text-sm">
                  <span className="font-medium">{loan.toolName}</span> ·{" "}
                  {loan.borrowerName} · {loan.startDate} to {loan.endDate} ·{" "}
                  <span className="capitalize">{loan.status}</span>
                </p>
                <LoanActivity requestId={loan._id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
