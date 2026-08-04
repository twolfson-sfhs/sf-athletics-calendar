# St. Francis Athletics Calendar — Netlify Version

This is the permanent Netlify-ready version of the 60-inch TV display.

## What it does

- Shows only the next 30 verified events.
- Pulls official schedule pages from gogoldenknights.net.
- Checks Varsity, JV, and Frosh source routes.
- Refreshes the TV page every 60 seconds.
- Uses Netlify's CDN cache so the athletics site is normally checked only every five minutes.
- Never displays sample events when a source fails.

## Add the official logo

Replace `public/assets/logo.png` with the official transparent PNG. Keep the filename exactly `logo.png`.

## Recommended deployment: GitHub + Netlify

Netlify must build the project so it can install the `cheerio` dependency and deploy the serverless function. A basic drag-and-drop HTML deployment is not enough for this live version.

1. Create a new GitHub repository.
2. Upload every file and folder in this package to the repository root.
3. In Netlify, choose **Add new project > Import an existing project**.
4. Choose GitHub and select the repository.
5. Netlify will read `netlify.toml`; leave the detected settings unchanged.
6. Choose **Deploy**.
7. Open the supplied `.netlify.app` URL.
8. Confirm real events appear and compare several against gogoldenknights.net.

## Season updates

The default season is `2026-27`. In Netlify, add an environment variable named `SEASON` when the school year changes, for example `2027-28`, and redeploy.

## Google TV

Open the Netlify address in a Google TV browser, bookmark it, set zoom to 100%, use full-screen mode, and disable the device sleep timer.
