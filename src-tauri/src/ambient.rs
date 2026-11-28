//! Ambient environment sensing for the companion features.
//!
//! Currently only low-battery detection (Windows). Polling follows the same
//! pattern as `game_detect.rs`: a background thread, emit only on state flip,
//! and respect the global pause guard so anti-cheat sessions stay untouched.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

static LOW_BATTERY: AtomicBool = AtomicBool::new(false);

/// Emit `kuro-battery-low` once when the battery drops below ~20% and is
/// discharging. Desktop machines (no battery) and unknown readings are ignored.
#[cfg(windows)]
fn read_low_battery() -> Option<bool> {
    use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    unsafe {
        let mut status: SYSTEM_POWER_STATUS = std::mem::zeroed();
        if GetSystemPowerStatus(&mut status) == 0 {
            return None;
        }
        // 128 = no battery, 255 = unknown
        if status.BatteryFlag == 128 || status.BatteryFlag == 255 {
            return None;
        }
        // 1 = AC online, 255 = unknown
        if status.ACLineStatus == 1 || status.ACLineStatus == 255 {
            return Some(false);
        }
        let percent = status.BatteryLifePercent;
        let critical = (status.BatteryFlag & 0x04) != 0 || (status.BatteryFlag & 0x02) != 0;
        if percent <= 20 || critical {
            Some(true)
        } else {
            Some(false)
        }
    }
}

#[cfg(not(windows))]
fn read_low_battery() -> Option<bool> {
    None
}

pub fn start_ambient_watcher(app: AppHandle, paused: Arc<AtomicBool>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        if paused.load(Ordering::SeqCst) {
            continue;
        }
        let low = read_low_battery().unwrap_or(false);
        let prev = LOW_BATTERY.swap(low, Ordering::SeqCst);
        if low && !prev {
            let _ = app.emit("kuro-battery-low", true);
        }
    });
}
