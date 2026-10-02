"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AuthBrand from "../(auth)/_components/AuthBrand";
import { useAuthT } from "../(auth)/_components/AuthShell";
import { createWorkspace } from "./actions";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useAuthT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createWorkspace(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <AuthBrand />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-base font-semibold text-zinc-900">{t.onboarding.title}</h1>
          <p className="mb-4 text-sm text-zinc-500">{t.onboarding.body}</p>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <form action={handleSubmit} className="flex flex-col gap-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-zinc-900">{t.onboarding.label}</span>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder={t.onboarding.placeholder}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t.onboarding.submitting : t.onboarding.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
