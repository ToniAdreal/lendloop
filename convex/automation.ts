import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getCurrentUser } from "./helpers";

/**
 * Recent automation activity for one loan: webhook dispatches plus reminder
 * write-backs, merged newest-first. Visible to the loan's borrower, its owner,
 * and admins only (RBAC checked here, server-side).
 */
export const listForLoan = query({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const loan = await ctx.db.get(args.requestId);
    if (!loan) return [];
    const involved =
      loan.borrowerClerkId === me.clerkId ||
      loan.ownerClerkId === me.clerkId ||
      me.role === "admin";
    if (!involved) return [];

    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .collect();
    const merged = [
      ...events.map((e) => ({
        kind: e.kind,
        detail: e.detail,
        createdAt: e.createdAt,
      })),
      ...reminders.map((r) => ({
        kind: "reminder",
        detail: `Overdue reminder ${r.status} via ${r.channel}.`,
        createdAt: r.createdAt,
      })),
    ];
    return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  },
});

/** Append an automation event (used by the webhook action). */
export const recordEvent = internalMutation({
  args: {
    requestId: v.id("borrowRequests"),
    kind: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("automationEvents", {
      requestId: args.requestId,
      kind: args.kind,
      detail: args.detail,
      createdAt: Date.now(),
    });
  },
});

/**
 * Idempotent reminder write-back: if the idempotencyKey was already recorded,
 * the existing row is returned and nothing is duplicated. n8n retries are
 * therefore safe.
 */
export const recordReminder = internalMutation({
  args: {
    requestId: v.id("borrowRequests"),
    borrowerEmail: v.string(),
    channel: v.string(),
    status: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotencyKey", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      return { ok: true, duplicate: true, reminderId: existing._id };
    }
    const loan = await ctx.db.get(args.requestId);
    if (!loan) throw new Error("Loan not found.");
    const reminderId = await ctx.db.insert("reminders", {
      requestId: args.requestId,
      borrowerEmail: args.borrowerEmail,
      channel: args.channel,
      status: args.status,
      idempotencyKey: args.idempotencyKey,
      createdAt: Date.now(),
    });
    await ctx.db.insert("automationEvents", {
      requestId: args.requestId,
      kind: "reminder",
      detail: `Overdue reminder ${args.status} via ${args.channel} (write-back from n8n).`,
      createdAt: Date.now(),
    });
    return { ok: true, duplicate: false, reminderId };
  },
});
