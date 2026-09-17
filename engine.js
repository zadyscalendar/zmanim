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

  // ---------- Public API ----------
  return {
    isLeapYear, gregorianToJDN, jdnToGregorian, jdnToHebrew, hebrewToJdn,
    hebrewNumeral, hebrewYearString, getHolidays, getHolidayForJdn, getOmerDay,
    JDN0
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
      _raw: { sunriseMin, sunsetMin, tzOffsetHours }
    };
  }

  return { getZmanim };
})();

if (typeof module !== 'undefined') module.exports = { HebrewEngine, ZmanimEngine };
