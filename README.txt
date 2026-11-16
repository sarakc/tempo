TEMPO
Workout, focus (pomodoro), meditation and alarm timers in one simple app.

WHAT'S IN THIS FOLDER
  index.html             The whole app
  manifest.webmanifest   Lets phones install it like an app
  sw.js                  Makes it work offline once installed
  icons/                 App icons
  fonts/                 Space Grotesk font (SIL Open Font License, see fonts/OFL-SpaceGrotesk.txt)

TRY IT ON A COMPUTER
  Double-click index.html. It opens in your browser and works right away.
  (Home-screen install and offline mode need the hosting step below.)

LIVE APP
  https://sarakc.github.io/tempo/
  Hosted by GitHub Pages from github.com/sarakc/tempo. Pushing to main redeploys it.
  iPhone: open it in Safari, tap Share, then "Add to Home Screen".
  Android: open it in Chrome, tap the menu, then "Install app" or "Add to Home screen".
  Mac/PC: in Chrome or Edge, click the install icon in the address bar (Safari: File > Add to Dock).
  Keep using the installed app rather than the browser tab: on iPhone they keep separate data.

SOUNDS
  Settings > Sounds (or the Sounds row on each timer) lets you pick a sound for each moment:
  work starts, rest starts, the last 3 seconds, bells, the alarm and so on.
  Choose from the built-in sounds or "Add a sound file" from your phone (MP3, WAV or M4A, up to 5 MB).
  Your sound files stay on the device and are included in backups.

YOUR DATA AND SYNC
  Everything is saved on the device first, so the app works offline.
  Sync (Settings > Set up sync) keeps a private copy in a secret GitHub gist called
  tempo-sync.json and keeps all your devices the same:
    1. Create a token at github.com/settings/tokens/new?scopes=gist (only the "gist" box,
       no expiration). Save it in your password manager.
    2. Paste it into Tempo on each device. Devices merge record by record (each logged
       session, saved workout, the library, settings), and the newest change wins.
  It syncs on open, a few seconds after each change, and when you come back to the app.
  The token is stored only on the device. "Turn off" stops syncing but keeps your data.
  Custom sound files are not synced. "Download backup" saves a file that includes them.

GOOD TO KNOW
  - Alarm: a web app can only ring while it is open on screen. Leave Tempo open on the
    bedside screen with the phone on the charger. It cannot wake a locked phone.
  - Timers keep the screen awake while they run. If you lock the phone or switch apps,
    the countdown catches up when you come back, but sounds may not play in the meantime.
  - To rename the app, change "Tempo" in index.html (the <title> tag, APP_NAME and the
    in manifest.webmanifest.
