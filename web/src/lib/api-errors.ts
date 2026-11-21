/** Turn backend error codes into Mongolian messages for the user. */
const messages: Record<string, string> = {
  email_taken: "Энэ имэйл хаягаар бүртгэл аль хэдийн үүссэн байна.",
  invalid_credentials: "Имэйл эсвэл нууц үг буруу байна.",
  inactive_user: "Таны бүртгэл идэвхгүй байна. Админтай холбогдоно уу.",
  not_authenticated: "Та эхлээд нэвтэрнэ үү.",
  forbidden: "Танд энэ үйлдлийг хийх эрх байхгүй.",
};

export const NETWORK_ERROR = "Сервертэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.";
const FALLBACK = "Алдаа гарлаа. Дахин оролдоно уу.";

export async function errorMessageFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return messages[body.detail] ?? FALLBACK;
    if (res.status === 422) return "Оруулсан мэдээллээ шалгана уу.";
  } catch {
    // not JSON
  }
  return FALLBACK;
}

/** Only allow redirects to our own pages (never to another website). */
export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
