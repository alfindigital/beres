#!/usr/bin/env node
/* release.js - naikkan versi aset di SEMUA tempat sekaligus.
 *
 * KENAPA ADA: versi aset harus naik serentak di index.html (?v=N x3),
 * sw.js (?v=N x3) dan CACHE='beres-vN'. Lupa satu = user terjebak versi
 * lama. Sudah kejadian — makanya ini script, bukan ingatan.
 *
 * Pakai: node tools/release.js [N]   (tanpa N = versi sekarang + 1)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FHTML = path.join(ROOT, 'index.html');
const FSW = path.join(ROOT, 'sw.js');

const html = fs.readFileSync(FHTML, 'utf8');
const sw = fs.readFileSync(FSW, 'utf8');

const cur = /\?v=(\d+)/.exec(html);
if (!cur) { console.error('Tidak nemu ?v=N di index.html'); process.exit(1); }

const next = process.argv[2] ? +process.argv[2] : +cur[1] + 1;
if (!Number.isInteger(next) || next <= 0) { console.error('Versi harus bilangan bulat positif'); process.exit(1); }

const nHtml = (html.match(/\?v=\d+/g) || []).length;
const nSw = (sw.match(/\?v=\d+/g) || []).length;
const nCache = (sw.match(/beres-v\d+/g) || []).length;
if (!nCache) { console.error("Tidak nemu CACHE 'beres-vN' di sw.js"); process.exit(1); }

fs.writeFileSync(FHTML, html.replace(/\?v=\d+/g, '?v=' + next));
fs.writeFileSync(FSW, sw.replace(/\?v=\d+/g, '?v=' + next).replace(/beres-v\d+/g, 'beres-v' + next));

console.log(`v${cur[1]} -> v${next}: index.html ${nHtml} query, sw.js ${nSw} query + CACHE`);
