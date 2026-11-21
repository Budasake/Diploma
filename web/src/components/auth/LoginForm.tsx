"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NETWORK_ERROR, errorMessageFrom, safeNextPath } from "@/lib/api-errors";
import { roleHome, type User } from "@/lib/types";
import FormAlert from "./FormAlert";
import FormField from "./FormField";
import SubmitButton from "./SubmitButton";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);

    try {
      // Goes to FastAPI through the Next.js /api rewrite; the response sets the login cookie.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (!res.ok) {
        setError(await errorMessageFrom(res));
        setPending(false);
        return;
      }
      const user = (await res.json()) as User;
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next ?? roleHome[user.role]);
      router.refresh();
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <FormAlert message={error} />}
      <FormField label="Имэйл" name="email" type="email" autoComplete="email" required placeholder="ner@must.edu.mn" />
      <FormField label="Нууц үг" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pending={pending}>{pending ? "Нэвтэрч байна…" : "Нэвтрэх"}</SubmitButton>
    </form>
  );
}
