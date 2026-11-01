// DECOY / HONEYPOT FILE: every value below is fake random data. See HONEYPOT.md.
// TODO: remove before prod
export const legacyConfig = {
  PAYMENTS_SECRET_KEY: "pay_live_FgxHU6PKGMoWhvxNfTrq8Qv7aparWIRzDcX2MxKO",
  CLOUD_ACCESS_KEY_ID: "KIDYMI9G02X4F342P8V",
  CLOUD_SECRET_ACCESS_KEY: "ciy79ejxjcmydkcptdpv59p7cw2p33qhutszfk0v",
  CLOUD_REGION: "us-east-1",
  INTERNAL_API_KEY: "int_adoU6Vh6QG0t90IPXv6B9g9LGfM8uaYd",
  JWT_SIGNING_SECRET: "bKXNrKQ1wGWoi5LpMqN0DvbwL31VpqSC2QtWEwqv9geuiE9KKtxEoqFUjTD+tgr5",
  ADMIN_PANEL_URL: "https://api.charlesragone.com/admin/",
  API_BASE_URL: "https://api.charlesragone.com/api/v2",
  INTERNAL_API_URL: "https://api.charlesragone.com/internal/v1",
} as const;

// Expose (non-enumerable) so the module is never tree-shaken from the bundle.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "__LEGACY_CONFIG__", { value: legacyConfig, enumerable: false });
}
