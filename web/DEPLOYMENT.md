# Deployment Guide - Epstein Files Web App

## Deploying to Vercel

This is an open-source project. Anyone can deploy their own instance to Vercel (or any static hosting provider).

**Official deployment:** The canonical production deployment is maintained by the Volume team at Vercel.

### Prerequisites
- Vercel account (free tier works fine)
- Vercel CLI installed: `npm install -g vercel`
- GitHub repository (fork or original)

### Deployment Steps

#### Option 1: Vercel CLI (Recommended for first deployment)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Navigate to the web directory**:
   ```bash
   cd web
   ```

4. **Deploy to production**:
   ```bash
   vercel --prod
   ```

   **Note for Volume team maintainers:** Use `vercel --prod --scope volume` to deploy to the official team account.

5. **Follow the prompts**:
   - Link to existing project or create new? → **Create new** (for first deployment)
   - Project name: **epstein-files-micropayments** (or your preferred name)
   - Which directory contains code? → **.** (current directory)
   - Want to override settings? → **No**

6. **Verify deployment**:
   - Visit the provided URL (e.g., `https://epstein-files-micropayments.vercel.app`)
   - Check that all components render correctly
   - Test the demo query functionality

#### Option 2: Vercel Dashboard

1. **Go to Vercel Dashboard**: https://vercel.com

2. **Select account/team** (optional)
   - If you have multiple teams, select your desired account from the team selector (top-left)
   - **Volume team maintainers:** Select "Volume" for official deployment

3. **Import Project**:
   - Click "Add New..." button (top-right)
   - Select "Project" from the dropdown
   - Connect to your GitHub account if not already connected
   - Search for: `epstein-files-micropayments` (or your fork)
   - Click "Import" on the repository
   - If you don't see it, configure GitHub App permissions to allow access

4. **Configure Project**:
   - **Project Name**: `epstein-files-micropayments` (or customize)
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `web` ← **IMPORTANT:** Change from default `.`
   - **Build Command**: `pnpm build` (default is fine)
   - **Output Directory**: `dist` (default is fine)
   - **Install Command**: `pnpm install` (default is fine)

5. **Deploy**
   - Click "Deploy" button
   - Wait for build to complete (~1-2 minutes)
   - Visit your deployment URL

### Environment Variables

No environment variables are currently required for the web app. The application uses hardcoded gateway URLs:
- x402 Gateway: `https://x402.serendb.com`

If you need to configure these in the future:
1. Go to Project Settings → Environment Variables
2. Add variables with `VITE_` prefix (e.g., `VITE_X402_GATEWAY_URL`)

### Post-Deployment Verification

Test the following on the production URL:

1. **Landing Page loads** - Check hero section and all information sections
2. **Setup Guide renders** - Verify code blocks and instructions display correctly
3. **Demo Query component** - Test the query interface (requires wallet address and valid query)
4. **Responsive design** - Test on mobile and desktop viewports
5. **Console errors** - Check browser console for any JavaScript errors

### Continuous Deployment

Once connected to GitHub:
- Pushes to `main` branch trigger automatic production deployments
- Pull requests create preview deployments
- Configure branch settings in Vercel project settings if needed

### Custom Domain (Optional)

To add a custom domain:
1. Go to Project Settings → Domains
2. Add your domain (e.g., `epstein-files.volume.com`)
3. Configure DNS according to Vercel's instructions

### Troubleshooting

**Build fails**:
- Check that `pnpm install` and `pnpm build` work locally in the `web/` directory
- Verify `vercel.json` configuration is correct

**Site loads but components don't render**:
- Check that the output directory is set to `dist`
- Verify SPA rewrite rules in `vercel.json`

**Demo query doesn't work**:
- Check browser console for CORS errors
- Verify x402 gateway URL is accessible: `curl https://x402.serendb.com`
- Note: Actual queries require valid provider credentials and payment setup

### Deployment URLs

After deployment, your app will be available at:
- **Production**: `https://your-project-name.vercel.app` (or custom domain)
- **Preview**: Automatic preview URLs for pull requests (format: `https://your-project-name-git-branch-username.vercel.app`)

**Official deployment:** The canonical instance is maintained at the Volume team's Vercel account.
