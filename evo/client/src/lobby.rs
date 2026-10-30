//! The start screen: pick a name and drop into the one shared world.
use crate::net::Net;
use crate::util::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlElement, HtmlInputElement};

pub struct Boot {
    pub net: Option<Net>,
    pub my_id: u32,
    pub is_host: bool,
    pub room: String,
    pub name: String,
}

pub fn run(on_boot: impl FnOnce(Boot) + 'static) {
    let done: Rc<RefCell<Option<Box<dyn FnOnce(Boot)>>>> = Rc::new(RefCell::new(Some(Box::new(on_boot))));
    let name_in = by_id::<HtmlInputElement>("name");
    let error = by_id::<HtmlElement>("error");
    if let Some(st) = window().local_storage().ok().flatten() {
        if let Ok(Some(n)) = st.get_item("evo-name") {
            name_in.set_value(&n);
        }
    }
    let play = {
        let (name_in, error, done) = (name_in.clone(), error.clone(), done.clone());
        move || {
            let raw = name_in.value();
            let name = if raw.trim().is_empty() { "cell".to_string() } else { raw.trim().to_string() };
            if let Some(st) = window().local_storage().ok().flatten() {
                let _ = st.set_item("evo-name", &name);
            }
            error.set_text_content(Some("Connecting..."));
            let (error, done) = (error.clone(), done.clone());
            spawn_local(async move {
                match Net::connect(serde_json::json!({ "name": name })).await {
                    Ok((net, w)) => {
                        if let Some(el) = document().get_element_by_id("lobby") {
                            el.remove();
                        }
                        if let Some(f) = done.borrow_mut().take() {
                            f(Boot { net: Some(net), my_id: w.id, is_host: w.host, room: w.room, name });
                        }
                    }
                    Err(e) => error.set_text_content(Some(&e)),
                }
            });
        }
    };
    let play = Rc::new(play);
    {
        let play = play.clone();
        let cb = Closure::<dyn FnMut()>::new(move || play());
        by_id::<HtmlElement>("play").set_onclick(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }
    {
        let play = play.clone();
        let cb = Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(move |e: web_sys::KeyboardEvent| {
            if e.key() == "Enter" {
                play();
            }
        });
        name_in.set_onkeydown(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }
    // how many explorers are in the world right now
    let refresh = || {
        spawn_local(async {
            let Some(el) = document().get_element_by_id("world") else { return };
            let Ok(resp) = JsFuture::from(window().fetch_with_str("/api/rooms")).await else { return };
            let resp: web_sys::Response = resp.unchecked_into();
            let Ok(p) = resp.json() else { return };
            let Ok(json) = JsFuture::from(p).await else { return };
            let n = js_sys::JSON::stringify(&json).ok().and_then(|s| serde_json::from_str::<serde_json::Value>(&String::from(s)).ok()).and_then(|v| v[0]["players"].as_u64()).unwrap_or(0);
            el.set_text_content(Some(&if n == 0 { "The world is quiet. Be the first!".to_string() } else { format!("{n} playing now") }));
        });
    };
    refresh();
    let cb = Closure::<dyn FnMut()>::new(move || {
        if document().get_element_by_id("lobby").is_some() {
            refresh();
        }
    });
    let _ = window().set_interval_with_callback_and_timeout_and_arguments_0(cb.as_ref().unchecked_ref(), 3000);
    cb.forget();
}
