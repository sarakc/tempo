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

YOUR DATA
  Everything is saved on the device, in the browser you use the app in. Nothing is sent anywhere.
  Settings > "Download backup" saves a file you can restore on another phone or browser.
  Clearing your browser's website data deletes it, so keep a backup.

GOOD TO KNOW
  - Alarm: a web app can only ring while it is open on screen. Leave Tempo open on the
    bedside screen with the phone on the charger. It cannot wake a locked phone.
  - Timers keep the screen awake while they run. If you lock the phone or switch apps,
    the countdown catches up when you come back, but sounds may not play in the meantime.
  - To rename the app, change "Tempo" in index.html (the <title> tag, APP_NAME and the
    <h1>) and in manifest.webmanifest.
