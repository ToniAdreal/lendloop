import { mutation } from "./_generated/server";

/**
 * Demo seed data so the public page is not empty.
 * Run once per deployment:  npx convex run seed:seed
 * Idempotent: if tools already exist it does nothing.
 *
 * Seeds two neighbours (a plain user and an admin, both fictional) and ten
 * tools across all categories, plus one approved loan + one pending request
 * so every dashboard view has something to show. The seeded users have fake
 * Clerk ids ("seed_*") and cannot sign in; they exist purely as catalogue
 * owners. Delete them from the Convex dashboard when you go live.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tools").take(1);
    if (existing.length > 0) return { seeded: false, reason: "already seeded" };

    const now = Date.now();
    const lenders = [
      {
        clerkId: "seed_lender_maya",
        name: "Maya (Demo)",
        email: "maya@lendloop.example",
        role: "user" as const,
        isTrustedLender: true,
      },
      {
        clerkId: "seed_lender_tom",
        name: "Tom (Demo)",
        email: "tom@lendloop.example",
        role: "user" as const,
        isTrustedLender: false,
      },
      {
        clerkId: "seed_admin",
        name: "LendLoop Admin (Demo)",
        email: "admin@lendloop.example",
        role: "admin" as const,
        isTrustedLender: false,
      },
    ];
    for (const u of lenders) {
      await ctx.db.insert("users", { ...u, createdAt: now });
    }

    const tools: [string, string, string, string, string][] = [
      // ownerClerkId, name, category, condition, description
      ["seed_lender_maya", "Cordless Drill Driver 18V", "power-tools", "good", "Two batteries and a full bit set included."],
      ["seed_lender_maya", "Pressure Washer 1600 PSI", "power-tools", "good", "Great for patios and driveways. Hose included."],
      ["seed_lender_tom", "Extension Ladder 6m", "power-tools", "fair", "Sturdy aluminium ladder, one careful owner."],
      ["seed_lender_tom", "Hedge Trimmer", "garden", "good", "Electric hedge trimmer with 20m cable."],
      ["seed_lender_maya", "Wheelbarrow 90L", "garden", "well-used", "Dented but rolls true. Perfect for soil and rubble."],
      ["seed_lender_tom", "Stand Mixer 5L", "kitchen", "new", "Barely used stand mixer with whisk, hook and paddle."],
      ["seed_lender_maya", "Fondue Set for 6", "kitchen", "good", "Electric fondue set, forks and recipes included."],
      ["seed_lender_tom", "4-Person Tent", "camping", "good", "Pitched twice. Includes footprint and repair kit."],
      ["seed_lender_maya", "Camping Stove + Gas", "camping", "good", "Two-burner stove with a fresh gas canister."],
      ["seed_lender_tom", "Projector + Screen", "other", "good", "1080p projector and 100-inch pull-up screen for movie night."],
    ];
    const toolIds: Record<string, string> = {};
    for (const [owner, name, category, condition, description] of tools) {
      const ownerName = owner === "seed_lender_maya" ? "Maya (Demo)" : "Tom (Demo)";
      const id = await ctx.db.insert("tools", {
        ownerClerkId: owner,
        ownerName,
        name,
        category,
        condition,
        description,
        createdAt: now,
        updatedAt: now,
      });
      toolIds[name] = id as unknown as string;
    }

    // One approved, currently-active loan (drill is "on loan" in the UI).
    const drillId = toolIds["Cordless Drill Driver 18V"] as any;
    const today = new Date(now);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const start = new Date(today); start.setDate(start.getDate() - 1);
    const end = new Date(today); end.setDate(end.getDate() + 2);
    const loanId = await ctx.db.insert("borrowRequests", {
      toolId: drillId,
      toolName: "Cordless Drill Driver 18V",
      borrowerClerkId: "seed_lender_tom",
      borrowerName: "Tom (Demo)",
      borrowerEmail: "tom@lendloop.example",
      ownerClerkId: "seed_lender_maya",
      startDate: iso(start),
      endDate: iso(end),
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("automationEvents", {
      requestId: loanId,
      kind: "request_created",
      detail: 'Tom (Demo) requested "Cordless Drill Driver 18V" (seed data).',
      createdAt: now,
    });
    await ctx.db.insert("automationEvents", {
      requestId: loanId,
      kind: "status_changed",
      detail: "Status changed to approved (seed data).",
      createdAt: now,
    });

    // One pending request so "Incoming requests" is not empty for the owner view.
    const tentId = toolIds["4-Person Tent"] as any;
    const pStart = new Date(today); pStart.setDate(pStart.getDate() + 3);
    const pEnd = new Date(today); pEnd.setDate(pEnd.getDate() + 5);
    await ctx.db.insert("borrowRequests", {
      toolId: tentId,
      toolName: "4-Person Tent",
      borrowerClerkId: "seed_lender_maya",
      borrowerName: "Maya (Demo)",
      borrowerEmail: "maya@lendloop.example",
      ownerClerkId: "seed_lender_tom",
      startDate: iso(pStart),
      endDate: iso(pEnd),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { seeded: true, tools: tools.length };
  },
});
