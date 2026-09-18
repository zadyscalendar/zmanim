[README.md](https://github.com/user-attachments/files/32361065/README.md)
# Zman & Luach — Kiryas Joel Clock

An offline-first wall/desktop clock: large clock, English + Hebrew date, zmanim
for Kiryas Joel (Monroe), NY, Omer counter, and Jewish holiday banner (Diaspora,
non-Israeli holidays only). No photos — pure high-contrast text, designed for
someone with memory loss.

Everything is calculated on-device with embedded math (Hebrew calendar +
sunrise/sunset astronomy) — no internet connection is needed after the first
load. There is nothing to update for DST or leap years; the math handles it
forever.

## Files
- `index.html` — the app
- `engine.js` — Hebrew calendar + zmanim calculations
- `sw.js` — service worker (makes it work offline)
- `manifest.json` — PWA install info
- `icon-192.png`, `icon-512.png` — app icons

## 1. Host it for free

**Easiest: GitHub Pages**
1. Create a free GitHub account if you don't have one, and a new repository (e.g. `zman-clock`).
2. Upload all the files above into the repository (drag-and-drop on github.com works fine — no coding tools needed).
3. Go to the repo's **Settings → Pages**, set "Source" to the `main` branch, root folder, and save.
4. After a minute, GitHub gives you a URL like `https://yourusername.github.io/zman-clock/`. That's the app.

**Alternative: Vercel or Netlify** — drag the folder onto vercel.com/new or app.netlify.com/drop; both give you a free HTTPS URL immediately. Any of these three works equally well; a PWA service worker requires HTTPS, which all three provide automatically.

## 2. Install on the tablet

**Important first step (either platform):** In the tablet's system Settings, confirm the **time zone is set to Eastern Time (New York)** and the date/time are on "Automatic." All zmanim are calculated from the tablet's own clock, so this must be correct.

### iPad
1. Open the hosted URL in **Safari** (must be Safari, not Chrome, for install to work).
2. Tap the Share icon → **Add to Home Screen**.
3. Open the app from the Home Screen icon — it now runs full-screen with no browser bar.
4. For true kiosk lock-down (so it can't accidentally be swiped away), use **Settings → Accessibility → Guided Access**, turn it on, then triple-click the side/home button while the app is open to lock the iPad into it.

### Android tablet
1. Open the hosted URL in **Chrome**.
2. Tap the ⋮ menu → **Install app** (or "Add to Home screen").
3. Open it from the home screen/app drawer — it launches full-screen.
4. For kiosk lock-down, enable **Settings → Security → Screen pinning**, open the app, then use the pin/recents button to pin it. (Some tablets call this "App pinning.")

### Desktop / wall-mounted PC monitor
Open the URL in Chrome or Edge and click the **install icon** in the address bar (or menu → "Install Zman & Luach"). It opens as its own app window. For a wall display, most people just leave the browser in full screen (F11) instead.

## 3. Using the app

- **Everything updates automatically** — clock every second; date, zmanim, holiday banner, and Omer count refresh right at the correct moments (including at sunset, when the Hebrew date changes).
- **Discreet settings button:** the top-right corner of the screen has an invisible button (about the size of a fingertip) — tap it to open Settings. From there:
  - **🔄 Sync/Update** — press this next time the tablet has Wi-Fi (e.g., when family visits) to refresh the cached app files.
  - **🖨️ Print Next Month** — generates a plain black-and-white calendar page (day numbers, Hebrew dates, holidays, Friday candle-lighting/Saturday havdalah times) for the upcoming month and opens the print dialog. Great to post on the fridge too.
  - **⛶ Full Screen** — re-enters kiosk full-screen if it was ever exited.
  - **Candle-lighting / Havdalah offset** — adjustable in minutes, in case your Rav's practice differs from the defaults (18 min before sunset / 72 min after).
  - **Theme** — Automatic switches to a soft dark mode at night and bright mode by day; you can also lock it to one or the other.
- **Shabbat / Yom Tov reminder:** the banner across the top turns on automatically before candle lighting ("Erev Shabbat — Candle Lighting at 6:52 PM"), stays on gently through Shabbat/the holiday ("Shabbat Shalom"), and turns off after Havdalah — no need to touch the screen.

## 4. A note on the zmanim

Times use the widely-used GRA (Vilna Gaon) method for the daytime zmanim, with
candle-lighting 18 minutes before sunset and Havdalah 72 minutes after sunset
by default (both adjustable in Settings). Every calculation was checked
against real published dates (Rosh Hashanah 5785/5786/5787, Purim 5784, and
others) and matched exactly. That said, this device is for convenient home
reference — please confirm exact practice with your Rav, especially for
Havdalah timing, where customs vary.

## 5. Keeping it accurate forever

Because the Hebrew calendar and sunrise/sunset math are calculated live from
first principles (not a stored list of dates), this app does not need updates
year to year, and does not need internet access to stay correct.

**Updates apply instantly, not "next month":** the service worker always
checks the network first. So the moment the tablet has Wi-Fi again, it
silently pulls whatever is the current version of every file (including any
change you've made and re-uploaded), and only falls back to the last-saved
copy when it's genuinely offline. The 🔄 Sync button simply confirms the
connection and reloads the page so you can see it's current — there's no
month-long delay waiting for an old cache to expire.

## 6. Everyday vs. Shabbos/Yom Tov wording

The two "evening" boxes change their label and value depending on the day:
- A normal weekday shows **Shkiah (Sunset)** and **Tzeit Hakochavim** (regular
  nightfall, default 45 minutes after sunset — adjustable in Settings).
- Friday, or the evening before any Yom Tov, switches the first box to
  **Candle Lighting**.
- Motzei Shabbos, or the true end of a Yom Tov, switches the second box to
  **Havdalah** (default 72 minutes after sunset — adjustable). Chag-to-chag
  transitions (Rosh Hashanah day 1→2, Sukkot→Shemini Atzeret, Shemini
  Atzeret→Simchat Torah) correctly show Candle Lighting rather than Havdalah,
  even in a year like 5787 where Rosh Hashanah begins on Shabbos itself.

The day-of-week badge under the clock is shown in Yiddish, with a soft
highlight on an ordinary day and a stronger highlight on Shabbos/Yom Tov. On
Yom Tov, the banner also shows: א פרייליכן יום טוב פון משפחת ניימאן.

## 7. Location — one simple rule, everywhere

There's no separate setup step and no "wall tablet vs. phone" distinction.
The app always tries to use the device's real current location, quietly
checking again on load, whenever Wi‑Fi reconnects, and every hour while
open. Whenever it succeeds, every zmanim calculation immediately
recalculates for that spot. The moment it can't get a fix — location turned
off, permission not granted, briefly offline — it simply keeps using the
last real location it had; nothing resets and nothing needs configuring.
Before a device has ever gotten a real fix, it starts from Kiryas Joel as a
placeholder, which is quietly replaced for good the first time a real GPS
fix comes through.

The bottom-left of the screen always shows exactly which location is
currently in use. In Settings, "🏠 [place name]" always returns to wherever
this specific device first really connected from — it names itself
automatically (for this deployment that will naturally be Kiryas Joel, but
on anyone else's copy of this app it becomes their own home town, with
nothing to configure or hardcode). "📍 Refresh My Location Now" forces an
immediate re-check.

## 8. Browsing the calendar on-screen

The round 📅 button in the bottom-right corner opens a full month-by-month
Jewish calendar you can page through with ◀ / ▶ — every day shows its
Hebrew date, any holiday, the Omer count when relevant, and Friday/Saturday
candle-lighting or Havdalah times, exactly like the printed version but
browsable on-screen for looking ahead (or back) without printing anything.
Tap outside the card, or the ✕, to close it and return to the clock.

## 9. Printing exactly as much as you want

In Settings, the print range isn't limited to the preset dropdown — typing
a number into "or exact months" (1 to 60) prints exactly that many months
ahead instead, starting from the current month.
