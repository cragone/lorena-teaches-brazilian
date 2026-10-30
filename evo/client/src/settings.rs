//! Personal key bindings, saved in this browser (localStorage).
use crate::util::*;
use std::cell::{Cell, RefCell};
use wasm_bindgen::prelude::*;

pub const ACTIONS: [(&str, &str, &str); 9] = [
    ("up", "Move up", "KeyW"),
    ("down", "Move down", "KeyS"),
    ("left", "Move left", "KeyA"),
    ("right", "Move right", "KeyD"),
    ("bite", "Attack", "Space"),
    ("breed", "Breed / close shop", "KeyE"),
    ("split", "Split / call the pack", "KeyQ"),
    ("poison", "Shoot poison behind you", "KeyF"),
    ("befriend", "Befriend an animal (land)", "KeyB"),
];
const STORAGE_KEY: &str = "evo-keys-rs3";

thread_local! {
    static KEYS: RefCell<Vec<String>> = RefCell::new(load());
    static OPEN: Cell<bool> = const { Cell::new(false) };
    static LISTENING: RefCell<Option<usize>> = const { RefCell::new(None) };
}

fn load() -> Vec<String> {
    let mut keys: Vec<String> = ACTIONS.iter().map(|a| a.2.to_string()).collect();
    if let Some(s) = window().local_storage().ok().flatten().and_then(|st| st.get_item(STORAGE_KEY).ok().flatten()) {
        if let Ok(saved) = serde_json::from_str::<Vec<String>>(&s) {
            if saved.len() == keys.len() {
                keys = saved;
            }
        }
    }
    keys
}
fn save() {
    if let Some(st) = window().local_storage().ok().flatten() {
        let _ = st.set_item(STORAGE_KEY, &serde_json::to_string(&KEYS.with(|k| k.borrow().clone())).unwrap_or_default());
    }
}

pub fn key(action: &str) -> String {
    let i = ACTIONS.iter().position(|a| a.0 == action).unwrap_or(0);
    KEYS.with(|k| k.borrow()[i].clone())
}
pub fn open() -> bool {
    OPEN.with(|o| o.get())
}

pub fn key_label(code: &str) -> String {
    if let Some(r) = code.strip_prefix("Key") {
        return r.to_string();
    }
    if let Some(r) = code.strip_prefix("Digit") {
        return r.to_string();
    }
    match code {
        "ArrowUp" => "↑",
        "ArrowDown" => "↓",
        "ArrowLeft" => "←",
        "ArrowRight" => "→",
        "ShiftLeft" | "ShiftRight" => "Shift",
        "ControlLeft" | "ControlRight" => "Ctrl",
        other => other,
    }
    .to_string()
}

fn el(tag: &str, class: &str, text: &str) -> web_sys::HtmlElement {
    let e: web_sys::HtmlElement = document().create_element(tag).unwrap().unchecked_into();
    e.set_class_name(class);
    e.set_text_content(Some(text));
    e
}

fn render() {
    let modal = by_id::<web_sys::HtmlElement>("settings");
    let card = el("div", "scard", "");
    let _ = card.append_child(&el("h2", "", "Controls"));
    for (i, (_, label, _)) in ACTIONS.iter().enumerate() {
        let listening = LISTENING.with(|l| *l.borrow() == Some(i));
        let b = el("button", if listening { "listening" } else { "" }, &if listening { "Press a key...".to_string() } else { key_label(&KEYS.with(|k| k.borrow()[i].clone())) });
        let cb = Closure::<dyn FnMut()>::new(move || {
            LISTENING.with(|l| *l.borrow_mut() = Some(i));
            render();
        });
        b.set_onclick(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
        let row = el("div", "srow", "");
        let _ = row.append_child(&el("span", "", label));
        let _ = row.append_child(&b);
        let _ = card.append_child(&row);
    }
    let _ = card.append_child(&el("p", "", "Clicking also attacks, and the mouse steers when no move key is held."));
    let bar = el("div", "srow", "");
    let reset = el("button", "", "Reset defaults");
    let cb = Closure::<dyn FnMut()>::new(|| {
        KEYS.with(|k| *k.borrow_mut() = ACTIONS.iter().map(|a| a.2.to_string()).collect());
        save();
        render();
    });
    reset.set_onclick(Some(cb.as_ref().unchecked_ref()));
    cb.forget();
    let done = el("button", "", "Done");
    let cb = Closure::<dyn FnMut()>::new(|| toggle(false));
    done.set_onclick(Some(cb.as_ref().unchecked_ref()));
    cb.forget();
    let _ = bar.append_child(&reset);
    let _ = bar.append_child(&done);
    let _ = card.append_child(&bar);
    modal.set_inner_html("");
    let _ = modal.append_child(&card);
}

fn toggle(show: bool) {
    OPEN.with(|o| o.set(show));
    LISTENING.with(|l| *l.borrow_mut() = None);
    by_id::<web_sys::HtmlElement>("settings").set_hidden(!show);
    if show {
        render();
    }
}

pub fn mount() {
    let btn = by_id::<web_sys::HtmlElement>("settings-btn");
    let cb = Closure::<dyn FnMut()>::new(|| toggle(!open()));
    btn.set_onclick(Some(cb.as_ref().unchecked_ref()));
    cb.forget();
    // capture phase, so it runs before the game's own key handler
    let cb = Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(|e: web_sys::KeyboardEvent| {
        if !open() {
            return;
        }
        e.prevent_default();
        e.stop_propagation();
        let listening = LISTENING.with(|l| *l.borrow());
        let Some(i) = listening else {
            if e.code() == "Escape" {
                toggle(false);
            }
            return;
        };
        if e.code() != "Escape" {
            // binding a key that is already used swaps the two actions
            KEYS.with(|k| {
                let mut k = k.borrow_mut();
                let code = e.code();
                if let Some(t) = (0..k.len()).find(|&t| k[t] == code && t != i) {
                    k[t] = k[i].clone();
                }
                k[i] = code;
            });
            save();
        }
        LISTENING.with(|l| *l.borrow_mut() = None);
        render();
    });
    let opts = web_sys::AddEventListenerOptions::new();
    opts.set_capture(true);
    let _ = window().add_event_listener_with_callback_and_add_event_listener_options("keydown", cb.as_ref().unchecked_ref(), &opts);
    cb.forget();
}

pub fn set_button_visible(v: bool) {
    let b = by_id::<web_sys::HtmlElement>("settings-btn");
    let _ = b.style().set_property("display", if v { "" } else { "none" });
}
