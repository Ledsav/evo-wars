# 🚀 GitHub Pages Deployment Guide

This project is configured for automatic deployment to GitHub Pages.

## Quick Deployment Steps

### Method 1: Automatic Deployment (Recommended)

1. **Push to GitHub:**
   ```powershell
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin master
   ```

2. **Enable GitHub Pages in your repository:**
   - Go to your GitHub repository
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - The site will automatically deploy on every push to master

3. **Access your live site:**
   - Your site will be available at: `https://Ledsav.github.io/evo-wars/`
   - Check the **Actions** tab to monitor deployment progress

### Method 2: Manual Deployment with gh-pages

If you prefer manual deployment:

1. **Install gh-pages:**
   ```powershell
   npm install --save-dev gh-pages
   ```

2. **Deploy:**
   ```powershell
   npm run deploy
   ```

   This will:
   - Build your project
   - Push the `dist` folder to the `gh-pages` branch
   - Make it live at `https://Ledsav.github.io/evo-wars/`

## Configuration

### Base Path
The `base` in `vite.config.js` is set to `/evo-wars/`. If your repo name is different, update this:

```javascript
base: '/your-repo-name/',
```

### Branch
The workflow deploys from the `master` branch. If you use `main`, update `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - main  # Change this
```

## Troubleshooting

### Assets not loading?
- Verify the `base` path in `vite.config.js` matches your repo name
- Check that GitHub Pages is enabled and set to use GitHub Actions

### Build failing?
- Check the **Actions** tab for error details
- Ensure `package-lock.json` is committed
- Try running `npm ci` and `npm run build` locally first

### Page not updating?
- Wait a few minutes for GitHub's CDN to refresh
- Clear your browser cache
- Check the Actions tab to ensure the workflow completed successfully

## Local Testing

Test the production build locally:

```powershell
npm run build
npm run preview
```

This will serve the built files at `http://localhost:4173` with the correct base path.

## Live URL

Once deployed, your simulation will be available at:
**https://Ledsav.github.io/evo-wars/**

Enjoy evolving! 🧬✨
