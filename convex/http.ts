import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hmacSha256Hex, safeEqual } from "./helpers";

/**
 * HTTP endpoints consumed by n8n (served from the Convex *site* URL,
 * https://<deployment>.convex.site).
 *
 * Authentication (LENDLOOP_SHARED_SECRET):
 * - GET  /overdue-loans        headers x-lendloop-timestamp + x-lendloop-signature
 *                              where signature = HMAC(secret, `${timestamp}.GET./overdue-loans`)
 * - POST /reminders/writeback  same headers; signature = HMAC(secret, `${timestamp}.${rawBody}`)
 * Timestamps must be within 5 minutes, which bounds replay windows.
 */

const MAX_SKEW_MS = 5 * 60 * 1000;

async function verify(
  req: Request,
  signedPayload: (timestamp: string) => string,
): Promise<boolean> {
  const secret = process.env.LENDLOOP_SHARED_SECRET;
  if (!secret) return false;
  const timestamp = req.headers.get("x-lendloop-timestamp");
  const signature = req.headers.get("x-lendloop-signature");
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) return false;
  const expected = await hmacSha256Hex(secret, signedPayload(timestamp));
  return safeEqual(expected, signature);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const overdueLoans = httpAction(async (ctx, req) => {
  const ok = await verify(req, (ts) => `${ts}.GET./overdue-loans`);
  if (!ok) return json({ error: "unauthorized" }, 401);
  const loans = await ctx.runQuery(internal.requests.listOverdueInternal, {});
  return json({ overdue: loans, count: loans.length });
});

const reminderWriteback = httpAction(async (ctx, req) => {
  const rawBody = await req.text();
  const ok = await verify(req, (ts) => `${ts}.${rawBody}`);
  if (!ok) return json({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { loanId, borrowerEmail, channel, status, idempotencyKey } = body ?? {};
  if (!loanId || !idempotencyKey) {
    return json({ error: "loanId and idempotencyKey are required" }, 400);
  }
  try {
    const result = await ctx.runMutation(internal.automation.recordReminder, {
      requestId: loanId,
      borrowerEmail: borrowerEmail ?? "",
      channel: channel ?? "mock-email",
      status: status ?? "sent",
      idempotencyKey,
    });
    return json(result);
  } catch (err) {
    return json({ error: String(err).slice(0, 200) }, 400);
  }
});

const http = httpRouter();
http.route({ path: "/overdue-loans", method: "GET", handler: overdueLoans });
http.route({
  path: "/reminders/writeback",
  method: "POST",
  handler: reminderWriteback,
});

export default http;
