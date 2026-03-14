# Flora & Thomas - Save the Date

A wedding save-the-date puzzle site. Guests enter their details, solve a puzzle (crossword, sudoku, or spot the difference), and discover the wedding date.

## Setup

Serve the files with any static server:

```bash
python3 -m http.server 3000
```

## Guest Tracking

Guest visits and puzzle completions are logged to a Google Sheet via Apps Script.

### Apps Script (managed with clasp)

```bash
cd apps-script
clasp push --force
clasp deploy
```

The deployed URL goes in `assets/config.js`.

## Hosting

Static files - works on GitHub Pages, Netlify, or any static host. No build step required.
