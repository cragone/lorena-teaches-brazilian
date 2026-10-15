import Phaser from "phaser";

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  create() {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "evo", { fontSize: "64px", color: "#7CFC9A" })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b0f14",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  scene: [MainScene],
});
