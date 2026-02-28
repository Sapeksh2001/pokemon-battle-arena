# 🚀 QUICK REFERENCE GUIDE

## Essential Commands

### Local Development
```bash
# Install dependencies
npm install

# Start server
npm start

# Start frontend (in separate terminal)
npx http-server -p 3000
```

### Git Commands
```bash
# First time setup
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pokemon-battle-arena.git
git push -u origin main

# Regular updates
git add .
git commit -m "Your message"
git push
```

### Testing
```bash
# Server health
curl http://localhost:3001/health

# Production health
curl https://your-server.onrender.com/health
```

---

## File Checklist

### Backend (Render)
- [ ] `server.js` - WebSocket server
- [ ] `package.json` - Dependencies
- [ ] `render.yaml` - Deployment config
- [ ] `.env` - Environment variables (don't commit!)

### Frontend (Vercel)
- [ ] `index.html` - Main HTML
- [ ] `script.js` - Game logic + multiplayer
- [ ] `style.css` - Styles
- [ ] `pokemon_data.js` - Pokémon data
- [ ] `vercel.json` - Deployment config
- [ ] `.vercelignore` - Exclude server files

### Both
- [ ] `.gitignore` - Exclude node_modules, .env
- [ ] `README.md` - Documentation

---

## URLs to Update

### 1. In `script.js`:
```javascript
const SOCKET_URL = 'https://YOUR-SERVER.onrender.com';
```

### 2. In Render Dashboard:
```
Environment Variable:
Key:   FRONTEND_URL
Value: https://your-app.vercel.app
```

---

## Deployment Checklist

### Backend (Render)
1. [ ] Create GitHub repo
2. [ ] Push code to GitHub
3. [ ] Create Render web service
4. [ ] Connect GitHub repo
5. [ ] Set environment variables
6. [ ] Deploy
7. [ ] Test: `/health` endpoint
8. [ ] Copy Render URL

### Frontend (Vercel)
1. [ ] Update SOCKET_URL in script.js
2. [ ] Commit and push
3. [ ] Create Vercel project
4. [ ] Connect GitHub repo
5. [ ] Deploy
6. [ ] Copy Vercel URL
7. [ ] Update FRONTEND_URL in Render

### Final
1. [ ] Test: Open two browsers
2. [ ] Create room in Browser 1
3. [ ] Join room in Browser 2
4. [ ] Verify real-time sync

---

## Troubleshooting Quick Fixes

### "WebSocket connection failed"
```bash
# Check if server is running
curl https://your-server.onrender.com/health

# If no response: Wait 30s (server waking up from sleep)
```

### "CORS error"
```
1. Go to Render Dashboard
2. Environment → FRONTEND_URL
3. Must exactly match Vercel URL
4. Include https://
5. No trailing slash
```

### "Room not found"
```
Server restarted (rooms lost)
- This is normal on free tier
- Rooms are in-memory only
- Add database for persistence
```

---

## Important URLs

### Documentation
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- Socket.IO: https://socket.io/docs

### Your Services
- Render Dashboard: https://dashboard.render.com
- Vercel Dashboard: https://vercel.com/dashboard
- GitHub: https://github.com/YOUR_USERNAME/pokemon-battle-arena

---

## Environment Variables

### Local (.env file)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Render (Dashboard → Environment)
```env
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
```

### Vercel
```
No environment variables needed for static frontend
```

---

## Cost Summary

### Free Tier
- Vercel: $0
- Render: $0 (with auto-sleep)
- **Total: $0/month**

### Production ($7/mo)
- Vercel: $0
- Render: $7 (no sleep)
- **Total: $7/month**

---

## Testing Multiplayer

### Local (Two Browser Tabs)
1. Tab 1: http://localhost:3000 → Create Room
2. Tab 2: http://localhost:3000 → Join Room

### Production (Two Devices)
1. Device 1: https://your-app.vercel.app → Create Room
2. Device 2: https://your-app.vercel.app → Join Room

---

## Common Errors

| Error | Solution |
|-------|----------|
| `npm: command not found` | Install Node.js |
| `EADDRINUSE: port 3001` | Port in use: `kill -9 $(lsof -ti:3001)` |
| `404 on /socket.io` | Server not running or wrong URL |
| `CORS blocked` | Update FRONTEND_URL in Render |
| `Cannot find module` | Run `npm install` |

---

## Next Steps After Deployment

1. ✅ Share your game URL with friends
2. ✅ Monitor Render logs for errors
3. ✅ Test with 2-6 players
4. ✅ Consider upgrading to $7/mo for production
5. ✅ Add custom domain (optional)

---

**Need help?** Check DEPLOYMENT_GUIDE.md for detailed instructions.
