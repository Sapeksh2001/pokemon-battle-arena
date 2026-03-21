# Deployment Guide

This guide explains how to deploy the Pokémon Battle Arena frontend to Vercel and the WebSocket backend to Render. The whole process takes about 30 minutes and uses the free tiers for both services.

## Prerequisites

You'll need:
- A GitHub account
- A Vercel account
- A Render account
- Git and Node.js (v18+) installed locally

## Project Structure

Your files are already organized for this split deployment:

```
pokemon-battle-arena/
├── index.html              ← Frontend (Vercel)
├── script.js               ← Frontend (Vercel)
├── style.css               ← Frontend (Vercel)
├── Pokemon_NewDataset.js   ← Frontend (Vercel)
├── server.js               ← Backend (Render)
├── package.json            ← Backend (Render)
├── render.yaml             ← Backend (Render)
├── vercel.json             ← Frontend (Vercel)
├── .vercelignore           ← Frontend (Vercel)
├── .gitignore              ← Both
└── README.md               ← Documentation
```

## 1. Local Testing

Before deploying, verify everything works locally.

### Start the server
```bash
npm install
cp .env.example .env
npm start
```

The console should show the server running on `http://localhost:3001`. You can test it by opening `http://localhost:3001/health` in your browser.

### Start the client
In a new terminal:
```bash
npx http-server -p 3000
```
Open two browser tabs at `http://localhost:3000`. Create a room in one tab and join it in the other to confirm Socket.IO is communicating properly.

## 2. Deploy the Backend (Render)

We need to get the WebSocket server live first so we have a URL to give the frontend.

1. Initialize a git repository if you haven't already:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Sapeksh2001/pokemon-battle-arena.git
git branch -M main
git push -u origin main
```

2. Go to your Render dashboard and create a new **Web Service**.
3. Connect your GitHub repository.
4. Set the configuration:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under Advanced, add these Environment Variables:
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: `http://localhost:3000` (We will update this later).
6. Click Deploy. Once it finishes, save the provided URL (e.g., `https://pokemon-battle-server.onrender.com`).

Check that it works by visiting `https://your-server-url.onrender.com/health`.

## 3. Deploy the Frontend (Vercel)

Now we connect the client to the live server.

1. Open `multiplayer-integration.js` and update `SOCKET_URL`:
```javascript
// Replace http://localhost:3001 with your Render URL
const SOCKET_URL = 'https://pokemon-battle-server.onrender.com';
```
2. Commit and push this change to GitHub.
3. Go to your Vercel dashboard and add a new Project.
4. Import your GitHub repository. Leave the framework preset as "Other" and the build/install commands empty since Vercel automatically detects static files.
5. Click Deploy. Save the provided Vercel URL once finished.

## 4. Fix CORS (Cross-Origin Resource Sharing)

The server needs to explicitly allow requests from your new Vercel domain.

1. Go back to your Render dashboard and open your Web Service.
2. In the Environment tab, change `FRONTEND_URL` to your Vercel URL (e.g., `https://pokemon-battle-arena.vercel.app`). Do not include a trailing slash.
3. Save changes. Render will automatically start a new deployment.

Once Render is running again, test the live game by opening your Vercel URL on a phone and a computer, and starting a multiplayer room.

## Troubleshooting

- **WebSocket connection failed:** Check the Render logs. Your Render service might have spun down due to inactivity (standard on the free tier), which takes about 30 seconds to wake back up.
- **CORS error in console:** Your Render `FRONTEND_URL` doesn't exactly match your Vercel URL. Check for trailing slashes or missing `https://`.
- **Can't join room / Room not found:** Because the server state is held in memory, any auto-sleep or redeploy on Render will wipe active rooms. 

## Checking Server Health

You can always monitor your Render instance via its endpoints:
```bash
curl https://YOUR-SERVER.onrender.com/health
curl https://YOUR-SERVER.onrender.com/stats
```

If you plan to have actual players use this concurrently, consider upgrading Render to the $7/month tier to prevent the server from sleeping.
