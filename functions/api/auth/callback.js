/**
 * Coze OAuth 回调处理
 * GET /api/auth/callback?code=xxx&state=xxx
 *
 * 1. 用 code 换 access_token（调用 Coze Token API）
 * 2. 获取用户信息（从 token 响应或 Coze 用户 API）
 * 3. 创建/更新用户记录（初始化 100 积分）
 * 4. 创建 session 存入 KV
 * 5. 设置 cookie，重定向到首页
 */
import KV from '../../lib/kv.js';
import { COZE_API_BASE, COZE_OAUTH_TOKEN_URL, getOAuthConfig } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Coze 授权失败
  if (error) {
    const errorDesc = url.searchParams.get('error_description') || error;
    return new Response(renderErrorPage(`授权失败: ${errorDesc}`), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!code) {
    return new Response(renderErrorPage('授权失败：缺少 code 参数'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { clientId, clientSecret } = getOAuthConfig(env);
  const redirectUri = `${url.origin}/api/auth/callback`;

  // Step 1: 用授权码换取 token
  const tokenResp = await fetch(COZE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResp.json();

  if (!tokenData.access_token) {
    const errMsg = tokenData.error_description || tokenData.error || JSON.stringify(tokenData);
    return new Response(renderErrorPage(`获取 token 失败: ${errMsg}`), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || '';
  const expiresIn = tokenData.expires_in || 7200;

  // Step 2: 获取用户信息
  let userId = tokenData.user_id || tokenData.sub || '';
  let userName = tokenData.nickname || tokenData.name || '';
  let avatar = tokenData.avatar_url || tokenData.picture || '';

  // 如果 token 响应没有用户信息，尝试调用 Coze 用户 API
  if (!userId) {
    try {
      const userResp = await fetch(`${COZE_API_BASE}/open_api/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (userResp.ok) {
        const userData = await userResp.json();
        userId = userData.user_id || userData.data?.user_id || '';
        userName = userData.nickname || userData.data?.nickname || '';
        avatar = userData.avatar_url || userData.data?.avatar_url || '';
      }
    } catch {
      // 用户 API 可能不存在，继续用 fallback
    }
  }

  // Fallback: 从 token 生成稳定 ID
  if (!userId) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    userId = 'u_' + hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  if (!userName) {
    userName = `Coze用户_${String(userId).slice(-4)}`;
  }

  userId = String(userId);

  // Step 3: 创建或更新用户
  let user = await KV.getUser(env, userId);
  if (!user) {
    user = await KV.createUser(env, userId, userName);
    await KV.addLog(env, userId, {
      action: 'first_login',
      agentType: null,
      cost: 0,
      message: '首次登录，获得 100 积分',
      page: '/',
    });
  } else {
    await KV.updateUser(env, userId, { name: userName, avatar });
  }

  // Step 4: 创建 session
  const sessionId = await KV.createSession(env, {
    userId,
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    name: userName,
  });

  // Step 5: 设置 cookie 并重定向到首页
  const response = Response.redirect(`${url.origin}/`, 302);
  const headers = new Headers(response.headers);
  headers.append(
    'Set-Cookie',
    `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
  );

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function renderErrorPage(msg) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>登录错误</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
.err{background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.1);max-width:500px;text-align:center}
.err h2{color:#e24b4a;margin-bottom:12px}.err p{color:#666;line-height:1.6}
.err a{display:inline-block;margin-top:20px;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none}
</style></head>
<body><div class="err"><h2>登录失败</h2><p>${msg}</p><a href="/">返回首页</a></div></body></html>`;
}
