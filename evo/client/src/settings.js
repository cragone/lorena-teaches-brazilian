// Personal key bindings, saved in this browser (localStorage). `KEYS` is edited in place,
// so anything holding a reference always sees the current bindings.
const STORAGE_KEY = "evo-keys";
const DEFAULTS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", bite: "Space", breed: "KeyE" };
const ACTIONS = [
  ["up", "Move up"],
  ["down", "Move down"],
  ["left", "Move left"],
  ["right", "Move right"],
  ["bite", "Attack"],
  ["breed", "Breed / close shop"],
];

export const KEYS = { ...DEFAULTS };

try {
  Object.assign(KEYS, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  for (const k of Object.keys(KEYS)) if (!(k in DEFAULTS) || typeof KEYS[k] !== "string") KEYS[k] = DEFAULTS[k];
} catch {
  /* storage unavailable or corrupt: keep defaults */
}

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(KEYS));
  } catch {
    /* ignore */
  }
};

export const keyLabel = (code) => {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names = { Space: "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", Enter: "Enter", Tab: "Tab" };
  return names[code] ?? code;
};

let open = false;
export const settingsOpen = () => open;

// small gear button + modal, shared by the lobby and the game
export function mountSettings() {
  const btn = document.createElement("button");
  btn.id = "settings-btn";
  btn.textContent = "⚙ Controls";
  document.body.append(btn);

  const modal = document.createElement("div");
  modal.id = "settings";
  modal.hidden = true;
  document.body.append(modal);

  let listening = null; // action waiting for a key press

  const render = () => {
    const rows = ACTIONS.map(([action, label]) => {
      const b = document.createElement("button");
      b.textContent = listening === action ? "Press a key..." : keyLabel(KEYS[action]);
      b.className = listening === action ? "listening" : "";
      b.onclick = () => {
        listening = action;
        render();
      };
      const row = document.createElement("div");
      row.className = "srow";
      row.append(Object.assign(document.createElement("span"), { textContent: label }), b);
      return row;
    });
    const note = Object.assign(document.createElement("p"), { textContent: "Clicking also attacks, and the mouse steers when no move key is held." });
    const reset = Object.assign(document.createElement("button"), { textContent: "Reset defaults" });
    reset.onclick = () => {
      Object.assign(KEYS, DEFAULTS);
      save();
      render();
    };
    const close = Object.assign(document.createElement("button"), { textContent: "Done" });
    close.onclick = () => toggle(false);
    const bar = document.createElement("div");
    bar.className = "srow";
    bar.append(reset, close);
    const card = document.createElement("div");
    card.className = "scard";
    card.append(Object.assign(document.createElement("h2"), { textContent: "Controls" }), ...rows, note, bar);
    modal.replaceChildren(card);
  };

  const toggle = (show) => {
    open = show;
    listening = null;
    modal.hidden = !show;
    if (show) render();
  };
  btn.onclick = () => toggle(!open);

  window.addEventListener(
    "keydown",
    (e) => {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation();
      if (!listening) return e.code === "Escape" && toggle(false);
      if (e.code !== "Escape") {
        // binding a key that is already used swaps the two actions
        const taken = Object.keys(KEYS).find((k) => KEYS[k] === e.code && k !== listening);
        if (taken) KEYS[taken] = KEYS[listening];
        KEYS[listening] = e.code;
        save();
      }
      listening = null;
      render();
    },
    true,
  );
}
