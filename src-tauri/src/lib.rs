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
    // 在 tauri::log_stdout 之前先记录（因为它会调 Swift runtime，runtime 没启动会 abort）
    log_to_file("=== AI读书 run() entered ===\n");
    log_to_file("[1] before log_stdout\n");

    #[cfg(target_os = "ios")]
    tauri::log_stdout();

    log_to_file("[2] after log_stdout\n");

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init());

    log_to_file("[3] plugins initialized\n");

    builder
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_app_info,
            commands::read_text_file,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log_to_file(&format!("[ERR] Tauri startup error: {:?}\n", e));
            std::process::exit(1);
        });

    log_to_file("[4] Tauri running (after run returned)\n");
}

fn log_to_file(msg: &str) {
    use std::io::Write;
    eprint!("{}", msg);
    // iOS 沙盒里：HOME = $APPDATA，Documents 和 tmp 都可写
    let dirs = ["Documents", "tmp"];
    for sub in &dirs {
        if let Ok(home) = std::env::var("HOME") {
            let log_path = std::path::Path::new(&home).join(sub).join("ai-reader.log");
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                let _ = f.write_all(msg.as_bytes());
                let _ = f.sync_all();
            }
        }
    }
    // 同时写一个独立位置
    if let Ok(tmp) = std::env::var("TMPDIR") {
        let log_path = std::path::Path::new(&tmp).join("ai-reader.log");
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = f.write_all(msg.as_bytes());
            let _ = f.sync_all();
        }
    }
}
