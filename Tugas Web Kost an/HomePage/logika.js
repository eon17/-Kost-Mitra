// 1. Inisialisasi Koneksi ke Supabase
const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// 2. Fungsi Utama untuk Menarik dan Menampilkan Data
async function tampilkanKamarUser() {
  const roomGrid = document.getElementById("room-grid");
  roomGrid.innerHTML = "<p>Memuat data kamar...</p>";

  const { data: roomsData, error } = await supabaseClient
    .from("Rooms")
    .select(
      `
      *,
      room_facility (
        facilities (
          facility_name
        )
      )
    `,
    )
    .order("room_number", { ascending: true });

  if (error) {
    console.error("Gagal mengambil data dari Supabase:", error);
    roomGrid.innerHTML =
      "<p>Gagal memuat data kamar. Silakan muat ulang halaman.</p>";
    return;
  }

  roomGrid.innerHTML = "";

  // 🚀 VARIABEL UNTUK MENGHITUNG STATISTIK
  let jumlahAvailable = 0;
  let totalHarga = 0;
  let jumlahKamarValid = 0;

  roomsData.forEach((room) => {
    // -----------------------------------------
    // A. LOGIKA STATUS & HITUNG KAMAR AVAILABLE (UPDATE)
    // -----------------------------------------
    // Kita tambahkan pengecekan "Tersedia" agar sinkron dengan Admin
    const isAvailable =
      room.status === "Tersedia" ||
      room.status === "Available" ||
      room.status === "Kosong";

    const badgeClass = isAvailable ? "available" : "booked";
    const btnClass = isAvailable ? "btn-book" : "btn-waitlist";

    // UBAH TEKS DI SINI
    const statusText = isAvailable ? "Tersedia" : "Terisi";
    const btnText = isAvailable ? "Pesan Sekarang" : "Penuh"; // Sekalian di-Indonesiakan biar konsisten

    // Jika kamar tersedia, tambah 1 ke statistik
    if (isAvailable) {
      jumlahAvailable++;
    }

    const imageUrl =
      room.foto_kamar ||
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af";

    // -----------------------------------------
    // B. LOGIKA FASILITAS
    // -----------------------------------------
    let amenitiesHTML = "";
    function getIcon(namaFasilitas) {
      const name = namaFasilitas.toLowerCase();
      if (name.includes("wifi")) return "ph-wifi-high";
      if (name.includes("ac")) return "ph-snowflake";
      if (name.includes("mandi") || name.includes("bath")) return "ph-bathtub";
      if (name.includes("tv")) return "ph-television";
      if (name.includes("meja") || name.includes("desk")) return "ph-desktop";
      if (
        name.includes("kasur") ||
        name.includes("bed") ||
        name.includes("spring")
      )
        return "ph-bed";
      if (name.includes("lemari")) return "ph-door";
      return "ph-check-circle";
    }

    if (room.room_facility && room.room_facility.length > 0) {
      room.room_facility.forEach((rf) => {
        if (rf.facilities) {
          const facName = rf.facilities.facility_name;
          amenitiesHTML += `<span><i class="ph ${getIcon(facName)}"></i> ${facName}</span>`;
        }
      });
    } else {
      amenitiesHTML = `<span><i class="ph ph-info"></i> Belum ada info fasilitas</span>`;
    }

    // -----------------------------------------
    // C. LOGIKA HARGA & HITUNG RATA-RATA
    // -----------------------------------------
    let rawPrice = room.price || 0;
    if (typeof rawPrice === "string") {
      rawPrice = rawPrice.replace(/\./g, "");
    }
    let numPrice = Number(rawPrice);
    if (numPrice > 0 && numPrice < 10000) {
      numPrice = numPrice * 1000;
    }

    // Hitung total harga untuk statistik (hanya hitung jika harganya valid / lebih dari 0)
    if (numPrice > 0) {
      totalHarga += numPrice;
      jumlahKamarValid++;
    }

    const formattedPrice = new Intl.NumberFormat("id-ID").format(numPrice);

    // -----------------------------------------
    // D. RENDER HTML CARD KAMAR
    // -----------------------------------------
    const roomCard = `
      <div class="room-card">
        <div class="img-container">
          <img src="${imageUrl}" alt="Kamar ${room.room_number}" />
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>
        <div class="room-details">
          <div class="price-row">
            <h3>Kamar ${room.room_number}</h3>
            <p class="price">Rp ${formattedPrice} <span>/ bln</span></p>
          </div>
          <p class="loc">
            <i class="ph ph-map-pin"></i> Lantai ${room.floor || "-"} • Luas: ${room.room_size || "-"}
          </p>
          <div class="amenities">
            ${amenitiesHTML}
          </div>
          <div class="actions">
           <button class="btn-detail" onclick="window.location.href='../LoginPage/login.html'">
    Lihat Detail
</button>
            <button class="${btnClass}" onclick="${isAvailable ? "window.location.href='../LoginPage/login.html'" : ""}">
  ${btnText}
</button>
          </div>
        </div>
      </div>
    `;

    roomGrid.innerHTML += roomCard;
  });

  // -----------------------------------------
  // E. TAMPILKAN STATISTIK KE HTML (BAGIAN ATAS)
  // -----------------------------------------

  // Format harga rata-rata ke Rupiah
  const formattedAvg = new Intl.NumberFormat("id-ID").format(
    Math.round(rataRataHarga),
  );
  document.getElementById("stat-avg").innerText = `Rp ${formattedAvg}`;
}

// Jalankan saat web dibuka
document.addEventListener("DOMContentLoaded", () => {
  tampilkanKamarUser();
});

// Fungsi tombol View Detail (Di dalam file user.js)
window.viewDetail = function (roomId) {
  // Pindah ke halaman detail dengan membawa ID kamar di URL
  window.location.href = `/user/infokamar.html?id=${roomId}`;
};
