# Real iPhone widgets, via Scriptable

Scriptable is a free, official App Store app that runs JavaScript directly
as real iOS home-screen widgets — this is the one genuine way to get an
actual widget (not just an app icon) from this project.

## One-time setup
1. Install **Scriptable** from the App Store (free).
2. Open Scriptable, tap **+** to create a new script.
3. Delete the placeholder content, then copy in everything from
   `Zman & Luach (Scriptable).js` and paste it in.
4. Tap the script's name at the top and rename it (e.g. "Zman & Luach").
5. Close the editor — Scriptable saves automatically.

## Adding widgets to your Home Screen
You add the **same script** as a widget multiple times — once per thing you
want to see — and set a different "Parameter" on each to choose what it
shows:

1. Long-press an empty spot on your Home Screen → **+** (top corner) →
   search for **Scriptable** → pick a widget size (small/medium/large).
2. Long-press the new widget → **Edit Widget**.
3. Set **Script** to your saved script.
4. Set **Parameter** to one of:

| Parameter (type exactly) | Shows |
|---|---|
| *(leave blank)* | Clock + Yiddish day + Hebrew date |
| `today` | Today's zmanim list |
| `next` | The next upcoming zman, with a countdown |
| `month` | This month's calendar (today + holidays marked) — needs a **large** widget |
| `Mincha Ketana`, `Plag HaMincha`, `Alos Hashachar`, `Candle Lighting`, `Havdalah`, `Netz`, `Shkiah`, etc. | Just that one zman, big |

Repeat as many times as you like — e.g. a small "clock" widget, a medium
"next" widget, and a large "month" widget, all at once.

## Two honest limitations
- **Your reminders/notes from the phone app don't show up here.** Scriptable
  and a website run in completely separate, sandboxed storage — there's no
  way for one to read the other's saved data without a server in between,
  which this project intentionally doesn't have.
- **It doesn't automatically match your Settings in the app.** Near the top
  of the script there's a `SETTINGS` block (candle-lighting minutes, which
  alos/havdalah opinion, GRA vs. Magen Avraham, etc.) — edit those values
  once to match whatever you picked in the app's own ⚙️ Settings. Location
  defaults to using your iPhone's real GPS automatically; set `USE_GPS =
  false` near the top if you'd rather it always use the fallback coordinates
  written right below it.

Everything else — the Hebrew calendar, the zmanim math, holiday detection —
is the exact same tested engine as the phone/tablet app, just running
directly on your Home Screen.

## Android
Apple's Scriptable has no real equivalent on Android — there's no
mainstream, trustworthy app that runs plain JavaScript as a true Android
widget the way Scriptable does for iPhone. Rather than pointing you to a
shaky, technical workaround, the app now adds **Home Screen shortcuts**
instead: long-press the app's icon (after it's installed) to jump straight
to **Calendar** or **Settings**. It's not a full widget, but it's real,
reliable, and works today.
