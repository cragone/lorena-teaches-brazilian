{
  description = "lorena-teaches-brazilian: local dev shell for all three sites";

  inputs.nixpkgs.url = "nixpkgs";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          # Lorena's booking API (Express + better-sqlite3) — this is the
          # piece that owns the actual sqlite database file, so it's the
          # "db" of the bunch even though there's no standalone DB server.
          runDb = pkgs.writeShellScriptBin "run-db" ''
            set -euo pipefail
            root="$(git rev-parse --show-toplevel)"
            cd "$root/server"
            [ -d node_modules ] || npm install
            export PORT="''${PORT:-4000}"
            export ADMIN_PASSWORD="''${ADMIN_PASSWORD:-change-me}"
            echo "==> lorena API + sqlite db on http://localhost:$PORT"
            exec npm run dev
          '';

          # Lorena's marketing + booking frontend. Proxies /api to run-db.
          runLorena = pkgs.writeShellScriptBin "run-lorena" ''
            set -euo pipefail
            root="$(git rev-parse --show-toplevel)"
            cd "$root/client"
            [ -d node_modules ] || npm install
            export VITE_API_PROXY_TARGET="''${VITE_API_PROXY_TARGET:-http://localhost:4000}"
            echo "==> lorena client on http://localhost:5173 (proxying /api -> $VITE_API_PROXY_TARGET)"
            exec npm run dev -- --port 5173 --strictPort
          '';

          # Charles's portal: a single Go binary in production, but for dev
          # with hot reload we run the Go API and the Vite frontend as two
          # processes, same as the vite proxy (localhost:8080) expects.
          runCharlesragone = pkgs.writeShellScriptBin "run-charlesragone" ''
            set -euo pipefail
            root="$(git rev-parse --show-toplevel)/charles_ragone"
            [ -d "$root/node_modules" ] || (cd "$root" && npm install)

            (
              cd "$root/server"
              export PORT="''${PORT:-8080}"
              export DATA_DIR="''${DATA_DIR:-./data}"
              export COOKIE_SECURE="''${COOKIE_SECURE:-false}"
              echo "==> charles-ragone API on http://localhost:$PORT"
              go run ./cmd/server
            ) &
            api_pid=$!
            trap 'kill "$api_pid" 2>/dev/null || true' EXIT

            cd "$root"
            echo "==> charles-ragone frontend on http://localhost:5174 (proxying /api -> http://localhost:''${PORT:-8080})"
            npm run dev -- --port 5174 --strictPort
          '';

          # Eileen's biology site: a static React/Vite frontend, no backend.
          runEileen = pkgs.writeShellScriptBin "run-eileen" ''
            set -euo pipefail
            root="$(git rev-parse --show-toplevel)/biology"
            cd "$root"
            [ -d node_modules ] || npm install
            echo "==> eileen (biology) frontend on http://localhost:5175"
            exec npm run dev -- --port 5175 --strictPort
          '';
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.go
              pkgs.nodejs
              pkgs.python3
              pkgs.gnumake
              pkgs.gcc
              pkgs.pkg-config
              pkgs.sqlite
              pkgs.git

              runDb
              runLorena
              runCharlesragone
              runEileen
            ];

            shellHook = ''
              echo "lorena-teaches-brazilian dev shell"
              echo "  run-db             -> lorena API + sqlite   (http://localhost:4000)"
              echo "  run-lorena         -> lorena client         (http://localhost:5173)"
              echo "  run-charlesragone  -> charles API + client  (http://localhost:8080 / :5174)"
              echo "  run-eileen         -> eileen (biology) site (http://localhost:5175)"
            '';
          };
        }
      );
    };
}
