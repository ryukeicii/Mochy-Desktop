// the menu bar, laid out like the mac app's commands: file, playback, view, devices and window.
// every item sends its id to the page, which already knows how to do each thing

use tauri::menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

fn item<R: Runtime>(app: &AppHandle<R>, id: &str, title: &str, accel: Option<&str>) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let mut b = MenuItemBuilder::with_id(id, title);
    if let Some(a) = accel {
        b = b.accelerator(a);
    }
    b.build(app)
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let about = AboutMetadata { name: Some("Mochy".into()), ..Default::default() };
    let app_menu = SubmenuBuilder::new(app, "Mochy")
        .item(&PredefinedMenuItem::about(app, Some("About Mochy"), Some(about))?)
        .separator()
        .item(&item(app, "settings", "Settings…", Some("CmdOrCtrl+,"))?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new-playlist", "New Playlist…", Some("CmdOrCtrl+N"))?)
        .item(&item(app, "local-files", "Songs on This Computer", Some("CmdOrCtrl+Shift+O"))?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    // the text fields need these to cut, copy and paste on a mac
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let playback = SubmenuBuilder::new(app, "Playback")
        .item(&item(app, "play-pause", "Play / Pause", None)?)
        .item(&item(app, "next", "Next", Some("CmdOrCtrl+Right"))?)
        .item(&item(app, "previous", "Previous", Some("CmdOrCtrl+Left"))?)
        .separator()
        .item(&item(app, "skip-ahead", "Skip Ahead 10 Seconds", Some("CmdOrCtrl+Alt+Right"))?)
        .item(&item(app, "skip-back", "Skip Back 10 Seconds", Some("CmdOrCtrl+Alt+Left"))?)
        .separator()
        .item(&item(app, "volume-up", "Volume Up", Some("CmdOrCtrl+Up"))?)
        .item(&item(app, "volume-down", "Volume Down", Some("CmdOrCtrl+Down"))?)
        .separator()
        .item(&item(app, "shuffle", "Shuffle", Some("CmdOrCtrl+Alt+S"))?)
        .item(&item(app, "repeat", "Repeat", Some("CmdOrCtrl+R"))?)
        .separator()
        .item(&item(app, "like", "Like Song", Some("CmdOrCtrl+Shift+L"))?)
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&item(app, "lyrics", "Show Lyrics", Some("CmdOrCtrl+L"))?)
        .item(&item(app, "player", "Open Player", Some("CmdOrCtrl+Shift+P"))?)
        .item(&item(app, "sidebar", "Toggle Sidebar", Some("CmdOrCtrl+Alt+B"))?)
        .separator()
        .item(&item(app, "home", "Home", Some("CmdOrCtrl+1"))?)
        .item(&item(app, "search", "Search", Some("CmdOrCtrl+F"))?)
        .item(&item(app, "library", "Library", Some("CmdOrCtrl+3"))?)
        .item(&item(app, "back", "Back", Some("CmdOrCtrl+["))?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let devices = SubmenuBuilder::new(app, "Devices")
        .item(&item(app, "devices", "Devices…", Some("CmdOrCtrl+Shift+D"))?)
        .item(&item(app, "pair", "Pair a Device…", None)?)
        .separator()
        .item(&item(app, "sync-all", "Sync Libraries Now", None)?)
        .item(&item(app, "stop-remote", "Stop Controlling", None)?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    MenuBuilder::new(app).items(&[&app_menu, &file, &edit, &playback, &view, &devices, &window]).build()
}

pub fn install<R: Runtime>(app: &AppHandle<R>) {
    match build(app) {
        Ok(menu) => {
            let _ = app.set_menu(menu);
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu", event.id().0.clone());
            });
        }
        Err(e) => eprintln!("[menu] couldn't build the menu bar: {e}"),
    }
}
