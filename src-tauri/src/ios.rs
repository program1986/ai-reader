// iOS 平台相关代码
// - Apple Sign In 桥接到 ASAuthorization

pub mod apple_signin {
    use tauri::plugin::{Builder, TauriPlugin};
    use tauri::{Manager, Runtime};
    use tauri::ipc::{Invoke, IpcResponse};
    use serde::{Deserialize, Serialize};
    use tauri::command;

    /// 客户端调用 `sign_in_with_apple` 时传入空对象即可
    /// 返回:identity_token(JWT)、user identifier、name、email
    #[derive(Debug, Serialize)]
    pub struct AppleSignInResult {
        pub user_id: String,
        pub identity_token: String,
        pub name: Option<String>,
        pub email: Option<String>,
    }

    /// iOS 端的 Swift/ObjC 桥接实际由 Tauri 的 iOS scaffolding 处理
    /// 这里是 TS 端 invoke 的命令名占位
    /// 真机验证步骤:
    /// 1. 在 src-tauri/gen/apple/ 中找到 Xcode 工程
    /// 2. 在 AppDelegate.swift 中实现 `application(_:open:options:)` 处理 ASAuthorization
    /// 3. 通过 Tauri 的 event 系统或 IPC 把结果发回 Rust
    /// 4. Rust 这边把结果以 invoke 响应方式回给前端
    ///
    /// 当前 stub:仅返回未实现错误,前端需要做降级处理
    #[tauri::command]
    pub async fn sign_in_with_apple() -> crate::Result<AppleSignInResult> {
        // TODO:实现真实的 ASAuthorization 桥接
        // 1. Tauri iOS 插件写 Swift 代码,导出 native handle
        // 2. 用 #[tauri::command] 包装
        // 3. 调用 AuthenticationServices.ASAuthorizationAppleIDProvider
        // 4. JWT 用 Apple 公钥本地验签
        Err(crate::AppError::NotImplemented(
            "Apple Sign In 需要在 Xcode 工程中实现 ASAuthorization 桥接".to_string(),
        ))
    }

    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("apple-signin")
            .invoke_handler(tauri::generate_handler![sign_in_with_apple])
            .build()
    }
}
