/** Turn backend error codes into Mongolian messages for the user. */
const messages: Record<string, string> = {
  email_taken: "Энэ имэйл хаягаар бүртгэл аль хэдийн үүссэн байна.",
  invalid_credentials: "Имэйл эсвэл нууц үг буруу байна.",
  inactive_user: "Таны бүртгэл идэвхгүй байна. Админтай холбогдоно уу.",
  not_authenticated: "Та эхлээд нэвтэрнэ үү.",
  forbidden: "Танд энэ үйлдлийг хийх эрх байхгүй.",
  invalid_join_code: "Ийм кодтой хичээл олдсонгүй. Кодоо шалгана уу.",
  already_enrolled: "Та энэ хичээлд аль хэдийн нэгдсэн байна.",
  course_not_found: "Хичээл олдсонгүй.",
  student_not_in_course: "Энэ оюутан хичээлд бүртгэлгүй байна.",
  material_not_found: "Материал олдсонгүй.",
  unsupported_file_type: "Зөвхөн PDF болон DOCX файл оруулна уу.",
  file_too_large: "Файл хэт том байна (дээд хэмжээ 50 MB).",
  empty_file: "Файл хоосон байна.",
  duplicate_material: "Энэ файл энэ хичээлд аль хэдийн орсон байна.",
  material_processing: "Файл боловсруулагдаж байна. Түр хүлээнэ үү.",
  faq_not_found: "Асуулт олдсонгүй.",
  faq_docx_only: "Түгээмэл асуултыг зөвхөн DOCX файлаас оруулна.",
  invalid_faq_file: "Файлыг уншиж чадсангүй. Word (DOCX) файл эсэхийг шалгана уу.",
  conversation_not_found: "Яриа олдсонгүй.",
  empty_message: "Асуултаа бичнэ үү.",
  faq_empty: "Файлаас «Асуулт: … / Хариулт: …» хэлбэрийн асуулт олдсонгүй.",
};

export const NETWORK_ERROR = "Сервертэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.";
const FALLBACK = "Алдаа гарлаа. Дахин оролдоно уу.";

/** Mongolian message for a backend error code (e.g. from an XHR response). */
export function messageForCode(code: unknown): string {
  return typeof code === "string" ? (messages[code] ?? FALLBACK) : FALLBACK;
}

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
