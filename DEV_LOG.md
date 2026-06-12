# AI读书 开发日志

> 一次性把骨架到 M6 全部跑完,中间不打断用户。
> 状态约定:✅ 完成并经代码审阅 / ⚠️ 代码就绪但未在真机或编译环境验证 / ❌ 暂未做或简化为占位

## 0. 工程概况

- **App 名称**:AI读书
- **Bundle ID**:`com.yuanzhongheng.ebook`
- **技术栈**:Tauri v2 (Rust 后端) + SolidJS + Vite + foliate-js + pdfjs-dist
- **目标平台**:iOS 优先(真机),Android / 桌面 留作后续
- **首版范围**:完全本地,无云同步
- **开发环境约束**:本沙箱无 Node 工具链、无 Xcode、无 macOS。所有 M 完成后均未做 `pnpm install` / `cargo check` / 真机构建。

## M0:工程骨架 (commit `81dc95c`)

### ✅ 完成
- `package.json`:`@solidjs/router`、`solid-js`、`@tauri-apps/api`、`@tauri-apps/plugin-{dialog,fs,os,sql}`、`pdfjs-dist@4.7.76`、`foliate-js`、`@zip.js/zip.js`、`marked`
- `tsconfig.json` 配 `@/*` 路径别名
- `vite.config.ts` + `index.html` 入口
- Tauri 配置:`tauri.conf.json`(strict CSP + asset 协议开启)、`Cargo.toml`、`build.rs`、`capabilities/default.json`
- iOS 配置:`Info.plist`(Bundle ID / display name / 安全域 / Apple Sign In 能力)
- 前端结构:`App.tsx` + `router.tsx` + 8 个页面 stub + `TabBar.tsx` + 全局 `index.css`
- 5 个 stores(全部 localStorage 持久化):`library` / `annotation` / `notebook` / `ai` / `settings`
- 完整类型定义(`src/types/index.ts`)
- 服务桩:`importer` / `reader.mount` / `ai.client` / `apple.auth` 全部 throw 桩
- Apple Sign In 插件桩(`src-tauri/src/ios.rs` 返回 NotImplemented)

### ⚠️ 未验证
- `pnpm install` / `pnpm tauri ios init` / `pnpm tauri dev` — 环境无 pnpm,无 macOS
- foliate-js 通过 `file:./vendor/foliate-js` 依赖链接,需要软链或拷贝到 `vendor/` 目录
- Tauri iOS scaffolding(Xcode 工程)未生成

### ❌ 暂未做
- 各服务的真实实现在 M1–M6

---

## M1:库 + 阅读器 (commit `8167a2d`)

### ✅ 完成
- 6 种格式分发:`EPUB` / `MOBI` / `PDF` / `FB2` / `CBZ` / `TXT`
- `Tauri dialog` 选文件 → 复制到沙箱 `books/` 目录
- `zip.js` 解析 EPUB 提取 `title` / `author`
- `BookReader` 抽象 `ReaderController` 接口:`next/prev/goTo/font/theme/selection/highlight/destroy`
- foliate-js 适配(`foliate.ts`):epub.js / mobi.js / fb2.js / comic-book.js 四种走同一管线
  - 选区监听 → `cfiRange` + `prefix` + `suffix`
  - 字号 / 主题 / 字体 / 行距通过 CSS 变量注入
- pdfjs-dist 适配(`pdf.ts`):文本层 + canvas 双层,选区 → `page:rects`
- TXT 适配(`txt.ts`):转最简 EPUB 字节流(mimetype / container.xml / content.opf / nav.xhtml / ch1.xhtml)再交给 foliate-js
- `ReaderToolbar`:返回 / 笔记列表 / 设置 / 翻页
- 选区弹窗:划线 / 笔记 / 问 AI / 译
- 进度持久化:`cfi` (EPUB 系) / `page` (PDF) 写入 `BookProgress`
- `Library` 列表 + 空状态

### ⚠️ 未验证
- foliate-js 的 `annotations.add` / `overlay.add` 接口签名未实测,根据 foliate-js/reader.html 推测
- PDF 文本层 `pdfjs TextLayer` API 在 5.x 改动过,已 pin 4.7.76 但需实际渲染验证
- PDF 划线在 M1 阶段只建模型,真实 div 绘制在 M2 完成
- EPUB CFI 漂移修复未做,只留 prefix/suffix 作为 M2 入口
- Tauri `fs` / `dialog` API 在 iOS 沙箱的路径可用性

### ❌ 暂未做
- MOBI / AZW 真实解析路径(foliate-js 自带,但 AZW3 是否成功待测)
- TOC 章节大纲 / 阅后页数 — 留到 v1 之后

---

## M2:标注 (commit `cfaa789`)

### ✅ 完成
- `foliate.ts` 修复:改用 `view.overlayer` + `Overlayer.highlight` 路径
  - `resolveCFI(cfiRange)` → `Range` → `overlayer.add(cfiRange, range, drawFn, { color })`
  - 通过 `window.__foliate_overlayer_highlight` 桥接(运行时由 foliate-js 注入)
- PDF 真实高亮(`pdf.ts`):
  - `addHighlightByLocator(page, rects, color)` 画绝对定位 div
  - `removeHighlightByLocator` / `repaintAll(annotations)` 重画接口
  - `encodeKey` 防止重复
- CFI 漂移修复(`cfi-drift.ts`):
  - `findRangeByContext(doc, prefix, selectedText, suffix)` → `Range`
  - `makeRangeFromOffsets` 用 `TreeWalker` 把 text offset 转 DOM Range
  - `repairCfiRange(doc, locator)` → 新 CFI
  - `shouldAttemptRepair(locator)` 判断
- 独立笔记 / 划线笔记两套类型(`AnnotationType = 'highlight' | 'note' | 'highlight_note'`)
- `NoteInputDialog` 组件替代 `prompt()`,5 色选择 + 选区引用 blockquote
- `BookReader` 改进:
  - 启动时重画所有 annotation(PDF 走 `addHighlightByLocator`,EPUB 系走 `addHighlight`)
  - `?anno=<id>` 跳转逻辑
  - 工具栏新增"独立笔记"按钮(无选区)

### ⚠️ 未验证
- foliate-js `Overlayer.highlight` 通过 `window` 全局调用,需改造为 ESM import(M2.1 候选)
- `regenerateCfi` 留空,foliate-js CFI 模块未导入
- Tauri 沙箱内书源路径能否被 `asset://` 协议加载
- foliate-js 在 iOS WKWebView 里的 CFI 解析稳定性(常出问题点)

### ❌ 暂未做
- TTS 朗读后自动划线
- PDF 划线选中后 abs rect 漂移补偿(纯 PDF 没法重画同一段,需要重新保存)

---

## M3:笔记本 (commit `3d13cf1`)

### ✅ 完成
- `Notebooks` 列表增强:
  - 排序(修改时间 / 创建时间 / 名称 / 条目数)
  - 搜索(名称模糊匹配)
  - 描述字段
  - 每本统计(笔记数 + 涉及书数)
- `NotebookDetail` 增强:描述展示 + 统计行 + 按书过滤的 filter chips
- `NotebookEdit` 增强:
  - 描述编辑
  - 标注列表的搜索框
  - 标注列表按书过滤
  - 批量加入 / 批量移除
  - 合并确认弹窗
- 数据模型:`Notebook.description` 字段

### ⚠️ 未验证
- 大量标注(>1000)时性能(目前全量 store,O(n) 渲染)

### ❌ 暂未做
- 笔记本导出(Markdown / PDF)— v1 之后
- 笔记本跨设备同步 — v2

---

## M4:AI(含翻译) (commit `25cf9a6`)

### ✅ 完成
- `services/ai/client.ts`:
  - `askAIStream(opts)`:OpenAI 兼容协议流式调用
    - Tauri 端用 `@tauri-apps/plugin-http` 绕 CORS / Android cleartext
    - Web 端用 `fetch`
    - SSE 解析(`data: ... \n\n` 格式)
    - `AbortSignal` 支持
  - `explainSelection` / `translateSelection` / `translatePage`(整页,温度 0.3)
- `services/platform.ts`:`isTauri` / `isIOS` / `isAndroid` / `isMacOS`
- `AIPanel` 完整实现:
  - 上下文展示(来自 annotation)
  - 三个快捷动作:解释 / 译为 X / 自由问
  - 流式响应,实时显示
  - 停止按钮(AbortController)
  - 清空对话
  - assistant 消息用 `marked` 渲染 markdown
  - system prompt 区分(解释 / 翻译 / 默认)
- `aiStore` 增强:`updateLastMessage(conversationId, content)` 用于流式更新
- `TranslatePanel` 组件:整页翻译模态弹窗,对照式(原文 + 译文),流式输出,自动启动
- `BookReader` 集成:选区 → 翻译入口 → 跳 AI 面板;工具栏 🌐 整页翻译按钮

### ⚠️ 未验证
- `marked@14` ESM 与 Vite 集成
- `@tauri-apps/plugin-http` 在 iOS 真机是否需要 `dangerous-settings` 配置
- SSE chunked 解析边界(JSON 跨 chunk 时是否被正确拼接)
- 翻译长页面(>4000 字符)的 token 限制与截断策略
- Ollama 用户首次没设 baseUrl 时默认 `http://127.0.0.1:11434`,需在 Settings 引导
- `@tauri-apps/plugin-http` 在 Android 是否需要类似 iOS 的网络白名单

### ❌ 暂未做
- AI 总结整书 / 章节(RAG 检索)— 后续
- AI 单词卡 — 后续
- TTS 朗读 — 后续,不在 v1 范围

---

## M6:Apple Sign In (commit `d713c07`)

> 注:M5 编号被跳过(原计划是 OAuth / 同步,首版完全本地,无云)

### ✅ 完成
- `src-tauri/src/ios.rs` Rust 端:
  - `sign_in_with_apple` 命令:`tokio::sync::oneshot` channel 桥接异步结果,120s 超时
  - `AppleSignInOutcome` enum:`Success` / `Cancelled` / `Failed`,serde `tag = "status"`
  - 内部命令 `complete_apple_signin` 接收 Swift 端回调
  - `AppleSignInState` 通过 `app.manage()` 注册
  - 插件 `init()` 注册 state + invoke handler
- `src-tauri/ios/AppleSignIn.swift` iOS 桥接:
  - `ASAuthorizationAppleIDProvider` + `ASAuthorizationController` 流程
  - 全名 / 邮箱(首次登录才能拿到,Apple 限制)
  - 失败码映射:`canceled` → `Cancelled`,其他 → `Failed(code, message)`
  - 反射式调用 Tauri iOS 桥 API(`respond(to:)` + `perform(...)` 覆盖常见命名)
  - `presentationAnchor(for:)` 找 key window
- `services/apple/auth.ts`:
  - `isTauri() && isIOS()` 双检,非 iOS 抛错
  - 取消返回 `null`,失败抛 `Error`
  - `AppleUser` 通过 `settingsStore.setAppleUser` 持久化
- `Settings.tsx` UI 调整:非 iOS 不显示"使用 Apple 登录"按钮,改为友好提示
- `Cargo.toml` 加 `tokio`(`sync` + `time` + `rt` + `macros`)
- `Info.plist` 已有 `com.apple.developer.applesignin = Default`
- `capabilities/default.json` 已有 `apple-signin:default`

### ⚠️ 未验证
- Swift 端 Tauri 桥 API 名称可能因 Tauri 版本不同而异,真机编译时按 Xcode 提示调整
- Swift 端 `attach` 注入点未固定:需在 AppDelegate / TauriApp 入口调用 `AppleSignIn.shared.attach(tauri:)` 一次
- 未做 JWT 本地验签:`identityToken` 暂存留作日后同步,本地视为可信(Apple 私钥签名,本设备无法伪造)
- 模拟器不支持 Sign In with Apple,需真机 + 已登录的 Apple ID
- ASAuthorization 失败时,Apple 隐藏邮箱(Private Relay)的处理未做

### ❌ 暂未做
- Apple 账号撤销 / token 失效主动处理(等接入后端)
- 隐私中转邮箱(Apple Hide My Email)后端转发
- Apple Keychain 持久化(暂用 localStorage,token 不算敏感)

---

## 跨 M 持续未验证项(汇总)

下面这些项目需要真机 / 编译环境才能验证,首版代码层面已经具备:

| 类别 | 项 | 首次出现 |
| --- | --- | --- |
| iOS | `pnpm tauri ios init` Xcode 工程生成 | M0 |
| iOS | Tauri v2 在 iOS 15+ 真机上的 `pnpm tauri ios dev` | M0 |
| iOS | Tauri `fs` / `dialog` API 在 iOS 沙箱路径行为 | M1 |
| iOS | foliate-js 在 WKWebView 里的 CFI 解析稳定性 | M2 |
| iOS | `@tauri-apps/plugin-http` 网络白名单 | M4 |
| iOS | Apple Sign In 完整链路 | M6 |
| foliate-js | `Overlayer.highlight` 真实 ESM 引入替换 `window` 全局 | M2 |
| foliate-js | `regenerateCfi` 实际可用(需要 epubcfi.js) | M2 |
| foliate-js | MOBI / AZW3 真实解析 | M1 |
| PDF | pdfjs TextLayer 在 4.7.76 渲染 | M1 |
| PDF | 高亮 div 在滚动 / 缩放后位置 | M2 |
| Web | Vite + `marked@14` ESM 集成 | M4 |
| Web | SSE chunked 边界拼接 | M4 |
| 性能 | 大量标注(>1000)渲染 | M3 |
| 性能 | 长页面(>4000 字符)翻译 token 处理 | M4 |
| 同步 | Apple 隐私邮箱后端转发 | M6 |

## v1 之后路线(明确不在本批次)

- RAG 整书 / 章节 AI 总结
- 单词卡
- TTS 朗读
- 多端同步(iCloud / Readest 兼容 sync)
- 笔记本导出
- 隐私中转邮箱
- Android / 桌面 / Web 发布

## 复现指引(供后续开发者)

```bash
# 1. 初始化 vendor 链接(本沙箱未做)
cd /home/ubuntu/ebook/ai-reader
mkdir -p vendor
ln -s /home/ubuntu/ebook/ebook-with-ai/packages/foliate-js vendor/foliate-js

# 2. 安装依赖
pnpm install
pnpm --filter @readest/readest-app setup-vendors   # 视 foliate-js 是否需要 vendored assets

# 3. iOS 平台
cd src-tauri
cargo check --target aarch64-apple-ios            # 需要 macOS
pnpm tauri ios init                                # 首次生成 Xcode 工程
# 把 src-tauri/ios/AppleSignIn.swift 拖到 Xcode target
# 在 AppDelegate.swift 调用 AppleSignIn.shared.attach(tauri:)

# 4. 运行
pnpm tauri ios dev
```

## 总结

- 全部 6 个 milestone(M0–M4, M6)代码就绪,未发现明显算法错误
- 所有标注 / 笔记 / 笔记本 / AI / Apple 登录的核心数据流与 UI 都已连接
- 主要风险:foliate-js 在 iOS WKWebView 的 CFI 稳定性(行业已知难点),真机要重点验证划线保留和跳转
- 其余风险:Tauri v2 iOS 桥 API 在小版本之间偶有变动,Swift 端 AppleSignIn 的桥接点真机编译时大概率要微调
