/**
 * Cloudflare KV 存储工具
 *
 * 数据结构：
 * session:{sessionId}     → { userId, accessToken, refreshToken, expiresAt, name }
 * user:{userId}           → { credits, name, avatar, firstLoginAt }
 * logs:{userId}           → [ { action, agentType, cost, message, time, page } ]
 * progress:{userId}       → { project1: { task1: true, ... }, ... }
 */

const KV = {
  // ===== Session =====
  async createSession(env, data) {
    const sessionId = crypto.randomUUID();
    await env.EDU_KV.put(`session:${sessionId}`, JSON.stringify(data), {
      expirationTtl: 86400 * 7, // 7 天过期
    });
    return sessionId;
  },

  async getSession(env, sessionId) {
    const raw = await env.EDU_KV.get(`session:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  },

  async deleteSession(env, sessionId) {
    await env.EDU_KV.delete(`session:${sessionId}`);
  },

  // ===== User =====
  async getUser(env, userId) {
    const raw = await env.EDU_KV.get(`user:${userId}`);
    return raw ? JSON.parse(raw) : null;
  },

  async createUser(env, userId, name) {
    const user = {
      credits: 100, // 初始积分
      name,
      avatar: '',
      firstLoginAt: new Date().toISOString(),
    };
    await env.EDU_KV.put(`user:${userId}`, JSON.stringify(user));
    return user;
  },

  async updateUser(env, userId, updates) {
    const user = await this.getUser(env, userId);
    if (!user) return null;
    Object.assign(user, updates);
    await env.EDU_KV.put(`user:${userId}`, JSON.stringify(user));
    return user;
  },

  async spendCredits(env, userId, amount) {
    const user = await this.getUser(env, userId);
    if (!user) return { ok: false, error: '用户不存在' };
    if (user.credits < amount) return { ok: false, error: `积分不足，需要 ${amount}，当前 ${user.credits}` };
    user.credits -= amount;
    await env.EDU_KV.put(`user:${userId}`, JSON.stringify(user));
    return { ok: true, credits: user.credits };
  },

  async earnCredits(env, userId, amount) {
    const user = await this.getUser(env, userId);
    if (!user) return { ok: false, error: '用户不存在' };
    user.credits += amount;
    await env.EDU_KV.put(`user:${userId}`, JSON.stringify(user));
    return { ok: true, credits: user.credits };
  },

  // ===== Logs =====
  async addLog(env, userId, log) {
    const key = `logs:${userId}`;
    const raw = await env.EDU_KV.get(key);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push({ ...log, time: new Date().toISOString() });
    // 最多保留 500 条
    const trimmed = logs.slice(-500);
    await env.EDU_KV.put(key, JSON.stringify(trimmed));
  },

  async getLogs(env, userId) {
    const raw = await env.EDU_KV.get(`logs:${userId}`);
    return raw ? JSON.parse(raw) : [];
  },

  // ===== Progress =====
  async getProgress(env, userId) {
    const raw = await env.EDU_KV.get(`progress:${userId}`);
    return raw ? JSON.parse(raw) : {};
  },

  async markTaskDone(env, userId, projectId, taskId) {
    const progress = await this.getProgress(env, userId);
    if (!progress[projectId]) progress[projectId] = {};
    progress[projectId][taskId] = true;
    await env.EDU_KV.put(`progress:${userId}`, JSON.stringify(progress));
    return progress;
  },
};

export default KV;
