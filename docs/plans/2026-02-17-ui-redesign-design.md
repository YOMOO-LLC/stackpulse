# StackPulse UI 重设计方案

**日期：** 2026-02-17
**方案：** A — 命令中心（Command Center）
**目标：** 深色专业工具风格，对标 Linear/Vercel，提升开发者使用体验

---

## 一、设计系统 Token

### 颜色

```css
/* 背景层级 */
--bg-base:     #09090b;   /* zinc-950 — 页面背景 */
--bg-surface:  #18181b;   /* zinc-900 — 侧边栏、卡片 */
--bg-elevated: #27272a;   /* zinc-800 — 悬停、高亮 */
--bg-input:    #3f3f46;   /* zinc-700 — 输入框 */

/* 主色 Emerald */
--primary:       #10b981; /* emerald-500 */
--primary-hover: #059669; /* emerald-600 */

/* 文字 */
--text-primary:   #fafafa; /* zinc-50 */
--text-secondary: #a1a1aa; /* zinc-400 */
--text-muted:     #52525b; /* zinc-600 */

/* 边框 */
--border:       #27272a;  /* zinc-800 */
--border-hover: #3f3f46;  /* zinc-700 */

/* 状态语义色 */
--status-healthy:  #10b981; /* emerald-500 */
--status-warning:  #f59e0b; /* amber-500 */
--status-critical: #ef4444; /* red-500 */
--status-unknown:  #52525b; /* zinc-600 */
```

### 字体
- **界面文字：** Geist Sans（已有）
- **数字/数据：** Geist Mono（已有）
- **大号数字：** `text-3xl font-bold font-mono`

### 圆角
```css
--radius-sm: 6px;  /* Badge、输入框 */
--radius-md: 10px; /* 卡片 */
--radius-lg: 14px; /* 弹窗 */
```

### 阴影（深色微妙内发光）
```css
--shadow-card: 0 0 0 1px rgba(255, 255, 255, 0.06);
```

---

## 二、整体布局结构

```
┌────────────────────────────────────────────────────────┐
│  侧边栏 (240px)  │         主内容区 (flex-1)            │
│  bg-surface      │         bg-base                      │
│                  │                                      │
│  ■ StackPulse    │  [页面标题] + [操作按钮]             │
│  ──────────────  │                                      │
│  ● OpenRouter    │  [内容区域：卡片 / 表单 / 网格]      │
│  ● Resend        │                                      │
│  ● Sentry        │                                      │
│  ──────────────  │                                      │
│  + 添加服务      │                                      │
│  ──────────────  │                                      │
│  user@email.com  │                                      │
│  [退出]          │                                      │
└────────────────────────────────────────────────────────┘
```

**路由覆盖：**
- `/dashboard` — 服务总览及详情
- `/connect` — Provider 选择
- `/connect/[id]` — API Key 表单
- 侧边栏在以上三个路由均可见，通过 `(app)` 路由组共享 layout

**登录页独立：** `/login` 保持全屏居中卡片，不显示侧边栏

---

## 三、各页面详细设计

### 1. 登录页 `/login`

- 背景：`bg-base` 全屏
- 中央卡片：`max-w-sm`, `bg-surface`, `border border-border`, `shadow-card`, `rounded-lg p-8`
- Logo：`■ StackPulse`，■ 为 emerald 色小方块
- 输入框：`bg-elevated border-border` 深色风格
- 按钮：emerald 实心，hover 加深
- 切换注册/登录：底部小字链接

### 2. 侧边栏 `<Sidebar>`

```
顶部区 (Logo)
  ■ StackPulse  → 点击跳转 /dashboard

中部区 (服务列表，可滚动)
  [脉冲点] [Provider 图标 16px] 服务备注名
  - 脉冲点颜色：healthy=emerald / warning=amber / critical=red / unknown=zinc
  - 脉冲点动画：css `animate-pulse`（仅 healthy/warning 有）
  - 选中状态：bg-elevated + 左侧 2px emerald 竖线 + text-primary
  - 未选中：text-secondary，hover bg-elevated/50

底部区
  [+ 添加服务] → /connect（outline 风格按钮，emerald 边框）
  ──────────
  [头像/首字母] test@example.com   [退出图标]
```

**Provider 图标：** 各服务使用真实 SVG Logo（通过 public/icons/ 提供）

### 3. Dashboard 主内容区 `/dashboard`

**无服务（空状态）：**
```
居中插图（SVG 简单图）
"还没有连接任何服务"
"开始连接你的第一个 API，实时掌握健康状态"
[连接第一个服务] emerald 按钮
```

**有服务（默认展示所有卡片，grid 2/3列）：**
```
顶部状态条：
  ● 3 个服务 · 全部正常  (emerald 点)
  或
  ⚠ 1 个服务需要关注    (amber 点)

服务卡片 (点击侧边栏项展开/折叠, 默认全展开):
  ┌─────────────────────────────────────────┐
  │  [图标] OpenRouter          ✓ 正常      │  ← 标题行
  │  ─────────────────────────────────────  │
  │  Credit Balance                         │  ← 指标名
  │  $7.93                   ▂▃▄▆▇▇▇      │  ← 大数字 + sparkline
  │  (font-mono text-3xl)                   │
  │                    最近 24h 最低: $7.80 │  ← 趋势摘要
  │  ─────────────────────────────────────  │
  │  更新于 2 分钟前          [刷新 ↻]     │  ← 底部
  └─────────────────────────────────────────┘
```

Sparkline：使用 SVG path 绘制，不引入图表库，保持轻量。

### 4. Connect 选择页 `/connect`

```
标题："连接服务"
副标题："选择要接入的 API 服务"

Provider 卡片网格 (2 列, md:3 列):
  ┌──────────────────────┐
  │  [真实Logo 32px]     │
  │  OpenRouter          │  ← 服务名 bold
  │  AI · API Key 接入   │  ← 分类 + 认证方式
  │  监控 1 项指标       │  ← 指标数
  └──────────────────────┘
  hover: border-emerald-500/50 + bg-elevated
  已连接的服务: 右上角 ✓ 徽章
```

### 5. Connect 表单页 `/connect/[id]`

```
面包屑：← 返回选择服务

表单卡片 (max-w-md):
  [Logo 40px] OpenRouter
  "输入 API Key 完成连接"

  [标签] 备注名称（可选）
  [输入框]

  [标签] API Key *
  [输入框 password]

  [连接] 按钮 (emerald 实心，宽度 100%)
  验证中: 按钮内 spinner + "验证中..."
  保存中: 按钮内 spinner + "保存中..."

错误: 红色文字提示，输入框 border-red-500
```

---

## 四、组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `<AppSidebar>` | `components/app-sidebar.tsx` | 新增，共享侧边栏 |
| `<AppLayout>` | `app/(app)/layout.tsx` | 新增，包含侧边栏的 (app) 路由组 layout |
| `<StatusDot>` | `components/status-dot.tsx` | 新增，脉冲状态点（替换现有 StatusBadge） |
| `<ServiceCard>` | `components/service-card.tsx` | 改造，增加图标/sparkline/刷新按钮 |
| `<Sparkline>` | `components/sparkline.tsx` | 新增，纯 SVG 轻量趋势图 |
| `<ProviderCard>` | `components/provider-card.tsx` | 新增，Connect 页服务选择卡片 |
| `globals.css` | `app/globals.css` | 更新颜色 Token 为 dark 主题 |

---

## 五、路由重构

将 `/dashboard` 和 `/connect` 移入 `(app)` 路由组，共享侧边栏 layout：

```
src/app/
  (auth)/
    login/
      page.tsx          # 独立，无侧边栏
  (app)/
    layout.tsx          # 新增：含侧边栏的共享 layout（含 auth 检查）
    dashboard/
      page.tsx
    connect/
      page.tsx
      [providerId]/
        page.tsx
```

删除旧的 `dashboard/layout.tsx` 和 `connect/layout.tsx`。

---

## 六、动画规格

| 元素 | 动画 | 规格 |
|------|------|------|
| 状态脉冲点 | `animate-pulse` | CSS，仅 healthy/warning |
| 侧边栏选中项 | `transition-colors 150ms` | 背景色平滑过渡 |
| 页面切换 | Next.js 默认 | 无额外动画（保持流畅） |
| 按钮 hover | `transition-colors 150ms` | |
| 卡片 hover | `transition-shadow 200ms` | 阴影微微加强 |
| Provider 卡片 hover | `transition-all 200ms` | 边框 + 背景 |

---

## 七、Provider 图标资源

在 `public/icons/` 目录添加：
- `openrouter.svg` — OpenRouter Logo
- `resend.svg` — Resend Logo
- `sentry.svg` — Sentry Logo

如无官方 SVG，使用带品牌色的首字母圆形头像作为 fallback。

---

*设计确认人：用户*
*下一步：调用 writing-plans 生成实施计划*
