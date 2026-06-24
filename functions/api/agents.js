/**
 * 智能体列表
 * GET /api/agents
 *
 * 返回所有智能体配置信息（供前端展示）
 */
import { getAllAgents } from '../lib/config.js';

export async function onRequestGet() {
  const agents = getAllAgents();
  return Response.json({ agents });
}
