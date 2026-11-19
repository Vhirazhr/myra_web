# Pengujian MYRA

## Menjalankan suite lokal

Jalankan PostgreSQL, Auth, PostgREST, Storage, Realtime, dan Edge Functions dari Supabase lokal. Gunakan project lokal yang dapat menampung akun pengujian sementara. Fixture menolak project URL selain localhost atau 127.0.0.1. Setiap run membuat akun unik melalui Admin API, mengunggah file privat untuk tes, lalu membersihkan akun dan objek uji.

1. Gunakan `supabase start`, pasang migrasi, dan jalankan fungsi sesuai README. Ambil konfigurasi lokal dari `supabase status` hanya di terminal pribadi. Pastikan Auth mengizinkan login email untuk akun terverifikasi. Jalankan frontend pada project lokal yang sama.
2. Pada proses yang menjalankan Playwright, ekspor `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` untuk **stack lokal**. Pasang Chromium memakai `pnpm exec playwright install chromium` atau tetapkan `MYRA_E2E_BROWSER` ke executable yang tersedia.
3. Tetapkan `MYRA_E2E_WEB_URL` bila alamat frontend berbeda dari `http://127.0.0.1:8443`. Untuk menguji bundle produksi, build dengan env frontend lokal lalu jalankan `pnpm preview`.
4. Untuk tes AI, sediakan satu adapter sungguhan dengan secret di proses Edge Function. Pada proses tes, set `MYRA_E2E_ADAPTER` dan `MYRA_E2E_MODEL`. Pengujian implementasi memakai llama.cpp dengan Qwen2.5-0.5B-Instruct di balik endpoint OpenAI-compatible lokal. Provider juga bisa diarahkan ke endpoint berbayar yang dikonfigurasikan pemilik. Tes mengirim prompt dan mengharapkan jawaban model.
5. Untuk tes worker, sediakan nilai `MYRA_WORKER_TOKEN` yang sama bagi runner dan Edge Function. Jalankan perintah berikut.

```sh
pnpm typecheck
pnpm build
pnpm test
```

Suite melewati tes inference bila model tidak dikonfigurasi, dan melewati tes worker bila token worker tidak tersedia. Periksa jumlah **passed** dan **skipped** ketika membandingkan run.

## Cakupan

| Skenario | Bukti yang diperiksa |
| --- | --- |
| Login, sesi, pemulihan | URL privat meminta login, sesi bertahan saat refresh, akun baru tanpa admin ditolak, password baru menggantikan password lama setelah recovery terverifikasi |
| Karakter dan universe | UI menyimpan edit profil, roster, lore dan timeline ke database |
| Grup dan sosial | Mode dan anggota bertahan, graph membaca relasi, perubahan trust menciptakan riwayat |
| Stories | PNG diunggah ke bucket privat, story dipublikasikan, byte diunduh, view, like dan reply tersimpan |
| AI dan memory | Tes koneksi memanggil provider, pesan pengguna tersimpan, preferensi yang disimpan secara eksplisit digunakan model pada percakapan baru |
| Realtime | Tab yang tetap terbuka menerima karakter baru setelah tab kedua menyimpannya |
| Isolasi | Pengguna tanpa admin dan admin lain ditolak untuk data privat, foreign key menolak relasi lintas pemilik, lore universe dan crossover terpisah |
| Simulasi dan restore | Jadwal dieksekusi sekali, mood dan milestone tersimpan, pause berfungsi, snapshot mengembalikan karakter dan diary yang dihapus |
| Worker dan notifikasi | Worker dipanggil lewat HTTP tanpa browser, menghormati quiet hours, lalu mengirim pesan proaktif dan mencatat notifikasi ketika diizinkan |
| Persistensi | Browser baru yang login kembali membaca record, media, dan aktivitas story sebelumnya |

## Pemeriksaan database dan server

Terapkan seluruh file `supabase/migrations` sesuai urutannya pada database Supabase kosong. Jalankan pemeriksaan tanpa mengubah data aplikasi.

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/access.sql
deno check --no-lock --node-modules-dir=none supabase/functions/myra/index.ts supabase/functions/worker/index.ts
```

Validasi lokal mencakup migrasi pada database kosong dengan schema Auth dan Storage yang sesuai, 27 tabel publik dengan RLS, enam bucket privat, grant fungsi khusus worker, dan publication Realtime.

## Verifikasi eksternal yang masih diperlukan

Untuk menerima deployment produksi, ulangi smoke test di staging milik owner dengan domain HTTPS, callback email dan akun admin nyata. Verifikasi OpenRouter/OpenAI pilihan owner, latensi panggilan dan audio dua arah, push ke perangkat Android, serta pemanggilan cron cloud. Pengujian recovery lokal memakai link yang diterbitkan oleh Supabase Auth. Pengiriman email publik, Vercel, perangkat Android, dan provider voice berbayar memerlukan infrastruktur masing-masing.
