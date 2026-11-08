/*
 * Konfigurasi publik aplikasi (setara .env NEXT_PUBLIC_*).
 * Isi nilai ini saat deploy, ATAU isi lewat Pengaturan → Supabase / Google Forms
 * (disimpan di browser guru). JANGAN pernah mengisi service_role key di sini.
 *
 *   SUPABASE_URL          → Project Settings → API → Project URL
 *   SUPABASE_ANON_KEY     → Project Settings → API → publishable / anon key
 *
 * Jika kosong, aplikasi berjalan dalam MODE DEMO (data contoh, ditandai jelas).
 */
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
