/**
 * Coze OAuth 登录入口
 * GET /api/auth/login
 *
 * 重定向到 Coze 授权页面
 */
import { COZE_OAUTH_BASE, OAUTH_SCOPE } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const clientId = env.COZE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'OAuth 未配置，请在 Cloudflare Pages 环境变量中设置 COZE_OAUTH_CLIENT_ID' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: crypto.randomUUID(),
    scope: OAUTH_SCOPE,
  });

  return Response.redirect(`${COZE_OAUTH_BASE}/open/oauth/authorize?${params}`, 302);
}
