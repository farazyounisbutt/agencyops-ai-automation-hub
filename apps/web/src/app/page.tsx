import { AuthStatus } from "@/components/auth-status";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">AgencyOps</h1>
      <p>Sign in with your approved agency account.</p>
      <AuthStatus />
    </main>
  );
}
