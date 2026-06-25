/**
 * Coze 智能体配置
 *
 * === 已配置内容 ===
 * - OAuth 凭证（fallback，生产环境建议用 Cloudflare 环境变量覆盖）
 * - 测试 Bot ID：7629158444695699498（所有智能体暂用此 Bot）
 * - 24 个智能体架构（6 项目 × 4 类型）
 *
 * === 待办 ===
 * - 在 Coze 平台为每个项目创建专属智能体，替换 TEST_BOT_ID
 * - 在 Cloudflare 环境变量中配置 OAuth 凭证（覆盖此文件中的 fallback）
 */

// ===== OAuth 凭证（fallback，优先使用 Cloudflare 环境变量）=====
export const OAUTH_CLIENT_ID = '65921753529999591828073675215369.app.coze';
export const OAUTH_CLIENT_SECRET = 'AnPUPGdp4mLM8wX4Cc1WssW05jtEGUFMxFAQqTAQ3mIfhu8W';

/**
 * 获取 OAuth 配置（优先环境变量，fallback 到本文件）
 */
export function getOAuthConfig(env) {
  return {
    clientId:     (env.COZE_OAUTH_CLIENT_ID     || OAUTH_CLIENT_ID).trim(),
    clientSecret: (env.COZE_OAUTH_CLIENT_SECRET || OAUTH_CLIENT_SECRET).trim(),
  };
}

// ===== Bot ID 配置 =====
// 当前测试 Bot，所有智能体暂用此 ID
const TEST_BOT_ID = '7629158444695699498';

// 默认智能体 Bot ID（所有项目通用 fallback）
const DEFAULT_BOTS = {
  guide:  TEST_BOT_ID,  // AI导学
  quiz:   TEST_BOT_ID,  // 指测闯关
  boost:  TEST_BOT_ID,  // AI加速
  review: TEST_BOT_ID,  // 复盘助训
};

/**
 * 按项目覆盖 Bot ID（创建专属智能体后填入）
 * 留空则用 DEFAULT_BOTS（当前为测试 Bot）
 *
 * 获取 Bot ID：Coze 平台 → 智能体详情 → 发布 → API → 复制 Bot ID
 */
const PROJECT_BOTS = {
  project1: {
    // guide:  '',  // 项目一·导学：数据分析基础认知
    // quiz:   '',  // 项目一·闯关：数据四大属性/分析流程
    // boost:  '',  // 项目一·加速：数据采集与可视化实操
    // review: '',  // 项目一·复盘：数据驱动决策思维
  },
  project2: {
    // guide:  '',  // 项目二·导学：选品分析框架
    // quiz:   '',  // 项目二·闯关：GR/CRn/BSR/好评率
    // boost:  '',  // 项目二·加速：四象限选品矩阵
    // review: '',  // 项目二·复盘：选品策略决策
  },
  project3: {
    // guide:  '',  // 项目三·导学：营销推广指标体系
    // quiz:   '',  // 项目三·闯关：CTR/ROI/CVR/CAC
    // boost:  '',  // 项目三·加速：漏斗分析与归因
    // review: '',  // 项目三·复盘：推广效果评估
  },
  project4: {
    // guide:  '',  // 项目四·导学：销售五层指标体系
    // quiz:   '',  // 项目四·闯关：毛利率/RFM模型
    // boost:  '',  // 项目四·加速：数据清洗与趋势预测
    // review: '',  // 项目四·复盘：销售策略优化
  },
  project5: {
    // guide:  '',  // 项目五·导学：服务三层指标体系
    // quiz:   '',  // 项目五·闯关：FCR/CSAT/NPS/AHT
    // boost:  '',  // 项目五·加速：满意度分析与飞书表格
    // review: '',  // 项目五·复盘：客户服务价值提升
  },
  project6: {
    // guide:  '',  // 项目六·导学：物流三维度指标
    // quiz:   '',  // 项目六·闯关：ADT/OTDR/PIR/ITR
    // boost:  '',  // 项目六·加速：物流效率与Power BI
    // review: '',  // 项目六·复盘：物流成本优化
  },
};

// ===== 智能体类型元信息 =====
const AGENT_META = {
  guide:  { name: 'AI导学',   cost: 5,  color: '#4f46e5', icon: '🧭', desc: '引入场景，建立学习动机' },
  quiz:   { name: '指测闯关',   cost: 3,  color: '#0ea5e9', icon: '🎯', desc: '指标掌握度快速诊断' },
  boost:  { name: 'AI加速',   cost: 10, color: '#f97316', icon: '🚀', desc: '实操任务辅助加速' },
  review: { name: '复盘助训',   cost: 8,  color: '#db2777', icon: '📝', desc: '从完成任务到形成决策思维' },
};

// ===== 项目信息 =====
const PROJECTS = {
  project1: {
    name: '开启数据驱动之旅',
    short: '数据驱动',
    color: '#4f46e5',
    icon: '📊',
    agents: {
      guide:  '介绍"焕新家电"电商场景，建立数据分析基本认知与学习动机',
      quiz:   '测试数据四大属性、数据分析流程、数据来源分类等基础概念',
      boost:  '辅助数据采集、清洗、可视化基础实操（Excel/Power BI）',
      review: '从描述性分析到诊断性分析：总结数据驱动决策思维路径',
    },
  },
  project2: {
    name: '商品选品数据分析',
    short: '商品选品',
    color: '#0891b2',
    icon: '🛒',
    agents: {
      guide:  '介绍选品分析框架，理解"焕新家电"迷你加湿器选品场景',
      quiz:   '测试市场增长率、CRn、GR、BSR、好评率等选品核心指标',
      boost:  '辅助四象限选品矩阵分析、竞品数据对比实操',
      review: '从数据到策略：总结选品决策方法论',
    },
  },
  project3: {
    name: '营销推广数据分析',
    short: '营销推广',
    color: '#f97316',
    icon: '📢',
    agents: {
      guide:  '介绍"焕新家电"双十一5渠道200万销售额推广场景',
      quiz:   '测试CTR、ROI、CVR、复购率RPR、CAC等推广核心指标',
      boost:  '辅助漏斗分析、渠道ROI对比、归因模型实操',
      review: '从效果评估到策略优化：总结推广决策思维',
    },
  },
  project4: {
    name: '销售交易数据分析',
    short: '销售交易',
    color: '#16a34a',
    icon: '💰',
    agents: {
      guide:  '介绍"焕新家电"8.2万单1.2亿销售额四渠道销售场景',
      quiz:   '测试销售五层指标体系、毛利率、RFM模型等核心概念',
      boost:  '辅助数据清洗（负数库存/重复订单）、RFM客户分层实操',
      review: '从销售分析到趋势预测：总结销售决策方法论',
    },
  },
  project5: {
    name: '客户服务数据分析',
    short: '客户服务',
    color: '#db2777',
    icon: '🎧',
    agents: {
      guide:  '介绍"焕新家电"首解率58%、满意度3.6分的服务场景',
      quiz:   '测试FCR、CSAT、NPS、AHT等服务核心指标',
      boost:  '辅助满意度分析、坐席排班优化、飞书多维表格实操',
      review: '从服务数据到客户价值：总结服务策略优化思维',
    },
  },
  project6: {
    name: '物流履约数据分析',
    short: '物流履约',
    color: '#9333ea',
    icon: '🚚',
    agents: {
      guide:  '介绍"鲜享优选"生鲜电商三季度物流场景',
      quiz:   '测试ADT、OTDR、PIR、ITR、库存周转率等物流核心指标',
      boost:  '辅助物流效率分析、快递公司对比、Power BI可视化实操',
      review: '从物流数据到成本优化：总结供应链决策思维',
    },
  },
};

// ===== 辅助函数 =====

/**
 * 获取指定项目+类型的 Bot ID
 */
export function getBotId(projectId, agentType) {
  const projectBots = PROJECT_BOTS[projectId] || {};
  return projectBots[agentType] || DEFAULT_BOTS[agentType] || '';
}

/**
 * 获取智能体类型元信息
 */
export function getAgentMeta(agentType) {
  return AGENT_META[agentType] || AGENT_META.guide;
}

/**
 * 获取所有智能体配置列表（24个 = 6项目 × 4类型）
 * 供前端 /api/agents 展示
 */
export function getAllAgents() {
  const agents = [];
  for (const [projId, proj] of Object.entries(PROJECTS)) {
    for (const [agentType, meta] of Object.entries(AGENT_META)) {
      const botId = getBotId(projId, agentType);
      agents.push({
        projectId: projId,
        projectName: proj.name,
        projectShort: proj.short,
        projectColor: proj.color,
        projectIcon: proj.icon,
        type: agentType,
        name: meta.name,
        icon: meta.icon,
        cost: meta.cost,
        color: meta.color,
        desc: proj.agents[agentType] || meta.desc,
        configured: !!botId,
        isFallback: botId === TEST_BOT_ID,
        botId: botId ? botId.slice(0, 6) + '****' : '', // 脱敏显示
      });
    }
  }
  return agents;
}

/**
 * 获取所有项目信息
 */
export function getAllProjects() {
  return Object.entries(PROJECTS).map(([id, p]) => ({ id, ...p }));
}

// ===== Coze API 配置 =====
export const COZE_API_BASE = 'https://api.coze.cn';
export const COZE_OAUTH_BASE = 'https://www.coze.cn';

// OAuth API 端点（已验证正确）
// Token 交换 & 刷新：POST https://api.coze.cn/api/permission/oauth2/token
// 授权页面：浏览器跳转 https://www.coze.cn/open/oauth/authorize?...
export const COZE_OAUTH_AUTHORIZE_URL = 'https://www.coze.cn/open/oauth/authorize';
export const COZE_OAUTH_TOKEN_URL = 'https://api.coze.cn/api/permission/oauth2/token';

// OAuth scope
export const OAUTH_SCOPE = 'bot chat conversation';
