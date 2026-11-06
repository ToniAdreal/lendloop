import Link from "next/link";
import { SignedOut, SignedIn } from "@clerk/nextjs";
import PublicTools from "@/components/PublicTools";

// Live data comes from Convex; always render on demand.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div>
      <section className="py-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">LendLoop</h1>
        <p className="mt-3 text-lg text-stone-600">
          Borrow what you need. Lend what you don&apos;t.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-stone-500">
          A neighbourhood lending co-op for the tools gathering dust in
          everyone&apos;s garage. Browse what is available below, then sign in
          to request a loan or list a tool of your own.
        </p>
        <div className="mt-6">
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
            >
              Sign in to lend or borrow
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
            >
              Go to your dashboard
            </Link>
          </SignedIn>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Available to borrow now</h2>
        <PublicTools />
      </section>
    </div>
  );
}
