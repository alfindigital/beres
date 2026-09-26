# beres.

To do list Bahasa Indonesia. Offline, tanpa akun, tanpa iklan.

## Jalankan

Buka `index.html` langsung di browser. Selesai.

Kalau mau lewat server lokal (biar service worker dan PWA aktif):
```bash
cd beres
python -m http.server 4830
```
lalu buka http://localhost:4830

## Kenapa ini beda

Todoist dan TickTick maksa bahasa Inggris untuk quick-add. Di sini kamu ketik seperti
ngomong biasa:

```
bayar kos besok jam 9 !p1 #keuangan @wa tiap bulan
```

Satu kalimat itu jadi: judul "bayar kos", tenggat besok 09:00, prioritas 1, proyek
keuangan, label wa, ulang tiap bulan. Nol klik.

Yang dimengerti parser:

| Kategori | Contoh |
|---|---|
| Relatif | hari ini, besok, bsk, lusa, kemarin, minggu depan, bulan depan, akhir bulan, 3 hari lagi |
| Hari | senin, jumat, jum'at, sabtu depan |
| Tanggal | 15 agustus, 15 agu, 5/9, 31/12/26, tgl 25, des 25 |
| Jam | jam 9, jam 9 malam, jam 3 pagi, 14.30, 19:00, 6pm, jam setengah 9 |
| Waktu kabur | besok pagi, nanti sore, nanti malam, siang ini |
| Ulang | tiap hari, tiap senin, tiap hari kerja, tiap 3 bulan, mingguan |
| Prioritas | !p1 sampai !p4, atau p1 |
| Proyek | #keuangan |
| Label | @wa (boleh banyak) |

Yang sengaja TIDAK diparse: `budi@gmail.com` tetap utuh, `tanggal 32` dan `jam 99`
dibiarkan sebagai teks.

## Isi lainnya

- Geser kartu ke kanan = kelar, ke kiri = hapus. Ada undo.
- Timer fokus 5/15/25/50 menit. Metafora deret tick habis dari kanan, bukan ring.
- Streak harian, grafik 7 hari terakhir, sisa tugas per proyek.
- 4 aksen warna, tema gelap dan terang, semua lolos kontras WCAG AA.
- Pintasan: `1`-`5` pindah tampilan, `n` tugas baru, `/` cari, `f` fokus, `Esc` tutup.
- Ekspor/impor JSON. Data cuma di HP/laptop kamu, tidak ke mana-mana.

## Tes

```bash
node test-parse.js
```
Harus: `82 lolos, 0 gagal`.

## Dokumen lain

`HANDOFF.md` (dokumen internal, tidak ikut di repo ini) untuk konteks lengkap, hasil verifikasi, dan cacat yang sudah diperbaiki.
`AGENTS.md` untuk aturan AI yang menyentuh kode ini.

---
Dibuat untuk dipakai sendiri. @alfindigital
