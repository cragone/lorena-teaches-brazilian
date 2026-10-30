//! Thin WebSocket wrapper. The server only relays; see evo/server/src/main.rs.
use crate::util::*;
use std::cell::{Cell as StdCell, RefCell};
use std::collections::VecDeque;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use web_sys::{CloseEvent, MessageEvent, WebSocket};

pub struct Net {
    ws: WebSocket,
    pub inbox: Rc<RefCell<VecDeque<serde_json::Value>>>,
    pub closed: Rc<StdCell<bool>>,
    _keep: Vec<Closure<dyn FnMut(JsValue)>>,
    _ping: i32,
}

pub struct Welcome {
    pub id: u32,
    pub room: String,
    pub host: bool,
}

impl Net {
    pub fn send(&self, v: &serde_json::Value) {
        if self.ws.ready_state() == WebSocket::OPEN {
            let _ = self.ws.send_with_str(&v.to_string());
        }
    }
    pub fn send_str(&self, s: &str) {
        if self.ws.ready_state() == WebSocket::OPEN {
            let _ = self.ws.send_with_str(s);
        }
    }

    /// join = {name, create: true} or {name, room: "ABCD"}
    pub async fn connect(join: serde_json::Value) -> Result<(Net, Welcome), String> {
        let loc = window().location();
        let proto = if loc.protocol().unwrap_or_default() == "https:" { "wss" } else { "ws" };
        let url = format!("{proto}://{}/ws", loc.host().unwrap_or_default());
        let ws = WebSocket::new(&url).map_err(|_| "Can't reach the server".to_string())?;
        let inbox: Rc<RefCell<VecDeque<serde_json::Value>>> = Rc::default();
        let closed = Rc::new(StdCell::new(false));
        let (tx, rx) = futures_channel_pair();

        let mut keep: Vec<Closure<dyn FnMut(JsValue)>> = Vec::new();
        {
            let inbox = inbox.clone();
            let tx = tx.clone();
            let on_msg = Closure::<dyn FnMut(JsValue)>::new(move |e: JsValue| {
                let e: MessageEvent = e.unchecked_into();
                let Some(text) = e.data().as_string() else { return };
                let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { return };
                if let Some(t) = v["t"].as_str() {
                    if t == "welcome" || t == "error" {
                        tx.send(v.clone());
                    }
                }
                inbox.borrow_mut().push_back(v);
            });
            ws.set_onmessage(Some(on_msg.as_ref().unchecked_ref()));
            keep.push(on_msg);
        }
        {
            let closed = closed.clone();
            let tx = tx.clone();
            let on_close = Closure::<dyn FnMut(JsValue)>::new(move |_e: JsValue| {
                closed.set(true);
                tx.send(serde_json::json!({ "t": "error", "m": "Connection closed" }));
            });
            ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));
            keep.push(on_close);
        }
        {
            let tx = tx.clone();
            let on_err = Closure::<dyn FnMut(JsValue)>::new(move |_e: JsValue| tx.send(serde_json::json!({ "t": "error", "m": "Can't reach the server" })));
            ws.set_onerror(Some(on_err.as_ref().unchecked_ref()));
            keep.push(on_err);
        }
        {
            let ws2 = ws.clone();
            let mut j = join.clone();
            j["t"] = "join".into();
            let on_open = Closure::<dyn FnMut(JsValue)>::new(move |_e: JsValue| {
                let _ = ws2.send_with_str(&j.to_string());
            });
            ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));
            keep.push(on_open);
        }

        let first = rx.recv().await;
        if first["t"] == "welcome" {
            // the welcome is not for the game loop
            inbox.borrow_mut().retain(|m| m["t"] != "welcome");
            let ws2 = ws.clone();
            let ping = Closure::<dyn FnMut()>::new(move || {
                if ws2.ready_state() == WebSocket::OPEN {
                    let _ = ws2.send_with_str("{\"t\":\"ping\"}");
                }
            });
            let handle = window().set_interval_with_callback_and_timeout_and_arguments_0(ping.as_ref().unchecked_ref(), 20000).unwrap_or(0);
            ping.forget();
            let w = Welcome { id: first["id"].as_u64().unwrap_or(0) as u32, room: first["room"].as_str().unwrap_or("").to_string(), host: first["host"].as_bool().unwrap_or(false) };
            Ok((Net { ws, inbox, closed, _keep: keep, _ping: handle }, w))
        } else {
            let _ = ws.close();
            Err(first["m"].as_str().unwrap_or("Connection closed").to_string())
        }
    }
}

// a one-shot async channel without pulling in a futures crate
#[derive(Clone)]
struct Tx(Rc<RefCell<Option<serde_json::Value>>>, Rc<RefCell<Option<std::task::Waker>>>);
struct Rx(Tx);
fn futures_channel_pair() -> (Tx, Rx) {
    let tx = Tx(Rc::default(), Rc::default());
    (tx.clone(), Rx(tx))
}
impl Tx {
    fn send(&self, v: serde_json::Value) {
        if self.0.borrow().is_none() {
            *self.0.borrow_mut() = Some(v);
            if let Some(w) = self.1.borrow_mut().take() {
                w.wake();
            }
        }
    }
}
impl Rx {
    async fn recv(self) -> serde_json::Value {
        std::future::poll_fn(move |cx| {
            if let Some(v) = self.0.0.borrow_mut().take() {
                std::task::Poll::Ready(v)
            } else {
                *self.0.1.borrow_mut() = Some(cx.waker().clone());
                std::task::Poll::Pending
            }
        })
        .await
    }
}

#[allow(dead_code)]
fn _unused(_: CloseEvent) {}
