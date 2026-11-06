import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import UserSync from "@/components/UserSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "LendLoop - Borrow what you need. Lend what you don't.",
  description:
    "LendLoop is a neighbourhood tool-lending community. Borrow what you need. Lend what you don't.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <ConvexClientProvider>
            <SignedIn>
              <UserSync />
            </SignedIn>
            <header className="border-b border-stone-200 bg-white">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <Link href="/" className="text-lg font-bold tracking-tight">
                  LendLoop
                </Link>
                <nav className="flex items-center gap-4 text-sm">
                  <SignedIn>
                    <Link
                      href="/dashboard"
                      className="font-medium text-emerald-800 hover:underline"
                    >
                      Dashboard
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                  <SignedOut>
                    <Link
                      href="/sign-in"
                      className="rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
                    >
                      Sign in to lend or borrow
                    </Link>
                  </SignedOut>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
            <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
              LendLoop, a fictional neighbourhood lending co-op. Be kind,
              return on time.
            </footer>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
