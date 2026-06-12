// AI读书 - Tauri 后端入口
// - 插件注册
// - 自定义命令
// - iOS 平台适配 (Apple Sign In 等)

#[cfg(target_os = "ios")]
mod ios;

mod commands;
mod error;

pub use error::{AppError, Result};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_sql::Builder::default().build());

    // iOS 平台:注册 Apple Sign In 插件
    #[cfg(target_os = "ios")]
    {
        builder = builder.plugin(ios::apple_signin::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
            commands::read_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI读书");
}
