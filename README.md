# Helm HMI Platform (SnapHelm)

面向工控现场的现代 HMI / PLC 调试与控制平台。

除了面向工控机本地一体部署的 Web/Node.js 版本外，**现已全新推出原生安卓移动版（Android App）支持**，可直接使用**安卓平板（Pad）**替代传统的 Pro-face 等专用工业触控屏和笨重的工控机一体机。

> 💡 **测试建议**：推荐优先使用 **安卓平板（Android Pad）** 进行安装测试与操作，专为大屏与横屏交互设计，多模块监控与调试体验更佳；同时也适配主流安卓手机。
>
> 📦 **安装包下载**：已提供最新 Debug 测试安装包供直接下载体验：[`apk/app-debug.apk`](apk/app-debug.apk)
>
> 💬 **技术交流**：本版本已开放下载体验，欢迎同行、工控工程师与开发者**免费下载试用与技术交流**。联系方式见文末。

---

## 📱 安卓版本（Android App）核心优势

相比传统专用触摸屏（如 Pro-face）及传统工控机方案，安卓移动版具备以下显著优势：

1. **硬件成本更低、选型极灵活**
   - 传统工业触控屏（如 Pro-face、西门子屏）硬件售价高昂、供货周期长、后期维护与备件成本高。
   - 安卓版可直接运行在市面高性价比、高硬件规格的通用安卓平板（Android Pad）或工业级安卓平板上，硬件采购与更换成本大幅降低（可节约 60%~80% 硬件成本）。

2. **自研纯 Kotlin 高性能工业协议引擎**
   - 底层通信完全基于 Kotlin 自研协议栈，摆脱对臃肿外部第三方通信库的依赖。
   - 采用**单轮整批状态原子更新**与**点位缓存去重评估**机制，彻底根除高频轮询引发的界面卡顿与重组掉帧，数据刷新极速流畅。
   - 内置底层并发调度互斥设计，确保参数修改与启停控制等下发指令毫秒级优先响应。

3. **主流工业 PLC 协议原生全覆盖（免外部中间件）**
   - **基恩士（Keyence）上位链路**：支持 KV-Nano / KV-5000 / KV-7000 / KV-8000 系列，支持 ASCII 批量读写字与位操作。
   - **西门子（Siemens）S7**：支持 S7-200 / 200 SMART / 300 / 400 / 1200 / 1500，基于 ISO-on-TCP (TPKT/COTP/S7comm)，机架槽位 TSAP 自动计算。
   - **三菱（Mitsubishi）Melsec MC**：支持 Q / L / iQ-R / FX5U 系列，基于 Qna-3E 二进制帧通信，批量极速读写。
   - **欧姆龙（Omron）FINS TCP**：支持 CP1H / CJ2M / CS1 / NX1P 等，节点号握手自动协商，全存储区覆盖。
   - **Modbus TCP**：支持标准功能码（01/02/03/04/05/06/16），大寄存器自动切片分包，兼容各类 Modbus 从站、PLC 与传感器。

4. **现代化 UI 与极佳现场交互**
   - 基于原生 Jetpack Compose 构建，融入 Apple 设计语言，界面简约精致、层级清晰。
   - 专为 Pad 大屏优化：顶部关键监控参数卡 + 底部四大功能模块（开关控制 / 监控信息 / 设置参数 / 实时报警），支持内联展开与快速浏览。
   - 内置数字软键盘安全录入与数值上下限即时校验，防止现场误触与越界写入。

5. **移动无线运维、摆脱工位限制**
   - 运维与电气工程师手持一台安卓 Pad 即可在车间设备旁自由移动，近距离排查机械与电气动作，实时查看报警及下发调试参数，彻底摆脱固定机柜工位屏的束缚。

---

## 📥 安卓端安装包下载与测试

- **安装包文件**：[`apk/app-debug.apk`](apk/app-debug.apk)（大小约 11.3 MB）
- **推荐测试环境**：
  - **推荐设备**：各类 Android 平板电脑（Pad 优先，横屏体验最佳，屏幕建议 10 英寸及以上）
  - **系统要求**：Android 8.0 及以上（API Level 26+）
- **快速安装测试**：
  1. 克隆或下载本仓库中的 [`apk/app-debug.apk`](apk/app-debug.apk) 到安卓 Pad；
  2. 点击安装（若提示需允许未知应用安装权限，请选择允许）；
  3. 平板与 PLC 处于同一局域网（Wi-Fi 或 Type-C 工业有线网卡），即可配置 PLC IP 建立连接进行调试。

---

## 💻 原 Node.js / Web HMI 架构（工控机本地部署）

面向工控机本地一体部署的 Node.js HMI/PLC 平台骨架：

- 在工控机本地运行后端服务、前端界面和 SQLite 数据库。
- 在同一局域网内通过无线路由，让 iPad / 手机 / 工位机通过浏览器访问 Web HMI。
- 统一封装 PLC 读写、权限、审计、报警、配方、趋势和设备页面能力。

详细技术选型和 PRD 见：

- [docs/architecture.md](docs/architecture.md)
- [docs/prd.md](docs/prd.md)

### 运行方式

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

后端默认监听 `3001`，前端默认监听 `5173`。前端开发环境会通过 Vite 代理访问后端 `/api`。

### 目录结构

```text
Helm/
├── apk/                     # 安卓端 APK 安装包发布目录
│   └── app-debug.apk        # 最新 Android Debug 安装包（建议使用 Pad 测试）
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

---

## 🤝 下载与技术交流

本项目持续探索工业自动化领域的现代移动端 HMI 交互、自研工控协议栈演进与低成本替代方案。

如果您对以下内容感兴趣，欢迎下载体验并随时联系技术交流：
- **APK 安装包试用、Bug 反馈与功能建议**
- **PLC 驱动适配与协议定制（基恩士、西门子、三菱、欧姆龙、Modbus 等）**
- **车间 Pad 替代 Pro-face 等老旧触摸屏的落地实践与工控方案探讨**

**联系方式**：
- **邮箱**：[linnanly@gmail.com](mailto:linnanly@gmail.com)
- **微信**：`linnan-wx`
