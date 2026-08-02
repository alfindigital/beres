#!/usr/bin/env node
/* test-ketahanan.js - uji app.load() menghadapi localStorage rusak/dijahati.
 *
 * KENAPA ADA: data user disimpan di localStorage yang bisa rusak (kuota penuh,
 * ekstensi lain, atau file impor jahat). Kalau load() meledak, app blank dan
 * user kehilangan akses ke SEMUA tugasnya. Ini menguji load() saja, terisolasi,
 * tanpa perlu browser.
 *
 * Pakai: node tools/test-ketahanan.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Sadap fungsi blank() dan load() dari app.js tanpa menjalankan seluruh IIFE
// (IIFE butuh DOM). Ambil sumbernya, lalu evaluasi di sandbox kecil.
function ambil(nama) {
  const i = APP.indexOf('function ' + nama + '(');
  if (i < 0) throw new Error('fungsi ' + nama + ' tidak ketemu di app.js');
  let d = 0, j = APP.indexOf('{', i);
  const start = i;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') d++;
    else if (APP[k] === '}') { d--; if (d === 0) return APP.slice(start, k + 1); }
  }
  throw new Error('kurung tidak seimbang di ' + nama);
}

const KASUS = {
  'JSON rusak':            '{tasks:[},,,',
  'string kosong':         '',
  'bukan objek (string)':  '"cuma string"',
  'null literal':          'null',
  'angka':                 '12345',
  'array di akar':         '[1,2,3]',
  'tasks bukan array':     '{"tasks":"bukan array","projects":[]}',
  'projects hilang':       '{"tasks":[]}',
  'projects array kosong': '{"tasks":[],"projects":[]}',
  'field tugas hilang':    '{"tasks":[{"id":"t-1"}],"projects":[{"id":"p","name":"X","color":"red"}]}',
  'tipe field salah':      '{"tasks":[{"id":1,"title":123,"labels":"bukan array","subs":null,"due":999}],"projects":[]}',
  'set bukan objek':       '{"tasks":[],"projects":[],"set":"bukan objek"}',
  'sessions bukan array':  '{"tasks":[],"projects":[],"sessions":{}}',
  'seq bukan angka':       '{"tasks":[],"projects":[],"seq":"banyak"}',
  '__proto__ jahat':       '{"tasks":[],"projects":[],"__proto__":{"tercemar":"YA"}}',
  'constructor jahat':     '{"tasks":[],"projects":[],"constructor":{"prototype":{"tercemar2":"YA"}}}',
  'nested sangat dalam':   '{"tasks":[{"id":"t","title":"x","labels":[[[[["dalam"]]]]],"subs":[]}],"projects":[]}',
  'unicode + emoji':       '{"tasks":[{"id":"t","title":"\\u0000\\uD83D\\uDE00 nol byte","labels":[],"subs":[]}],"projects":[]}'
};

let lolos = 0, gagal = 0;
const pesan = [];

for (const [nama, isi] of Object.entries(KASUS)) {
  // sandbox: localStorage tiruan + fungsi yang disadap
  const sandbox = {
    localStorage: { getItem: () => (isi === '' ? '' : isi) },
    Array, Object, JSON, String, Number, Math, Date
  };
  const kode = `
    var KEY = 'beres.v1';
    var PAL = ['#C6F24E','#6BA9FF','#FF6B35','#B79CFF','#4FD9C4','#FF7BB8','#FFA53D','#8BD450'];
    ${ambil('blank')}
    ${ambil('load')}
    var hasil, err = null;
    try { hasil = load(); } catch (e) { err = e.name + ': ' + e.message; }
    ({ err: err, hasil: hasil });
  `;
  let out;
  try {
    const vm = require('vm');
    out = vm.runInNewContext(kode, sandbox, { timeout: 3000 });
  } catch (e) {
    out = { err: 'SANDBOX ' + e.message };
  }

  const tercemar = ({}).tercemar === 'YA' || ({}).tercemar2 === 'YA';
  if (out.err) {
    gagal++;
    pesan.push(`  MELEDAK  ${nama}\n    ${out.err}`);
  } else if (tercemar) {
    gagal++;
    pesan.push(`  TERCEMAR ${nama} -> Object.prototype kena polusi`);
  } else if (!out.hasil || !Array.isArray(out.hasil.tasks) ||
             !Array.isArray(out.hasil.projects) || !out.hasil.projects.length ||
             typeof out.hasil.set !== 'object' || out.hasil.set === null ||
             !Array.isArray(out.hasil.sessions)) {
    gagal++;
    pesan.push(`  BENTUK SALAH ${nama} -> ${JSON.stringify(out.hasil).slice(0, 110)}`);
  } else {
    lolos++;
  }
}

if (pesan.length) console.log(pesan.join('\n'));
console.log(`\n${lolos} tahan, ${gagal} jebol, total ${lolos + gagal}`);
process.exit(gagal ? 1 : 0);
