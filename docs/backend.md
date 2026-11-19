# Backend, scheduler, dan Android

## Akses aplikasi

MYRA menggunakan proyek Supabase `splifnxylqaicneodkaj`. Web ini ditujukan untuk administrator yang diprovisikan owner. Setiap akun admin memiliki workspace privat. Banyak karakter dapat menjadi anggota sebuah grup dalam satu workspace. Aplikasi Android pribadi dapat masuk dengan akun admin yang sama. Untuk membuka aplikasi konsumen bagi akun non-admin, diperlukan kebijakan akses produk dan model keanggotaan pengguna tersendiri.

Semua tabel aplikasi di schema publik memakai RLS. Kunci asing komposit mengikat relasi dengan owner. Operasi berprivilege seperti penyelesaian turn, pencatatan usage, dan worker diperuntukkan untuk role server. Endpoint `myra` memvalidasi access token ke Auth dan memeriksa keanggotaan admin. Endpoint `worker` memakai token scheduler tersendiri.

## Percakapan pada Android

1. Gunakan Supabase SDK dengan project URL serta publishable key yang sama. Login lewat email dan password, pertahankan session lewat fasilitas SDK.
2. Baca `characters`, `universes`, `groups`, dan `conversations` memakai JWT pengguna. Untuk percakapan baru, isi `name` dan tepat satu dari `character_id` atau `group_id`. Pilihan `universe_id` dan `crossover_id` saling eksklusif.
3. Simpan pesan dengan `conversation_id`, `role=user`, dan `body`. Tambahkan `reply_to`, `mentions`, serta `memory_mode` bila diperlukan. Media diunggah ke bucket privat `conversation-media` dengan path `<auth.uid()>/<uuid>.<ext>`. Simpan path dan MIME pada pesan, gunakan signed URL untuk playback.
4. Panggil `POST /functions/v1/myra` dengan header `apikey`, `Authorization: Bearer <user JWT>`, dan JSON `{"action":"generate","id":"<ID pesan pengguna>"}`. Respons berisi ID pesan karakter. Retry menggunakan ID pesan yang sama. Untuk grup, mention memilih pembicara, dan maksimal delapan karakter menjawab setiap turn. Jika sebagian karakter sudah menjawab, percobaan berikutnya melanjutkan peserta yang tersisa.
5. Dengarkan perubahan pada `messages`, `message_reactions`, `notifications`, dan `story_activity`. Setelah reconnect, ambil kembali data sejak halaman terakhir. Logout harus menghapus cache private client tersebut.
6. Untuk feed story, panggil `story_feed` dengan `for_group`, `for_universe`, atau keduanya null untuk feed pribadi. RPC menyaring waktu publikasi, masa berlaku, dan audience.
7. Untuk push, simpan token FCM perangkat di `devices` milik pengguna. Saat token berubah, perbarui record. Saat logout, hapus token perangkat tersebut. Gunakan `notification_id` untuk deduplikasi di perangkat dan buka percakapan setelah pemeriksaan session.

### Operasi Edge

| Action di `myra` | `id` | Hasil |
| --- | --- | --- |
| `generate` | Pesan pengguna | Balasan personal atau grup dan memory persisten |
| `test-google` | Tidak diperlukan | Uji koneksi Gemini memakai `GEMINI_API_KEY` server |
| `summarize` | Percakapan | Ringkasan 32 pesan terbaru, disimpan pada scope percakapan |
| `generate-story` | Karakter | Draft dengan caption dari model |
| `voice-note` | Pesan asisten | Audio Gemini TTS disimpan sebagai WAV di bucket privat |
| `transcribe` | Pesan audio | Transkripsi Gemini tersimpan |
| `live-token` | Karakter | Token Gemini Live sekali pakai, ID catatan call, dan model Live; instruksi karakter dikunci di backend |
| `simulation` | Tidak diperlukan | Jumlah jadwal dan event yang dieksekusi untuk owner |

Untuk panggilan suara, backend membuat token Gemini Live sekali pakai dengan masa mulai satu menit dan masa sesi 30 menit. Token dibatasi ke model dan instruksi karakter; API key Google tidak pernah dikirim ke browser. Browser membuka WebSocket Live API dengan token sementara, mengirim audio PCM mikrofon, dan memutar audio PCM yang diterima. Status call dicatat di tabel `calls`. Voice note memakai Gemini TTS, sedangkan transkripsi memakai Gemini multimodal input. Gambar dalam chat dapat dikirim ke Gemini melalui signed URL berumur pendek.

## Aktifkan scheduler di Supabase Cloud

Deploy kedua Edge Functions. Simpan secret worker yang sama di Edge Function Secrets sebagai `MYRA_WORKER_TOKEN` dan di Vault sebagai `myra_worker_token`. Tambahkan Vault secret `myra_worker_url` dengan nilai `https://splifnxylqaicneodkaj.supabase.co/functions/v1/worker`. Lalu jalankan [SQL penjadwalan](../supabase/ops/enable_scheduler.sql) di SQL Editor. Skrip membuat satu job bernama `myra-worker` yang memanggil worker setiap menit.

Aktifkan simulation di UI, buat jadwal dalam zona waktu owner, lalu periksa **Last backend tick** dan diary. Satu jadwal dieksekusi sekali per hari lokal. Untuk pesan proaktif, aktifkan preferensi global dan pengaturan pada percakapan personal. Untuk FCM, diperlukan service account serta minimal satu token perangkat. Push dapat dikirim ulang jika jaringan putus tepat setelah FCM menerima pesan. ID notifikasi mendukung deduplikasi.

Untuk memeriksa scheduler, lihat `cron.job_run_details`, respons pg_net, dan log Edge Function. Waktu tick manual pada UI juga dicatat. Untuk menonaktifkan pemanggilan terjadwal, gunakan `select cron.unschedule('myra-worker')`.

## Cadangan dan pemulihan

Snapshot aplikasi menyalin data domain milik akun dalam satu transaksi. Restore hanya memasukkan record dengan ID yang belum ada. Snapshot menyimpan referensi media. Objek Storage, akun Auth, token perangkat, secret, dan konfigurasi deployment dikelola terpisah.

Untuk disaster recovery, aktifkan backup PostgreSQL atau PITR sesuai paket Supabase, dan buat salinan terpisah dari enam bucket privat melalui Supabase Storage S3 endpoint atau Storage API. Saat melakukan pemulihan penuh, pulihkan database dan object Storage dari waktu yang selaras. Restore ke proyek staging terlebih dahulu dan verifikasi signed URL, login, dan satu turn chat.

## Google AI configuration

Simpan satu secret server-side bernama `GEMINI_API_KEY` dari Google AI Studio. Model default: `gemini-3.6-flash` untuk chat/memory/proactive/transcription, `gemini-3.8-live` untuk panggilan, dan `gemini-3.8-flash-tts` untuk voice note. Model dapat diubah lewat `GEMINI_CHAT_MODEL`, `GEMINI_LIVE_MODEL`, dan `GEMINI_TTS_MODEL` secrets. Jangan pernah menaruh key dalam `VITE_*` atau mengirimkannya ke browser.

Foto dan video karakter dibuat melalui Google Flow dengan login Google AI Plus, lalu diunduh dan diimpor ke Character Media Studio. Flow tidak menyediakan API publik Google untuk memanggil langganan Plus secara langsung dari MYRA. MYRA dapat mengirim media yang sudah diimpor ke percakapan.
