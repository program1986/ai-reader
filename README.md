# AI读书

> 跨平台电子阅读器(本仓库当前 iOS 优先)。基于 Tauri v2 + SolidJS,支持 EPUB / MOBI / PDF / FB2 / CBZ / TXT 六种格式,集成划线、笔记、AI 问答、整页翻译、笔记本管理。

## 状态

v1 仍在开发。详细进度见 [`DEV_LOG.md`](./DEV_LOG.md)。

## 协议

本项目代码: **GNU AGPL v3**(参见 `LICENSE`)。

本项目用到的第三方代码:
- [`foliate-js`](./vendor/foliate-js) — MIT,John Schember
- [`pdfjs-dist`](https://github.com/mozilla/pdf.js) — Apache 2.0,Mozilla
- 其他依赖见 `package.json`

## 技术栈

| 层 | 技术 |
|---|---|
| 壳 | Tauri v2 |
| 前端 | SolidJS + Vite + TypeScript |
| 渲染 | foliate-js (EPUB/MOBI/FB2/CBZ) + pdfjs-dist (PDF) + 自研 worker (TXT) |
| 状态 | Solid Stores |
| 持久化 | SQLite (Tauri `tauri-plugin-sql`) |
| AI | BYOK,OpenAI 兼容协议 |
| Apple 登录 | Tauri 插件 + ASAuthorization |

## 目录

```
.
├── src/                # 前端 (SolidJS)
│   ├── pages/          # 路由页面
│   ├── components/     # 通用 UI 组件
│   ├── stores/         # 状态管理
│   ├── domain/         # 领域模型 + 纯 TS 业务逻辑
│   ├── services/       # 平台 / Tauri 桥接
│   └── types/          # 共享类型
├── src-tauri/          # Rust 后端
│   ├── src/            # Rust 源码
│   ├── capabilities/   # 权限声明
│   ├── plugins/        # 自研 Tauri 插件
│   └── Info.plist      # iOS 配置
├── vendor/             # 第三方源码 (foliate-js 等)
└── DEV_LOG.md          # 开发日志
```

## 开发

### 先决条件

- Node 18+,pnpm 8+
- Rust 1.77+
- iOS 开发: Xcode 15+ + iOS 15+ SDK
- Tauri 平台依赖: <https://tauri.app/start/prerequisites/>

### 初始化

```bash
# 1. 安装 pnpm 依赖
pnpm install

# 2. 链接 vendor (foliate-js 来自 Readest monorepo)
# 见 vendor/README.md

# 3. (iOS 首次)生成 Xcode 工程
pnpm tauri ios init
```

### 开发

```bash
# Web 调试(不需要 iOS 工具链)
pnpm tauri dev

# iOS 模拟器
pnpm tauri ios dev

# 真机
pnpm tauri ios dev --device <name>
```

### 构建

```bash
# iOS App Store / TestFlight
pnpm tauri ios build
```

## 包信息

- Bundle ID: `com.yuanzhongheng.ebook`
- App 显示名: `AI读书`
- min iOS: 15.0
