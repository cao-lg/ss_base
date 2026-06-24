/**
 * 认证中间件 —— 校验 session cookie，注入用户信息
 *
 * 对 /api/auth/* 之外的请求生效：
 *   1. 从 cookie 中读取 session_id
 *   2. 查 KV 获取 session 数据
 *   3. 注入到 data.userData 供后续 handler 使用
 */
import KV from './lib/kv.js';

export async function onRequest(context) {
  const { request, env, data, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 登录/回调接口不需要鉴权
  if (path === '/api/auth/login' || path === '/api/auth/callback') {
    return next();
  }

  // 读取 session cookie
  const cookie = request.headers.get('cookie') || '';
  const sessionMatch = cookie.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    // 非 API 请求直接放行（静态文件）
    if (!path.startsWith('/api/')) return next();
    return jsonResponse({ error: '未登录' }, 401);
  }

  const session = await KV.getSession(env, sessionMatch[1]);

  if (!session) {
    if (!path.startsWith('/api/')) return next();
    return jsonResponse({ error: '会话已过期，请重新登录' }, 401);
  }

  // 检查 token 是否过期
  if (session.expiresAt && Date.now() > session.expiresAt) {
    // 尝试刷新 token
    if (session.refreshToken) {
      const refreshed = await refreshCozeToken(env, session.refreshToken);
      if (refreshed) {
        session.accessToken = refreshed.access_token;
        session.expiresAt = Date.now() + refreshed.expires_in * 1000;
        if (refreshed.refresh_token) session.refreshToken = refreshed.refresh_token;
        await KV.createSession(env, session); // 更新 session
      } else {
        await KV.deleteSession(env, sessionMatch[1]);
        if (path.startsWith('/api/')) {
          return jsonResponse({ error: '登录已过期，请重新登录' }, 401);
        }
        return next();
      }
    } else {
      await KV.deleteSession(env, sessionMatch[1]);
      if (path.startsWith('/api/')) {
        return jsonResponse({ error: '登录已过期，请重新登录' }, 401);
      }
      return next();
    }
  }

  // 注入用户数据
  data.session = session;
  data.sessionId = sessionMatch[1];

  return next();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function refreshCozeToken(env, refreshToken) {
  try {
    const resp = await fetch('https://api.coze.cn/open_oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.COZE_OAUTH_CLIENT_ID,
        client_secret: env.COZE_OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await resp.json();
    if (data.access_token) return data;
    return null;
  } catch {
    return null;
  }
}
