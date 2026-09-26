/* beres. - parser quick add Bahasa Indonesia
 * Dipakai browser (window.BeresParse) dan Node (module.exports) untuk test.
 * Contoh: "bayar kos besok jam 9 !p1 #keuangan @wa tiap bulan"
 */
'use strict';
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && typeof module.exports === 'object') module.exports = api;
  else root.BeresParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /* ---------- util tanggal ---------- */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var dayStart = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var addMonths = function (d, n) {
    var x = new Date(d), day = x.getDate();
    x.setDate(1); x.setMonth(x.getMonth() + n);
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
  };
  var parseISO = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  var diffDays = function (a, b) { return Math.round((dayStart(a) - dayStart(b)) / 86400000); };

  /* ---------- kamus ---------- */
  var WEEKDAYS = {
    minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4,
    jumat: 5, "jum'at": 5, jumaat: 5, sabtu: 6
  };
  var WD_RE = "minggu|ahad|senin|selasa|rabu|kamis|jum'at|jumat|jumaat|sabtu";
  var WD_NAMA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var WD_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  var MONTHS = {
    januari: 0, jan: 0, februari: 1, febuari: 1, feb: 1, maret: 2, mar: 2, april: 3, apr: 3,
    mei: 4, juni: 5, jun: 5, juli: 6, jul: 6, agustus: 7, agust: 7, agu: 7, agt: 7,
    september: 8, sept: 8, sep: 8, oktober: 9, okt: 9, november: 10, nov: 10, desember: 11, des: 11
  };
  var MON_RE = "januari|jan|februari|febuari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|" +
    "agustus|agust|agu|agt|september|sept|sep|oktober|okt|november|nov|desember|des";
  var MON_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // Penanda topeng: EN QUAD. Dihitung s oleh regex (batas kata token lain tetap kena)
  // tapi mustahil diketik user, jadi aman dibuang di akhir.
  var NUL = '\u2000'; // EN QUAD: dihitung \s oleh regex, mustahil diketik user

  /* ---------- inti ---------- */
  function parse(text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    var now = opts.now ? new Date(opts.now) : new Date();
    var today = dayStart(now);

    var masked = text;
    var res = {
      title: '', due: null, time: null, priority: 0,
      project: null, labels: [], repeat: null, tokens: []
    };

    function mask(start, end) {
      masked = masked.slice(0, start) + NUL.repeat(end - start) + masked.slice(end);
    }
    function tok(type, start, end, label) {
      res.tokens.push({ type: type, raw: text.slice(start, end).trim(), label: label });
      mask(start, end);
    }
    // regex selalu dijalankan di string bertopeng supaya token tidak dobel dipakai
    function find(re) { return re.exec(masked); }

    /* 1. prioritas: !p1 / p1 */
    var m = find(/(^|\s)!?p([1-4])(?=\s|$)/i);
    if (m) {
      res.priority = +m[2];
      tok('priority', m.index, m.index + m[0].length, 'P' + m[2]);
    }

    /* 2. project: #kerja */
    m = find(/(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_.\-]*)/u);
    if (m) {
      res.project = m[2];
      tok('project', m.index, m.index + m[0].length, m[2]);
    }

    /* 3. label: @rumah (boleh banyak) */
    var reLabel = /(^|\s)@([\p{L}\p{N}][\p{L}\p{N}_.\-]*)/u;
    for (var guard = 0; guard < 10; guard++) {
      m = find(reLabel);
      if (!m) break;
      res.labels.push(m[2]);
      tok('label', m.index, m.index + m[0].length, m[2]);
    }

    /* 4. pengulangan */
    (function () {
      var mm;
      if ((mm = find(new RegExp('(^|\\s)(?:tiap|setiap)\\s+hari\\s+kerja\\b', 'i')))) {
        res.repeat = { unit: 'week', interval: 1, wd: [1, 2, 3, 4, 5] };
      } else if ((mm = find(new RegExp('(^|\\s)(?:tiap|setiap)\\s+(' + WD_RE + ')\\b', 'i')))) {
        res.repeat = { unit: 'week', interval: 1, wd: [WEEKDAYS[mm[2].toLowerCase()]] };
      } else if ((mm = find(/(^|\s)(?:tiap|setiap)\s+(?:(\d+)\s*)?(hari|minggu|pekan|bulan|tahun)\b/i))) {
        res.repeat = { unit: unitOf(mm[3]), interval: mm[2] ? +mm[2] : 1, wd: null };
      } else if ((mm = find(/(^|\s)(harian|mingguan|bulanan|tahunan)\b/i))) {
        var u = { harian: 'day', mingguan: 'week', bulanan: 'month', tahunan: 'year' }[mm[2].toLowerCase()];
        res.repeat = { unit: u, interval: 1, wd: null };
      }
      if (res.repeat) tok('repeat', mm.index, mm.index + mm[0].length, repeatLabel(res.repeat));
    })();

    /* 5. tanggal: kumpulkan semua kandidat, ambil yang paling kiri */
    var cands = [];
    function cand(re, fn) {
      var mm = find(re);
      if (mm) cands.push({ i: mm.index, end: mm.index + mm[0].length, m: mm, fn: fn });
    }

    // 15/8 atau 15-8-2026
    cand(/(^|\s)(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?(?=\s|$)/, function (mm) {
      var d = +mm[2], mo = +mm[3];
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
      var y = mm[4] ? (mm[4].length === 2 ? 2000 + +mm[4] : +mm[4]) : today.getFullYear();
      var dt = new Date(y, mo - 1, d);
      if (!mm[4] && dt < today) dt = new Date(y + 1, mo - 1, d);
      return dt;
    });
    // 15 agu 2026
    cand(new RegExp('(^|\\s)(\\d{1,2})\\s+(' + MON_RE + ')\\.?(?:\\s+(\\d{4}))?\\b', 'i'), function (mm) {
      var d = +mm[2], mo = MONTHS[mm[3].toLowerCase()];
      if (d < 1 || d > 31) return null;
      var y = mm[4] ? +mm[4] : today.getFullYear();
      var dt = new Date(y, mo, d);
      if (!mm[4] && dt < today) dt = new Date(y + 1, mo, d);
      return dt;
    });
    // agu 15
    cand(new RegExp('(^|\\s)(' + MON_RE + ')\\.?\\s+(\\d{1,2})(?=\\s|$)', 'i'), function (mm) {
      var mo = MONTHS[mm[2].toLowerCase()], d = +mm[3];
      if (d < 1 || d > 31) return null;
      var dt = new Date(today.getFullYear(), mo, d);
      if (dt < today) dt = new Date(today.getFullYear() + 1, mo, d);
      return dt;
    });
    // tgl 5
    cand(/(^|\s)(?:tgl|tanggal)\.?\s*(\d{1,2})\b/i, function (mm) {
      var d = +mm[2];
      if (d < 1 || d > 31) return null;
      var dt = new Date(today.getFullYear(), today.getMonth(), d);
      if (dt < today) dt = addMonths(dt, 1);
      return dt;
    });
    // 3 hari lagi
    cand(/(^|\s)(\d{1,3})\s*(hari|minggu|pekan|bulan|tahun)\s+(?:lagi|ke\s?depan|mendatang)\b/i, function (mm) {
      var n = +mm[2], u = unitOf(mm[3]);
      if (u === 'day') return addDays(today, n);
      if (u === 'week') return addDays(today, 7 * n);
      if (u === 'month') return addMonths(today, n);
      return addMonths(today, 12 * n);
    });
    // kata kunci
    cand(/(^|\s)(hari ini|hr ini|sekarang|skrg|besok pagi|besok|bsk|esok|lusa|kemarin|kmrn|minggu depan|pekan depan|bulan depan|tahun depan|akhir bulan|akhir pekan|weekend|nanti malam|malam ini|nanti sore|siang ini|nanti siang)(?=\s|$)/i,
      function (mm) {
        var k = mm[2].toLowerCase().replace(/\s+/g, ' ');
        switch (k) {
          case 'hari ini': case 'hr ini': case 'sekarang': case 'skrg': return today;
          case 'besok': case 'bsk': case 'esok': return addDays(today, 1);
          case 'besok pagi': res.time = res.time || '07:00'; return addDays(today, 1);
          case 'lusa': return addDays(today, 2);
          case 'kemarin': case 'kmrn': return addDays(today, -1);
          case 'minggu depan': case 'pekan depan': return addDays(today, 7);
          case 'bulan depan': return addMonths(today, 1);
          case 'tahun depan': return addMonths(today, 12);
          case 'akhir bulan': return new Date(today.getFullYear(), today.getMonth() + 1, 0);
          case 'akhir pekan': case 'weekend': return nextWd(today, 6, false);
          case 'nanti malam': case 'malam ini': res.time = res.time || '20:00'; return today;
          case 'nanti sore': res.time = res.time || '16:00'; return today;
          case 'nanti siang': case 'siang ini': res.time = res.time || '13:00'; return today;
        }
        return null;
      });
    // senin / senin depan
    cand(new RegExp('(^|\\s)(' + WD_RE + ')(\\s+(depan|ini))?(?=\\s|$)', 'i'), function (mm) {
      return nextWd(today, WEEKDAYS[mm[2].toLowerCase()], /depan/i.test(mm[3] || ''));
    });

    cands.sort(function (a, b) { return a.i - b.i; });
    var dateEnd = -1;
    for (var ci = 0; ci < cands.length; ci++) {
      var dt = cands[ci].fn(cands[ci].m);
      if (dt) {
        res.due = ymd(dt);
        dateEnd = cands[ci].end;
        tok('date', cands[ci].i, cands[ci].end, fmtTanggal(dt, now));
        break;
      }
    }

    /* 6. jam */
    (function () {
      var mm, h, mi, mod;
      if ((mm = find(/(^|\s)jam\s+setengah\s+(\d{1,2})\b/i))) {
        h = (+mm[2] - 1 + 24) % 24; mi = 30;
      } else if ((mm = find(/(^|\s)jam\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*(pagi|siang|sore|malam|subuh))?(?=\s|$)/i))) {
        h = +mm[2]; mi = mm[3] ? +mm[3] : 0; mod = mm[4];
      } else if ((mm = find(/(^|\s)(\d{1,2}):(\d{2})(?:\s*(pagi|siang|sore|malam))?(?=\s|$)/))) {
        h = +mm[2]; mi = +mm[3]; mod = mm[4];
      } else if ((mm = find(/(^|\s)(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)\b/i))) {
        h = +mm[2]; mi = mm[3] ? +mm[3] : 0;
        mod = mm[4].toLowerCase() === 'pm' ? 'sore' : 'pagi';
      } else {
        return;
      }
      if (h > 23 || mi > 59) return;
      h = terapkanModifier(h, mod);
      res.time = pad(h) + ':' + pad(mi);
      tok('time', mm.index, mm.index + mm[0].length, res.time);
    })();

    /* 6b. "besok pagi" gaya "besok" + "pagi" yang nempel setelah tanggal */
    if (dateEnd >= 0 && !res.time) {
      var after = /^(\s*)(pagi|siang|sore|malam|subuh)(?=\s|$)/i.exec(masked.slice(dateEnd));
      if (after) {
        var jam = { pagi: '07:00', siang: '13:00', sore: '16:00', malam: '20:00', subuh: '04:30' };
        res.time = jam[after[2].toLowerCase()];
        tok('time', dateEnd, dateEnd + after[0].length, res.time);
      }
    }

    /* 7. normalisasi */
    if (res.time && !res.due) {
      var t = res.time.split(':');
      var dt2 = new Date(today); dt2.setHours(+t[0], +t[1], 0, 0);
      res.due = ymd(dt2 < now ? addDays(today, 1) : today);
    }
    if (res.repeat && !res.due) {
      if (res.repeat.wd && res.repeat.wd.length) {
        var best = null;
        for (var i = 0; i <= 7; i++) {
          var d2 = addDays(today, i);
          if (res.repeat.wd.indexOf(d2.getDay()) >= 0) { best = d2; break; }
        }
        res.due = ymd(best || today);
      } else {
        res.due = ymd(today);
      }
    }

    res.title = masked.split(NUL).join('').replace(/\s+/g, ' ').trim();
    return res;
  }

  function unitOf(kata) {
    kata = kata.toLowerCase();
    if (kata === 'hari') return 'day';
    if (kata === 'minggu' || kata === 'pekan') return 'week';
    if (kata === 'bulan') return 'month';
    return 'year';
  }

  function terapkanModifier(h, mod) {
    if (!mod) return h;
    mod = mod.toLowerCase();
    if (mod === 'pagi' || mod === 'subuh') return h === 12 ? 0 : h;
    if (mod === 'siang') return h >= 11 ? h : h + 12;
    // sore / malam
    if (h === 12) return mod === 'malam' ? 0 : 12;
    return h < 12 ? h + 12 : h;
  }

  function nextWd(from, wd, pekanDepan) {
    var cur = dayStart(from);
    var d = (wd - cur.getDay() + 7) % 7;
    if (d === 0 && pekanDepan) d = 7;
    return addDays(cur, d);
  }

  /* ---------- pengulangan ---------- */
  function repeatLabel(r) {
    if (!r) return '';
    if (r.wd && r.wd.length) {
      if (r.wd.length === 5 && r.wd.indexOf(0) < 0 && r.wd.indexOf(6) < 0) return 'tiap hari kerja';
      return 'tiap ' + r.wd.map(function (w) { return WD_NAMA[w]; }).join(', ');
    }
    var nama = { day: 'hari', week: 'minggu', month: 'bulan', year: 'tahun' }[r.unit] || r.unit;
    return 'tiap ' + (r.interval > 1 ? r.interval + ' ' : '') + nama;
  }

  function nextDue(repeat, fromISO) {
    if (!repeat) return null;
    var base = parseISO(fromISO) || dayStart(new Date());
    var iv = Math.max(1, repeat.interval || 1);
    if (repeat.wd && repeat.wd.length) {
      for (var i = 1; i <= 14; i++) {
        var d = addDays(base, i);
        if (repeat.wd.indexOf(d.getDay()) >= 0) return ymd(d);
      }
      return ymd(addDays(base, 7));
    }
    if (repeat.unit === 'day') return ymd(addDays(base, iv));
    if (repeat.unit === 'week') return ymd(addDays(base, 7 * iv));
    if (repeat.unit === 'month') return ymd(addMonths(base, iv));
    if (repeat.unit === 'year') return ymd(addMonths(base, 12 * iv));
    return null;
  }

  /* ---------- format tampilan ---------- */
  function fmtTanggal(d, now) {
    now = now || new Date();
    var n = diffDays(d, now);
    if (n === 0) return 'Hari ini';
    if (n === 1) return 'Besok';
    if (n === -1) return 'Kemarin';
    if (n === 2) return 'Lusa';
    if (n > 2 && n < 7) return WD_PENDEK[d.getDay()];
    if (n < 0) return WD_PENDEK[d.getDay()] + ', ' + d.getDate() + ' ' + MON_PENDEK[d.getMonth()];
    var s = d.getDate() + ' ' + MON_PENDEK[d.getMonth()];
    if (d.getFullYear() !== now.getFullYear()) s += ' ' + d.getFullYear();
    return s;
  }

  function fmtDue(iso, time, now) {
    var d = parseISO(iso);
    if (!d) return '';
    var s = fmtTanggal(d, now || new Date());
    if (time) s += ' ' + time;
    return s;
  }

  function fmtPanjang(iso) {
    var d = parseISO(iso);
    if (!d) return '';
    return WD_NAMA[d.getDay()] + ', ' + d.getDate() + ' ' +
      ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
        'September', 'Oktober', 'November', 'Desember'][d.getMonth()] + ' ' + d.getFullYear();
  }

  return {
    parse: parse,
    nextDue: nextDue,
    repeatLabel: repeatLabel,
    fmtDue: fmtDue,
    fmtTanggal: fmtTanggal,
    fmtPanjang: fmtPanjang,
    ymd: ymd,
    parseISO: parseISO,
    addDays: addDays,
    addMonths: addMonths,
    dayStart: dayStart,
    diffDays: diffDays,
    WD_PENDEK: WD_PENDEK,
    WD_NAMA: WD_NAMA,
    MON_PENDEK: MON_PENDEK
  };
});
