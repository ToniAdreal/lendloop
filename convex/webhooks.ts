import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hmacSha256Hex } from "./helpers";

/**
 * Fires an HMAC-signed webhook to n8n whenever a borrow request is created or
 * changes status. Scheduled (ctx.scheduler) from the request mutations so the
 * mutation itself stays fast and transactional.
 *
 * Signature: hex HMAC-SHA256 of the raw JSON body, keyed by N8N_WEBHOOK_SECRET,
 * sent as `x-lendloop-signature`. The n8n "request-notification" workflow
 * verifies it before doing anything (see n8n/request-notification.json).
 *
 * Payload is minimized: names + tool + dates + status. No email addresses:
 * request notifications do not need them (reminders use the overdue endpoint,
 * which is separately authenticated).
 */
export const notifyN8n = internalAction({
  args: {
    requestId: v.id("borrowRequests"),
    event: v.string(), // request_created | status_changed
  },
  handler: async (ctx, args) => {
    const loan = await ctx.runQuery(internal.requests.getLoanInternal, {
      requestId: args.requestId,
    });
    if (!loan) return;

    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) {
      await ctx.runMutation(internal.automation.recordEvent, {
        requestId: args.requestId,
        kind: "webhook_skipped",
        detail: "N8N_WEBHOOK_URL is not configured; webhook skipped.",
      });
      return;
    }

    const payload = {
      event: args.event,
      occurredAt: new Date().toISOString(),
      loan: {
        id: loan._id,
        toolName: loan.toolName,
        borrowerName: loan.borrowerName,
        ownerClerkId: loan.ownerClerkId,
        startDate: loan.startDate,
        endDate: loan.endDate,
        status: loan.status,
      },
    };
    const body = JSON.stringify(payload);
    const secret = process.env.N8N_WEBHOOK_SECRET ?? "";
    const signature = await hmacSha256Hex(secret, body);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lendloop-signature": signature,
          "x-lendloop-event": args.event,
        },
        body,
      });
      await ctx.runMutation(internal.automation.recordEvent, {
        requestId: args.requestId,
        kind: res.ok ? "webhook_sent" : "webhook_failed",
        detail: res.ok
          ? `Webhook to n8n delivered (${args.event}).`
          : `n8n webhook returned HTTP ${res.status} (${args.event}).`,
      });
    } catch (err) {
      await ctx.runMutation(internal.automation.recordEvent, {
        requestId: args.requestId,
        kind: "webhook_failed",
        detail: `n8n webhook delivery failed (${args.event}): ${String(err).slice(0, 200)}`,
      });
    }
  },
});
