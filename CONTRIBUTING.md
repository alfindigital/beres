# Panduan Kontribusi

1. Fork repo ini
2. Buat branch: feat/fitur, fix/bug, docs/perubahan
3. Commit: feat: deskripsi, fix: deskripsi
4. Buka Pull Request

```bash
# Nol dependency, jadi tidak ada npm install.
python -m http.server 4830   # jalanin app, lalu buka http://localhost:4830
node test-parse.js           # harus: 82 lolos, 0 gagal
node tools/test-ketahanan.js # harus: 18 tahan, 0 jebol
node tools/build-dist.js     # build dist/ untuk deploy
```

Jangan commit .env*, API key, atau credential. Lisensi: [MIT](LICENSE).
