// Thin WebSocket wrapper. The server only relays; see evo/server/src/main.rs.
export class Net {
  constructor(ws) {
    this.ws = ws;
    this.queue = [];
    this.handler = null;
    this.onclose = null;
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (this.handler) this.handler(m);
      else this.queue.push(m);
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      this.onclose?.();
    };
    this.ping = setInterval(() => this.send({ t: "ping" }), 20000);
  }

  // messages that arrive before the game scene exists are held until it is ready
  setHandler(fn) {
    this.handler = fn;
    for (const m of this.queue.splice(0)) fn(m);
  }

  send(obj) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // join = { name, create: true } or { name, room: "ABCD" }
  static connect(join) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      const first = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === "welcome") {
          ws.removeEventListener("message", first);
          resolve({ net: new Net(ws), welcome: m });
        } else if (m.t === "error") reject(new Error(m.m));
      };
      ws.addEventListener("message", first);
      ws.onopen = () => ws.send(JSON.stringify({ t: "join", ...join }));
      ws.onerror = () => reject(new Error("Can't reach the server"));
      ws.onclose = () => reject(new Error("Connection closed"));
    });
  }
}
