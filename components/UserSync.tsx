"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * Syncs the Clerk profile into the Convex `users` table once per session,
 * right after sign-in. All RBAC decisions read that row server-side.
 */
export default function UserSync() {
  const { isSignedIn, isLoaded } = useUser();
  const syncUser = useMutation(api.users.syncUser);
  const done = useRef(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && !done.current) {
      done.current = true;
      syncUser({}).catch(() => {
        // Non-fatal: dashboard queries return empty states until sync lands;
        // allow a retry on the next mount.
        done.current = false;
      });
    }
  }, [isLoaded, isSignedIn, syncUser]);

  return null;
}
