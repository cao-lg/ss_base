/**
 * 学习画像数据
 * GET /api/profile
 *
 * 返回：{
 *   user: { name, credits, firstLoginAt },
 *   logs: [...],
 *   progress: {...},
 *   stats: {
 *     totalInteractions,
 *     agentUsage: { guide: N, quiz: N, boost: N, review: N },
 *     totalCreditsSpent,
 *     totalCreditsEarned,
 *     projectProgress: { project1: 3, project2: 1, ... },
 *     dailyActivity: [{ date, count }]
 *   }
 * }
 */
import KV from '../lib/kv.js';

export async function onRequestGet({ env, data }) {
  if (!data?.session) {
    return Response.json({ error: '未登录' }, { status: 401 });
  }

  const userId = data.session.userId;
  const [user, logs, progress] = await Promise.all([
    KV.getUser(env, userId),
    KV.getLogs(env, userId),
    KV.getProgress(env, userId),
  ]);

  // 统计数据
  const stats = {
    totalInteractions: 0,
    agentUsage: { guide: 0, quiz: 0, boost: 0, review: 0 },
    totalCreditsSpent: 0,
    totalCreditsEarned: 0,
    projectProgress: {},
    dailyActivity: {},
  };

  for (const log of logs) {
    const date = log.time?.split('T')[0] || 'unknown';

    if (log.action?.startsWith('agent_') && !log.action.endsWith('_reply')) {
      stats.totalInteractions++;
      const agentType = log.agentType;
      if (agentType && stats.agentUsage.hasOwnProperty(agentType)) {
        stats.agentUsage[agentType]++;
      }
    }

    if (log.cost > 0) {
      stats.totalCreditsSpent += log.cost;
    } else if (log.cost < 0) {
      stats.totalCreditsEarned += Math.abs(log.cost);
    }

    // 每日活动统计
    if (!stats.dailyActivity[date]) stats.dailyActivity[date] = 0;
    stats.dailyActivity[date]++;
  }

  // 项目进度统计
  for (const [proj, tasks] of Object.entries(progress)) {
    stats.projectProgress[proj] = Object.keys(tasks).length;
  }

  // 日活数据转数组（最近30天）
  const dailyArr = Object.entries(stats.dailyActivity)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));

  stats.dailyActivity = dailyArr;

  return Response.json({
    user: {
      name: user?.name || data.session.name,
      credits: user?.credits || 0,
      firstLoginAt: user?.firstLoginAt || null,
    },
    logs: logs.slice(-100), // 最近100条
    progress,
    stats,
  });
}
