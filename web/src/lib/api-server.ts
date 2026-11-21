import "server-only";

import { cookies } from "next/headers";

/*
 * Call the FastAPI backend from Server Components, forwarding the user's login
 * cookie so FastAPI knows who is asking. Must run inside a <Suspense> boundary
 * (it reads the request's cookies).
 */

export const API_URL = process.env.API_URL ?? "http://localhost:8000";
export const AUTH_COOKIE = "access_token";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Cookie: `${AUTH_COOKIE}=${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 503 }; // backend unreachable
  }
}
