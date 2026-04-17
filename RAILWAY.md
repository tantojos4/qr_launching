# Railway Backend Deployment

## Cara Deploy

### 1. Push ke GitHub
```bash
git add .
git commit -m "feat: add Railway deployment"
git push origin master
```

### 2. Connect ke Railway
1. Buka https://railway.app
2. Click "New Project"
3. Pilih "Deploy from GitHub repo"
4. Select repo `qr-launching`
5. Railway akan auto-detect Dockerfile

### 3. Set Environment Variables
Di Railway Dashboard → Settings → Variables, tambahkan:

```
PORT=3001
FRONTEND_URL=https://your-app.netlify.app
ALLOWED_ORIGINS=https://your-app.netlify.app
TOKEN_EXPIRY_MS=300000
```

### 4. Deploy
Railway akan auto-deploy setiap push ke GitHub.

URL backend: `https://your-project.railway.app`

---

## Testing

```bash
# Test backend
curl https://your-project.railway.app/scan?token=test

# Test WebSocket
wscat -c wss://your-project.railway.app/ws
```
