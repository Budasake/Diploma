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
