use wasm_bindgen::JsCast;

pub use evo_core::util::*;

// ---- tiny procedural audio ---------------------------------------------------
thread_local! {
    static AUDIO: std::cell::RefCell<Option<web_sys::AudioContext>> = const { std::cell::RefCell::new(None) };
}

pub fn sfx(freq: f64, dur: f64, kind: &str, vol: f64, slide: f64) {
    let _ = (|| -> Result<(), wasm_bindgen::JsValue> {
        AUDIO.with(|a| {
            let mut a = a.borrow_mut();
            if a.is_none() {
                *a = Some(web_sys::AudioContext::new()?);
            }
            let ctx = a.as_ref().unwrap();
            let _ = ctx.resume();
            let now = ctx.current_time();
            let o = ctx.create_oscillator()?;
            let g = ctx.create_gain()?;
            o.set_type(match kind {
                "square" => web_sys::OscillatorType::Square,
                "sawtooth" => web_sys::OscillatorType::Sawtooth,
                "triangle" => web_sys::OscillatorType::Triangle,
                _ => web_sys::OscillatorType::Sine,
            });
            o.frequency().set_value_at_time(freq as f32, now)?;
            if slide != 0.0 {
                o.frequency().exponential_ramp_to_value_at_time((freq + slide).max(30.0) as f32, now + dur)?;
            }
            g.gain().set_value_at_time(vol as f32, now)?;
            g.gain().exponential_ramp_to_value_at_time(0.0001, now + dur)?;
            o.connect_with_audio_node(&g)?;
            g.connect_with_audio_node(&ctx.destination())?;
            o.start()?;
            o.stop_with_when(now + dur)?;
            Ok(())
        })
    })();
}

pub fn window() -> web_sys::Window {
    web_sys::window().expect("no window")
}
pub fn document() -> web_sys::Document {
    window().document().expect("no document")
}
pub fn by_id<T: JsCast>(id: &str) -> T {
    document().get_element_by_id(id).unwrap_or_else(|| panic!("missing #{id}")).dyn_into::<T>().unwrap()
}
pub fn now_ms() -> f64 {
    js_sys::Date::now()
}
