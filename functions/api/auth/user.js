/**
 * 获取当前登录用户信息
 * GET /api/auth/user
 *
 * 返回：{ userId, name, avatar, credits }
 */
import KV from '../../lib/kv.js';

export async function onRequestGet({ env, data }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const { userId, name } = data.session;
  const user = await KV.getUser(env, userId);

  if (!user) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }

  return Response.json({
    userId,
    name: user.name || name,
    avatar: user.avatar || '',
    credits: user.credits,
  });
}
