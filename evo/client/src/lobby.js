import { Net } from "./net.js";

const $ = (id) => document.getElementById(id);

// Shows the start screen and resolves with how to boot the game:
// { net, myId, isHost, room, name } (net is null for solo play).
export function runLobby() {
  return new Promise((resolve) => {
    const lobby = $("lobby");
    const nameInput = $("name");
    const codeInput = $("code");
    const errorBox = $("error");
    const list = $("rooms");
    try {
      nameInput.value = localStorage.getItem("evo-name") ?? "";
    } catch {
      /* storage unavailable */
    }
    const params = new URLSearchParams(location.search);
    if (params.get("room")) codeInput.value = params.get("room").toUpperCase();

    const name = () => {
      const n = nameInput.value.trim() || "cell";
      try {
        localStorage.setItem("evo-name", n);
      } catch {
        /* ignore */
      }
      return n;
    };
    const start = (boot) => {
      clearInterval(poll);
      lobby.remove();
      resolve(boot);
    };
    const connect = async (join) => {
      errorBox.textContent = "Connecting...";
      try {
        const { net, welcome } = await Net.connect({ name: name(), ...join });
        start({ net, myId: welcome.id, isHost: welcome.host, room: welcome.room, name: name() });
      } catch (e) {
        errorBox.textContent = e.message;
      }
    };

    $("solo").onclick = () => start({ net: null, myId: "solo", isHost: true, room: "", name: name() });
    $("create").onclick = () => connect({ create: true });
    $("join").onclick = () => connect({ room: codeInput.value });
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") connect({ room: codeInput.value });
    });

    const refresh = async () => {
      try {
        const rooms = await (await fetch("/api/rooms")).json();
        list.replaceChildren(
          ...(rooms.length
            ? rooms.map((r) => {
                const b = document.createElement("button");
                b.textContent = `${r.code}  ·  ${r.players}/${r.max}`;
                b.disabled = r.players >= r.max;
                b.onclick = () => connect({ room: r.code });
                return b;
              })
            : [Object.assign(document.createElement("p"), { textContent: "No open rooms yet" })]),
        );
      } catch {
        list.textContent = "";
      }
    };
    const poll = setInterval(refresh, 3000);
    refresh();
  });
}
