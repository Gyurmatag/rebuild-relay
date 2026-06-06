import { getEnv, readVar, resolveBaseUrl } from "@/lib/cf";
import { createConnector } from "@/lib/connectors";
import { LINEAR_MCP_URL, exchangeCode } from "@/lib/linear-oauth";
import { mcpCallTool } from "@/lib/mcp-client";
import { getSessionFromRequest } from "@/lib/require-session";

/** Look up the workspace's first team id so save_issue has a team to create in. */
async function fetchDefaultTeam(accessToken: string): Promise<string> {
  try {
    const result = await mcpCallTool(LINEAR_MCP_URL, { Authorization: `Bearer ${accessToken}` }, "list_teams", {});
    const parsed = JSON.parse(result.text) as { teams?: Array<{ id?: string }> };
    return parsed.teams?.[0]?.id ?? "";
  } catch {
    return "";
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/**
 * OAuth redirect target. Validates state, exchanges the code (PKCE) for tokens
 * at Linear, and stores a ready-to-use "Linear (OAuth)" MCP connector whose
 * bearer token is the access token.
 */
export async function GET(request: Request) {
  const env = await getEnv();
  const baseUrl = (readVar(env, "PUBLIC_BASE_URL") ?? resolveBaseUrl(request, env)).replace(/\/$/, "");
  const back = (query: string) => Response.redirect(`${baseUrl}/integrations${query}`, 302);

  if (!(await getSessionFromRequest(env, request))) {
    return Response.redirect(`${baseUrl}/login`, 302);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return back(`?error=${encodeURIComponent(oauthError)}`);

  const cookie = readCookie(request.headers.get("cookie"), "linear_oauth");
  if (!cookie || !code || !state) return back(`?error=missing_oauth_state`);

  let saved: { state: string; codeVerifier: string; clientId: string };
  try {
    saved = JSON.parse(atob(cookie));
  } catch {
    return back(`?error=bad_oauth_state`);
  }
  if (saved.state !== state) return back(`?error=state_mismatch`);

  const redirectUri = `${baseUrl}/api/connectors/linear-oauth/callback`;

  try {
    const token = await exchangeCode({
      code,
      redirectUri,
      clientId: saved.clientId,
      codeVerifier: saved.codeVerifier,
    });
    const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
    const team = await fetchDefaultTeam(token.access_token);

    await createConnector(env, {
      name: "Linear (OAuth)",
      type: "mcp",
      config: {
        url: LINEAR_MCP_URL,
        toolName: "save_issue",
        token: token.access_token,
        refreshToken: token.refresh_token ?? "",
        tokenExpiresAt: expiresAt,
        clientId: saved.clientId,
        oauth: "true",
        ...(team ? { team } : {}),
      },
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${baseUrl}/integrations?connected=linear`,
        "Set-Cookie": `linear_oauth=; Path=/api/connectors/linear-oauth; Max-Age=0`,
      },
    });
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "token exchange failed");
    return back(`?error=${message}`);
  }
}
