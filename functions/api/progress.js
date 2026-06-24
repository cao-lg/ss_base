/**
 * 学习进度管理
 * GET  /api/progress          → 查询所有项目进度
 * POST /api/progress          → 标记任务完成 { projectId, taskId }
 */
import KV from '../lib/kv.js';

export async function onRequestGet({ env, data }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const progress = await KV.getProgress(env, data.session.userId);
  return Response.json(progress);
}

export async function onRequestPost({ env, data, request }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const { projectId, taskId } = await request.json();
  if (!projectId || !taskId) {
    return Response.json({ error: '缺少参数' }, { status: 400 });
  }

  const progress = await KV.markTaskDone(env, data.session.userId, projectId, taskId);

  // 完成任务奖励积分
  const reward = 10;
  await KV.earnCredits(env, data.session.userId, reward);

  await KV.addLog(env, data.session.userId, {
    action: 'task_complete',
    agentType: null,
    cost: -reward,
    message: `完成任务 ${projectId}/${taskId}`,
    page: `/${projectId}.html`,
  });

  const user = await KV.getUser(env, data.session.userId);

  return Response.json({ ok: true, progress, credits: user.credits });
}
