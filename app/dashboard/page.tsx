"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import ToolsBrowser from "@/components/ToolsBrowser";
import MyListings from "@/components/MyListings";
import MyRequests from "@/components/MyRequests";
import IncomingRequests from "@/components/IncomingRequests";
import AdminPanel from "@/components/AdminPanel";

type Tab = "tools" | "listings" | "requests" | "incoming" | "admin";

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "tools", label: "All tools" },
  { id: "listings", label: "My listings" },
  { id: "requests", label: "My requests" },
  { id: "incoming", label: "Incoming requests" },
];

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("tools");
  const me = useQuery(api.users.currentUser);
  const isAdmin = me?.role === "admin";
  const tabs = isAdmin
    ? [...BASE_TABS, { id: "admin" as Tab, label: "Admin" }]
    : BASE_TABS;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Your LendLoop</h1>
        {me && (
          <p className="text-sm text-stone-500">
            Signed in as {me.name}
            {me.isTrustedLender && (
              <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                Trusted Lender
              </span>
            )}
          </p>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-emerald-700 text-white"
                : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tools" && <ToolsBrowser />}
      {tab === "listings" && <MyListings />}
      {tab === "requests" && <MyRequests />}
      {tab === "incoming" && <IncomingRequests />}
      {tab === "admin" && isAdmin && <AdminPanel />}
    </div>
  );
}
