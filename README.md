# MYRA

Dashboard privat untuk mengelola karakter AI, universe, percakapan personal dan grup, memory, stories, dan aktivitas karakter. Frontend React 19, Vite, dan TypeScript memakai Supabase Auth, PostgreSQL, Storage, Realtime, dan Edge Functions. Web dan klien Android mendatang memakai identitas, ID record, dan kebijakan akses yang sama.

## Sambungkan proyek Supabase myra

Project ref yang diberikan adalah `splifnxylqaicneodkaj`. Migrasi dapat dijalankan pada proyek baru. Selama pengembangan, pengujian memakai stack Supabase lokal yang terpisah dari cloud.

1. Pasang Supabase CLI dan pnpm 10.34.3. Gunakan Node 22.12+ atau Node 24. Jalankan `pnpm install --frozen-lockfile`.
2. Dari menu **Connect** pada dashboard proyek Supabase, salin publishable key ke `.env.local` mengikuti `.env.example`. Di Vercel, tetapkan dua variabel yang sama untuk environment tujuan.
3. Dari terminal atau CI tepercaya, sediakan `SUPABASE_ACCESS_TOKEN` dan `SUPABASE_DB_PASSWORD` lewat secret manager. Jalankan `bash scripts/deploy-backend.sh`. Script mengarah ke project ref di atas, menampilkan dry run, menerapkan migrasi, lalu men-deploy fungsi `myra` dan `worker`. Database, RLS, publication, dan enam bucket privat dibuat oleh migrasi.
4. Pada **Authentication** di proyek cloud, matikan public signup, tetapkan Site URL, dan izinkan URL pemulihan `https://DOMAIN-ADMIN/recover`. Konfigurasi SMTP untuk pengiriman email. Buat akun pemilik terverifikasi lewat **Authentication → Users**. Setelah itu, jalankan SQL berikut sebagai pemilik proyek di SQL Editor, dengan UUID akun sebenarnya.

```sql
insert into public.admin_access(user_id)
values ('<UUID akun dari Authentication>'::uuid)
on conflict do nothing;
```

5. Buat satu API key di [Google AI Studio](https://aistudio.google.com/apikey), lalu simpan hanya sebagai Supabase Edge Function Secret:
   ```sh
   pnpm exec supabase secrets set GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
   ```
   MYRA memakai `gemini-3.8-flash` untuk chat dan memori, `gemini-3.8-live` untuk voice call, serta `gemini-3.8-flash-lite-tts` untuk voice note. Model default dapat diubah melalui `GEMINI_CHAT_MODEL`, `GEMINI_LIVE_MODEL`, dan `GEMINI_TTS_MODEL`. Buka **Google AI Engine** dan pilih **Test Gemini connection**.
6. Hubungkan branch yang sudah direview ke Vercel dengan preset Vite, perintah `pnpm build`, dan direktori output `dist`. Setelah env frontend disimpan, buat deployment baru. Buka domain admin dan masuk memakai akun yang diprovisikan.

| Fitur | Secret di server |
| --- | --- |
| Gemini chat, memory, proactive, TTS, transcription, Live token | `GEMINI_API_KEY` (satu key) |
| Pekerja terjadwal | `MYRA_WORKER_TOKEN` acak, minimal 32 karakter |
| Push Android | `FIREBASE_SERVICE_ACCOUNT_JSON` dengan akses kirim FCM ke proyek aplikasi |

Jangan gunakan prefiks `VITE_` untuk Gemini API key. Kunci hanya disimpan di Edge Function Secrets; browser menerima token Live berumur pendek, bukan API key. Foto dan video karakter tetap memakai Google Flow melalui alur manual: salin prompt, buat media di Flow dengan akun Google AI Plus, unduh, lalu impor melalui Character Media Studio.

## Jalankan dan uji

```sh
pnpm dev
pnpm typecheck
pnpm build
```

Untuk pengujian lokal standar dengan Docker dan Supabase CLI, jalankan `supabase start` dari root repo. Untuk stack lokal yang sudah ada, jalankan `supabase migration up --local`. Konfigurasikan publishable atau anon key lokal, jalankan `supabase functions serve --env-file PATH_ENV_SERVER`, lalu buka Vite. CLI dapat melakukan konfirmasi port bila sudah dipakai oleh instance lain.

Lihat [panduan pengujian](docs/testing.md) untuk menjalankan Playwright pada Supabase lokal asli. [Kontrak backend](docs/backend.md) mencakup scheduler, backup, API Android, dan batas verifikasi layanan.

## Alur utama

- **Character Studio** menyimpan profil, portrait, personality, gaya bicara, voice, dan latar. Profil bisa diduplikasi, diarsipkan, dicari, atau dihapus. Universe dan grup menyimpan roster melalui transaksi database.
- **Conversations** menyimpan pesan pengguna sebelum memanggil model. Jika Gemini gagal atau kuota habis, pesan tetap tersedia. Tombol **Request response** mencoba kembali turn yang sama. Grup mendukung mode, mention, balasan antarkarakter, reply, reaksi, dan lampiran privat. Perubahan dari klien lain masuk lewat Realtime.
- **Memory Engine** mengelola tujuh scope. Model menerima riwayat terbatas dan hasil retrieval yang sesuai. Pengguna dapat menyimpan kutipan secara eksplisit, membatasi memory pada percakapan, melewati ekstraksi, dan mengedit atau menghapus memory.
- **Story Studio** mendukung draft dan waktu tayang, media privat, group/universe feed, like, view, reaction, reply, dan arsip. **Social Graph** membaca relasi nyata dan menyimpan perubahan trust dalam riwayat.
- **Life Simulation** menjalankan jadwal dan event melalui worker, mencatat mood dan diary, serta dapat menambah interaksi dan milestone. **Proactive Messaging** menghormati quiet hours dan interval. Android push menggunakan FCM ketika ada konfigurasi dan perangkat terdaftar.
- **Dashboard** membaca jumlah record, usage, estimasi biaya, storage dan aktivitas karakter. **Security** menampilkan audit. **Backup & Restore** menyimpan snapshot record per pemilik dan mengembalikan record yang hilang. Salinan byte media dan disaster recovery cloud dibahas di panduan backend.

Aplikasi Android diposisikan sebagai klien berikutnya. Deliverable branch ini adalah admin web dan backend bersama.
