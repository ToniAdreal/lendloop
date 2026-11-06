"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const CATEGORIES = ["", "power-tools", "garden", "kitchen", "camping", "other"];

/** All tools with availability status, filterable by category. */
export default function ToolsBrowser() {
  const [category, setCategory] = useState("");
  const tools = useQuery(api.tools.listAll, category ? { category } : {});
  const createRequest = useMutation(api.requests.create);
  const [drafts, setDrafts] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [message, setMessage] = useState<string | null>(null);

  async function borrow(tool: any) {
    const draft = drafts[tool._id];
    if (!draft?.start || !draft?.end) {
      setMessage("Pick a start and end date first.");
      return;
    }
    setMessage(null);
    try {
      await createRequest({
        toolId: tool._id,
        startDate: draft.start,
        endDate: draft.end,
      });
      setMessage(`Request sent for "${tool.name}". See "My requests".`);
    } catch (err: any) {
      setMessage(err?.message ?? "Could not send that request.");
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">All tools</h2>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "" ? "All categories" : c.replace("-", " ")}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {tools === undefined ? (
        <p className="text-sm text-stone-500">Loading tools…</p>
      ) : tools.length === 0 ? (
        <p className="text-sm text-stone-500">No tools in this category yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tools.map((tool: any) => (
            <li
              key={tool._id}
              className="rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{tool.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    tool.status === "available"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {tool.status === "available"
                    ? "Available"
                    : `On loan until ${tool.onLoanUntil}`}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                {tool.category.replace("-", " ")} · {tool.condition}
              </p>
              <p className="mt-2 text-sm text-stone-600">{tool.description}</p>
              <p className="mt-2 text-xs text-stone-500">
                Listed by {tool.ownerName}
                {tool.ownerIsTrusted && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
                    Trusted Lender
                  </span>
                )}
              </p>
              {!tool.isMine && tool.status === "available" && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-stone-500">
                    From
                    <input
                      type="date"
                      className="ml-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [tool._id]: { ...d[tool._id], start: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs text-stone-500">
                    To
                    <input
                      type="date"
                      className="ml-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [tool._id]: { ...d[tool._id], end: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    onClick={() => borrow(tool)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Request to borrow
                  </button>
                </div>
              )}
              {tool.isMine && (
                <p className="mt-3 text-xs italic text-stone-400">
                  This is your listing.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
