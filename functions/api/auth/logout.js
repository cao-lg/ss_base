/**
 * 退出登录
 * GET /api/auth/logout
 */
import KV from '../../lib/kv.js';

export async function onRequestGet({ env, request, data }) {
  const sessionId = data?.sessionId;

  if (sessionId) {
    await KV.deleteSession(env, sessionId);
  }

  const url = new URL(request.url);
  const response = Response.redirect(`${url.origin}/`, 302);
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', 'session_id=; Path=/; HttpOnly; Secure; Max-Age=0');

  return new Response(response.body, { status: response.status, headers });
}
