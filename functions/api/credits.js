/**
 * 积分管理
 * GET  /api/credits          → 查询当前积分
 * POST /api/credits/earn     → 获得积分（完成任务、签到等）
 * POST /api/credits/spend    → 扣除积分（内部调用，一般不直接用）
 */
import KV from '../lib/kv.js';

// 查询积分
export async function onRequestGet({ env, data }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const user = await KV.getUser(env, data.session.userId);
  if (!user) {
    return Response.json({ error: '用户不存在' }, { status: 404 });
  }

  return Response.json({
    credits: user.credits,
    name: user.name,
  });
}

// 获得积分
export async function onRequestPost({ env, data, request }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const { amount, reason } = await request.json();
  const amt = Math.min(Math.max(parseInt(amount) || 0, 0), 100);

  const result = await KV.earnCredits(env, data.session.userId, amt);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // 记录日志
  await KV.addLog(env, data.session.userId, {
    action: 'earn_credits',
    agentType: null,
    cost: -amt,
    message: reason || '获得积分',
    page: '/',
  });

  return Response.json({ ok: true, credits: result.credits });
}
