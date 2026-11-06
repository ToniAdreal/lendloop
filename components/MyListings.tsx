"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const CATEGORIES = ["power-tools", "garden", "kitchen", "camping", "other"];
const CONDITIONS = ["new", "good", "fair", "well-used"];

const emptyForm = { name: "", category: "power-tools", condition: "good", description: "" };

/** "My listings": list a new tool, edit or delete your own. */
export default function MyListings() {
  const mine = useQuery(api.tools.listMine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await update({ toolId: editing as any, ...form });
        setEditing(null);
      } else {
        await create(form);
      }
      setForm(emptyForm);
    } catch (err: any) {
      setError(err?.message ?? "Could not save that listing.");
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">My listings</h2>
      <form
        onSubmit={submit}
        className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2"
      >
        <label className="text-sm">
          Tool name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
            placeholder="e.g. Cordless drill"
          />
        </label>
        <label className="text-sm">
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("-", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Condition
          <select
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Short description
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
            placeholder="What is included, any quirks…"
          />
        </label>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {editing ? "Save changes" : "List this tool"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm"
            >
              Cancel editing
            </button>
          )}
        </div>
      </form>

      {mine === undefined ? (
        <p className="text-sm text-stone-500">Loading your listings…</p>
      ) : mine.length === 0 ? (
        <p className="text-sm text-stone-500">
          You have not listed anything yet. Your drill deserves better.
        </p>
      ) : (
        <ul className="space-y-3">
          {mine.map((tool: any) => (
            <li
              key={tool._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">{tool.name}</p>
                <p className="text-xs text-stone-500">
                  {tool.category.replace("-", " ")} · {tool.condition} ·{" "}
                  {tool.status === "available" ? "Available" : "On loan"}
                  {tool.pendingRequests > 0 &&
                    ` · ${tool.pendingRequests} pending request(s)`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(tool._id);
                    setForm({
                      name: tool.name,
                      category: tool.category,
                      condition: tool.condition,
                      description: tool.description,
                    });
                  }}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${tool.name}" and its requests?`)) {
                      remove({ toolId: tool._id }).catch(() => {});
                    }
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
