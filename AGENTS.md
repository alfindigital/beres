# AGENTS.md - beres.

Aturan untuk AI mana pun yang menyentuh folder ini. Baca `HANDOFF.md` untuk konteks penuh.

## Wajib
- Bahasa Indonesia casual, suara "aku". **Jangan pakai em dash.**
- Vanilla HTML/CSS/JS. **Nol dependency, nol build step, nol framework.** Jangan tambahkan npm install.
- Sebelum bilang selesai: `node test-parse.js` harus **82 lolos, 0 gagal**, dan konsol browser nol error.
- "Selesai" berarti sudah dijalankan dan dilihat hasilnya di browser sungguhan. Bukan asumsi.
- Bukan git. Jangan `git init`, jangan bikin branch.

## Rilis: naikkan 3 tempat SEKALIGUS
`index.html` (3 query), `sw.js` (3 query), dan `CACHE = 'beres-vN'` di `sw.js`.
Lupa satu = user terjebak versi lama. Sudah kejadian.

## Deploy
`node tools/build-dist.js` lalu deploy **folder `dist`**, jangan `.`
`.assetsignore` tidak bekerja di Cloudflare Pages. Verifikasi kebocoran pakai isi respons,
bukan status code (SPA fallback mengembalikan 200 untuk path tak dikenal).

## Jangan diubah tanpa alasan kuat
- Metafora fokus = **deret tick habis dari kanan**. Bukan ring lingkaran.
- `--a-txt` terpisah dari `--a`. Aksen cerah sebagai teks di latar terang gagal WCAG (1.29:1).
- Timer pakai **deadline timestamp**, bukan counter yang dikurangi. Tab background di-throttle.
- Penanda topeng di `parse.js` = EN QUAD. **Jangan ganti jadi `\0`** (bikin file jadi biner)
  atau spasi biasa (bikin semua spasi judul hilang).
- Data benih dibuat lewat `seed()`, bukan `addTask()`. Kalau lewat `addTask()`, teks contoh
  ikut diparse dan bikin proyek liar.

## Jangan ditawarkan lagi
Ring progress, Inter/Poppins, gradien ungu, emoji sebagai ikon, backend/akun/sinkron cloud.
