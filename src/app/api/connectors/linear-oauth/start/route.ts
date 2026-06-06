import { getEnv, readVar, resolveBaseUrl } from "@/lib/cf";
import { buildAuthorizeUrl, pkceChallenge, randomToken, registerClient } from "@/lib/linear-oauth";
import { getSessionFromRequest } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kicks off the Linear MCP OAuth flow: registers a public client (DCR),
 * creates a PKCE verifier + state (stashed in a short-lived cookie), and
 * redirects the operator to Linear's consent screen.
 */
export async function GET(request: Request) {
  const env = await getEnv();
  const baseUrl = (readVar(env, "PUBLIC_BASE_URL") ?? resolveBaseUrl(request, env)).replace(/\/$/, "");

  if (!(await getSessionFromRequest(env, request))) {
    return Response.redirect(`${baseUrl}/login`, 302);
  }

  const redirectUri = `${baseUrl}/api/connectors/linear-oauth/callback`;

  try {
    const clientId = await registerClient(redirectUri);
    const codeVerifier = randomToken();
    const codeChallenge = await pkceChallenge(codeVerifier);
    const state = randomToken(24);
    const cookie = btoa(JSON.stringify({ state, codeVerifier, clientId }));
    const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge });

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl,
        "Set-Cookie": `linear_oauth=${cookie}; Path=/api/connectors/linear-oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "OAuth start failed");
    return Response.redirect(`${baseUrl}/integrations?error=${message}`, 302);
  }
}
