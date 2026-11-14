# Deploy: Vercel + domain (#15)

The frontend is a static Vite build. Vercel rebuilds it on every push.
Build settings live in `frontend/vercel.json`, so the dashboard only needs the steps below.

## Skeleton on mock data (phase 1)

### 1. Connect the repo
1. Sign in at vercel.com with GitHub → **Add New… → Project** → import `space-penguins`.
2. **Root Directory:** `frontend` (important: the repo root has no `package.json`).
3. Framework preset shows **Vite**. Leave build/output settings as they are (`vercel.json` sets them).
4. **Environment Variables** (Production and Preview):
   | Name | Value |
   |---|---|
   | `VITE_USE_MOCK` | `true` |
   | `VITE_API_URL` | `http://localhost:8000` (not used while mock is on) |
5. **Deploy.** Open the `*.vercel.app` URL and check:
   - the header shows "Data: dr1+qr3 · 2026-05-20" (mock health)
   - `/?ra=133.768079&dec=-7.242922` plays the 3 mock frames
   - **Copy link** copies a link that opens the same view

Every push to `main` deploys to production. Every PR gets its own preview URL, posted on the PR.

> `VITE_*` values are baked in at build time. After changing one in Vercel, **redeploy**
> (Deployments → ⋯ → Redeploy) or the site keeps the old value.

### 2. Add the GoDaddy domain
1. Vercel project → **Settings → Domains** → add `yourdomain.com`, and `www.yourdomain.com` when Vercel offers it.
2. Vercel shows the DNS records it wants. **Use exactly the values it shows**; they are usually:
   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |
3. GoDaddy → **My Products → Domain → DNS**:
   - delete the existing `A @` record (GoDaddy's "Parked" one) and any `CNAME www` record
   - add the records from step 2 (TTL: default)
4. Back in Vercel, wait until both domains show **Valid Configuration**. Usually minutes,
   sometimes a few hours. Vercel issues the HTTPS certificate automatically.
