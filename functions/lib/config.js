/**
 * Coze 智能体配置 —— 部署前填写真实 Bot ID
 *
 * 获取方式：Coze 平台 → 智能体详情 → 发布 → API 调用 → 复制 Bot ID
 *
 * 如果每个项目用不同的 Bot，在 PROJECT_BOTS 中配置；
 * 如果所有项目共用同一组 Bot，只填 DEFAULT_BOTS 即可。
 */

// 默认智能体 Bot ID（所有项目通用）
const DEFAULT_BOTS = {
  guide:  '',  // AI导学 ——  引入场景、建立学习动机
  quiz:   '',  // 指测闯关 —— 指标掌握度快速诊断
  boost:  '',  // AI加速 ——  实操任务辅助
  review: '',  // 复盘助训 ——  形成决策思维
};

// 按项目覆盖（可选，留空则用 DEFAULT_BOTS）
// Bot ID 格式示例: '7400000000000000001'
const PROJECT_BOTS = {
  project1: {},  // 项目一：开启数据驱动之旅
  project2: {},  // 项目二：商品选品数据分析
  project3: {},  // 项目三：营销推广数据分析
  project4: {},  // 项目四：销售交易数据分析
  project5: {},  // 项目五：客户服务数据分析
  project6: {},  // 项目六：物流履约数据分析
};

// 智能体元信息
const AGENT_META = {
  guide:  { name: 'AI导学',    cost: 5,  color: '#4f46e5', desc: '引入场景，建立学习动机' },
  quiz:   { name: '指测闯关',   cost: 3,  color: '#0ea5e9', desc: '指标掌握度快速诊断' },
  boost:  { name: 'AI加速',    cost: 10, color: '#f97316', desc: '实操任务辅助加速' },
  review: { name: '复盘助训',   cost: 8,  color: '#db2777', desc: '从完成任务到形成决策思维' },
};

/**
 * 获取指定项目+类型的 Bot ID
 */
export function getBotId(projectId, agentType) {
  const projectBots = PROJECT_BOTS[projectId] || {};
  return projectBots[agentType] || DEFAULT_BOTS[agentType] || '';
}

/**
 * 获取智能体元信息
 */
export function getAgentMeta(agentType) {
  return AGENT_META[agentType] || AGENT_META.guide;
}

/**
 * 获取所有智能体配置列表（供前端展示）
 */
export function getAllAgents() {
  return Object.entries(AGENT_META).map(([type, meta]) => ({
    type,
    ...meta,
    configured: !!DEFAULT_BOTS[type],
  }));
}

// Coze API 基础地址
export const COZE_API_BASE = 'https://api.coze.cn';
export const COZE_OAUTH_BASE = 'https://www.coze.cn';

// OAuth API 端点（基于 Coze 官方文档 + 火山引擎实战验证）
// 授权页面 URL API — 返回 302 重定向到 consent 授权页
export const COZE_OAUTH_AUTHORIZE_URL = 'https://api.coze.cn/api/permission/oauth2/authorize';
// Token 交换 & 刷新 API
export const COZE_OAUTH_TOKEN_URL = 'https://api.coze.cn/api/permission/oauth2/token';

// OAuth scope — 根据实际需要的权限配置
// 在 Coze 创建 OAuth 应用时，也需要在权限页签勾选对应权限
export const OAUTH_SCOPE = 'bot chat conversation';
