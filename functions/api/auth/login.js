/**
 * Coze OAuth 登录入口
 * GET /api/auth/login
 *
 * 标准 OAuth 2.0 授权码模式：
 *   1. 浏览器跳转到 Coze 授权页（携带 client_id, redirect_uri, response_type=code）
 *   2. 用户在 Coze 授权页同意授权
 *   3. Coze 重定向回 /api/auth/callback?code=xxx
 *   4. callback.js 用 code 换取 access_token
 */
import { COZE_OAUTH_AUTHORIZE_URL, OAUTH_SCOPE, getOAuthConfig } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const { clientId } = getOAuthConfig(env);

  if (!clientId) {
    return new Response(JSON.stringify({
      error: 'OAuth 未配置',
      hint: '请在 Cloudflare Pages → Settings → Environment variables 中设置 COZE_OAUTH_CLIENT_ID 和 COZE_OAUTH_CLIENT_SECRET',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const state = crypto.randomUUID();

  // 构建标准 OAuth 授权 URL，浏览器直接跳转
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
    scope: OAUTH_SCOPE,
  });

  const authUrl = `${COZE_OAUTH_AUTHORIZE_URL}?${params}`;
  return Response.redirect(authUrl, 302);
}
