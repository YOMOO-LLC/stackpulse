# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 启动开发服务器（端口 4567）
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 运行 ESLint
```

开发服务器访问地址：http://localhost:4567（非默认的 3000 端口）

## 技术栈

- **Next.js 16.1.6**（App Router）+ **React 19.2.3**
- **TypeScript**（strict 模式）
- **Tailwind CSS v4**（使用 `@import "tailwindcss"` 语法，非旧版 `@tailwind` 指令）
- 字体：Geist Sans + Geist Mono（通过 `next/font/google` 加载）

## 架构

采用 Next.js App Router，源码位于 `src/` 目录：

- `src/app/layout.tsx` — 根布局，设置字体 CSS 变量和全局样式
- `src/app/page.tsx` — 首页（当前为脚手架默认页）
- `src/app/globals.css` — 全局样式，定义 `--background` / `--foreground` CSS 变量和 Tailwind 主题配置

路径别名：`@/*` 映射到 `./src/*`

## CSS 主题

CSS 变量通过 Tailwind v4 的 `@theme inline` 块定义，支持系统级暗色模式（`prefers-color-scheme: dark`）。在组件中使用 `bg-background`、`text-foreground` 等 Tailwind 工具类引用这些变量。

## TDD 工作流

测试框架：**Vitest** + `@testing-library/react`

```bash
npx vitest              # 监听模式（开发时常驻）
npx vitest run          # 单次运行全部测试
npx vitest run src/path/to/file.test.ts  # 运行单个文件
npx vitest --coverage   # 生成覆盖率报告
```

**Red-Green-Refactor 循环**（所有功能开发和 Bug 修复均须遵循）：

1. **Red** — 先写一个描述期望行为的失败测试
2. **Green** — 写刚好能让测试通过的最简实现
3. **Refactor** — 在测试保护下重构，保持测试绿色

不得在没有对应失败测试的情况下直接写实现代码。

## 测试账号

| 字段 | 值 |
|------|----|
| Email | `dev@stackpulse.local` |
| Password | `Test1234!` |

seed 文件：`supabase/seed.sql`，运行 `supabase db reset` 可重建本地数据库并插入测试账号。
