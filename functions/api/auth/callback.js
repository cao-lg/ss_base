/**
 * OAuth 回调处理
 * GET /api/auth/callback?code=xxx&state=xxx
 */
import { getOAuthConfig } from '../../lib/config.js';
import KV from '../../lib/kv.js';

/* ===== 工具 ===== */
function getCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const m = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

function renderErrorPage(message) {
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>授权失败 - 数智电商</title>
<style>
  body { font-family: system-ui,sans-serif; background:#0f172a; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#1e293b; border-radius:16px; padding:40px; text-align:center; max-width:420px; }
  .icon { font-size:48px; margin-bottom:16px; }
  .title { font-size:20px; font-weight:600; margin-bottom:8px; }
  .msg { color:#94a3b8; font-size:14px; margin-bottom:24px; line-height:1.6; }
  .btn { display:inline-block; padding:10px 24px; background:#6366f1; color:white; border-radius:8px; text-decoration:none; font-size:14px; }
</style></head><body>
<div class="card">
  <div class="icon">⚠️</div>
  <div class="title">授权失败</div>
  <div class="msg">${message}</div>
  <a href="/" class="btn">返回首页</a>
</div></body></html>`, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ===== 主逻辑 ===== */
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  /* 1. 验证 state（防 CSRF）*/
  const savedState = getCookie(request, 'oauth_state');
  if (!state || state !== savedState) {
    return renderErrorPage('安全校验失败（state 不匹配），请重新登录。');
  }

  if (!code) {
    return renderErrorPage('授权服务器未返回授权码（code），请重新登录。');
  }

  const { clientId, clientSecret } = getOAuthConfig(env);
  if (!clientId || !clientSecret) {
    return renderErrorPage('服务器 OAuth 配置缺失，请联系管理员。');
  }

  const redirectUri = `${url.origin}/api/auth/callback`;

  try {
    /* 2. 用 code 换 access_token
     * Coze OAuth2 token endpoint 要求：
     * - Content-Type: application/x-www-form-urlencoded
     * - client_id / client_secret 放在 body（form 字段），不是 Basic Auth
     */
    const tokenBodyParams = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      code:          code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
    });
    const tokenResp = await fetch('https://api.coze.cn/api/permission/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBodyParams.toString(),
    });

    const tokenBody = await tokenResp.text();
    let tokenData;
    try { tokenData = JSON.parse(tokenBody); } catch { tokenData = { raw: tokenBody }; }

    if (!tokenResp.ok || !tokenData.access_token) {
      const msg = tokenData.message || tokenData.msg || JSON.stringify(tokenData);
      // DEBUG: 暴露关键信息用于排查，确认后删除
      const debug = ` [DEBUG clientId=${clientId?.slice(0,10)}... secret_len=${clientSecret?.length} ct=${tokenResp.headers.get('content-type')} status=${tokenResp.status}]`;
      return renderErrorPage(`令牌获取失败：${msg}${debug}`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    /* 3. 获取 Coze 用户信息 */
    let cozeUserName = 'Coze用户_' + Math.random().toString(36).slice(2, 8);
    let cozeUserId  = null;
    try {
      const meResp = await fetch('https://api.coze.cn/v1/users/me', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      if (meResp.ok) {
        const meData = await meResp.json();
        cozeUserName = meData.data?.name || meData.data?.nickname || cozeUserName;
        cozeUserId  = meData.data?.user_id || meData.data?.id || null;
      }
    } catch { /* 获取用户信息失败不阻塞登录 */ }

    /* 4. 查找/创建本地用户（KV）*/
    let userId  = null;
    let isNew  = false;

    if (cozeUserId) {
      userId = await KV.getUserIdByCozeId(env, cozeUserId);
    }

    if (!userId) {
      /* 新用户 */
      isNew  = true;
      userId = 'u_' + crypto.randomUUID().slice(0, 8);

      await KV.createUser(env, userId, cozeUserName);

      if (cozeUserId) {
        await KV.bindCozeUserId(env, cozeUserId, userId);
      }
      /* createUser 默认 100 积分，无需额外操作 */
    }

    /* 5. 创建 session（KV key = sessionId）*/
    const sessionId = await KV.createSession(env, {
      userKey:      userId,
      name:         cozeUserName,
      accessToken:  access_token,
      refreshToken: refresh_token || '',
      expiresAt:    Date.now() + (expires_in || 900) * 1000,  /* access_token 过期时间 */
    });

    /* 6. 设置 cookie：session_id = sessionId（UUID）
     *    中间件读 session_id cookie → 查 KV session:{sessionId}
     *    所以 cookie 值必须是 sessionId，不能是 JSON！
     */
    const maxAge = 7 * 24 * 3600;
    const cookie = [
      `session_id=${sessionId}`,
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
      'Path=/',
    ].join('; ');

    const clearStateCookie = [
      'oauth_state=',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
      'Path=/',
    ].join('; ');

    const headers = new Headers({
      'Location': '/',
      'Set-Cookie': [cookie, clearStateCookie].join(', '),
    });

    return new Response(null, { status: 302, headers });

  } catch (err) {
    return renderErrorPage(`服务器内部错误：${err.message}`);
  }
}
