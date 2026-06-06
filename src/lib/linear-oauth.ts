/**
 * OAuth 2.1 client for Linear's remote MCP server (https://mcp.linear.app/mcp).
 *
 * Uses the discovered authorization-server metadata: dynamic client
 * registration (public client, no secret) + authorization code flow with PKCE
 * (S256), and refresh tokens. The resulting access token is used as the bearer
 * for MCP calls, so the existing MCP connector path works unchanged.
 */

export const LINEAR_MCP_URL = "https://mcp.linear.app/mcp";
const REGISTRATION_ENDPOINT = "https://mcp.linear.app/register";
const AUTHORIZE_ENDPOINT = "https://mcp.linear.app/authorize";
const TOKEN_ENDPOINT = "https://mcp.linear.app/token";
const SCOPE = "read write";

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

function base64url(bytes: ArrayBuffer): string {
  let s = "";
  const b = new Uint8Array(bytes);
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 48): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return base64url(b.buffer);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

/** Register a public OAuth client for this redirect URI (DCR). Returns client_id. */
export async function registerClient(redirectUri: string): Promise<string> {
  const res = await fetch(REGISTRATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Rebuild Relay",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Linear client registration failed (${res.status})`);
  const data = (await res.json()) as { client_id?: string };
  if (!data.client_id) throw new Error("Linear registration returned no client_id");
  return data.client_id;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", LINEAR_MCP_URL);
  return url.toString();
}

export async function exchangeCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
    resource: LINEAR_MCP_URL,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Linear token exchange failed (${res.status})`);
  return (await res.json()) as TokenSet;
}

export async function refreshAccessToken(params: { refreshToken: string; clientId: string }): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    resource: LINEAR_MCP_URL,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Linear token refresh failed (${res.status})`);
  return (await res.json()) as TokenSet;
}
