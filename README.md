# St. Francis Athletics Calendar — Fixed 1920×1080 TV Version

This version always renders a fixed 1920×1080 digital-signage board with exactly five columns and six rows. It then scales the entire board to fit the browser viewport. Browser zoom is not required.

## Updating the existing Netlify site

Replace the files in your GitHub repository with the files from this package and commit the changes. Netlify will redeploy automatically.

The key public files are:

- `public/index.html`
- `public/styles.css`
- `public/app.js`

## On Google TV

1. Open the Netlify website in TV Bro or JioPages/JioSphere.
2. Keep browser zoom at its default.
3. Use landscape mode.
4. Hide the browser toolbar when possible.
5. The page will automatically scale down to fit the available screen while preserving the full 5×6 grid.

## Logo

Replace `public/assets/logo.png` with the official transparent St. Francis PNG and keep the same filename.

## Time handling fix

This version preserves the exact time posted on gogoldenknights.net instead of converting the event through the Netlify server's UTC timezone. Dates are handled as date-only values and times are displayed verbatim, so a posted 4:00 PM event remains 4:00 PM on the television. TBA remains TBA.
