// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
async fn save_state(path: String, data: String) -> Result<(), String> {
    std::thread::spawn(move || {
        if let Err(e) = std::fs::write(path, data) {
            eprintln!("Failed to save state: {:?}", e);
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
