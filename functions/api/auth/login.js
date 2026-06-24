/**
 * Coze OAuth 登录入口（标准流程）
 * GET /api/auth/login
 *
 * 正确流程：
 *   1. 后端调用 Coze「获取授权页面 URL API」
 *      GET https://api.coze.cn/api/permission/oauth2/authorize?client_id=...&client_secret=...&redirect_uri=...&response_type=code&scope=...&state=...
 *   2. Coze 返回 302，location 头里是真正的授权页 URL（/oauth/consent?authorize_key=xxx）
 *   3. 浏览器跳转到授权页，用户同意授权
 *   4. Coze 重定向回 /api/auth/callback?code=xxx
 *   5. callback.js 用 code 换 access_token
 */
import { getOAuthConfig } from '../../lib/config.js';

export async function onRequestGet({ env, request }) {
  const { clientId, clientSecret } = getOAuthConfig(env);

  if (!clientId || !clientSecret) {
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

  // 调用 Coze「获取授权页面 URL API」
  // 文档：GET /api/permission/oauth2/authorize
  const cozeParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'bot chat conversation',
    state: state,
  });

  const cozeAuthUrl = `https://api.coze.cn/api/permission/oauth2/authorize?${cozeParams}`;

  try {
    // 用 redirect: 'manual' 获取 302 响应，不自动跟随
    const cozeResp = await fetch(cozeAuthUrl, { redirect: 'manual' });

    if (cozeResp.status >= 300 && cozeResp.status < 400) {
      // Coze 返回 302，location 里是真正的授权页 URL
      const authPageUrl = cozeResp.headers.get('location');
      if (authPageUrl) {
        // 把 state 存到 cookie，callback 时验证
        const headers = new Headers({
          'Location': authPageUrl,
          'Set-Cookie': `oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`,
        });
        return new Response(null, { status: 302, headers });
      }
    }

    // 没拿到 302，读取错误信息
    const errText = await cozeResp.text();
    let errMsg = `Coze 授权 API 返回异常（status ${cozeResp.status}）`;
    try {
      const errJson = JSON.parse(errText);
      errMsg += `：${errJson.message || errJson.msg || errText.slice(0, 200)}`;
    } catch {
      // 可能是 302 到错误页，尝试解析 location
      const loc = cozeResp.headers.get('location');
      if (loc) {
        errMsg += `，重定向到：${loc.slice(0, 200)}`;
      } else {
        errMsg += `：${errText.slice(0, 300)}`;
      }
    }

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: '调用 Coze 授权 API 失败',
      detail: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
