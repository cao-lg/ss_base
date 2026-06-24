/* ===== 全局应用状态 ===== */
const APP = {
  user: null,
  credits: 0,
  progress: {},

  init() {
    const saved = localStorage.getItem('edu_user');
    if (saved) {
      const data = JSON.parse(saved);
      this.user = data.user;
      this.credits = data.credits;
      this.progress = data.progress || {};
      this.updateNavUI();
    }
    this.loadProgress();
  },

  login(username, credits = 100) {
    this.user = username;
    this.credits = credits;
    this.saveState();
    this.updateNavUI();
    showToast(`欢迎，${username}！你已获得 ${credits} 初始积分 🎉`);
    closeLoginModal();
  },

  saveState() {
    localStorage.setItem('edu_user', JSON.stringify({
      user: this.user,
      credits: this.credits,
      progress: this.progress
    }));
  },

  spendCredits(amount, action) {
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
    // 记录使用日志（学习画像数据）
    this.logInteraction(action, amount);
    return true;
  },

  earnCredits(amount, reason) {
    if (!this.user) return;
    this.credits += amount;
    this.saveState();
    this.updateNavUI();
    showToast(`+${amount} 积分！${reason}`);
  },

  logInteraction(action, cost) {
    const logs = JSON.parse(localStorage.getItem('edu_logs') || '[]');
    logs.push({
      user: this.user,
      action,
      cost,
      time: new Date().toISOString(),
      page: window.location.pathname
    });
    localStorage.setItem('edu_logs', JSON.stringify(logs.slice(-500)));
  },

  loadProgress() {
    const p = JSON.parse(localStorage.getItem('edu_progress') || '{}');
    this.progress = p;
  },

  markDone(projectId, taskId) {
    if (!this.progress[projectId]) this.progress[projectId] = {};
    this.progress[projectId][taskId] = true;
    localStorage.setItem('edu_progress', JSON.stringify(this.progress));
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

function mockCozeLogin() {
  // 模拟Coze OAuth流程 —— 实际部署时替换为真实Coze OAuth
  const username = 'Coze用户_' + Math.floor(Math.random() * 9000 + 1000);
  APP.login(username, 100);
}

function mockDirectLogin() {
  const u = document.getElementById('mock-username');
  const p = document.getElementById('mock-password');
  if (!u || !u.value.trim()) { showToast('请输入学号或邮箱'); return; }
  APP.login(u.value.trim(), 100);
}

/* ===== Toast通知 ===== */
function showToast(msg, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ===== AI智能体交互 ===== */
const AGENT_CONFIGS = {
  'guide': { name: 'AI导学', cost: 5, color: '#4f46e5', greeting: '你好！我是AI导学助手，将带你进入本项目的业务场景，建立学习动机。请告诉我你对这个项目最好奇的问题？' },
  'quiz': { name: '指测闯关', cost: 3, color: '#0ea5e9', greeting: '欢迎来到指测闯关！我将通过3-5道场景题，快速诊断你对本章指标的掌握程度。准备好了吗？' },
  'boost': { name: 'AI加速', cost: 10, color: '#f97316', greeting: '你好！我是AI加速助手，将帮助你完成真实数据分析实操任务。请上传你的数据文件或描述你的分析需求。' },
  'review': { name: '复盘助训', cost: 8, color: '#db2777', greeting: '项目完成了！让我们一起复盘，从"完成任务"升级到"形成决策思维"。你觉得本项目最大的收获是什么？' }
};

const DEMO_RESPONSES = {
  guide: [
    '好问题！让我们从一个真实场景开始：双十一大促后，你拿到了ROI数据，但数字背后隐藏着什么？',
    '数据不是目的，决策才是。让我们沿着「数据→信息→知识→决策」这条路径，一步步解锁电商的"上帝视角"。',
    '我注意到你对这个概念很感兴趣！推荐你先完成任务1.1，深入理解数据的四大属性。你知道数据和土地有什么本质区别吗？'
  ],
  quiz: [
    '【第1题】假设迷你加湿器市场年销售额2000万，增长到2600万，市场增长率是多少？\nA. 20%  B. 25%  C. 30%  D. 35%',
    '正确！答案是C. 30%。公式：（2600-2000）/2000×100% = 30%。\n再来一题：若前5家品牌销售额之和为1500万，全市场3000万，CRn是多少？',
    '太棒了！你的指标掌握度达到80%。薄弱点：市场渗透率计算。建议重读任务2.1第三小节。'
  ],
  boost: [
    '请上传Excel数据文件，或者描述你的数据结构，我来帮你进行数据清洗和分析。',
    '我已识别到你的数据集有3处逻辑错误：①负数库存；②未来日期订单；③重复订单号。建议按以下步骤处理……',
    '分析完成！关键发现：抖音渠道ROI=1.8，低于直通车的2.4，但新客占比高达67%，具备品牌造血价值。建议不要降低抖音预算。'
  ],
  review: [
    '很好的收获！让我们进一步思考：如果下次大促前，你只有一周时间，你会优先分析哪3个指标来制定策略？',
    '你的思路很清晰！GMV + ROI + 复购率的组合，确实抓住了规模、效率、留存三个核心维度。',
    '出色的复盘！你的数据思维已经从"描述性分析"进阶到"诊断性分析"。下一步是"预测性分析"，在项目四中我们将深入探讨。'
  ]
};

function initAgent(containerId, agentType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const config = AGENT_CONFIGS[agentType] || AGENT_CONFIGS.guide;
  let msgCount = 0;

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
      <div class="ae-desc" id="${containerId}_desc">登录后可使用此智能体</div>
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

  function updateUI() {
    if (!APP.user) return;
    document.getElementById(`${containerId}_lock`).style.display = 'none';
    document.getElementById(`${containerId}_greeting`).style.display = 'block';
    document.getElementById(`${containerId}_input`).disabled = false;
    document.getElementById(`${containerId}_btn`).disabled = false;
    document.getElementById(`${containerId}_desc`).textContent = `通过Coze账号使用 ${config.name} 智能体，消耗 ${config.cost} 积分/次对话`;
  }

  if (APP.user) updateUI();
  document.addEventListener('loginSuccess', updateUI);
}

function sendAgentMsg(containerId, agentType) {
  const input = document.getElementById(`${containerId}_input`);
  const msgs = document.getElementById(`${containerId}_msgs`);
  if (!input || !msgs) return;
  const text = input.value.trim();
  if (!text) return;

  if (!APP.spendCredits(AGENT_CONFIGS[agentType]?.cost || 5, `使用${AGENT_CONFIGS[agentType]?.name}`)) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'msg user';
  userMsg.textContent = text;
  msgs.appendChild(userMsg);
  input.value = '';

  const responses = DEMO_RESPONSES[agentType] || DEMO_RESPONSES.guide;
  const idx = Math.floor(Math.random() * responses.length);

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'msg bot';
    botMsg.style.whiteSpace = 'pre-line';
    botMsg.textContent = responses[idx];
    msgs.appendChild(botMsg);
    msgs.scrollTop = msgs.scrollHeight;
  }, 800);

  msgs.scrollTop = msgs.scrollHeight;

  APP.logInteraction(`agent_${agentType}_message`, AGENT_CONFIGS[agentType]?.cost || 5);
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

/* ===== 初始化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  APP.init();
  // 点击弹窗外部关闭
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('loginModal');
    if (modal && e.target === modal) closeLoginModal();
  });
});
