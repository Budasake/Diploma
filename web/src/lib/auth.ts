import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { roleHome, type Role, type User } from "./types";

/*
 * Server-side auth helpers (the "Data Access Layer").
 * The FastAPI backend is the source of truth: we forward the login cookie to
 * GET /api/auth/me and trust its answer. Next.js never decodes the token itself.
 */

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const COOKIE_NAME = "access_token";

/** The logged-in user, or null. Must be called inside a <Suspense> boundary. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `${COOKIE_NAME}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as User;
  } catch {
    return null; // backend down: treat as logged out
  }
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
