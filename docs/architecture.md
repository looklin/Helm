# 架构与技术选型

## 1. 项目目标

构建一个运行于工控机的本地 HMI 平台，使用 Node.js 提供 PLC 通信和业务服务，使用 React 提供操作界面，使用 SQLite 保存配置和运行数据。系统应支持在工控机本机触屏访问，也支持通过局域网 Wi-Fi 让 iPad、手机、PC 浏览器访问并读写 PLC。

## 2. 推荐整体架构

```text
浏览器 / iPad / 手机
        |
   HTTP(S) + WebSocket
        |
   React Web HMI
        |
    Node API Gateway
        |
  PLC Runtime / Alarm / Recipe / Audit / Auth
        |
  PLC Driver Adapters (Modbus TCP / OPC UA / S7 / MC ...)
        |
     SQLite + 文件存储
```

## 3. 为什么建议用 Monorepo

- 前后端、共享协议、PLC 驱动、数据库模型放在同一仓库，避免协议漂移。
- 工业项目通常生命周期长，monorepo 更适合版本协同和后续二次开发。
- 更适合做本地一体部署，最终可以由一个安装包完成初始化、建库、前端静态资源部署和服务注册。

## 4. 推荐技术选型

### 4.1 语言与包管理

- 语言：TypeScript
- Node 版本：Node.js 22 LTS
- 包管理：pnpm workspace

原因：

- TypeScript 适合工业场景下的长期维护、接口稳定和多人协作。
- Node 22 LTS 生命周期更稳，适合部署到工控机。
- pnpm 更适合 monorepo，安装快、磁盘占用低。

### 4.2 后端

- 框架：Fastify
- 实时通信：WebSocket（`@fastify/websocket`）或 Socket.IO（二选一，首选纯 WebSocket）
- 校验：Zod
- 日志：Pino
- 任务调度：BullMQ 或轻量自研队列
- 认证：JWT + Refresh Token + 本地会话白名单

为什么不是 NestJS：

- 该项目更偏“边缘控制 + 实时状态同步”，Fastify 更轻、更直接、资源占用更低。
- 工控机场景往往优先部署稳定性和启动速度，Fastify 更合适。

### 4.3 前端

- 框架：React 19 + Vite
- 路由：React Router
- 状态管理：Zustand
- 数据获取：TanStack Query
- UI：自建工业风组件库 + Tailwind CSS
- 图表：ECharts

原因：

- HMI 场景强调实时状态、趋势图、配方编辑、报警面板，React + Query + Zustand 的组合足够灵活。
- Vite 对本地开发体验和构建速度都很好。
- 工业界面通常需要较高定制度，自建 UI 层比重型后台模板更可控。

### 4.4 数据库

- 数据库：SQLite
- ORM / SQL 工具：Drizzle ORM
- 驱动：`better-sqlite3`

原因：

- SQLite 非常适合工控机本地单机场景，部署简单，不依赖单独数据库服务。
- `better-sqlite3` 同步调用在单机边缘场景性能稳定、依赖简单。
- Drizzle 生成 SQL 透明，迁移可控，适合工业项目审计与长期维护。

### 4.5 PLC 通信层

建议单独抽象为 `packages/plc-runtime`，不要把 PLC 协议逻辑直接写进业务 API。

驱动设计建议：

- `DriverAdapter`：统一 `connect / disconnect / read / write / batchRead / batchWrite / healthCheck`
- `TagModel`：统一点位定义，例如 `name / address / type / scale / access / pollInterval`
- `RuntimeScheduler`：统一轮询调度、写入排队、失败重试、熔断与缓存
- `PermissionGuard`：高风险写操作必须做权限和二次确认

第一阶段协议建议：

- Modbus TCP
- Siemens S7
- OPC UA

第二阶段再扩展：

- Mitsubishi MC
- Omron FINS
- EtherNet/IP

### 4.6 部署与运维

- 进程管理：PM2 或系统服务
- Linux 工控机：systemd
- Windows 工控机：NSSM / WinSW
- 反向代理：Caddy
- 局域网证书：可选本地 HTTPS，自签名证书

推荐部署方式：

- Node API 与 React 构建产物部署在同一台工控机
- Node 服务直接托管静态前端资源
- SQLite 与导出报表落本地磁盘
- 移动端通过工控机 IP 或绑定域名访问

## 5. 推荐目录结构

```text
apps/
  api/
    src/
      app/
      modules/
        auth/
        plc/
        tags/
        alarms/
        recipes/
        trends/
        devices/
        audit/
        system/
      realtime/
      bootstrap/
    test/
  web/
    src/
      app/
      pages/
      widgets/
      features/
      entities/
      shared/
    public/
packages/
  db/
    src/
    drizzle/
  plc-runtime/
    src/
      core/
      drivers/
      scheduler/
      cache/
  shared/
    src/
      contracts/
      schemas/
      constants/
      types/
  ui/
    src/
tooling/
  config/
  scripts/
deploy/
  linux/
  windows/
docs/
data/
```

## 6. 核心模块建议

### 后端核心模块

- `auth`：用户、角色、登录、权限
- `plc`：PLC 连接管理、驱动实例、连通性检查
- `tags`：点位定义、分组、权限、读写策略
- `alarms`：报警规则、确认、消警、历史
- `recipes`：配方模板、版本、下发、回读校验
- `trends`：趋势采样、历史查询、导出
- `devices`：产线、设备、页面绑定关系
- `audit`：所有写操作审计
- `system`：参数、备份、日志、健康检查

### 前端页面建议

- 登录页
- 设备总览页
- 单机 HMI 操作页
- 报警中心
- 趋势曲线页
- 配方管理页
- 点位调试页
- 用户与权限页
- 系统设置页

## 7. 数据建模建议

SQLite 首批核心表：

- `users`
- `roles`
- `permissions`
- `user_roles`
- `plc_connections`
- `tag_groups`
- `tags`
- `tag_values_current`
- `tag_values_history`
- `alarms`
- `alarm_events`
- `recipes`
- `recipe_items`
- `audit_logs`
- `system_settings`

说明：

- `tag_values_current` 保存当前值，供实时界面读取。
- `tag_values_history` 做趋势和追溯，建议做按天归档或定期清理。
- 所有 PLC 写入都必须进入 `audit_logs`。

## 8. 工业场景特别建议

- 所有写操作默认“显式确认”，并支持权限控制。
- 网络断开时前端必须明确显示“只读 / 离线”状态。
- PLC 通信层与 Web 请求层解耦，避免页面操作直接阻塞驱动线程。
- 对每个 PLC 驱动加入心跳、重试、熔断和恢复机制。
- 重要动作必须支持操作前值、目标值、操作人、时间戳记录。
- 提供本地备份和导出能力，避免数据库文件单点损坏带来不可恢复风险。

