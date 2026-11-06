"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Public, read-only catalogue. The Convex query behind this projects tools to
 * { name, category } only, so no owner information ever reaches this page.
 */
export default function PublicTools() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return <p className="text-sm text-stone-500">Loading available tools…</p>;
  }
  if (tools.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No tools are available right now. Check back soon, or be the first to
        lend something.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool: any, i: number) => (
        <li
          key={`${tool.name}-${i}`}
          className="rounded-lg border border-stone-200 bg-white p-4"
        >
          <p className="font-medium">{tool.name}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
            {String(tool.category).replace("-", " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
