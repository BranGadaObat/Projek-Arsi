# PROGRESS

Status terakhir: **Fase 0–5 selesai, Fase 6 (push) menunggu URL repository dari manusia.**

Tanggal verifikasi: 25 Oktober 2026.

## Hasil verifikasi

| Perintah | Hasil |
| --- | --- |
| `npm install` | OK (prisma generate jalan lewat `postinstall`) |
| `npm run typecheck` | OK — shared, server, client tanpa error |
| `npm test` | OK — shared 21 test, server 36 test, client 5 test (62 total) |
| `npm run build` | OK — bundle client 409 kB (gzip 121 kB) |
| `npm run dev` | OK — `http://localhost:3001/api/health` → `{"status":"ok"}`, `http://localhost:5173` → 200 |
| `npm run db:seed` | OK — proyek contoh, 17 tugas, 4 anggota, 2 hari libur |

## Status fase

- [x] Fase 0: Fondasi monorepo, tsconfig, Vite + Tailwind, Express `/api/health`, skrip root, `.gitignore`, `.env.example`
- [x] Fase 1: Mesin inti `shared` (tanggal, kalender, durasi, dependensi, roll-up, recompute, drag, CPM, PERT, biaya) + vektor uji 6.11
- [x] Fase 2: Backend (skema Prisma + migrasi, auth, seluruh rute Bagian 7, recompute/snapshot, middleware, cek kepemilikan, seed) + test integrasi
- [x] Fase 3: Frontend Bagian 8 lengkap + test komponen (bar Gantt & panah dependensi, validasi form tugas, penandaan node kritis PERT)
- [x] Fase 4: `install`, `typecheck`, `test`, `build` lolos; `npm run dev` berjalan dan respons
- [x] Fase 5: `.gitignore` mencakup `node_modules`, `dist`, `.env`, `*.db`, `coverage`; `README.md` sesuai kenyataan; pemindaian rahasia dilakukan (tidak ada token/password nyata yang ter-commit; `.env` dan `*.db` ter-ignore)
- [ ] Fase 6: Push ke GitHub — menunggu URL repository `https://github.com/USERNAME/gantt-project-app.git`

## Acceptance checklist (Bagian 12)

### Tugas

- [x] Tambah, ubah, dan hapus tugas berhasil — `server/src/tests/tasks.test.ts`
- [x] Durasi, tanggal mulai, prioritas, dan warna tersimpan — `tasks.test.ts`
- [x] Sub-tugas (parent-child) bisa dibuat, dan induk menghitung rentang serta progres otomatis — `tasks.test.ts` + unit `shared`

### Dependensi dan Gantt

- [x] Predecessor FS dan SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11 — `shared/src/engine.test.ts` + `server/src/tests/dependencies.test.ts`
- [x] Bar Gantt tampil, ada panah dependensi (FS dan SS) — `client/src/components/gantt/GanttChart.test.tsx`
- [ ] Bar bisa di-drag serta di-resize — implementasi ada (preview `shared`, PATCH saat dilepas), **belum diuji manual di browser**
- [x] Dependensi yang membentuk siklus ditolak dengan pesan jelas (`CYCLE_DETECTED`) — `dependencies.test.ts`

### Resource

- [x] Tambah anggota tim (nama, email, peran, gaji) dan alokasikan ke tugas — `analysis.test.ts`, `tasks.test.ts`
- [x] Biaya dan peringatan over-alokasi muncul benar — `analysis.test.ts` (5 hari over-alokasi terdeteksi)

### Kalender

- [x] Ubah akhir pekan dan tambah hari libur, lalu jadwal bergeser otomatis — `calendar.test.ts`
- [x] Durasi tidak menghitung akhir pekan dan hari libur — vektor uji 6.11 + `calendar.test.ts`

### Analisis

- [x] Halaman Analisis menampilkan Critical Path dan diagram PERT, node kritis berwarna merah — `PertDiagram.test.tsx` (node & panah kritis ditandai), halaman `AnalysisPage`

### Persistensi dan akun

- [x] Data tidak hilang saat halaman di-refresh (SQLite via Prisma)
- [x] Register, login, dan logout berfungsi, pengguna A tidak bisa melihat data pengguna B — `auth.test.ts`, `access.test.ts`

### Repository

- [x] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`
- [x] `node_modules`, `.env`, dan file database tidak ikut ter-commit (`.gitignore`; repo belum di-init — Fase 6)
- [x] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error

## Catatan / sisa pekerjaan

- Fase 6: `git init`, commit, dan push memerlukan URL repository dari manusia (lihat Bagian 10 blueprint).
- Item drag/resize Gantt dan tampilan responsif perlu uji manual di browser (belum diverifikasi lewat screenshot).
