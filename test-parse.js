/* Test parser: node test-parse.js
 * Waktu acuan dipatok: Sabtu, 1 Agustus 2026 pukul 10:00.
 */
'use strict';
var P = require('./js/parse.js');
var NOW = new Date(2026, 7, 1, 10, 0, 0); // Sabtu 1 Agu 2026
var lolos = 0, gagal = 0, pesan = [];

function cek(nama, aktual, harap) {
  var a = JSON.stringify(aktual), h = JSON.stringify(harap);
  if (a === h) { lolos++; return; }
  gagal++;
  pesan.push('  GAGAL ' + nama + '\n    harap : ' + h + '\n    aktual: ' + a);
}

function p(teks) { return P.parse(teks, { now: NOW }); }

function t(teks, harap) {
  var r = p(teks);
  var aktual = {};
  for (var k in harap) aktual[k] = r[k];
  cek(JSON.stringify(teks), aktual, harap);
}

/* ---------- judul bersih ---------- */
t('beli galon', { title: 'beli galon', due: null, priority: 0 });
t('  spasi   berlebih   dirapikan  ', { title: 'spasi berlebih dirapikan' });
t('', { title: '', due: null });
t('rapat tim marketing minggu ini soal budget', { title: 'rapat tim marketing soal budget' });

/* ---------- tanggal relatif ---------- */
t('kerjain tugas hari ini', { title: 'kerjain tugas', due: '2026-08-01' });
t('bayar kos besok', { title: 'bayar kos', due: '2026-08-02' });
t('bsk setor laporan', { title: 'setor laporan', due: '2026-08-02' });
t('lusa ke dokter', { title: 'ke dokter', due: '2026-08-03' });
t('nyuci kemarin', { title: 'nyuci', due: '2026-07-31' });
t('review minggu depan', { title: 'review', due: '2026-08-08' });
t('bayar listrik bulan depan', { title: 'bayar listrik', due: '2026-09-01' });
t('perpanjang STNK tahun depan', { title: 'perpanjang STNK', due: '2027-08-01' });
t('tutup buku akhir bulan', { title: 'tutup buku', due: '2026-08-31' });
t('3 hari lagi deadline', { title: 'deadline', due: '2026-08-04' });
t('2 minggu lagi checkup', { title: 'checkup', due: '2026-08-15' });
t('6 bulan lagi servis', { title: 'servis', due: '2027-02-01' });

/* ---------- hari ---------- */
t('futsal senin', { title: 'futsal', due: '2026-08-03' });          // Sen berikutnya
t('futsal sabtu', { title: 'futsal', due: '2026-08-01' });          // hari ini Sabtu
t('futsal sabtu depan', { title: 'futsal', due: '2026-08-08' });
t('rapat jumat', { title: 'rapat', due: '2026-08-07' });
t("sholat jum'at", { title: 'sholat', due: '2026-08-07' });

/* ---------- tanggal absolut ---------- */
t('bayar pajak 15 agustus', { title: 'bayar pajak', due: '2026-08-15' });
t('bayar pajak 15 agu', { title: 'bayar pajak', due: '2026-08-15' });
t('ultah adek 20 jan', { title: 'ultah adek', due: '2027-01-20' });   // sudah lewat, lompat tahun
t('meeting 5/9', { title: 'meeting', due: '2026-09-05' });
t('meeting 5-9-2027', { title: 'meeting', due: '2027-09-05' });
t('kontrak habis 31/12/26', { title: 'kontrak habis', due: '2026-12-31' });
t('gajian tgl 25', { title: 'gajian', due: '2026-08-25' });
t('bayar cicilan tanggal 1', { title: 'bayar cicilan', due: '2026-08-01' }); // hari ini tgl 1, jadi hari ini
t('bayar cicilan tanggal 30', { title: 'bayar cicilan', due: '2026-08-30' });
t('setoran tgl 1 bulan depan', { title: 'setoran bulan depan', due: '2026-08-01' }); // tgl paling kiri menang
t('des 25 liburan', { title: 'liburan', due: '2026-12-25' });
t('tanggal 32 bukan tanggal', { title: 'tanggal 32 bukan tanggal', due: null });
t('meeting 45/13 typo', { title: 'meeting 45/13 typo', due: null });

/* ---------- jam ---------- */
t('meeting besok jam 9', { title: 'meeting', due: '2026-08-02', time: '09:00' });
t('meeting jam 9 malam', { title: 'meeting', due: '2026-08-01', time: '21:00' });
t('sahur jam 3 pagi', { title: 'sahur', due: '2026-08-02', time: '03:00' });   // 03:00 sudah lewat -> besok
t('makan jam 12 siang', { title: 'makan', due: '2026-08-01', time: '12:00' });
t('standup jam 09:30', { title: 'standup', due: '2026-08-02', time: '09:30' });
t('kelas jam 14.30', { title: 'kelas', due: '2026-08-01', time: '14:30' });
t('nonton 19:00', { title: 'nonton', due: '2026-08-01', time: '19:00' });
t('gym 6pm', { title: 'gym', due: '2026-08-01', time: '18:00' });
t('bangun 5am', { title: 'bangun', due: '2026-08-02', time: '05:00' });
t('rapat jam setengah 9', { title: 'rapat', due: '2026-08-02', time: '08:30' });
t('besok pagi olahraga', { title: 'olahraga', due: '2026-08-02', time: '07:00' });
t('nanti malam nelpon ibu', { title: 'nelpon ibu', due: '2026-08-01', time: '20:00' });
t('nanti sore ke pasar', { title: 'ke pasar', due: '2026-08-01', time: '16:00' });
t('senin sore fitting baju', { title: 'fitting baju', due: '2026-08-03', time: '16:00' });
t('jam 99 ngawur', { title: 'jam 99 ngawur', due: null, time: null });

/* ---------- prioritas, project, label ---------- */
t('bayar utang !p1', { title: 'bayar utang', priority: 1 });
t('nyapu p4', { title: 'nyapu', priority: 4 });
t('riset pasar #kerja', { title: 'riset pasar', project: 'kerja' });
t('beli susu #belanja @tokopedia @urgent',
  { title: 'beli susu', project: 'belanja', labels: ['tokopedia', 'urgent'] });
t('kirim invoice besok jam 9 !p1 #kerja @email', {
  title: 'kirim invoice', due: '2026-08-02', time: '09:00',
  priority: 1, project: 'kerja', labels: ['email']
});
t('email ke budi@gmail.com', { title: 'email ke budi@gmail.com', labels: [] }); // @ nempel = bukan label

/* ---------- pengulangan ---------- */
t('minum vitamin tiap hari', { title: 'minum vitamin', repeat: { unit: 'day', interval: 1, wd: null }, due: '2026-08-01' });
t('laporan tiap senin', { title: 'laporan', repeat: { unit: 'week', interval: 1, wd: [1] }, due: '2026-08-03' });
t('standup tiap hari kerja', { title: 'standup', repeat: { unit: 'week', interval: 1, wd: [1, 2, 3, 4, 5] }, due: '2026-08-03' });
t('bayar kos tiap bulan', { title: 'bayar kos', repeat: { unit: 'month', interval: 1, wd: null } });
t('ganti oli tiap 3 bulan', { title: 'ganti oli', repeat: { unit: 'month', interval: 3, wd: null } });
t('setor laporan mingguan', { title: 'setor laporan', repeat: { unit: 'week', interval: 1, wd: null } });
t('jurnal harian jam 9 malam', { title: 'jurnal', repeat: { unit: 'day', interval: 1, wd: null }, time: '21:00' });

/* ---------- kombinasi liar ---------- */
t('bayar kos besok jam 9 !p1 #keuangan @wa tiap bulan', {
  title: 'bayar kos', due: '2026-08-02', time: '09:00', priority: 1,
  project: 'keuangan', labels: ['wa'], repeat: { unit: 'month', interval: 1, wd: null }
});
t('#kerja !p2 kirim proposal 15 agustus jam 14:00', {
  title: 'kirim proposal', project: 'kerja', priority: 2,
  due: '2026-08-15', time: '14:00'
});

/* ---------- nextDue ---------- */
cek('nextDue harian', P.nextDue({ unit: 'day', interval: 1, wd: null }, '2026-08-01'), '2026-08-02');
cek('nextDue 3 hari', P.nextDue({ unit: 'day', interval: 3, wd: null }, '2026-08-01'), '2026-08-04');
cek('nextDue mingguan', P.nextDue({ unit: 'week', interval: 1, wd: null }, '2026-08-01'), '2026-08-08');
cek('nextDue bulanan', P.nextDue({ unit: 'month', interval: 1, wd: null }, '2026-08-01'), '2026-09-01');
cek('nextDue bulanan akhir', P.nextDue({ unit: 'month', interval: 1, wd: null }, '2026-01-31'), '2026-02-28');
cek('nextDue tahunan', P.nextDue({ unit: 'year', interval: 1, wd: null }, '2026-08-01'), '2027-08-01');
cek('nextDue hari kerja (Jum -> Sen)', P.nextDue({ unit: 'week', interval: 1, wd: [1, 2, 3, 4, 5] }, '2026-08-07'), '2026-08-10');
cek('nextDue tiap senin', P.nextDue({ unit: 'week', interval: 1, wd: [1] }, '2026-08-03'), '2026-08-10');

/* ---------- format ---------- */
cek('fmt hari ini', P.fmtDue('2026-08-01', null, NOW), 'Hari ini');
cek('fmt besok+jam', P.fmtDue('2026-08-02', '09:00', NOW), 'Besok 09:00');
cek('fmt lusa', P.fmtDue('2026-08-03', null, NOW), 'Lusa');
cek('fmt dalam pekan', P.fmtDue('2026-08-05', null, NOW), 'Rab');
cek('fmt jauh', P.fmtDue('2026-09-20', null, NOW), '20 Sep');
cek('fmt beda tahun', P.fmtDue('2027-01-05', null, NOW), '5 Jan 2027');
cek('fmt kemarin', P.fmtDue('2026-07-31', null, NOW), 'Kemarin');
cek('fmt panjang', P.fmtPanjang('2026-08-17'), 'Senin, 17 Agustus 2026');
cek('label ulang harkerja', P.repeatLabel({ unit: 'week', interval: 1, wd: [1, 2, 3, 4, 5] }), 'tiap hari kerja');
cek('label ulang 3 bulan', P.repeatLabel({ unit: 'month', interval: 3, wd: null }), 'tiap 3 bulan');

/* ---------- hasil ---------- */
console.log(pesan.join('\n'));
console.log('\n' + lolos + ' lolos, ' + gagal + ' gagal, total ' + (lolos + gagal));
process.exit(gagal ? 1 : 0);
