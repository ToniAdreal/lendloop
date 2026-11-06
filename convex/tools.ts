import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  activeLoanFor,
  getCurrentUser,
  requestsForTool,
  requireAdmin,
  requireUser,
} from "./helpers";

export const CATEGORIES = [
  "power-tools",
  "garden",
  "kitchen",
  "camping",
  "other",
] as const;

/**
 * PUBLIC catalogue for the landing page.
 * Data minimization: returns ONLY { name, category } for tools that are
 * currently available. No owner name/id, no descriptions, no request data.
 * Deliberately does not require auth.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").collect();
    const available: { name: string; category: string }[] = [];
    for (const tool of tools) {
      const requests = await requestsForTool(ctx, tool._id);
      if (!activeLoanFor(requests)) {
        available.push({ name: tool.name, category: tool.category });
      }
    }
    return available.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Authenticated catalogue: every tool with a computed availability status.
 * Contact details are never included; ownerName + trusted badge are display
 * data only.
 */
export const listAll = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return []; // dashboard syncs the user first; stay graceful
    let tools = await ctx.db.query("tools").collect();
    if (args.category) {
      tools = tools.filter((t) => t.category === args.category);
    }
    const out = [];
    for (const tool of tools) {
      const requests = await requestsForTool(ctx, tool._id);
      const loan = activeLoanFor(requests);
      const owner = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", tool.ownerClerkId))
        .unique();
      out.push({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        ownerName: tool.ownerName,
        ownerIsTrusted: owner?.isTrustedLender ?? false,
        isMine: tool.ownerClerkId === me.clerkId,
        status: loan ? ("on-loan" as const) : ("available" as const),
        onLoanUntil: loan?.endDate ?? null,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** The signed-in user's own listings. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerClerkId", me.clerkId))
      .collect();
    const out = [];
    for (const tool of tools) {
      const requests = await requestsForTool(ctx, tool._id);
      out.push({
        ...tool,
        status: activeLoanFor(requests)
          ? ("on-loan" as const)
          : ("available" as const),
        pendingRequests: requests.filter((r) => r.status === "pending").length,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!args.name.trim()) throw new Error("Tool name is required.");
    const now = Date.now();
    return await ctx.db.insert("tools", {
      ownerClerkId: me.clerkId,
      ownerName: me.name,
      name: args.name.trim(),
      category: args.category,
      condition: args.condition,
      description: args.description.trim(),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Owner-only edit (admins use removeAny for moderation, not silent edits). */
export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found.");
    if (tool.ownerClerkId !== me.clerkId) {
      throw new Error("You can only edit your own listings.");
    }
    await ctx.db.patch(args.toolId, {
      name: args.name.trim(),
      category: args.category,
      condition: args.condition,
      description: args.description.trim(),
      updatedAt: Date.now(),
    });
  },
});

/** Owner deletes own listing; cascades to that tool's requests. */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found.");
    if (tool.ownerClerkId !== me.clerkId) {
      throw new Error("You can only delete your own listings.");
    }
    await deleteToolCascade(ctx, args.toolId);
  },
});

/** Admin moderation: remove ANY listing. RBAC enforced here, server-side. */
export const removeAny = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found.");
    await deleteToolCascade(ctx, args.toolId);
  },
});

async function deleteToolCascade(
  ctx: { db: any },
  toolId: Parameters<typeof requestsForTool>[1],
) {
  const requests = await ctx.db
    .query("borrowRequests")
    .withIndex("by_tool", (q: any) => q.eq("toolId", toolId))
    .collect();
  for (const r of requests) {
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_request", (q: any) => q.eq("requestId", r._id))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);
    const rems = await ctx.db
      .query("reminders")
      .withIndex("by_request", (q: any) => q.eq("requestId", r._id))
      .collect();
    for (const rem of rems) await ctx.db.delete(rem._id);
    await ctx.db.delete(r._id);
  }
  await ctx.db.delete(toolId);
}
