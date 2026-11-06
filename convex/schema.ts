import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * LendLoop data model.
 *
 * Data-minimization notes:
 * - The public catalogue query never reads borrower/owner contact fields; it
 *   projects tools down to { name, category } before returning.
 * - borrowerEmail is stored on the request only because the n8n reminder flow
 *   needs a delivery address; it is never exposed to other users' queries
 *   (incoming-request views strip it, the overdue endpoint returns the minimum
 *   fields n8n needs and is HMAC-authenticated).
 */
export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk user id (JWT `sub`)
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    isTrustedLender: v.boolean(),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  tools: defineTable({
    ownerClerkId: v.string(),
    ownerName: v.string(), // denormalized display name (not contact data)
    name: v.string(),
    category: v.string(), // power-tools | garden | kitchen | camping | other
    condition: v.string(), // new | good | fair | well-used
    description: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerClerkId"])
    .index("by_category", ["category"]),

  borrowRequests: defineTable({
    toolId: v.id("tools"),
    toolName: v.string(), // denormalized so history survives listing edits
    borrowerClerkId: v.string(),
    borrowerName: v.string(),
    borrowerEmail: v.string(), // reminder delivery only, see header note
    ownerClerkId: v.string(),
    startDate: v.string(), // YYYY-MM-DD (inclusive)
    endDate: v.string(), // YYYY-MM-DD (inclusive)
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled"),
      v.literal("returned"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_borrower", ["borrowerClerkId"])
    .index("by_owner", ["ownerClerkId"])
    .index("by_tool", ["toolId"])
    .index("by_status", ["status"]),

  // Append-only log of automation activity per loan: webhook dispatches to n8n
  // and reminder write-backs. Surfaced in the UI as "recent automation activity".
  automationEvents: defineTable({
    requestId: v.id("borrowRequests"),
    kind: v.string(), // request_created | status_changed | webhook_sent | webhook_failed | reminder
    detail: v.string(),
    createdAt: v.number(),
  }).index("by_request", ["requestId"]),

  // Reminder write-backs from n8n. idempotencyKey makes the HTTP endpoint
  // safely retryable: n8n may deliver the same write-back twice.
  reminders: defineTable({
    requestId: v.id("borrowRequests"),
    borrowerEmail: v.string(),
    channel: v.string(), // e.g. "mock-email" | "email"
    status: v.string(), // e.g. "sent"
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),
});
