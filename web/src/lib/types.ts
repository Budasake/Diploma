export type Role = "student" | "teacher" | "admin";

/** Matches the backend's UserOut schema. */
export type User = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
};

/** Matches the backend's CourseOut schema. join_code is only sent to the course's teacher. */
export type Course = {
  id: number;
  title: string;
  code: string | null;
  description: string | null;
  teacher_name: string;
  student_count: number;
  created_at: string;
  join_code: string | null;
};

export type Student = {
  id: number;
  full_name: string;
  email: string;
  joined_at: string;
};

export type MaterialStatus = "processing" | "ready" | "no_text" | "failed";

/** Matches the backend's MaterialOut schema. */
export type Material = {
  id: number;
  course_id: number;
  filename: string;
  file_type: "pdf" | "docx";
  size_bytes: number;
  status: MaterialStatus;
  error: string | null;
  page_count: number | null;
  chunk_count: number;
  created_at: string;
  processed_at: string | null;
};

/** URL that opens/downloads the original file (PDFs open in the browser). */
export function materialFileUrl(m: Pick<Material, "id" | "course_id">): string {
  return `/api/courses/${m.course_id}/materials/${m.id}/file`;
}

/** One piece of text the AI can search (what it "read" from a file). */
export type Chunk = { id: number; position: number; page: number | null; text: string };

/** Matches the backend's FaqOut schema. */
export type FaqItem = {
  id: number;
  category: string | null;
  question: string;
  answer: string;
  source: "import" | "manual";
  position: number;
  created_at: string;
  updated_at: string;
};

export type FaqImportResult = { found: number; added: number; updated: number; unchanged: number };

export type SearchResult = {
  query: string;
  faq: { id: number; category: string | null; question: string; answer: string; similarity: number }[];
  chunks: { material_id: number; filename: string; page: number | null; text: string; similarity: number }[];
};

/** Group FAQ items by category, keeping their order. */
export function groupFaq(items: FaqItem[]): [string, FaqItem[]][] {
  const groups = new Map<string, FaqItem[]>();
  for (const item of items) {
    const key = item.category ?? "Бусад";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

export const roleHome: Record<Role, string> = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
};

export const roleLabel: Record<Role, string> = {
  student: "Оюутан",
  teacher: "Багш",
  admin: "Админ",
};
