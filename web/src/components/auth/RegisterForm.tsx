"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NETWORK_ERROR, errorMessageFrom } from "@/lib/api-errors";
import FormAlert from "./FormAlert";
import FormField from "./FormField";
import SubmitButton from "./SubmitButton";

type FieldErrors = Partial<Record<"full_name" | "email" | "password" | "confirm", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Check the form in the browser first, so obvious mistakes don't need a server round-trip. */
function validate(form: FormData): FieldErrors {
  const errors: FieldErrors = {};
  const name = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (name.length < 2) errors.full_name = "Нэрээ оруулна уу.";
  if (!EMAIL_RE.test(email)) errors.email = "Зөв имэйл хаяг оруулна уу.";
  if (password.length < 8) errors.password = "Нууц үг дор хаяж 8 тэмдэгттэй байна.";
  if (confirm !== password) errors.confirm = "Нууц үг таарахгүй байна.";
  return errors;
}

export default function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormError(null);

    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.get("full_name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (!res.ok) {
        setFormError(await errorMessageFrom(res));
        setPending(false);
        return;
      }
      // New accounts are students and are logged in right away.
      router.replace("/student");
      router.refresh();
    } catch {
      setFormError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && <FormAlert message={formError} />}
      <FormField label="Овог нэр" name="full_name" autoComplete="name" error={errors.full_name} placeholder="Б.Болд" />
      <FormField label="Имэйл" name="email" type="email" autoComplete="email" error={errors.email} placeholder="ner@must.edu.mn" />
      <FormField label="Нууц үг" name="password" type="password" autoComplete="new-password" error={errors.password} />
      <FormField label="Нууц үг давтах" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
      <SubmitButton pending={pending}>{pending ? "Бүртгэж байна…" : "Бүртгүүлэх"}</SubmitButton>
    </form>
  );
}
