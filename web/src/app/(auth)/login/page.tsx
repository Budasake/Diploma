import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Нэвтрэх · AI Сургалтын Туслах" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Тавтай морил</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Бүртгэлээрээ нэвтэрнэ үү.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">
        Бүртгэлгүй юу?{" "}
        <Link href="/register" className="font-medium text-primary-soft-foreground hover:underline">
          Бүртгүүлэх
        </Link>
      </p>
    </>
  );
}
