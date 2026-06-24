/**
 * Coze OAuth 登录入口
 * GET /api/auth/login
 *
 * Coze OAuth 授权码模式流程：
 *   1. 后端调用 Coze「获取授权页面URL」API（携带 client_id, client_secret, redirect_uri）
 *   2. Coze 返回 302，Location 为授权同意页 URL
 *   3. 后端将浏览器重定向到该授权同意页
 *   4. 用户在 Coze 授权页同意授权
 *   5. Coze 重定向回 /api/auth/callback?code=xxx
 *   6. callback.js 用 code 换取 access_token
 */
import { COZE_OAUTH_AUTHORIZE_URL, OAUTH_SCOPE } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const clientId = env.COZE_OAUTH_CLIENT_ID;
  const clientSecret = env.COZE_OAUTH_CLIENT_SECRET;

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

  // 构建 Coze 授权 API 请求参数
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  });

  // 尝试方式1：后端调用 Coze 授权 API，获取 302 重定向到授权同意页
  try {
    const authResp = await fetch(`${COZE_OAUTH_AUTHORIZE_URL}?${params}`, {
      method: 'GET',
      redirect: 'manual', // 不自动跟随重定向，手动提取 Location
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Coze API 返回 302，Location 是授权同意页 URL
    if (authResp.status === 302 || authResp.status === 301) {
      const location = authResp.headers.get('location');
      if (location) {
        return Response.redirect(location, 302);
      }
    }

    // 某些情况下 Coze 可能返回 JSON 格式的授权 URL
    if (authResp.status === 200) {
      const data = await authResp.json();
      const authUrl = data.data?.authorize_url || data.authorize_url || data.url || data.location;
      if (authUrl) {
        return Response.redirect(authUrl, 302);
      }
    }

    // 如果以上都失败，尝试方式2：直接重定向浏览器到 Coze 授权页（标准 OAuth 模式）
    // 这是 fallback，部分 Coze 版本可能支持直接浏览器跳转
    return Response.redirect(
      `${COZE_OAUTH_AUTHORIZE_URL}?${params}`,
      302
    );
  } catch (err) {
    // 网络错误时 fallback 到直接重定向
    return Response.redirect(
      `${COZE_OAUTH_AUTHORIZE_URL}?${params}`,
      302
    );
  }
}
