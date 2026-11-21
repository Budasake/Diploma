import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Бүртгүүлэх · AI Сургалтын Туслах" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Бүртгэл үүсгэх</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Оюутны бүртгэл үүсгэнэ. Багшийн эрхийг админ олгоно.
      </p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Бүртгэлтэй юу?{" "}
        <Link href="/login" className="font-medium text-primary-soft-foreground hover:underline">
          Нэвтрэх
        </Link>
      </p>
    </>
  );
}
