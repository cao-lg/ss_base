# 数智电商数据分析教学平台

基于 Coze 智能体的现代化教学网站，覆盖电商数据分析六大项目。

## 项目结构

```
├── index.html              # 主页
├── courses.html            # 课程列表
├── agents.html             # AI智能体中心
├── dashboard.html          # 学习画像仪表板
├── project1~6.html         # 六个项目详情页
├── styles/main.css         # 样式
├── scripts/app.js          # 前端交互
├── functions/              # Cloudflare Pages Functions (后端)
│   ├── _middleware.js       #   认证中间件
│   ├── lib/
│   │   ├── config.js        #   Bot ID 配置 ← 填写这里
│   │   └── kv.js            #   KV 存储工具
│   └── api/
│       ├── auth/
│       │   ├── login.js     #   Coze OAuth 登录
│       │   ├── callback.js  #   OAuth 回调
│       │   ├── logout.js    #   退出登录
│       │   └── user.js      #   获取用户信息
│       ├── chat.js          #   智能体对话代理 (Coze Chat API)
│       ├── credits.js       #   积分管理
│       ├── progress.js      #   学习进度
│       ├── profile.js       #   学习画像数据
│       └── agents.js        #   智能体列表
├── wrangler.toml            # Cloudflare 配置
└── _redirects               # Cloudflare Pages 重定向
```

## 部署步骤

### 1. 推送到 GitHub

代码已推送到: https://github.com/cao-lg/ss_base

### 2. Cloudflare Pages 创建项目

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages
2. Create application → Pages → Connect to Git
3. 选择 `cao-lg/ss_base` 仓库

### 3. 构建配置

| 配置项 | 值 |
|--------|-----|
| Framework preset | None |
| Build command | 留空 |
| Build output directory | `/` |
| Root directory | 留空 |

### 4. 环境变量（Settings → Environment variables）

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `COZE_OAUTH_CLIENT_ID` | Coze OAuth 应用 ID | `xxxxxxxx` |
| `COZE_OAUTH_CLIENT_SECRET` | Coze OAuth 应用密钥 | `xxxxxxxx` |

### 5. KV 命名空间绑定（Settings → Functions → KV namespace bindings）

1. 先在 Cloudflare Dashboard → Workers & Pages → KV 创建一个 namespace，命名为 `EDU_KV`
2. 在 Pages 项目设置 → Functions → KV namespace bindings 中添加：
   - Variable name: `EDU_KV`
   - KV namespace: 选择刚创建的 `EDU_KV`

### 6. 填写 Bot ID

编辑 `functions/lib/config.js`，在 `DEFAULT_BOTS` 中填入你的 Coze 智能体 Bot ID：

```javascript
const DEFAULT_BOTS = {
  guide:  '7400000000000000001',  // AI导学 Bot ID
  quiz:   '7400000000000000002',  // 指测闯关 Bot ID
  boost:  '7400000000000000003',  // AI加速 Bot ID
  review: '7400000000000000004',  // 复盘助训 Bot ID
};
```

### 7. Coze OAuth 回调地址

在 Coze 开发者平台 → OAuth 应用设置中，将回调地址设为：
```
https://你的域名/api/auth/callback
```

### 8. 部署

点击 Save and Deploy，获得 `*.pages.dev` 域名。

## 工作原理

```
学生 → Coze OAuth 登录 → 获取 access_token（存入 KV session）
  ↓
学生发送消息 → /api/chat
  ↓
后端检查教学站积分 → 扣积分
  ↓
用学生的 token 调 Coze Chat API → 消耗学生自己的 Coze 额度
  ↓
记录学习日志到 KV → 流式返回回复
  ↓
学生学习画像仪表板展示使用数据
```

## 降级模式

如果后端 API 不可用（如本地预览），网站自动降级为模拟模式：
- 登录使用模拟用户名
- 智能体返回预设回复
- 数据存储在 localStorage
