use crate::Result;

#[tauri::command]
pub fn greet(name: &str) -> Result<String> {
    Ok(format!("Hello, {}! 来自 AI读书 后端。", name))
}

#[tauri::command]
pub fn get_app_info() -> Result<serde_json::Value> {
    Ok(serde_json::json!({
        "name": "AI读书",
        "version": env!("CARGO_PKG_VERSION"),
        "bundleId": "com.yuanzhongheng.ebook",
    }))
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String> {
    let content = std::fs::read_to_string(&path)?;
    Ok(content)
}
