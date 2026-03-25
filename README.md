# Helm HMI Platform

面向工控机本地一体部署的 Node.js HMI/PLC 平台骨架。

目标：

- 在工控机本地运行后端服务、前端界面和 SQLite 数据库。
- 在同一局域网内通过无线路由，让 iPad / 手机 / 工位机访问 Web HMI。
- 统一封装 PLC 读写、权限、审计、报警、配方、趋势和设备页面能力。
- 替代传统 Pro-face 类 HMI 的大部分软件能力，并保留后续扩展多 PLC 驱动的空间。

详细技术选型和 PRD 见：

- [docs/architecture.md](/Users/linnan/Helm/docs/architecture.md)
- [docs/prd.md](/Users/linnan/Helm/docs/prd.md)

## 运行方式

首次安装依赖：

```bash
npm install
```

开发模式分别启动：

```bash
npm run dev:api
npm run dev:web
```

生产构建：

```bash
npm run build
npm run start
```

后端默认监听 `3001`，前端默认监听 `5173`。
前端开发环境会通过 Vite 代理访问后端 `/api`。

## 建议目录

```text
Helm/
├── apps/
│   ├── api/                 # Node 后端 API、SQLite、Keyence PLC 适配
│   └── web/                 # React HMI 前端
├── packages/
│   ├── db/                  # SQLite schema、迁移、仓储层
│   ├── plc-runtime/         # PLC 驱动抽象、轮询、写入队列、点位缓存
│   ├── shared/              # 前后端共享类型、协议、常量
│   └── ui/                  # 共享 UI 组件与主题
├── tooling/
│   ├── config/              # tsconfig / eslint / vitest 等共享配置
│   └── scripts/             # 打包、部署、初始化脚本
├── deploy/
│   ├── linux/               # systemd / 安装脚本
│   └── windows/             # NSSM / PowerShell / 安装脚本
├── docs/                    # 架构与 PRD
└── data/                    # SQLite 数据、导出文件、运行时缓存
```

## 当前初始化工程

- `apps/api`：Fastify API，可直接切换 `mock` 或 `keyence` 模式。
- `packages/plc-runtime`：默认内置 mock，支持 `node-keyence-hostlink`。
- `packages/db`：SQLite 自动建表，保存点位当前值和审计日志。
- `apps/web`：保留现有 Dashboard UI，并接入 API 状态和示例读写。

## 联系方式

- 邮箱：[linnanly@gmail.com](mailto:linnanly@gmail.com)
- 微信：linnan-wx
