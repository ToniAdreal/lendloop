import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireAdmin } from "./helpers";

/**
 * Called by the client right after Clerk sign-in (see components/UserSync).
 * Upserts the caller's profile row keyed by the Clerk subject id.
 * The first sync creates a plain "user"; promotion to admin is an explicit,
 * auditable action (Convex dashboard or an existing admin), never automatic.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated.");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    const name =
      identity.name ?? identity.nickname ?? identity.email ?? "Neighbour";
    const email = identity.email ?? "";
    if (existing) {
      await ctx.db.patch(existing._id, { name, email });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name,
      email,
      role: "user",
      isTrustedLender: false,
      createdAt: Date.now(),
    });
  },
});

/** The signed-in user's own profile (null when signed out / not synced). */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isTrustedLender: user.isTrustedLender,
    };
  },
});

/** Admin-only: every registered user (for the Trusted Lender controls). */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isTrustedLender: u.isTrustedLender,
      createdAt: u.createdAt,
    }));
  },
});

/** Admin-only: mark/unmark a lender as "Trusted Lender". */
export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { isTrustedLender: args.trusted });
  },
});
