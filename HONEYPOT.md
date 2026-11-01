# Honeypot decoys

**Everything listed here is FAKE.** Random characters; none are credentials for any real service. If one of these values ever shows up in a real system, it is a mistake.

Honeypot host: `https://api.charlesragone.com` (code in `/honeypot`, logs to `honeypot/hits.jsonl`, run `node honeypot/server.js`, default port 4100; put it behind the host above).

| Name | Fake value |
|---|---|
| PAYMENTS_SECRET_KEY | `pay_live_FgxHU6PKGMoWhvxNfTrq8Qv7aparWIRzDcX2MxKO` |
| CLOUD_ACCESS_KEY_ID | `KIDYMI9G02X4F342P8V` |
| CLOUD_SECRET_ACCESS_KEY | `ciy79ejxjcmydkcptdpv59p7cw2p33qhutszfk0v` |
| INTERNAL_API_KEY | `int_adoU6Vh6QG0t90IPXv6B9g9LGfM8uaYd` |
| JWT_SIGNING_SECRET | `bKXNrKQ1wGWoi5LpMqN0DvbwL31VpqSC2QtWEwqv9geuiE9KKtxEoqFUjTD+tgr5` |
| ADMIN_PANEL_URL | `https://api.charlesragone.com/admin/` |
| API_BASE_URL / INTERNAL_API_URL | `https://api.charlesragone.com/api/v2`, `https://api.charlesragone.com/internal/v1` |

## Where they live
- `client/src/config/legacyConfig.ts` (imported by `main.tsx`, ends up in the bundle)
- `client/public/.env.backup`, `client/public/config.json`, `client/public/admin/config.js`

## Honeypot behaviour
- Every request is logged to `hits.jsonl` (time, ip, method, path, query, UA, referer).
- `/api/*`, `/admin/*`, `/internal/*` return fake paginated user lists with `next` and other links back into the honeypot, after a 1-3 s delay. At most 50 delayed connections at once; beyond that it answers immediately. Other paths get a 404.
- Set `HITS_FILE`, `PORT`, `HONEYPOT_URL` to override defaults. Rotate/trim `hits.jsonl` yourself.

## Scanners
Allowlisted in `.gitleaks.toml` and `.secretlintignore`. GitHub push protection is separate and is not configured by these files; if it blocks the `pay_live_` string, use the bypass link as "false positive / used in tests".

## Caveats
- Don't route real traffic to `https://api.charlesragone.com/api` on the same host; the honeypot answers those paths.
- Real visitors never need these files, but crawlers' hits on them are only a signal, not proof of malice.

## Deployment (api.charlesragone.com)
- `honeypot/Dockerfile`, `kubernetes/honeypot-production.yaml` (1 replica, tiny limits, 1Gi volume for `hits.jsonl`), and an `api.charlesragone.com` rule in `kubernetes/charles_ingress.yaml`.
- `.github/workflows/production_honeypot.yml` builds and deploys on changes to `honeypot/**`, and re-applies the ingress.
- **DNS (Cloudflare):** add a proxied `A` record `api` pointing at the same IP as your other `charlesragone.com` records. The existing `charlesragone-com-tls` origin cert must cover `*.charlesragone.com`, which the setup in `kubernetes/README.md` does.
- Read hits: `kubectl exec deploy/prod-honeypot -- cat /data/hits.jsonl`. Client IPs come from Cloudflare's `cf-connecting-ip` header.
