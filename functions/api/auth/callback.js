/**
 * Coze OAuth 回调处理
 * GET /api/auth/callback?code=xxx&state=xxx
 *
 * 1. 用 code 换 access_token
 * 2. 获取用户信息
 * 3. 创建/更新用户记录（初始化 100 积分）
 * 4. 创建 session 存入 KV
 * 5. 设置 cookie，重定向到首页
 */
import KV from '../../lib/kv.js';
import { COZE_API_BASE } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('授权失败：缺少 code 参数', { status: 400 });
  }

  const clientId = env.COZE_OAUTH_CLIENT_ID;
  const clientSecret = env.COZE_OAUTH_CLIENT_SECRET;
  const redirectUri = `${url.origin}/api/auth/callback`;

  // Step 1: 换取 token
  const tokenResp = await fetch(`${COZE_API_BASE}/open_oauth/token`, {
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
    return new Response(`获取 token 失败: ${JSON.stringify(tokenData)}`, { status: 400 });
  }

  // Step 2: 获取用户信息
  const userResp = await fetch(`${COZE_API_BASE}/open_api/user`, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  const userData = await userResp.json();

  if (!userData.user_id) {
    return new Response(`获取用户信息失败: ${JSON.stringify(userData)}`, { status: 400 });
  }

  const userId = String(userData.user_id);
  const userName = userData.nickname || userData.name || `Coze用户_${userId.slice(-4)}`;
  const avatar = userData.avatar_url || '';

  // Step 3: 创建或更新用户
  let user = await KV.getUser(env, userId);
  if (!user) {
    user = await KV.createUser(env, userId, userName);
    // 记录首次登录日志
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
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || '',
    expiresAt: Date.now() + (tokenData.expires_in || 7200) * 1000,
    name: userName,
  });

  // Step 5: 设置 cookie 并重定向
  const response = Response.redirect(`${url.origin}/`, 302);
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
