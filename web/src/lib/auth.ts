import "server-only";

import { redirect } from "next/navigation";
import { apiGet } from "./api-server";
import { roleHome, type Role, type User } from "./types";

/*
 * Server-side auth helpers (the "Data Access Layer").
 * The FastAPI backend is the source of truth: we forward the login cookie to
 * GET /api/auth/me and trust its answer. Next.js never decodes the token itself.
 */

/** The logged-in user, or null. Must be called inside a <Suspense> boundary. */
export async function getCurrentUser(): Promise<User | null> {
  const result = await apiGet<User>("/api/auth/me");
  return result.ok ? result.data : null;
}

/**
 * Use at the top of a protected page section.
 * Not logged in → /login. Wrong role → that user's own dashboard.
 */
export async function requireRole(role: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${roleHome[role]}`);
  if (user.role !== role) redirect(roleHome[user.role]);
  return user;
}
