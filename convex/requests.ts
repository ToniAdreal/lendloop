import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCurrentUser, requireAdmin, requireUser, todayStr } from "./helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create a borrow request. Server-side rules:
 * - borrower must be signed in and synced
 * - cannot borrow your own tool
 * - dates must be a valid, non-past range
 * - no overlapping approved loan for the same window
 * Side effect: schedules the n8n webhook action (request_created).
 */
export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!DATE_RE.test(args.startDate) || !DATE_RE.test(args.endDate)) {
      throw new Error("Dates must be YYYY-MM-DD.");
    }
    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    if (args.startDate < todayStr()) {
      throw new Error("Start date cannot be in the past.");
    }
    const tool = await ctx.db.get(args.toolId);
    if (!tool) throw new Error("Tool not found.");
    if (tool.ownerClerkId === me.clerkId) {
      throw new Error("You cannot borrow your own tool.");
    }
    const existing = await ctx.db
      .query("borrowRequests")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .collect();
    const clash = existing.find(
      (r) =>
        r.status === "approved" &&
        r.startDate <= args.endDate &&
        args.startDate <= r.endDate,
    );
    if (clash) {
      throw new Error("That tool is already booked for part of this range.");
    }
    const now = Date.now();
    const requestId = await ctx.db.insert("borrowRequests", {
      toolId: args.toolId,
      toolName: tool.name,
      borrowerClerkId: me.clerkId,
      borrowerName: me.name,
      borrowerEmail: me.email,
      ownerClerkId: tool.ownerClerkId,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("automationEvents", {
      requestId,
      kind: "request_created",
      detail: `${me.name} requested "${tool.name}" for ${args.startDate} to ${args.endDate}.`,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.notifyN8n, {
      requestId,
      event: "request_created",
    });
    return requestId;
  },
});

/** Borrower's own requests. */
export const listMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("borrowRequests")
      .withIndex("by_borrower", (q) => q.eq("borrowerClerkId", me.clerkId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, borrowerEmail: undefined }));
  },
});

/**
 * Requests on the signed-in user's own tools.
 * borrowerEmail is stripped: owners need a name and dates, not an inbox.
 */
export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("borrowRequests")
      .withIndex("by_owner", (q) => q.eq("ownerClerkId", me.clerkId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, borrowerEmail: undefined }));
  },
});

/** Admin-only: every loan in the system. */
export const listAllLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("borrowRequests").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Owner approves or declines a pending request on their own tool. */
export const respond = mutation({
  args: {
    requestId: v.id("borrowRequests"),
    decision: v.union(v.literal("approved"), v.literal("declined")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    if (req.ownerClerkId !== me.clerkId) {
      throw new Error("Only the tool owner can respond to this request.");
    }
    if (req.status !== "pending") {
      throw new Error(`Request is already ${req.status}.`);
    }
    if (args.decision === "approved") {
      const siblings = await ctx.db
        .query("borrowRequests")
        .withIndex("by_tool", (q) => q.eq("toolId", req.toolId))
        .collect();
      const clash = siblings.find(
        (r) =>
          r._id !== req._id &&
          r.status === "approved" &&
          r.startDate <= req.endDate &&
          req.startDate <= r.endDate,
      );
      if (clash) throw new Error("Another approved loan overlaps this range.");
    }
    await setStatusAndNotify(ctx, req._id, args.decision);
  },
});

/** Borrower cancels their own pending request. */
export const cancel = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    if (req.borrowerClerkId !== me.clerkId) {
      throw new Error("Only the borrower can cancel this request.");
    }
    if (req.status !== "pending") {
      throw new Error(`Request is already ${req.status}.`);
    }
    await setStatusAndNotify(ctx, req._id, "cancelled");
  },
});

/** Mark an approved loan returned. Owner or borrower may confirm. */
export const markReturned = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    if (req.ownerClerkId !== me.clerkId && req.borrowerClerkId !== me.clerkId) {
      throw new Error("Only the lender or borrower can close this loan.");
    }
    if (req.status !== "approved") {
      throw new Error(`Loan is ${req.status}, not an active approved loan.`);
    }
    await setStatusAndNotify(ctx, req._id, "returned");
  },
});

async function setStatusAndNotify(
  ctx: any,
  requestId: any,
  status: "approved" | "declined" | "cancelled" | "returned",
) {
  const now = Date.now();
  await ctx.db.patch(requestId, { status, updatedAt: now });
  await ctx.db.insert("automationEvents", {
    requestId,
    kind: "status_changed",
    detail: `Status changed to ${status}.`,
    createdAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.webhooks.notifyN8n, {
    requestId,
    event: "status_changed",
  });
}

/** Internal: full loan record used to build the n8n webhook payload. */
export const getLoanInternal = internalQuery({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

/**
 * Internal: overdue loans = approved, endDate before today, not returned.
 * Returns the minimum fields the reminder flow needs.
 */
export const listOverdueInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayStr();
    const approved = await ctx.db
      .query("borrowRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    return approved
      .filter((r) => r.endDate < today)
      .map((r) => ({
        loanId: r._id,
        toolName: r.toolName,
        borrowerName: r.borrowerName,
        borrowerEmail: r.borrowerEmail,
        dueDate: r.endDate,
      }));
  },
});
