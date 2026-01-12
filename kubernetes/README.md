# Cloudflare TLS + Proxy Setup  
## Traefik Ingress → Kubernetes Services  
### SSL Mode: **Full (Strict)**

This guide is for:
- **Cloudflare in front**
- **Azure VM / LB → Kubernetes**
- **Traefik as Ingress Controller**
- **Multiple domains**
- **End-to-end TLS (browser → Cloudflare → Traefik)**

We will use a **Cloudflare Origin Certificate** mounted into Traefik.

---

## 1️⃣ Point Nameservers to Cloudflare

For **each domain**:

1. Go to your registrar
2. Replace nameservers with Cloudflare-provided ones
3. Wait for domain to become **Active** in Cloudflare

---

## 2️⃣ DNS Records (Proxied)

Cloudflare Dashboard → **DNS**

For each domain:

| Type | Name | Value | Proxy |
|-----|------|------|------|
| A | example.com | `<AZURE_PUBLIC_IP>` | ☁️ Proxied |
| A | www | `<AZURE_PUBLIC_IP>` | ☁️ Proxied |

- **Orange cloud ON**
- Repeat for all domains

---

## 3️⃣ Cloudflare SSL/TLS Settings

Cloudflare Dashboard → **SSL/TLS → Overview**

- Encryption Mode:  
  🔒 **Full (strict)**

Cloudflare Dashboard → **SSL/TLS → Edge Certificates**

Enable:
- ✅ Always Use HTTPS
- ✅ Automatic HTTPS Rewrites
- ✅ TLS 1.3

---

## 4️⃣ Create Cloudflare Origin Certificate

Cloudflare Dashboard → **SSL/TLS → Origin Server**

1. Click **Create Certificate**
2. Settings:
   - Key type: **RSA**
   - Hostnames:
     ```
     example.com
     *.example.com
     otherdomain.com
     *.otherdomain.com
     ```
3. Validity: **15 years**
4. Create certificate

⬇️ Download:
- `origin-cert.pem`
- `origin-key.pem`

---

## 5️⃣ Store Cert in Kubernetes

### Create TLS Secret

```bash
kubectl create secret tls cloudflare-origin-cert \
  --cert=origin-cert.pem \
  --key=origin-key.pem \
  -n traefik


varify:
kubectl get secret cloudflare-origin-cert -n traefik


traefikingress.yaml:
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

tls:
  stores:
    default:
      defaultCertificate:
        secretName: cloudflare-origin-cert
