
/* =====================================================================
   ZMAN & LUACH — Scriptable widget
   Add this script to your Home Screen multiple times, once per widget
   you want. Long-press each widget → Edit Widget → set "Parameter" to
   choose what that copy shows:

     (leave blank)     → Clock + Hebrew date + Yiddish day
     today             → Today's full zmanim list
     next              → The next upcoming zman, with a countdown
     month             → This month's calendar, today + holidays marked
     <any zman name>   → Just that one zman, e.g.:
                          "Mincha Ketana", "Plag HaMincha", "Alos Hashachar",
                          "Candle Lighting", "Havdalah", "Shkiah", "Netz"

   Widget sizes: small, medium, and large are all supported; "month"
   needs large to be readable.

   IMPORTANT — two things this widget can't share with the phone app,
   because Scriptable and a website run in completely separate sandboxes
   with no access to each other's storage:
     1) Your personal reminders/notes from the app do NOT appear here.
     2) Your chosen opinions (which alos, GRA vs Magen Avraham, etc.) are
        NOT read from the app automatically — set them once below, to
        match whatever you picked in the app's Settings.
   ===================================================================== */

/* ---------------------- CONFIG — edit these to match your Settings in the app ---------------------- */
const USE_GPS = true;                 // true = ask iOS for real location each time; false = always use the fallback below
const FALLBACK_LAT = 41.3307;         // used if USE_GPS is false, or if a GPS fix can't be obtained
const FALLBACK_LON = -74.1868;
const FALLBACK_LABEL = 'Kiryas Joel, NY';

const SETTINGS = {
  candleLightingMinutes: 18,
  elevationMeters: 0,
  showSeconds: false,
  zmanOpinion: {
    alos: '16.1', misheyakir: '11', netz: 'standard', shkiah: 'standard',
    tzeisEveryday: 'small', havdalah: 'rt72fixed'
  },
  hourSystemPerZman: { shma: 'GRA', tefila: 'GRA', minchaGedolah: 'GRA', minchaKetana: 'GRA', plag: 'GRA' }
};

/* ---------------------- Colors (matches the app's high-contrast look) ---------------------- */
const BG_DAY = new Color('#f7f5ef'), FG_DAY = new Color('#101010'), SOFT_DAY = new Color('#5a5a5a'), ACCENT = new Color('#173d6b');
const BG_NIGHT = new Color('#05070a'), FG_NIGHT = new Color('#f1ece0'), SOFT_NIGHT = new Color('#c9c2b0'), ACCENT_NIGHT = new Color('#e7d9a8');

/* ============================= [ENGINE — do not edit below this line] ============================= */
/* Pasted verbatim from the app's own engine.js — the exact same, already-tested Hebrew calendar and
   zmanim math, with zero changes. If you ever update the app, you can safely replace everything between
   here and the "[END ENGINE]" marker with the new engine.js content. */

/* ===================================================================
   HEBREW CALENDAR + ZMANIM ENGINE (pure math, zero dependencies)
   Validated against real-world anchor dates:
     1 Tishrei 5785 = Oct 3, 2024   (hebcal.com / Chabad.org)
     1 Tishrei 5786 = Sep 23, 2025  (hebcal.com)
     1 Tishrei 5787 = Sep 12, 2026  (hebcal.com / Chabad.org)
     14 Adar II 5784 (Purim) = Mar 24, 2024
   =================================================================== */

const HebrewEngine = (function () {
  // ---------- Molad-based Hebrew calendar arithmetic ----------
  function isLeapYear(y) { return ((7 * y + 1) % 19) < 7; }

  const MONTHS_BEFORE_POS = [0,12,24,37,49,61,74,86,99,111,123,136,148,160,173,185,197,210,222,235];
  function monthsElapsed(year) {
    const y = year - 1;
    const fullCycles = Math.floor(y / 19);
    const rem = y % 19;
    return 235 * fullCycles + MONTHS_BEFORE_POS[rem];
  }
  function moladChalakim(year) {
    return 31524 + monthsElapsed(year) * 765433;
  }
  function roshHashanahDay(year) {
    const totalChalakim = moladChalakim(year);
    const rawDay = Math.floor(totalChalakim / 25920);
    const timeInDay = totalChalakim % 25920;
    const dow = ((rawDay % 7) + 7) % 7;
    let shift = 0;
    if (timeInDay >= 19440) shift = 1;
    else if (dow === 2 && timeInDay >= 9924 && !isLeapYear(year)) shift = 1;
    else if (dow === 1 && timeInDay >= 16789 && isLeapYear(year - 1)) shift = 1;
    let day2 = rawDay + shift;
    const dow2 = ((day2 % 7) + 7) % 7;
    if (dow2 === 0 || dow2 === 3 || dow2 === 5) day2 += 1;
    return day2;
  }
  const JDN0 = 347997; // calibrated against 3 independent real anchors above

  function gregorianToJDN(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }
  function jdnToGregorian(jdn) {
    let a = jdn + 32044;
    let b = Math.floor((4 * a + 3) / 146097);
    let c = a - Math.floor((146097 * b) / 4);
    let d = Math.floor((4 * c + 3) / 1461);
    let e = c - Math.floor((1461 * d) / 4);
    let m = Math.floor((5 * e + 2) / 153);
    const day = e - Math.floor((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * Math.floor(m / 10);
    const year = 100 * b + d - 4800 + Math.floor(m / 10);
    return { year, month, day };
  }

  function yearLengthCategory(len) {
    if (len === 353 || len === 383) return 0; // chaserah
    if (len === 354 || len === 384) return 1; // kesidrah
    if (len === 355 || len === 385) return 2; // shleimah
    throw new Error('bad hebrew year length ' + len);
  }
  const MONTHS_REGULAR = ['Tishrei','Cheshvan','Kislev','Tevet','Shvat','Adar','Nisan','Iyar','Sivan','Tammuz','Av','Elul'];
  const MONTHS_LEAP    = ['Tishrei','Cheshvan','Kislev','Tevet','Shvat','Adar I','Adar II','Nisan','Iyar','Sivan','Tammuz','Av','Elul'];
  const MONTHS_HEBREW_REGULAR = ['תִּשְׁרֵי','חֶשְׁוָן','כִּסְלֵו','טֵבֵת','שְׁבָט','אֲדָר','נִיסָן','אִיָּר','סִיוָן','תַּמּוּז','אָב','אֱלוּל'];
  const MONTHS_HEBREW_LEAP    = ['תִּשְׁרֵי','חֶשְׁוָן','כִּסְלֵו','טֵבֵת','שְׁבָט','אֲדָר א׳','אֲדָר ב׳','נִיסָן','אִיָּר','סִיוָן','תַּמּוּז','אָב','אֱלוּל'];

  const yearStructCache = {};
  function getYearStructure(year) {
    if (yearStructCache[year]) return yearStructCache[year];
    const leap = isLeapYear(year);
    const len = roshHashanahDay(year + 1) - roshHashanahDay(year);
    const cat = yearLengthCategory(len);
    const cheshvan = cat >= 2 ? 30 : 29;
    const kislev = cat >= 1 ? 30 : 29;
    const lengths = leap
      ? [30, cheshvan, kislev, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]
      : [30, cheshvan, kislev, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    const names = leap ? MONTHS_LEAP : MONTHS_REGULAR;
    const namesHebrew = leap ? MONTHS_HEBREW_LEAP : MONTHS_HEBREW_REGULAR;
    const result = { leap, lengths, names, namesHebrew, yearLength: len };
    yearStructCache[year] = result;
    return result;
  }

  function jdnToHebrew(jdn) {
    const daysSinceEpoch = jdn - JDN0;
    let year = Math.floor(daysSinceEpoch / 365.2468) - 1;
    while (roshHashanahDay(year + 1) <= daysSinceEpoch) year++;
    while (roshHashanahDay(year) > daysSinceEpoch) year--;
    const dayOfYear = daysSinceEpoch - roshHashanahDay(year);
    const { lengths, names, namesHebrew } = getYearStructure(year);
    let rem = dayOfYear, idx = 0;
    while (rem >= lengths[idx]) { rem -= lengths[idx]; idx++; }
    return { year, monthIndex: idx, monthName: names[idx], monthNameHebrew: namesHebrew[idx], day: rem + 1 };
  }
  function hebrewToJdn(year, monthName, day) {
    const { lengths, names } = getYearStructure(year);
    const idx = names.indexOf(monthName);
    let offset = 0;
    for (let i = 0; i < idx; i++) offset += lengths[i];
    return JDN0 + roshHashanahDay(year) + offset + (day - 1);
  }

  // Hebrew numeral formatting (gematria) for day-of-month / year display
  const GEMATRIA_ONES = ['','א','ב','ג','ד','ה','ו','ז','ח','ט'];
  const GEMATRIA_TENS = ['','י','כ','ל','מ','נ','ס','ע','פ','צ'];
  function hebrewNumeral(num) {
    if (num === 15) return 'ט״ו';
    if (num === 16) return 'ט״ז';
    let tens = Math.floor(num / 10), ones = num % 10;
    let str = GEMATRIA_TENS[tens] + GEMATRIA_ONES[ones];
    if (str.length === 1) return str + '׳';
    return str.slice(0, -1) + '״' + str.slice(-1);
  }
  function hebrewYearString(year) {
    // year like 5787 -> ה׳תשפ״ז style (drop the thousands, ה is implied)
    const shortYear = year % 1000;
    const hundreds = Math.floor(shortYear / 100);
    const remainder = shortYear % 100;
    const hundredLetters = ['','ק','ר','ש','ת','תק','תר','תש','תת','תתק'];
    let str = hundredLetters[hundreds];
    if (remainder === 15) str += 'טו';
    else if (remainder === 16) str += 'טז';
    else str += GEMATRIA_TENS[Math.floor(remainder/10)] + GEMATRIA_ONES[remainder%10];
    if (str.length <= 1) return str + '׳';
    return str.slice(0, -1) + '״' + str.slice(-1);
  }

  // ---------- Holidays (Diaspora, non-Israeli) ----------
  function getHolidays(year) {
    const list = [];
    const add = (name, nameHe, jdnStart, days, category) => {
      for (let i = 0; i < days; i++) list.push({ name, nameHe, jdn: jdnStart + i, category, dayNum: i + 1, totalDays: days });
    };
    add('Rosh Hashanah', 'ראש השנה', hebrewToJdn(year, 'Tishrei', 1), 2, 'yomtov');
    add('Yom Kippur', 'יום כיפור', hebrewToJdn(year, 'Tishrei', 10), 1, 'yomtov');
    add('Sukkot', 'סוכות', hebrewToJdn(year, 'Tishrei', 15), 7, 'yomtov');
    add('Shemini Atzeret', 'שמיני עצרת', hebrewToJdn(year, 'Tishrei', 22), 1, 'yomtov');
    add('Simchat Torah', 'שמחת תורה', hebrewToJdn(year, 'Tishrei', 23), 1, 'yomtov');
    const chanukahStart = hebrewToJdn(year, 'Kislev', 25);
    add('Chanukah', 'חנוכה', chanukahStart, 8, 'minor');
    add('Tu BiShvat', 'ט״ו בשבט', hebrewToJdn(year, 'Shvat', 15), 1, 'minor');
    const purimMonth = isLeapYear(year) ? 'Adar II' : 'Adar';
    add('Purim', 'פורים', hebrewToJdn(year, purimMonth, 14), 1, 'minor');
    add('Shushan Purim', 'שושן פורים', hebrewToJdn(year, purimMonth, 15), 1, 'minor');
    add('Pesach', 'פסח', hebrewToJdn(year, 'Nisan', 15), 8, 'yomtov');
    add('Lag BaOmer', 'ל״ג בעומר', hebrewToJdn(year, 'Iyar', 18), 1, 'minor');
    add('Shavuot', 'שבועות', hebrewToJdn(year, 'Sivan', 6), 2, 'yomtov');
    // Tisha B'Av: if 9 Av falls on Shabbat, the fast is postponed to the 10th.
    // (Calibrated JDN weekday mapping: JDN % 7 === 5 is Saturday.)
    let tishaBav = hebrewToJdn(year, 'Av', 9);
    if (((tishaBav % 7) + 7) % 7 === 5) tishaBav += 1;
    add("Tisha B'Av", 'תשעה באב', tishaBav, 1, 'fast');
    return list;
  }

  function getHolidayForJdn(jdn, hebYear) {
    // check current, previous and next hebrew year (for boundary safety)
    for (const y of [hebYear - 1, hebYear, hebYear + 1]) {
      const holidays = getHolidays(y);
      for (const h of holidays) {
        if (h.jdn === jdn) return h;
      }
    }
    return null;
  }

  // Omer count: day 1 = 16 Nisan (night before), valid range 1-49
  function getOmerDay(jdn, hebYear) {
    const jdn15Nisan = hebrewToJdn(hebYear, 'Nisan', 15);
    const d = jdn - jdn15Nisan;
    return (d >= 1 && d <= 49) ? d : null;
  }

  // Yiddish day-of-week names (index matches JS Date.getDay(): 0=Sunday..6=Saturday)
  const YIDDISH_DAYS = ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת'];

  // ---------- Public API ----------
  return {
    isLeapYear, gregorianToJDN, jdnToGregorian, jdnToHebrew, hebrewToJdn,
    hebrewNumeral, hebrewYearString, getHolidays, getHolidayForJdn, getOmerDay,
    YIDDISH_DAYS, JDN0
  };
})();

// ---------- Zmanim (solar position, NOAA/Meeus algorithm) ----------
const ZmanimEngine = (function () {
  function julianCentury(jd) { return (jd - 2451545.0) / 36525.0; }
  function geomMeanLongSun(t) { return (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360; }
  function geomMeanAnomalySun(t) { return 357.52911 + t * (35999.05029 - 0.0001537 * t); }
  function eccentEarthOrbit(t) { return 0.016708634 - t * (0.000042037 + 0.0000001267 * t); }
  function sunEqOfCenter(t) {
    const m = geomMeanAnomalySun(t) * Math.PI / 180;
    return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289;
  }
  function sunAppLong(t) {
    const o = geomMeanLongSun(t) + sunEqOfCenter(t);
    return o - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * Math.PI / 180);
  }
  function obliqCorr(t) {
    const e0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    return e0 + 0.00256 * Math.cos((125.04 - 1934.136 * t) * Math.PI / 180);
  }
  function sunDeclination(t) {
    const e = obliqCorr(t) * Math.PI / 180, lambda = sunAppLong(t) * Math.PI / 180;
    return Math.asin(Math.sin(e) * Math.sin(lambda)) * 180 / Math.PI;
  }
  function eqOfTime(t) {
    const epsilon = obliqCorr(t) * Math.PI / 180;
    const l0 = geomMeanLongSun(t) * Math.PI / 180;
    const e = eccentEarthOrbit(t);
    const m = geomMeanAnomalySun(t) * Math.PI / 180;
    const y = Math.tan(epsilon / 2) ** 2;
    const Etime = y * Math.sin(2 * l0) - 2 * e * Math.sin(m) + 4 * e * y * Math.sin(m) * Math.cos(2 * l0) - 0.5 * y * y * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m);
    return 4 * Etime * 180 / Math.PI;
  }
  function hourAngle(lat, decl, zenith) {
    const latRad = lat * Math.PI / 180, declRad = decl * Math.PI / 180, zenRad = zenith * Math.PI / 180;
    const cosH = (Math.cos(zenRad) - Math.sin(latRad) * Math.sin(declRad)) / (Math.cos(latRad) * Math.cos(declRad));
    if (cosH > 1 || cosH < -1) return null;
    return Math.acos(cosH) * 180 / Math.PI;
  }
  function toJulianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

  // returns minutes-from-UTC-midnight, or null if the sun never crosses this zenith that day
  function solarEventUTCMinutes(dateUTCNoonRef, lat, lon, zenith, morning) {
    const jdMidnight = Math.floor(toJulianDay(dateUTCNoonRef));
    let t = julianCentury(jdMidnight + 0.5);
    let timeUTCmin = 720;
    for (let i = 0; i < 3; i++) {
      const eq = eqOfTime(t);
      const decl = sunDeclination(t);
      const ha = hourAngle(lat, decl, zenith);
      if (ha === null) return null;
      const delta = morning ? ha : -ha;
      timeUTCmin = 720 - 4 * (lon + delta) - eq;
      t = julianCentury(jdMidnight + 0.5 + timeUTCmin / 1440);
    }
    return timeUTCmin;
  }

  // date: a JS Date (used only for its calendar day, in local time); lat/lon in degrees (west negative)
  function getZmanim(date, lat, lon, opts) {
    opts = opts || {};
    const candleMin = opts.candleLightingMinutes != null ? opts.candleLightingMinutes : 18;
    const havdalahMin = opts.havdalahMinutes != null ? opts.havdalahMinutes : 72;
    const tzeitMin = opts.tzeitMinutes != null ? opts.tzeitMinutes : 45;
    // build a UTC "noon of this local calendar day" reference so solar calc lands on the right day
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const refUTC = new Date(Date.UTC(y, m, d, 17, 0, 0)); // ~noon EST/EDT in UTC, close enough for day selection
    const tzOffsetHours = -date.getTimezoneOffset() / 60;

    const sunriseMin = solarEventUTCMinutes(refUTC, lat, lon, 90.833, true);
    const sunsetMin = solarEventUTCMinutes(refUTC, lat, lon, 90.833, false);
    const alotMin = solarEventUTCMinutes(refUTC, lat, lon, 106.1, true);   // 16.1° before sunrise
    const tzeit72Min = sunsetMin + 72;

    if (sunriseMin == null || sunsetMin == null) return null; // polar edge case, not relevant at this latitude

    const shaZmanit = (sunsetMin - sunriseMin) / 12; // minutes per halachic hour (GRA, sunrise-to-sunset)

    const toLocal = (utcMin) => {
      let local = utcMin + tzOffsetHours * 60;
      local = ((local % 1440) + 1440) % 1440;
      return local; // minutes since local midnight
    };
    const fmt = (utcMin) => {
      const local = toLocal(utcMin);
      const h = Math.floor(local / 60), mi = Math.round(local % 60);
      let h12 = h % 12; if (h12 === 0) h12 = 12;
      return { text: `${h12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`, minutesLocal: local };
    };

    return {
      alotHashachar: fmt(alotMin),
      netzHachama: fmt(sunriseMin),
      sofZmanShma: fmt(sunriseMin + 3 * shaZmanit),
      sofZmanTefila: fmt(sunriseMin + 4 * shaZmanit),
      chatzos: fmt((sunriseMin + sunsetMin) / 2),
      minchaKetana: fmt(sunriseMin + 9.5 * shaZmanit),
      plagHamincha: fmt(sunriseMin + 10.75 * shaZmanit),
      shkiah: fmt(sunsetMin),
      candleLighting: fmt(sunsetMin - candleMin),
      havdalah: fmt(sunsetMin + havdalahMin),
      tzeitHakochavim: fmt(sunsetMin + tzeitMin),
      _raw: { sunriseMin, sunsetMin, tzOffsetHours }
    };
  }

  /* =========================================================================
     ADVANCED / CONFIGURABLE ZMANIM — every zman with its selectable opinions.
     ZMAN_DEFS and HOUR_SYSTEMS are the single source of truth for what
     opinions exist, so the UI can build its dropdowns straight from these
     instead of hardcoding a duplicate list that could drift out of sync.
     ========================================================================= */

  // degreesBelow is measured from the true (0°) horizon; degreesBelow=0.833
  // reproduces standard sunrise/sunset (refraction + solar radius).
  function angleEventMinutes(refUTC, lat, lon, degreesBelow, morning) {
    return solarEventUTCMinutes(refUTC, lat, lon, 90 + degreesBelow, morning);
  }
  // "dip of the horizon" for an elevated observer, in degrees.
  function elevationDipDegrees(meters) {
    if (!meters || meters <= 0) return 0;
    return (1.76 * Math.sqrt(meters)) / 60;
  }

  const ZMAN_DEFS = {
    alos: { label: 'Alos Hashachar', hebrew: 'עלות השחר', kind: 'degreeOrFixed', side: 'morning',
      options: [
        { id: '16.1', label: '16.1°', degrees: 16.1 },
        { id: '18', label: '18°', degrees: 18 },
        { id: '19.8', label: '19.8° (Chayei Adam)', degrees: 19.8 },
        { id: 'baalHatanya', label: '16.9° (Baal HaTanya)', degrees: 16.9 },
        { id: 'fixed72', label: '72 fixed minutes', fixedMinutes: 72 },
        { id: 'fixed90', label: '90 fixed minutes', fixedMinutes: 90 },
        { id: 'fixed96', label: '96 fixed minutes', fixedMinutes: 96 }
      ], default: '16.1' },
    misheyakir: { label: 'Misheyakir', hebrew: 'משיכיר', kind: 'degreeOrFixed', side: 'morning',
      options: [
        { id: '11.5', label: '11.5°', degrees: 11.5 },
        { id: '11', label: '11°', degrees: 11 },
        { id: '10.2', label: '10.2° (Chabad)', degrees: 10.2 },
        { id: '7.65', label: '7.65° (Star-K)', degrees: 7.65 }
      ], default: '11' },
    netz: { label: 'Netz (Sunrise)', hebrew: 'הנץ החמה', kind: 'sunEvent', side: 'morning',
      options: [ { id: 'standard', label: 'Standard' }, { id: 'elevation', label: 'Elevation-adjusted' } ], default: 'standard' },
    shkiah: { label: 'Shkiah (Sunset)', hebrew: 'שקיעת החמה', kind: 'sunEvent', side: 'evening',
      options: [ { id: 'standard', label: 'Standard' }, { id: 'elevation', label: 'Elevation-adjusted' } ], default: 'standard' },
    shma: { label: 'Sof Zman Krias Shema', hebrew: 'סוף זמן ק"ש', kind: 'hourBased', offsetHours: 3 },
    tefila: { label: 'Sof Zman Tefila', hebrew: 'סוף זמן תפילה', kind: 'hourBased', offsetHours: 4 },
    chatzos: { label: 'Chatzos', hebrew: 'חצות היום', kind: 'fixed' },
    minchaGedolah: { label: 'Mincha Gedolah', hebrew: 'מנחה גדולה', kind: 'hourBased', offsetHours: 6.5 },
    minchaKetana: { label: 'Mincha Ketana', hebrew: 'מנחה קטנה', kind: 'hourBased', offsetHours: 9.5 },
    plag: { label: 'Plag HaMincha', hebrew: 'פלג המנחה', kind: 'hourBased', offsetHours: 10.75 },
    candle: { label: 'Candle Lighting', hebrew: 'הדלקת נרות', kind: 'minutesBeforeSunset',
      presets: [10, 15, 18, 20, 22, 30, 36, 40], default: 18 },
    tzeisEveryday: { label: 'Tzeis Hakochavim (everyday)', hebrew: 'צאת הכוכבים (חול)', kind: 'tzeisEveryday',
      options: [
        { id: 'geonim', label: 'Geonim (~14–20 min / 4.37°)', degrees: 4.37 },
        { id: 'medium', label: '3 medium stars (~42 min / 7.083°)', degrees: 7.083 },
        { id: 'small', label: '3 small stars (~50 min / 8.5°)', degrees: 8.5 }
      ], default: 'small' },
    havdalah: { label: 'Havdalah (Motzei Shabbos/Yom Tov)', hebrew: 'הבדלה (מוצאי שבת/יו"ט)', kind: 'havdalah',
      options: [
        { id: 'small85', label: '3 small stars (8.5°)', degrees: 8.5 },
        { id: 'rt72fixed', label: 'Rabbeinu Tam — 72 fixed minutes', fixedMinutes: 72 },
        { id: 'rt72zmaniyos', label: 'Rabbeinu Tam — 72 proportional minutes', zmaniyosMinutes: 72 },
        { id: 'rt90fixed', label: 'Rabbeinu Tam — 90 fixed minutes', fixedMinutes: 90 },
        { id: 'rt96fixed', label: 'Rabbeinu Tam — 96 fixed minutes', fixedMinutes: 96 }
      ], default: 'rt72fixed' }
  };
  const HOUR_SYSTEMS = [
    { id: 'GRA', label: 'GRA (sunrise–sunset)' },
    { id: 'MGA72', label: 'Magen Avraham (72 min)' },
    { id: 'baalHatanya', label: 'Baal HaTanya' }
  ];
  const HOUR_BASED_ZMANIM = ['shma', 'tefila', 'minchaGedolah', 'minchaKetana', 'plag'];

  function findOption(zmanKey, optionId) {
    const def = ZMAN_DEFS[zmanKey];
    if (!def || !def.options) return null;
    return def.options.find((o) => o.id === optionId) || null;
  }

  // Computes every raw solar event once, then derives all display zmanim
  // according to settings.zmanOpinion (per-zman choice), settings.hourSystemPerZman
  // (per hour-based zman: 'shma'|'tefila'|'minchaGedolah'|'minchaKetana'|'plag' -> 'GRA'|'MGA72'|'baalHatanya'),
  // and settings.candleLightingMinutes. Falls back to each zman's default
  // opinion when nothing is chosen, so this is safe to call with a partial settings object.
  function getZmanimFull(date, lat, lon, settings) {
    settings = settings || {};
    const opinion = settings.zmanOpinion || {};
    const hourSystemPerZman = settings.hourSystemPerZman || {};
    const elevationMeters = settings.elevationMeters || 0;
    const candleMin = settings.candleLightingMinutes != null ? settings.candleLightingMinutes : ZMAN_DEFS.candle.default;

    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const refUTC = new Date(Date.UTC(y, m, d, 17, 0, 0));
    const tzOffsetHours = -date.getTimezoneOffset() / 60;
    const dip = elevationDipDegrees(elevationMeters);

    // --- base sun events ---
    const sunriseStd = angleEventMinutes(refUTC, lat, lon, 0.833, true);
    const sunsetStd = angleEventMinutes(refUTC, lat, lon, 0.833, false);
    if (sunriseStd == null || sunsetStd == null) return null; // polar edge case

    const sunriseElev = angleEventMinutes(refUTC, lat, lon, 0.833 + dip, true);
    const sunsetElev = angleEventMinutes(refUTC, lat, lon, 0.833 + dip, false);
    const netzAmiti = angleEventMinutes(refUTC, lat, lon, 1.583, true);   // Baal HaTanya "true" sunrise (internal use)
    const shkiahAmiti = angleEventMinutes(refUTC, lat, lon, 1.583, false); // Baal HaTanya "true" sunset (internal use)

    const netzMin = (opinion.netz === 'elevation' && sunriseElev != null) ? sunriseElev : sunriseStd;
    const shkiahMin = (opinion.shkiah === 'elevation' && sunsetElev != null) ? sunsetElev : sunsetStd;

    // --- alos / misheyakir (degree or fixed-minute opinions) ---
    function resolveMorningEvent(zmanKey, defaultOptId) {
      const optId = opinion[zmanKey] || defaultOptId;
      const opt = findOption(zmanKey, optId) || findOption(zmanKey, defaultOptId);
      if (!opt) return null;
      if (opt.fixedMinutes != null) return sunriseStd - opt.fixedMinutes;
      return angleEventMinutes(refUTC, lat, lon, opt.degrees, true);
    }
    const alosMin = resolveMorningEvent('alos', ZMAN_DEFS.alos.default);
    const misheyakirMin = resolveMorningEvent('misheyakir', ZMAN_DEFS.misheyakir.default);

    // --- shaos zmaniyos (halachic hour length) per hour-system ---
    const graShaZmanit = (sunsetStd - sunriseStd) / 12;
    const alos72Fixed = sunriseStd - 72, tzeis72Fixed = sunsetStd + 72;
    const mga72ShaZmanit = (tzeis72Fixed - alos72Fixed) / 12;
    const baalHatanyaShaZmanit = (shkiahAmiti != null && netzAmiti != null) ? (shkiahAmiti - netzAmiti) / 12 : null;

    function hourSystemFor(zmanKey) {
      return hourSystemPerZman[zmanKey] || 'GRA';
    }
    function startAndShaFor(system) {
      if (system === 'MGA72') return { start: alos72Fixed, sha: mga72ShaZmanit };
      if (system === 'baalHatanya' && netzAmiti != null && baalHatanyaShaZmanit != null) return { start: netzAmiti, sha: baalHatanyaShaZmanit };
      return { start: sunriseStd, sha: graShaZmanit }; // GRA default/fallback
    }
    function hourBasedMinutes(zmanKey, offsetHours) {
      const { start, sha } = startAndShaFor(hourSystemFor(zmanKey));
      return start + offsetHours * sha;
    }

    // --- tzeis (everyday) and Havdalah (Motzei Shabbos/Yom Tov) ---
    function resolveEveningEvent(zmanKey) {
      const def = ZMAN_DEFS[zmanKey];
      const optId = opinion[zmanKey] || def.default;
      const opt = findOption(zmanKey, optId) || findOption(zmanKey, def.default);
      if (!opt) return null;
      if (opt.fixedMinutes != null) return sunsetStd + opt.fixedMinutes;
      if (opt.zmaniyosMinutes != null) return sunsetStd + opt.zmaniyosMinutes * (graShaZmanit / 60);
      return angleEventMinutes(refUTC, lat, lon, opt.degrees, false);
    }
    const tzeisEverydayMin = resolveEveningEvent('tzeisEveryday');
    const havdalahMin = resolveEveningEvent('havdalah');

    const chatzosMin = (sunriseStd + sunsetStd) / 2;
    const candleLightingMin = shkiahMin - candleMin;

    // --- format for display ---
    const showSeconds = !!settings.showSeconds;
    const toLocal = (utcMin) => { let local = utcMin + tzOffsetHours * 60; return ((local % 1440) + 1440) % 1440; };
    const fmt = (utcMin) => {
      if (utcMin == null) return null;
      let local = toLocal(utcMin);
      let h = Math.floor(local / 60);
      let remMin = local - h * 60; // fractional minutes remaining, 0..60
      let mi, ss;
      if (showSeconds) {
        mi = Math.floor(remMin);
        ss = Math.round((remMin - mi) * 60);
        if (ss === 60) { ss = 0; mi += 1; }
      } else {
        mi = Math.round(remMin);
        ss = null;
      }
      if (mi === 60) { mi = 0; h += 1; }
      h = ((h % 24) + 24) % 24;
      let h12 = h % 12; if (h12 === 0) h12 = 12;
      const text = showSeconds
        ? `${h12}:${String(mi).padStart(2, '0')}:${String(ss).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
        : `${h12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
      return { text, minutesLocal: local };
    };

    return {
      alos: fmt(alosMin),
      misheyakir: fmt(misheyakirMin),
      netz: fmt(netzMin),
      shma: fmt(hourBasedMinutes('shma', 3)),
      tefila: fmt(hourBasedMinutes('tefila', 4)),
      chatzos: fmt(chatzosMin),
      minchaGedolah: fmt(hourBasedMinutes('minchaGedolah', 6.5)),
      minchaKetana: fmt(hourBasedMinutes('minchaKetana', 9.5)),
      plag: fmt(hourBasedMinutes('plag', 10.75)),
      shkiah: fmt(shkiahMin),
      candle: fmt(candleLightingMin),
      tzeisEveryday: fmt(tzeisEverydayMin),
      havdalah: fmt(havdalahMin),
      _raw: { sunriseStd, sunsetStd, netzMin, shkiahMin, tzOffsetHours }
    };
  }

  return { getZmanim, getZmanimFull, ZMAN_DEFS, HOUR_SYSTEMS, HOUR_BASED_ZMANIM };
})();

if (typeof module !== 'undefined') module.exports = { HebrewEngine, ZmanimEngine };


/* ============================= [END ENGINE] ============================= */

/* ---------------------- Widget helpers ---------------------- */
const ZMAN_ORDER = ['alos','misheyakir','netz','shma','tefila','chatzos','minchaGedolah','minchaKetana','plag'];
const YIDDISH_DAYS = HebrewEngine.YIDDISH_DAYS;
const DOW_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Friendly English names a person might type into the widget's Parameter box, mapped to the internal key.
const ZMAN_ALIASES = {
  'alos hashachar': 'alos', 'alos': 'alos', 'dawn': 'alos',
  'misheyakir': 'misheyakir',
  'netz': 'netz', 'netz hachama': 'netz', 'sunrise': 'netz',
  'sof zman shma': 'shma', 'sof zman krias shema': 'shma', 'shema': 'shma', 'shma': 'shma',
  'sof zman tefila': 'tefila', 'sof zman tefilah': 'tefila', 'tefila': 'tefila',
  'chatzos': 'chatzos', 'chatzot': 'chatzos', 'midday': 'chatzos',
  'mincha gedolah': 'minchaGedolah',
  'mincha ketana': 'minchaKetana',
  'plag hamincha': 'plag', 'plag': 'plag',
  'shkiah': 'shkiah', 'sunset': 'shkiah',
  'candle lighting': 'candle', 'candles': 'candle',
  'tzeis hakochavim': 'tzeisEveryday', 'tzeis': 'tzeisEveryday', 'nightfall': 'tzeisEveryday',
  'havdalah': 'havdalah'
};

async function resolveLocation(){
  if (USE_GPS) {
    try {
      Location.setAccuracyToThreeKilometers();
      const loc = await Location.current();
      return { lat: loc.latitude, lon: loc.longitude, label: 'Current Location' };
    } catch (e) { /* fall through to fallback */ }
  }
  return { lat: FALLBACK_LAT, lon: FALLBACK_LON, label: FALLBACK_LABEL };
}

function computeToday(now, lat, lon){
  const jdnToday = HebrewEngine.gregorianToJDN(now.getFullYear(), now.getMonth()+1, now.getDate());
  const z = ZmanimEngine.getZmanimFull(now, lat, lon, SETTINGS);
  let hebrewJdn = jdnToday;
  if (z) {
    const sunsetLocalMin = z.shkiah.minutesLocal;
    const nowLocalMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
    if (nowLocalMin >= sunsetLocalMin) hebrewJdn = jdnToday + 1;
  }
  const hebDate = HebrewEngine.jdnToHebrew(hebrewJdn);
  const holiday = HebrewEngine.getHolidayForJdn(hebrewJdn, hebDate.year);
  const omer = HebrewEngine.getOmerDay(hebrewJdn, hebDate.year);
  const holidayTomorrow = HebrewEngine.getHolidayForJdn(hebrewJdn+1, hebDate.year);
  const dow = now.getDay();
  const isFriday = dow===5, isSaturday = dow===6;
  const continuingIntoYomTov = !!(holidayTomorrow && holidayTomorrow.category==='yomtov');
  const erevSomething = isFriday || continuingIntoYomTov;
  const isHolidayEndingTonight = !!(holiday && holiday.category==='yomtov' && holiday.dayNum===holiday.totalDays);
  const havdalahTonight = (isSaturday || isHolidayEndingTonight) && !continuingIntoYomTov;
  const inHolyTime = isSaturday || (holiday && holiday.category==='yomtov');
  return { jdnToday, hebrewJdn, hebDate, holiday, holidayTomorrow, omer, z, isFriday, isSaturday, erevSomething, havdalahTonight, inHolyTime };
}

function isNightNow(now, state){
  if (!state.z) return false;
  const nowMin = now.getHours()*60 + now.getMinutes();
  return (nowMin < state.z.netz.minutesLocal) || (nowMin >= state.z.shkiah.minutesLocal);
}

function styleWidget(widget, night){
  widget.backgroundColor = night ? BG_NIGHT : BG_DAY;
}
function fg(night){ return night ? FG_NIGHT : FG_DAY; }
function soft(night){ return night ? SOFT_NIGHT : SOFT_DAY; }
function accentColor(night){ return night ? ACCENT_NIGHT : ACCENT; }

function addRow(stack, label, value, night, size){
  const row = stack.addStack();
  row.layoutHorizontally();
  const l = row.addText(label);
  l.font = Font.systemFont(size || 13);
  l.textColor = soft(night);
  l.rightAlignText();
  row.addSpacer();
  const v = row.addText(value);
  v.font = Font.boldSystemFont(size || 13);
  v.textColor = fg(night);
  stack.addSpacer(4);
}

/* ---------------------- Rendering modes ---------------------- */

function renderClock(widget, now, state, night, family){
  const big = widget.addText(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  big.font = Font.boldSystemFont(family === 'small' ? 34 : 44);
  big.textColor = fg(night);
  widget.addSpacer(4);

  const dowRow = widget.addStack();
  const dowText = dowRow.addText(YIDDISH_DAYS[now.getDay()]);
  dowText.font = Font.boldSystemFont(15);
  dowText.textColor = state.inHolyTime ? accentColor(night) : soft(night);
  dowText.rightAlignText();
  widget.addSpacer(6);

  const heb = widget.addText(`${HebrewEngine.hebrewNumeral(state.hebDate.day)} ${state.hebDate.monthNameHebrew}`);
  heb.font = Font.systemFont(15);
  heb.textColor = fg(night);
  heb.rightAlignText();

  if (family !== 'small') {
    const eng = widget.addText(`${DOW_EN[now.getDay()]}, ${MONTH_EN[now.getMonth()]} ${now.getDate()}`);
    eng.font = Font.systemFont(12);
    eng.textColor = soft(night);
  }
  if (state.holiday) {
    widget.addSpacer(6);
    const h = widget.addText(state.holiday.name);
    h.font = Font.boldSystemFont(13);
    h.textColor = accentColor(night);
  }
}

function renderToday(widget, now, state, night, family){
  const title = widget.addText(`${DOW_EN[now.getDay()]}, ${MONTH_EN[now.getMonth()]} ${now.getDate()}`);
  title.font = Font.boldSystemFont(14);
  title.textColor = fg(night);
  const heb = widget.addText(`${HebrewEngine.hebrewNumeral(state.hebDate.day)} ${state.hebDate.monthNameHebrew} ${HebrewEngine.hebrewYearString(state.hebDate.year)}`);
  heb.font = Font.systemFont(12);
  heb.textColor = soft(night);
  heb.rightAlignText();
  if (state.holiday) {
    const h = widget.addText(state.holiday.name + (state.holiday.totalDays>1 ? ` (Day ${state.holiday.dayNum}/${state.holiday.totalDays})` : ''));
    h.font = Font.boldSystemFont(12);
    h.textColor = accentColor(night);
  }
  widget.addSpacer(8);

  const z = state.z;
  const rowsToShow = family === 'large'
    ? ['alos','netz','shma','tefila','chatzos','minchaKetana']
    : ['netz','shma','minchaKetana'];
  rowsToShow.forEach((key) => {
    if (z[key]) addRow(widget, ZmanimEngine.ZMAN_DEFS[key].hebrew, z[key].text, night, family==='large'?13:11);
  });
  if (state.erevSomething) addRow(widget, 'הדלקת נרות', z.candle.text, night, family==='large'?13:11);
  else addRow(widget, 'שקיעה', z.shkiah.text, night, family==='large'?13:11);
  if (family === 'large') {
    if (state.havdalahTonight) addRow(widget, 'הבדלה', z.havdalah.text, night, 13);
    else addRow(widget, 'צאת הכוכבים', z.tzeisEveryday.text, night, 13);
  }
  if (state.omer) {
    widget.addSpacer(4);
    const o = widget.addText(`Omer: Day ${state.omer}`);
    o.font = Font.systemFont(11);
    o.textColor = soft(night);
  }
}

function renderNext(widget, now, state, night, family){
  const z = state.z;
  const nowMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
  const candidates = [];
  ZMAN_ORDER.forEach((key) => { if (z[key]) candidates.push({ label: ZmanimEngine.ZMAN_DEFS[key].hebrew, minutesLocal: z[key].minutesLocal, text: z[key].text }); });
  candidates.push({ label: state.erevSomething ? 'הדלקת נרות' : 'שקיעה', minutesLocal: state.erevSomething ? z.candle.minutesLocal : z.shkiah.minutesLocal, text: state.erevSomething ? z.candle.text : z.shkiah.text });
  candidates.push({ label: state.havdalahTonight ? 'הבדלה' : 'צאת הכוכבים', minutesLocal: state.havdalahTonight ? z.havdalah.minutesLocal : z.tzeisEveryday.minutesLocal, text: state.havdalahTonight ? z.havdalah.text : z.tzeisEveryday.text });
  candidates.sort((a,b) => a.minutesLocal - b.minutesLocal);
  const next = candidates.find((c) => c.minutesLocal > nowMin) || candidates[0];

  const label = widget.addText('Next Zman');
  label.font = Font.systemFont(12);
  label.textColor = soft(night);
  widget.addSpacer(4);
  const name = widget.addText(next.label);
  name.font = Font.boldSystemFont(family==='small'?20:24);
  name.textColor = accentColor(night);
  name.rightAlignText();
  const time = widget.addText(next.text);
  time.font = Font.boldSystemFont(family==='small'?26:32);
  time.textColor = fg(night);
  widget.addSpacer(4);
  let diff = next.minutesLocal - nowMin;
  if (diff < 0) diff += 1440;
  const hh = Math.floor(diff/60), mm = Math.floor(diff%60);
  const countdown = widget.addText(hh > 0 ? `in ${hh}h ${mm}m` : `in ${mm}m`);
  countdown.font = Font.systemFont(13);
  countdown.textColor = soft(night);
}

function renderMonth(widget, now, night){
  const y = now.getFullYear(), m = now.getMonth()+1;
  const title = widget.addText(`${MONTH_EN[m-1]} ${y}`);
  title.font = Font.boldSystemFont(16);
  title.textColor = fg(night);
  widget.addSpacer(6);

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m-1, 1).getDay();
  const dowHead = widget.addStack();
  dowHead.layoutHorizontally();
  ['S','M','T','W','T','F','S'].forEach((d) => {
    const c = dowHead.addStack(); c.size = new Size(30,14);
    const t = c.addText(d); t.font = Font.systemFont(9); t.textColor = soft(night); t.centerAlignText();
  });
  widget.addSpacer(2);

  let day = 1;
  const totalCells = firstDow + daysInMonth;
  const rowCount = Math.ceil(totalCells / 7);
  for (let r = 0; r < rowCount; r++) {
    const row = widget.addStack();
    row.layoutHorizontally();
    for (let c = 0; c < 7; c++) {
      const cellIndex = r*7 + c;
      const cell = row.addStack();
      cell.size = new Size(30, 26);
      cell.layoutVertically();
      if (cellIndex >= firstDow && day <= daysInMonth) {
        const jdn = HebrewEngine.gregorianToJDN(y, m, day);
        const hebDate = HebrewEngine.jdnToHebrew(jdn);
        const holiday = HebrewEngine.getHolidayForJdn(jdn, hebDate.year);
        const isToday = day === now.getDate();
        const numText = cell.addText(String(day));
        numText.font = isToday ? Font.boldSystemFont(12) : Font.systemFont(11);
        numText.textColor = isToday ? accentColor(night) : fg(night);
        numText.centerAlignText();
        if (holiday) {
          const dot = cell.addText('•');
          dot.font = Font.boldSystemFont(9);
          dot.textColor = accentColor(night);
          dot.centerAlignText();
        }
        day++;
      }
    }
    widget.addSpacer(1);
  }
}

function renderSingleZman(widget, now, state, key, night, family){
  const z = state.z;
  let label, value;
  if (key === 'candle') { value = state.erevSomething ? z.candle.text : z.shkiah.text; label = state.erevSomething ? 'הדלקת נרות' : 'שקיעה'; }
  else if (key === 'havdalah') { label = state.havdalahTonight ? 'הבדלה' : 'צאת הכוכבים'; value = state.havdalahTonight ? z.havdalah.text : z.tzeisEveryday.text; }
  else if (key === 'tzeisEveryday') { label = 'צאת הכוכבים'; value = z.tzeisEveryday.text; }
  else if (key === 'shkiah') { label = 'שקיעה'; value = z.shkiah.text; }
  else { label = ZmanimEngine.ZMAN_DEFS[key] ? ZmanimEngine.ZMAN_DEFS[key].hebrew : key; value = z[key] ? z[key].text : '--:--'; }

  const l = widget.addText(label);
  l.font = Font.systemFont(family==='small'?15:18);
  l.textColor = soft(night);
  l.rightAlignText();
  widget.addSpacer(6);
  const v = widget.addText(value);
  v.font = Font.boldSystemFont(family==='small'?30:38);
  v.textColor = fg(night);
  widget.addSpacer(6);
  const d = widget.addText(`${DOW_EN[now.getDay()]}, ${MONTH_EN[now.getMonth()]} ${now.getDate()}`);
  d.font = Font.systemFont(10);
  d.textColor = soft(night);
}

/* ---------------------- Main ---------------------- */
async function run(){
  const now = new Date();
  const family = config.widgetFamily || 'medium'; // when previewed in-app, defaults to medium
  const param = (args.widgetParameter || '').trim();

  const loc = await resolveLocation();
  const state = computeToday(now, loc.lat, loc.lon);
  const night = isNightNow(now, state);

  const widget = new ListWidget();
  styleWidget(widget, night);
  widget.setPadding(12, 14, 12, 14);

  const paramLower = param.toLowerCase();
  if (!param || paramLower === 'clock') {
    renderClock(widget, now, state, night, family);
  } else if (paramLower === 'today') {
    renderToday(widget, now, state, night, family);
  } else if (paramLower === 'next') {
    renderNext(widget, now, state, night, family);
  } else if (paramLower === 'month') {
    renderMonth(widget, now, night);
  } else if (ZMAN_ALIASES[paramLower]) {
    renderSingleZman(widget, now, state, ZMAN_ALIASES[paramLower], night, family);
  } else {
    const err = widget.addText(`Unknown widget parameter: "${param}"`);
    err.font = Font.systemFont(12);
    err.textColor = fg(night);
    widget.addSpacer(4);
    const hint = widget.addText('Try: clock, today, next, month, or a zman name like "Mincha Ketana".');
    hint.font = Font.systemFont(10);
    hint.textColor = soft(night);
  }

  Script.setWidget(widget);
  if (!config.runsInWidget) await widget.presentMedium();
  Script.complete();
}

await run();
