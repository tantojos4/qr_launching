# Netlify Frontend Deployment

## Cara Deploy

### 1. Update netlify.toml
Edit `apps/frontend/netlify.toml`, ganti `your-railway-project.railway.app` dengan URL Railway backend kamu:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-PROJECT.railway.app/api/:splat"
  status = 200
  force = true
```

### 2. Push ke GitHub
```bash
git add .
git commit -m "feat: add Netlify deployment"
git push origin master
```

### 3. Connect ke Netlify
1. Buka https://netlify.com
2. Click "Add new site" → "Import an existing project"
3. Pilih GitHub
4. Authorize Netlify (jika belum)
5. Select repo `qr-launching`
6. **Base directory**: `apps/frontend`
7. **Build command**: `bun run build`
8. **Publish directory**: `build`

### 4. Set Environment Variables
Di Netlify Dashboard → Site settings → Environment variables:

```
PUBLIC_BACKEND_URL=https://your-project.railway.app
PUBLIC_WS_URL=wss://your-project.railway.app
PUBLIC_FRONTEND_URL=https://your-app.netlify.app
```

### 5. Deploy
Netlify akan build dan deploy otomatis.

URL frontend: `https://your-app.netlify.app`

---

## Update Environment Variables

### Railway (Backend)
```
FRONTEND_URL=https://your-app.netlify.app
ALLOWED_ORIGINS=https://your-app.netlify.app
```

### Netlify (Frontend)
```
PUBLIC_BACKEND_URL=https://your-project.railway.app
PUBLIC_WS_URL=wss://your-project.railway.app
```

---

## Testing Production

1. **Buka di HP**: `https://your-app.netlify.app/presenter`
2. **Set target URL**: `https://slamet.banyumaskab.go.id`
3. **Buka di Laptop**: `https://your-app.netlify.app/scanner`
4. **Scan QR** dari layar HP
5. **Laptop redirect** ke target URL 🎉

---

## Troubleshooting

### WebSocket tidak connect
- Pastikan `PUBLIC_WS_URL` pakai `wss://` (secure)
- Railway auto-HTTPS untuk WebSocket

### CORS error
- Update `ALLOWED_ORIGINS` di Railway dengan URL Netlify

### Kamera tidak work di production
- Browser modern butuh HTTPS untuk kamera
- Netlify sudah auto-HTTPS
