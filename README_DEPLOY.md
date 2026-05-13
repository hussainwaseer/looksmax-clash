# Deployment Documentation: Looksmax Clash

This guide explains how to deploy your site for free using **Render.com**.

## Prerequisites
- A GitHub account.
- Your code pushed to a GitHub repository.

## Step 1: Push your code to GitHub
Make sure all your changes (including the updated `package.json`) are committed and pushed to GitHub.

## Step 2: Set up a Render.com account
1. Go to [Render.com](https://render.com/) and sign up (GitHub login is easiest).

## Step 3: Create a New Web Service
1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `looksmax-clash` (or anything you like)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Select the **Free** tier.

## Step 4: Add Environment Variables
In the **Environment** tab of your Render service, add the following:
- `NODE_ENV`: `production`

## Step 5: Deploy
Click **Create Web Service**. Render will now build and deploy your site.

---

### Important Notes for Free Tier
- **Spin Down**: If no one visits the site for 15 minutes, Render will "spin down" the server. The next visitor will have to wait about 30 seconds for it to start back up.
- **WebRTC/Socket.io**: This deployment supports the real-time battle mode. However, since the server is a single instance, only players connected to that specific instance can play together (which is fine for most cases).
- **HTTPS**: Render provides HTTPS automatically, which is **required** for camera access in browsers.
