//! The start screen. Resolves with how to boot the game.
use crate::net::Net;
use crate::util::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{JsFuture, spawn_local};
use web_sys::{HtmlButtonElement, HtmlElement, HtmlInputElement};

pub struct Boot {
    pub net: Option<Net>,
    pub my_id: u32,
    pub is_host: bool,
    pub room: String,
    pub name: String,
}

type Done = Rc<RefCell<Option<Box<dyn FnOnce(Boot)>>>>;

pub fn run(on_boot: impl FnOnce(Boot) + 'static) {
    let done: Done = Rc::new(RefCell::new(Some(Box::new(on_boot))));
    let name_in = by_id::<HtmlInputElement>("name");
    let code_in = by_id::<HtmlInputElement>("code");
    let error = by_id::<HtmlElement>("error");
    if let Some(st) = window().local_storage().ok().flatten() {
        if let Ok(Some(n)) = st.get_item("evo-name") {
            name_in.set_value(&n);
        }
    }
    if let Ok(params) = web_sys::UrlSearchParams::new_with_str(&window().location().search().unwrap_or_default()) {
        if let Some(r) = params.get("room") {
            code_in.set_value(&r.to_uppercase());
        }
    }

    let name = {
        let name_in = name_in.clone();
        move || {
            let raw = name_in.value();
            let n = if raw.trim().is_empty() { "cell".to_string() } else { raw.trim().to_string() };
            if let Some(st) = window().local_storage().ok().flatten() {
                let _ = st.set_item("evo-name", &n);
            }
            n
        }
    };
    let finish = {
        let done = done.clone();
        move |boot: Boot| {
            if let Some(el) = document().get_element_by_id("lobby") {
                el.remove();
            }
            if let Some(f) = done.borrow_mut().take() {
                f(boot);
            }
        }
    };
    let connect = {
        let name = name.clone();
        let finish = finish.clone();
        let error = error.clone();
        Rc::new(move |join: serde_json::Value| {
            let (name, finish, error) = (name.clone(), finish.clone(), error.clone());
            error.set_text_content(Some("Connecting..."));
            spawn_local(async move {
                let mut join = join;
                let n = name();
                join["name"] = n.clone().into();
                match Net::connect(join).await {
                    Ok((net, w)) => finish(Boot { net: Some(net), my_id: w.id, is_host: w.host, room: w.room, name: n }),
                    Err(e) => error.set_text_content(Some(&e)),
                }
            });
        })
    };

    {
        let (name, finish) = (name.clone(), finish.clone());
        let cb = Closure::<dyn FnMut()>::new(move || finish(Boot { net: None, my_id: 0, is_host: true, room: String::new(), name: name() }));
        by_id::<HtmlElement>("solo").set_onclick(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }
    {
        let connect = connect.clone();
        let cb = Closure::<dyn FnMut()>::new(move || connect(serde_json::json!({ "create": true })));
        by_id::<HtmlElement>("create").set_onclick(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }
    {
        let (connect, code_in) = (connect.clone(), code_in.clone());
        let cb = Closure::<dyn FnMut()>::new(move || connect(serde_json::json!({ "room": code_in.value() })));
        by_id::<HtmlElement>("join").set_onclick(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }
    {
        let (connect, c2) = (connect.clone(), code_in.clone());
        let cb = Closure::<dyn FnMut(web_sys::KeyboardEvent)>::new(move |e: web_sys::KeyboardEvent| {
            if e.key() == "Enter" {
                connect(serde_json::json!({ "room": c2.value() }));
            }
        });
        code_in.set_onkeydown(Some(cb.as_ref().unchecked_ref()));
        cb.forget();
    }

    // the open rooms list, refreshed while the lobby is up
    let refresh = {
        let connect = connect.clone();
        move || {
            let connect = connect.clone();
            spawn_local(async move {
                let Some(list) = document().get_element_by_id("rooms") else { return };
                let Ok(resp) = JsFuture::from(window().fetch_with_str("/api/rooms")).await else { return list.set_text_content(Some("")) };
                let resp: web_sys::Response = resp.unchecked_into();
                let Ok(p) = resp.json() else { return };
                let Ok(json) = JsFuture::from(p).await else { return };
                let Ok(rooms) = serde_wasm_json(&json) else { return };
                list.set_text_content(None);
                let arr = rooms.as_array().cloned().unwrap_or_default();
                if arr.is_empty() {
                    let p = document().create_element("p").unwrap();
                    p.set_text_content(Some("No open rooms yet"));
                    let _ = list.append_child(&p);
                }
                for r in arr {
                    let code = r["code"].as_str().unwrap_or("").to_string();
                    let (players, max) = (r["players"].as_u64().unwrap_or(0), r["max"].as_u64().unwrap_or(0));
                    let b: HtmlButtonElement = document().create_element("button").unwrap().unchecked_into();
                    b.set_text_content(Some(&format!("{code}  ·  {players}/{max}")));
                    b.set_disabled(players >= max);
                    let (connect, code2) = (connect.clone(), code.clone());
                    let cb = Closure::<dyn FnMut()>::new(move || connect(serde_json::json!({ "room": code2 })));
                    b.set_onclick(Some(cb.as_ref().unchecked_ref()));
                    cb.forget();
                    let _ = list.append_child(&b);
                }
            });
        }
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

fn serde_wasm_json(v: &JsValue) -> Result<serde_json::Value, ()> {
    let s = js_sys::JSON::stringify(v).map_err(|_| ())?;
    serde_json::from_str(&String::from(s)).map_err(|_| ())
}
