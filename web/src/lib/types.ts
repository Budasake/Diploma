export type Role = "student" | "teacher" | "admin";

/** Matches the backend's UserOut schema. */
export type User = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
};

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
