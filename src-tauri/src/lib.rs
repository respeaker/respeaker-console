mod plugins;
mod xvf;

use tauri::Manager;

#[tauri::command]
fn update_tray_menu(
    app: tauri::AppHandle,
    show_text: String,
    quit_text: String,
) -> Result<(), String> {
    plugins::system_tray::update_tray_menu(&app, &show_text, &quit_text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When attempting to start a second instance, focus the existing main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(plugins::system_tray::init())
        .invoke_handler(tauri::generate_handler![
            update_tray_menu,
            xvf::commands::xvf_list_commands,
            xvf::commands::xvf_list_devices,
            xvf::commands::xvf_connect,
            xvf::commands::xvf_disconnect,
            xvf::commands::xvf_current_device,
            xvf::commands::xvf_read,
            xvf::commands::xvf_write,
            xvf::commands::xvf_read_many,
            xvf::commands::xvf_reboot_device,
            xvf::commands::xvf_check_dfu_util,
            xvf::commands::xvf_flash_firmware,
        ]);

    // Only enable updater in release mode
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
