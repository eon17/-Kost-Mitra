// 1. Inisialisasi Koneksi ke Supabase Global
const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";

// Gunakan window agar bisa diakses di admin-rooms.js & admin-payments.js
window.supabaseClient = createClient(supabaseUrl, supabaseKey);

// --- PROTEKSI HALAMAN ADMIN ---
async function proteksiHalamanAdmin() {
  const emailAktif =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  if (!emailAktif) {
    window.location.href = "../LoginPage/loginadmin.html";
    return;
  }

  try {
    // PERBAIKAN: Gunakan window.supabaseClient agar konsisten
    const { data: user, error } = await window.supabaseClient
      .from("Users")
      .select("role")
      .eq("email", emailAktif)
      .single();

    if (error || !user || user.role.toLowerCase().trim() !== "admin") {
      throw new Error("Akses Ditolak");
    }

    const loader = document.getElementById("loading-screen");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => {
        loader.style.display = "none";
      }, 400);
    } else {
      document.body.style.display = "block";
    }
    console.log("Welcome back, Boss!");
  } catch (err) {
    window.location.href = "../LoginPage/loginadmin.html";
  }
}

proteksiHalamanAdmin();

// --- LOGOUT & TAB SYSTEM (Sudah Benar) ---
window.logoutAdmin = function () {
  if (confirm("Yakin mau keluar, Boss?")) {
    sessionStorage.clear();
    window.location.href = "../LoginPage/loginadmin.html";
  }
};

window.bukaTab = function (tabId, element) {
  sessionStorage.setItem("tab_aktif_admin", tabId);
  document
    .querySelectorAll(".admin-section")
    .forEach((sec) => sec.classList.remove("active"));
  document
    .querySelectorAll(".sub-nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const targetTab = document.getElementById("tab-" + tabId);
  if (targetTab) targetTab.classList.add("active");
  if (element) element.classList.add("active");
};

// --- SINKRONISASI AKTIVASI DATA ---
window.onload = () => {
  muatFasilitas();
  tampilkanKamar();
  tampilkanPendingRentals();
  tampilkanLaporanKerusakan();
  tampilkanKonfirmasiPembayaran();
  inisialisasiFilterRiwayat();
  tampilkanHistoryPembayaran();

  const tabTerakhir = sessionStorage.getItem("tab_aktif_admin");
  if (tabTerakhir) {
    const tombolTarget = document.querySelector(
      `.sub-nav-btn[onclick*="'${tabTerakhir}'"]`,
    );
    if (tombolTarget) bukaTab(tabTerakhir, tombolTarget);
  }
};
