/* ===== 全局应用状态 ===== */
const APP = {
  user: null,
  credits: 0,
  progress: {},
  apiMode: false, // true = 真实API, false = 降级模拟模式

  async init() {
    // 检测后端 API 是否可用
    try {
      const resp = await fetch('/api/auth/user');
      if (resp.ok) {
        const data = await resp.json();
        this.apiMode = true;
        this.user = data.name;
        this.credits = data.credits;
        this.updateNavUI();
        return;
      }
      if (resp.status === 401) {
        // API 可用但未登录
        this.apiMode = true;
        this.updateNavUI();
        return;
      }
    } catch {
      // API 不可用（本地预览），降级到模拟模式
      this.apiMode = false;
    }

    // 降级模式：从 localStorage 恢复
    const saved = localStorage.getItem('edu_user');
    if (saved) {
      const data = JSON.parse(saved);
      this.user = data.user;
      this.credits = data.credits;
      this.progress = data.progress || {};
      this.updateNavUI();
    }
  },

  // 真实模式：从 API 获取积分
  async refreshCredits() {
    if (!this.apiMode) return;
    try {
      const resp = await fetch('/api/credits');
      if (resp.ok) {
        const data = await resp.json();
        this.credits = data.credits;
        this.updateNavUI();
      }
    } catch {}
  },

  // 模拟模式：保存到 localStorage
  saveState() {
    if (this.apiMode) return;
    localStorage.setItem('edu_user', JSON.stringify({
      user: this.user,
      credits: this.credits,
      progress: this.progress,
    }));
  },

  // 模拟模式登录
  mockLogin(username, credits = 100) {
    this.user = username;
    this.credits = credits;
    this.saveState();
    this.updateNavUI();
    showToast(`欢迎，${username}！你已获得 ${credits} 初始积分（模拟模式）`);
    closeLoginModal();
    document.dispatchEvent(new Event('loginSuccess'));
  },

  // 模拟模式扣积分
  spendCreditsLocal(amount, action) {
    if (!this.user) {
      openLoginModal();
      return false;
    }
    if (this.credits < amount) {
      showToast(`积分不足，需要 ${amount} 积分，当前 ${this.credits} 积分`);
      return false;
    }
    this.credits -= amount;
    this.saveState();
    this.updateNavUI();
    return true;
  },

  // 模拟模式获得积分
  earnCreditsLocal(amount, reason) {
    if (!this.user) return;
    this.credits += amount;
    this.saveState();
    this.updateNavUI();
    showToast(`+${amount} 积分！${reason}`);
  },

  // 标记任务完成
  async markDone(projectId, taskId) {
    if (this.apiMode) {
      try {
        const resp = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, taskId }),
        });
        const data = await resp.json();
        if (data.ok) {
          this.progress = data.progress;
          this.credits = data.credits;
          this.updateNavUI();
          showToast(`+10 积分！完成任务`);
          return;
        }
      } catch {}
    }
    // 降级
    if (!this.progress[projectId]) this.progress[projectId] = {};
    this.progress[projectId][taskId] = true;
    this.earnCreditsLocal(10, '完成任务');
    this.saveState();
  },

  getProjectProgress(projectId) {
    const p = this.progress[projectId] || {};
    return Object.keys(p).length;
  },

  updateNavUI() {
    const el = document.getElementById('user-area-nav');
    if (!el) return;
    if (this.user) {
      el.innerHTML = `
        <div class="user-bar">
          <div class="user-avatar">${this.user[0].toUpperCase()}</div>
          <span class="user-name">${this.user}</span>
          <span class="user-credits">&#129689; ${this.credits}积分</span>
          ${this.apiMode ? '<a href="/api/auth/logout" style="margin-left:8px;font-size:12px;color:#888">退出</a>' : ''}
        </div>`;
    } else {
      el.innerHTML = `<button class="btn-login" onclick="openLoginModal()">Coze账号登录</button>`;
    }
  }
};

/* ===== 登录相关 ===== */
function openLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) m.style.display = 'flex';
}
function closeLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) m.style.display = 'none';
}

// Coze OAuth 登录（真实模式跳转，模拟模式随机用户）
function cozeLogin() {
  if (APP.apiMode) {
    // 真实模式：跳转到 Coze OAuth
    window.location.href = '/api/auth/login';
  } else {
    // 降级模式：模拟登录
    const username = 'Coze用户_' + Math.floor(Math.random() * 9000 + 1000);
    APP.mockLogin(username, 100);
  }
}

// 模拟直接登录（降级模式 fallback）
function mockDirectLogin() {
  const u = document.getElementById('mock-username');
  if (!u || !u.value.trim()) { showToast('请输入学号或邮箱'); return; }
  APP.mockLogin(u.value.trim(), 100);
}

/* ===== Toast 通知 ===== */
function showToast(msg, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ===== AI 智能体交互 ===== */
const AGENT_CONFIGS = {
  'guide':  { name: 'AI导学',   cost: 5,  color: '#4f46e5', greeting: '你好！我是AI导学助手，将带你进入本项目的业务场景，建立学习动机。请告诉我你对这个项目最好奇的问题？' },
  'quiz':   { name: '指测闯关',  cost: 3,  color: '#0ea5e9', greeting: '欢迎来到指测闯关！我将通过场景题快速诊断你对本章指标的掌握程度。准备好了吗？' },
  'boost':  { name: 'AI加速',   cost: 10, color: '#f97316', greeting: '你好！我是AI加速助手，将帮助你完成真实数据分析实操任务。请描述你的分析需求。' },
  'review': { name: '复盘助训',  cost: 8,  color: '#db2777', greeting: '项目完成了！让我们一起复盘，从"完成任务"升级到"形成决策思维"。你觉得本项目最大的收获是什么？' }
};

// 降级模式的模拟回复
const DEMO_RESPONSES = {
  guide: [
    '好问题！让我们从一个真实场景开始：双十一大促后，你拿到了ROI数据，但数字背后隐藏着什么？',
    '数据不是目的，决策才是。让我们沿着「数据→信息→知识→决策」这条路径，一步步解锁电商的"上帝视角"。',
    '我注意到你对这个概念很感兴趣！推荐你先完成任务1.1，深入理解数据的四大属性。'
  ],
  quiz: [
    '【第1题】假设迷你加湿器市场年销售额2000万，增长到2600万，市场增长率是多少？\nA. 20%  B. 25%  C. 30%  D. 35%',
    '正确！答案是C. 30%。公式：（2600-2000）/2000*100% = 30%。\n再来一题：若前5家品牌销售额之和为1500万，全市场3000万，CRn是多少？',
    '太棒了！你的指标掌握度达到80%。薄弱点：市场渗透率计算。建议重读任务2.1。'
  ],
  boost: [
    '请描述你的数据结构，我来帮你进行数据清洗和分析。',
    '我已识别到你的数据集有3处逻辑错误。建议按以下步骤处理。',
    '分析完成！关键发现：抖音渠道ROI=1.8，低于直通车的2.4，但新客占比高达67%。'
  ],
  review: [
    '很好的收获！如果下次大促前只有一周时间，你会优先分析哪3个指标？',
    '你的思路很清晰！GMV + ROI + 复购率的组合，确实抓住了规模、效率、留存三个核心维度。',
    '出色的复盘！你的数据思维已经从描述性分析进阶到诊断性分析。'
  ]
};

function initAgent(containerId, agentType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const config = AGENT_CONFIGS[agentType] || AGENT_CONFIGS.guide;

  container.innerHTML = `
    <div class="agent-embed">
      <div class="ae-header">
        <div class="ae-title">
          <span>&#128161;</span> ${config.name}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="ae-badge">Coze智能体</span>
          <span class="ae-credits">-${config.cost}积分/次</span>
        </div>
      </div>
      <div class="ae-desc" id="${containerId}_desc">${APP.user ? '登录后可使用此智能体' : '请登录后使用'}</div>
      <div class="ae-chatbox" id="${containerId}_box">
        <div class="ae-messages" id="${containerId}_msgs">
          <div class="msg bot" id="${containerId}_greeting" style="display:none">${config.greeting}</div>
          <div class="ae-lock" id="${containerId}_lock">
            <div class="ae-lock-icon">&#128274;</div>
            <p>请登录后使用</p>
            <button class="btn-login" onclick="openLoginModal()">登录使用</button>
          </div>
        </div>
      </div>
      <div class="ae-input-row" id="${containerId}_inputrow">
        <input class="ae-input" id="${containerId}_input" placeholder="输入你的问题..." disabled>
        <button class="ae-send" id="${containerId}_btn" onclick="sendAgentMsg('${containerId}','${agentType}')" disabled>发送</button>
      </div>
    </div>`;

  // 存储对话 ID 用于多轮对话
  container.dataset.conversationId = '';

  function updateUI() {
    if (!APP.user) return;
    const lock = document.getElementById(`${containerId}_lock`);
    const greeting = document.getElementById(`${containerId}_greeting`);
    const input = document.getElementById(`${containerId}_input`);
    const btn = document.getElementById(`${containerId}_btn`);
    const desc = document.getElementById(`${containerId}_desc`);

    if (lock) lock.style.display = 'none';
    if (greeting) greeting.style.display = 'block';
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
    if (desc) desc.textContent = `通过Coze账号使用 ${config.name}，消耗 ${config.cost} 积分/次对话`;
  }

  if (APP.user) updateUI();
  document.addEventListener('loginSuccess', updateUI);
}

async function sendAgentMsg(containerId, agentType) {
  const input = document.getElementById(`${containerId}_input`);
  const msgs = document.getElementById(`${containerId}_msgs`);
  const container = document.getElementById(containerId);
  if (!input || !msgs) return;

  const text = input.value.trim();
  if (!text) return;

  const config = AGENT_CONFIGS[agentType] || AGENT_CONFIGS.guide;

  // 显示用户消息
  const userMsg = document.createElement('div');
  userMsg.className = 'msg user';
  userMsg.textContent = text;
  msgs.appendChild(userMsg);
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  // 创建"正在输入"提示
  const typingMsg = document.createElement('div');
  typingMsg.className = 'msg bot typing';
  typingMsg.innerHTML = '<span class="typing-dots">正在思考</span>';
  msgs.appendChild(typingMsg);
  msgs.scrollTop = msgs.scrollHeight;

  if (APP.apiMode) {
    // 真实模式：调用 Coze API
    try {
      const projectId = document.body.dataset.projectId || '';
      const conversationId = container.dataset.conversationId || '';

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          agentType,
          query: text,
          conversationId,
        }),
      });

      // 移除 typing
      typingMsg.remove();

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: '请求失败' }));
        const errMsg = document.createElement('div');
        errMsg.className = 'msg bot';
        errMsg.style.color = '#e24b4a';
        errMsg.textContent = errData.error || '智能体暂时无法响应，请稍后再试';
        msgs.appendChild(errMsg);
        msgs.scrollTop = msgs.scrollHeight;

        // 如果是积分不足，刷新积分显示
        if (resp.status === 403) {
          await APP.refreshCredits();
        }
        return;
      }

      // 从响应头获取最新积分
      const newCredits = resp.headers.get('X-Credits');
      if (newCredits !== null) {
        APP.credits = parseInt(newCredits);
        APP.updateNavUI();
      }

      // 处理 SSE 流式响应
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      const botMsg = document.createElement('div');
      botMsg.className = 'msg bot';
      botMsg.style.whiteSpace = 'pre-line';
      botMsg.textContent = '';
      msgs.appendChild(botMsg);

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'delta' && event.content) {
              botMsg.textContent += event.content;
              msgs.scrollTop = msgs.scrollHeight;
            }

            if (event.type === 'done') {
              if (event.conversationId) {
                container.dataset.conversationId = event.conversationId;
              }
            }

            if (event.type === 'error') {
              botMsg.style.color = '#e24b4a';
              botMsg.textContent += '\n[错误] ' + event.message;
            }
          } catch {}
        }
      }

      // 如果最终内容为空
      if (!botMsg.textContent.trim()) {
        botMsg.textContent = '（智能体未返回内容）';
      }
    } catch (err) {
      typingMsg.remove();
      const errMsg = document.createElement('div');
      errMsg.className = 'msg bot';
      errMsg.style.color = '#e24b4a';
      errMsg.textContent = '网络错误：' + err.message;
      msgs.appendChild(errMsg);
    }
  } else {
    // 降级模式：模拟回复
    if (!APP.spendCreditsLocal(config.cost, `使用${config.name}`)) {
      typingMsg.remove();
      return;
    }

    setTimeout(() => {
      typingMsg.remove();
      const responses = DEMO_RESPONSES[agentType] || DEMO_RESPONSES.guide;
      const idx = Math.floor(Math.random() * responses.length);
      const botMsg = document.createElement('div');
      botMsg.className = 'msg bot';
      botMsg.style.whiteSpace = 'pre-line';
      botMsg.textContent = responses[idx];
      msgs.appendChild(botMsg);
      msgs.scrollTop = msgs.scrollHeight;
    }, 800 + Math.random() * 500);
  }
}

/* ===== 学习进度追踪 ===== */
function renderProgressBars(projectData) {
  const container = document.getElementById('progress-container');
  if (!container) return;

  container.innerHTML = projectData.map(p => {
    const done = APP.getProjectProgress(p.id);
    const pct = Math.round((done / p.tasks) * 100);
    return `
      <div class="progress-bar-wrap">
        <div class="pbar-label">
          <span>${p.name}</span>
          <span>${pct}%</span>
        </div>
        <div class="pbar">
          <div class="pbar-fill" style="width: ${pct}%; background: ${p.color}"></div>
        </div>
      </div>`;
  }).join('');
}

/* ===== 学习画像仪表板 ===== */
async function loadDashboard() {
  if (!APP.apiMode) {
    // 降级模式：从 localStorage 读取
    const logs = JSON.parse(localStorage.getItem('edu_logs') || '[]');
    renderDashboardLocal(logs);
    return;
  }

  try {
    const resp = await fetch('/api/profile');
    if (!resp.ok) {
      window.location.href = '/api/auth/login';
      return;
    }
    const data = await resp.json();
    renderDashboard(data);
  } catch (err) {
    console.error('加载画像失败:', err);
  }
}

function renderDashboard(data) {
  const { user, stats, logs } = data;

  // 更新用户信息
  const nameEl = document.getElementById('dash-username');
  if (nameEl) nameEl.textContent = user.name;

  const creditsEl = document.getElementById('dash-credits');
  if (creditsEl) creditsEl.textContent = user.credits;

  const interactionsEl = document.getElementById('dash-interactions');
  if (interactionsEl) interactionsEl.textContent = stats.totalInteractions;

  const spentEl = document.getElementById('dash-spent');
  if (spentEl) spentEl.textContent = stats.totalCreditsSpent;

  // 活动日志
  const logContainer = document.getElementById('activity-log');
  if (logContainer) {
    logContainer.innerHTML = logs.slice(-20).reverse().map(log => `
      <div class="log-item">
        <span class="log-time">${new Date(log.time).toLocaleString('zh-CN')}</span>
        <span class="log-action">${log.message || log.action}</span>
        <span class="log-cost ${log.cost > 0 ? 'cost-spend' : 'cost-earn'}">
          ${log.cost > 0 ? '-' + log.cost : log.cost < 0 ? '+' + Math.abs(log.cost) : ''}
        </span>
      </div>
    `).join('');
  }

  // 如果有 Chart.js，渲染图表
  if (typeof Chart !== 'undefined') {
    renderCharts(stats);
  }
}

function renderDashboardLocal(logs) {
  const logContainer = document.getElementById('activity-log');
  if (logContainer) {
    logContainer.innerHTML = logs.slice(-20).reverse().map(log => `
      <div class="log-item">
        <span class="log-time">${new Date(log.time).toLocaleString('zh-CN')}</span>
        <span class="log-action">${log.action}</span>
        <span class="log-cost ${log.cost > 0 ? 'cost-spend' : 'cost-earn'}">
          ${log.cost > 0 ? '-' + log.cost : log.cost < 0 ? '+' + Math.abs(log.cost) : ''}
        </span>
      </div>
    `).join('') || '<p style="color:#999">暂无活动记录</p>';
  }
}

/* ===== 自测题 ===== */
function submitQuiz(projectId, answers, correctAnswers) {
  let correct = 0;
  answers.forEach((ans, i) => {
    if (ans === correctAnswers[i]) correct++;
  });
  const total = correctAnswers.length;
  const passed = correct >= Math.ceil(total * 0.6);

  if (passed) {
    APP.markDone(projectId, 'quiz');
    showToast(`自测通过！${correct}/${total} 正确，+20 积分`);
  } else {
    showToast(`自测未通过：${correct}/${total}，继续加油！`);
  }
  return { correct, total, passed };
}

/* ===== 初始化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  APP.init();
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('loginModal');
    if (modal && e.target === modal) closeLoginModal();
  });
});
