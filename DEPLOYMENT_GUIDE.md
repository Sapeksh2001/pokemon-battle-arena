# Deployment Guide (Serverless Edition)

Since we migrated to Firebase, the Pokémon Battle Arena is now a **purely static application**. There is no longer a need for a separate Node.js/Render backend. This makes it much easier to deploy.

## Prerequisites

- A GitHub account
- A Firebase project (already configured in `js/api/socketClient.js`)
- The Realtime Database initialized in **Test Mode** on the Firebase Console.

## 1. Hosting on GitHub Pages (Recommended)

This is the easiest way to get a permanent, shareable link for free.

1. Push your latest code to GitHub:
   ```bash
   git add .
   git commit -m "chore: Finalize Firebase migration"
   git push origin main
   ```
2. Go to your repository on GitHub.
3. Click on **Settings** > **Pages**.
4. Under **Build and deployment** > **Branch**:
   - Select **`main`**.
   - Select **`/(root)`**.
   - Click **Save**.
5. Wait ~2 minutes. GitHub will provide a link like `https://sapeksh2001.github.io/pokemon-battle-arena/`.

## 2. Hosting on Vercel

If you prefer Vercel, the project is already configured with a `vercel.json` file.

1. Install the Vercel CLI: `npm install -g vercel`
2. Run `vercel` in the project root.
3. Follow the prompts to link your account and deploy.
4. Vercel will give you a production URL like `https://pokemon-battle-arena.vercel.app`.

## Troubleshooting

- **Multiplayer not connecting:** Ensure you have clicked **"Create Database"** in the Firebase Console (Realtime Database tab). Without this, the app will 404 when trying to create a room.
- **Images not loading:** GitHub Pages is case-sensitive. Ensure all file paths in your data files match the casing on the filesystem.
- **Loading Overlay hangs:** Check the browser console. This usually means a data file (like `movesets.js`) failed to download.
