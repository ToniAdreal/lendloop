import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** YYYY-MM-DD for "today" in UTC. Loan dates are date-only strings. */
export function todayStr(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Resolve the signed-in user's record from the Clerk JWT identity.
 * Returns null when there is no identity or the user has not been synced yet
 * (sync happens via users.syncUser right after sign-in).
 */
export async function getCurrentUser(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated or user not synced yet.");
  return user;
}

/** RBAC: admin-only gate, enforced server-side inside Convex functions. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new Error("Admin role required.");
  return user;
}

/**
 * A tool is "on loan" when it has an approved request whose window covers
 * today and which has not been marked returned.
 */
export function activeLoanFor(
  requests: Doc<"borrowRequests">[],
  now: number = Date.now(),
): Doc<"borrowRequests"> | null {
  const today = todayStr(now);
  return (
    requests.find(
      (r) =>
        r.status === "approved" && r.startDate <= today && r.endDate >= today,
    ) ?? null
  );
}

export async function requestsForTool(
  ctx: Ctx,
  toolId: Id<"tools">,
): Promise<Doc<"borrowRequests">[]> {
  return await ctx.db
    .query("borrowRequests")
    .withIndex("by_tool", (q) => q.eq("toolId", toolId))
    .collect();
}

/** HMAC-SHA256 hex digest (WebCrypto; available in Convex actions). */
export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison for shared-secret checks. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
