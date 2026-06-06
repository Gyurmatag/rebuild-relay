import { createAuth } from "@/lib/auth";

/**
 * Returns the authenticated session for an API route, or null if unauthenticated.
 * Pass the route's Request; Better Auth reads the session cookie from its headers.
 */
export async function getSessionFromRequest(env: CloudflareEnv, request: Request) {
  const auth = createAuth(env);
  return auth.api.getSession({ headers: request.headers }).catch(() => null);
}
