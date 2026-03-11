# 仓库工具存储与管理系统

网页端 + 手机端响应式界面，支持中英文切换，双仓库（中国/新加坡），工具借还、维修、盘点与报表统计。后端使用 Supabase (PostgreSQL)。

## 功能概览

- **多语言**：界面中英文切换，关键数据中英双存
- **双仓库**：CN（中国）、SG（新加坡），数据按仓库与角色隔离
- **用户角色**：管理员、仓库经理、普通用户
- **工具状态**：可用 / 借出 / 已归还 / 损坏 / 维修中 / 遗失，完整状态流转
- **核心模块**：工具管理、借还、维修、盘点、报表、扫码

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + react-i18next + Recharts
- 后端/数据：Supabase（PostgreSQL、Auth、Storage、Realtime）

## 快速开始

```bash
npm install
cp .env.example .env   # 可选：填写 VITE_SUPABASE_* 以连接 Supabase
npm run dev
```

浏览器打开 http://localhost:5173 ，使用演示账号 **demo / demo** 登录（未配置 Supabase 时也可使用）。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/DATABASE.md](docs/DATABASE.md) | 数据库结构 |
| [docs/API.md](docs/API.md) | API 接口说明 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 部署配置 |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | 用户操作手册 |

## 项目结构

```
├── src/
│   ├── layouts/       # 网页布局、手机端底部 Tab 布局
│   ├── pages/         # 页面：登录、首页、工具、借还、维修、盘点、报表、扫码、我的
│   ├── stores/        # Zustand：认证、当前仓库
│   ├── i18n/          # 中英文文案
│   ├── lib/           # Supabase 客户端
│   ├── constants/     # 工具状态等常量
│   └── types/         # TypeScript 类型
├── supabase/migrations/  # 数据库迁移与 RLS
├── docs/              # 数据库、API、部署、用户手册
└── .env.example
```

## 交付清单

- [x] 完整源代码
- [x] 数据库结构文档（DATABASE.md）
- [x] API 接口文档（API.md）
- [x] 部署配置说明（DEPLOYMENT.md）
- [x] 用户操作手册（USER_MANUAL.md）

## License

Private / 内部使用
