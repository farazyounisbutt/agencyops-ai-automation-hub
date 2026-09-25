"use client";

import { SignInButton, SignOutButton, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type LocalUser = { id: string; email: string; name: string | null };
type Result = { subject: string; user?: LocalUser; error?: string };

export function AuthStatus() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    const controller = new AbortController();
    const subject = userId;
    async function load() {
      try {
        const token = await getToken();
        if (!token)
          throw new Error("Your session expired. Please sign in again.");
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) throw new Error("The application API is not configured.");
        const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 403)
          throw new Error(
            "Your account is signed in but has not been provisioned for AgencyOps. Contact your administrator.",
          );
        if (response.status === 401)
          throw new Error(
            "Your session could not be verified. Please sign in again.",
          );
        if (!response.ok)
          throw new Error(
            "AgencyOps is temporarily unavailable. Please try again later.",
          );
        const user: LocalUser = await response.json();
        if (!controller.signal.aborted) setResult({ subject, user });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            subject,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load your account.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [isLoaded, isSignedIn, userId, getToken]);

  if (!isLoaded) return <p role="status">Loading sign-in status…</p>;
  if (!isSignedIn)
    return (
      <SignInButton mode="redirect">
        <button className="rounded bg-black px-5 py-3 text-white dark:bg-white dark:text-black">
          Sign in
        </button>
      </SignInButton>
    );
  const current = result?.subject === userId ? result : null;
  return (
    <section className="space-y-4">
      <p>You are signed in.</p>
      {!current && <p role="status">Loading your AgencyOps account…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.user && (
        <p>
          Welcome, {current.user.name ?? current.user.email}.<br />
          {current.user.email}
        </p>
      )}
      <SignOutButton redirectUrl="/">
        <button
          className="rounded border px-5 py-3"
          onClick={() => setResult(null)}
        >
          Sign out
        </button>
      </SignOutButton>
    </section>
  );
}
