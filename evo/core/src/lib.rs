//! The evo game itself: data types and the simulation. It runs on the server (native) and its
//! types are shared with the browser client (WASM), so both always agree on the snapshot format.
pub mod model;
pub mod sim;
pub mod tribe;
pub mod util;
