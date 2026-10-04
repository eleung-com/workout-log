# Lift Log

Phone web app for logging lifts in one typed line. All data stays on the phone.
PRD and design mockup live in the Claude project "Workout tracker".

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser rules + Notes import accuracy
```

## Deploy (GitHub Pages)

Push to `main`. The workflow in `.github/workflows/pages.yml` tests, builds and publishes to
`https://<user>.github.io/<repo>/`. One-time: repo Settings > Pages > Source = GitHub Actions.
Your workout data (`import/`) is git-ignored and never pushed.

Install: open the Pages link in Safari > Share > Add to Home Screen. After the first open it works offline.

Try it locally on your iPhone: same Wi-Fi as the Mac, open `http://<your-mac-ip>:3000`
(Mac IP: System Settings > Wi-Fi > Details). Tap the arrow button at the top right >
Load backup > pick `import/lift-log-backup.json` (AirDrop it to Files first).

## Layout

| Path | What |
|---|---|
| `src/lib/parse.ts` | Line parser (PRD "Parsing rules") |
| `src/lib/match.ts` | Name matching: aliases, typos, word order, "which one?" |
| `src/lib/resolve.ts` | Parsed line + match -> entry |
| `src/lib/db.ts` | On-phone storage (IndexedDB via Dexie), backup and restore |
| `src/components/LogScreen.tsx` | Log screen |
| `import/` | One-time Notes import: `notes.txt` -> `build_backup.py` -> `lift-log-backup.json` |

## Build plan status

1. Notes import: done (`import/`)
2. Log screen: done
3. Install to home screen + offline: done
4. History and Progress tabs, charts, PRs
5. Backup reminder, exercise merge screen
