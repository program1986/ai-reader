// iOS 平台相关代码
// - Apple Sign In 桥接到 ASAuthorization
//
// 设计要点:
// 1. 前端 invoke('sign_in_with_apple') → Rust 命令
// 2. Rust 创建一个 oneshot channel,向 iOS 端 emit "apple-signin-start" 事件
// 3. iOS Swift 端在 AppDelegate 注册监听,收到事件后启动 ASAuthorization
// 4. Swift 端完成(或取消)后 emit "apple-signin-complete" 事件,带上结果
// 5. Rust 端监听该事件,把结果通过 channel 送回原命令,前端 promise resolve
// 6. 带 120s 超时,避免 Swift 端异常时挂死
//
// v1 不做本地 JWT 验签:identityToken 是 Apple 私钥签名,本地无法离线验证公钥轮转
// 存起来作为以后同步 / 服务端用,本地登录视为可信(同设备不可能伪造)

use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::sync::oneshot;
use tokio::time::timeout;

pub mod apple_signin {
    use super::*;

    /// Apple Sign In 的结果(从 Swift 端过来,送回前端)
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AppleSignInResult {
        pub user_id: String,
        pub identity_token: String,
        #[serde(default)]
        pub name: Option<String>,
        #[serde(default)]
        pub email: Option<String>,
    }

    /// 监听器使用的错误结构(从 Swift 端过来)
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AppleSignInError {
        pub code: String,
        pub message: String,
    }

    /// 包装一次性结果:成功/失败/取消
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(tag = "status", rename_all = "snake_case")]
    pub enum AppleSignInOutcome {
        Success(AppleSignInResult),
        Cancelled,
        Failed(AppleSignInError),
    }

    /// Tauri-managed state
    #[derive(Default)]
    pub struct AppleSignInState {
        pending: Mutex<Option<oneshot::Sender<AppleSignInOutcome>>>,
    }

    /// 前端 invoke 的命令
    /// - 仅 iOS 有效,其他平台返回 NotImplemented
    /// - 120s 超时,期间 Swift 端必须 emit "apple-signin-complete"
    #[tauri::command]
    pub async fn sign_in_with_apple<R: Runtime>(
        app: AppHandle<R>,
        state: State<'_, AppleSignInState>,
    ) -> crate::Result<AppleSignInResult> {
        // 注册一次性 channel
        let (tx, rx) = oneshot::channel::<AppleSignInOutcome>();
        {
            let mut pending = state.pending.lock().unwrap();
            // 如果上一次未完成,丢弃旧的(防止泄漏)
            *pending = Some(tx);
        }

        // 通知 Swift 开始 ASAuthorization
        app.emit("apple-signin-start", ())
            .map_err(|e| crate::AppError::Other(format!("emit failed: {e}")))?;

        // 等待 Swift 完成
        let outcome = match timeout(Duration::from_secs(120), rx).await {
            Ok(Ok(o)) => o,
            Ok(Err(_)) => {
                // channel 被 drop(说明 Swift 端也 drop 了 sender),视为取消
                *state.pending.lock().unwrap() = None;
                return Err(crate::AppError::Other("Apple Sign In 取消".into()));
            }
            Err(_) => {
                *state.pending.lock().unwrap() = None;
                return Err(crate::AppError::Other("Apple Sign In 超时".into()));
            }
        };

        // 清掉 pending(重要:让监听器不再尝试发送)
        *state.pending.lock().unwrap() = None;

        match outcome {
            AppleSignInOutcome::Success(r) => Ok(r),
            AppleSignInOutcome::Cancelled => {
                Err(crate::AppError::Other("Apple Sign In 取消".into()))
            }
            AppleSignInOutcome::Failed(e) => Err(crate::AppError::Other(format!(
                "Apple Sign In 失败 [{}]: {}",
                e.code, e.message
            ))),
        }
    }

    /// iOS Swift 端在 ASAuthorization 完成时调用此命令,把结果送回 Rust
    /// 该命令不向 JS 暴露,只供 iOS 端 invoke
    #[tauri::command]
    pub fn complete_apple_signin(
        state: State<'_, AppleSignInState>,
        outcome: AppleSignInOutcome,
    ) -> crate::Result<()> {
        let mut pending = state.pending.lock().unwrap();
        if let Some(tx) = pending.take() {
            // 忽略 send 错误(可能 receiver 已被超时 drop)
            let _ = tx.send(outcome);
        } else {
            // 没有 pending,可能是超时后 Swift 才回调
            // 不报错,只是忽略
        }
        Ok(())
    }

    /// 插件初始化:注册 state + invoke handler + 启动时不需要注册 listener
    /// (listener 内部是 event-based,on demand)
    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("apple-signin")
            .invoke_handler(tauri::generate_handler![
                sign_in_with_apple,
                complete_apple_signin,
            ])
            .setup(|app, _api| {
                app.manage(AppleSignInState::default());
                Ok(())
            })
            .build()
    }
}
