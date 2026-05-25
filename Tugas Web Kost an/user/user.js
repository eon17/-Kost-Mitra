// 1. Inisialisasi Koneksi ke Supabase
const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// 2. Fungsi Utama untuk Menarik dan Menampilkan Data
// =========================================================================
// RENDER GRID KAMAR DENGAN SINKRONISASI JSON FOTO & PEMBATASAN 3 AMENITIES
// =========================================================================
async function tampilkanKamarUser() {
  // Ambil email aktif dari LocalStorage
  const emailLogin =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  if (emailLogin) {
    try {
      // --- A. SYNC DATA PROFIL TERBARU ---
      const { data: profile, error: profileError } = await supabaseClient
        .from("Users")
        .select("id, name, avatar_url")
        .eq("email", emailLogin)
        .single();

      if (profile && !profileError) {
        sessionStorage.setItem("user_name", profile.name);
        const myId = parseInt(profile.id);

        // --- B. CEK APAKAH USER SUDAH PUNYA KAMAR (Untuk Role di Navbar) ---
        const { data: myRoom } = await supabaseClient
          .from("Rooms")
          .select("room_number")
          .eq('"user.id"', myId) // Menggunakan format kolom yang sama dengan kamarsaya.js
          .maybeSingle();

        if (myRoom) {
          window.currentRoomNumber = myRoom.room_number;
        } else {
          window.currentRoomNumber = null;
        }

        // --- C. SYNC FOTO PROFIL ---
        if (profile.avatar_url) {
          let finalFoto;
          if (profile.avatar_url.startsWith("http")) {
            finalFoto = profile.avatar_url;
          } else {
            const { data } = supabaseClient.storage
              .from("avatars")
              .getPublicUrl(profile.avatar_url);
            finalFoto = data.publicUrl;
          }
          sessionStorage.setItem("user_avatar", finalFoto);
        }

        // Update Navbar segera setelah data profile siap
        updateProfilNavbar();
      }
    } catch (err) {
      console.error("Gagal sinkron profil di user.js:", err);
    }
  }

  // --- D. RENDER GRID KAMAR (LOGIKA UTAMA USER.JS) ---
  const roomGrid = document.getElementById("room-grid");
  if (!roomGrid) return;

  roomGrid.innerHTML = "<p>Memuat data kamar...</p>";

  const { data: roomsData, error } = await supabaseClient
    .from("Rooms")
    .select(`*, room_facility (facilities (facility_name))`)
    .order("room_number", { ascending: true });

  if (error) {
    roomGrid.innerHTML = "<p>Gagal memuat data kamar.</p>";
    return;
  }

  roomGrid.innerHTML = "";
  let jumlahAvailable = 0;
  let totalHarga = 0;
  let jumlahKamarValid = 0;

  roomsData.forEach((room) => {
    const isAvailable =
      room.status === "Tersedia" ||
      room.status === "Kosong" ||
      room.status === "Available";
    if (isAvailable) jumlahAvailable++;

    // --- PARSING JSON FOTO (KATEGORI KAMAR) ---
    let imageUrl =
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af";

    if (room.foto_kamar) {
      try {
        const fotoString = room.foto_kamar.trim();
        if (fotoString.startsWith("{")) {
          const objekFoto = JSON.parse(fotoString);
          if (objekFoto.kamar && objekFoto.kamar.length > 0) {
            imageUrl = objekFoto.kamar[0];
          } else if (objekFoto.umum && objekFoto.umum.length > 0) {
            imageUrl = objekFoto.umum[0];
          }
        } else {
          const kepinganFoto = fotoString
            .split(",")
            .map((url) => url.trim())
            .filter((url) => url !== "");
          if (kepinganFoto.length > 0) imageUrl = kepinganFoto[0];
        }
      } catch (e) {
        console.error("Gagal urai foto_kamar kamar " + room.room_number, e);
      }
    }

    // Helper penentu icon Phosphor
    function getIcon(namaFasilitas) {
      const name = namaFasilitas.toLowerCase();
      if (name.includes("wifi")) return "ph-wifi-high";
      if (name.includes("ac")) return "ph-snowflake";
      if (name.includes("mandi")) return "ph-bathtub";
      if (name.includes("tv")) return "ph-television";
      if (name.includes("meja")) return "ph-desktop";
      if (name.includes("kasur") || name.includes("bed")) return "ph-bed";
      if (name.includes("lemari")) return "ph-door";
      return "ph-check-circle";
    }

    // =========================================================================
    // LOGIKA TERBARU: LIMITASI MAKSIMAL 3 FASILITAS DI KARTU KAMAR
    // =========================================================================
    let amenitiesHTML = "";

    if (room.room_facility && room.room_facility.length > 0) {
      const totalFasilitas = room.room_facility.length;

      // Ambil maksimal 3 item pertama saja dari total array fasilitas
      const fasilitasTerlimit = room.room_facility.slice(0, 3);

      fasilitasTerlimit.forEach((rf) => {
        if (rf.facilities) {
          const facName = rf.facilities.facility_name;
          amenitiesHTML += `<span><i class="ph ${getIcon(facName)}"></i> ${facName}</span>`;
        }
      });

      // Jika total fasilitas bawaan kamar di database lebih dari 3, pasang info +sisanya
      if (totalFasilitas > 3) {
        const sisaFasilitas = totalFasilitas - 3;
        amenitiesHTML += `<span class="more-amenities">+${sisaFasilitas} Lainnya</span>`;
      }
    } else {
      amenitiesHTML = `<span><i class="ph ph-info"></i> Belum ada info fasilitas</span>`;
    }
    // =========================================================================

    let numPrice = Number(String(room.price || 0).replace(/\./g, ""));
    if (numPrice > 0 && numPrice < 10000) numPrice *= 1000;
    if (numPrice > 0) {
      totalHarga += numPrice;
      jumlahKamarValid++;
    }

    const formattedPrice = new Intl.NumberFormat("id-ID").format(numPrice);

    roomGrid.innerHTML += `
    <div class="room-card">
      <div class="img-container">
        <img src="${imageUrl}" alt="Kamar ${room.room_number}" onerror="this.src='https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af';" />
        <span class="badge ${isAvailable ? "available" : "booked"}">
          ${isAvailable ? "Tersedia" : "Terisi"}
        </span>
      </div>
      <div class="room-details">
        <div class="price-row">
          <h3>Kamar ${room.room_number}</h3>
          <p class="price">Rp ${formattedPrice} <span>/ bln</span></p>
        </div>
        <p class="loc"><i class="ph ph-map-pin"></i> Lantai ${room.floor || "-"} • Luas: ${room.room_size || "-"}</p>
        <div class="amenities">${amenitiesHTML}</div>
        <div class="actions">
          <button class="btn-detail" onclick="viewDetail('${room.id}')">Lihat Detail</button>
          <button 
            class="${isAvailable ? "btn-book" : "btn-waitlist"}"
            onclick="${isAvailable ? `pesanSekarang('${room.id}', '${room.room_number}')` : ""}"
            ${!isAvailable ? "disabled" : ""}
          >
            ${isAvailable ? "Pesan Sekarang" : "Terisi"}
          </button>
        </div>
      </div>
    </div>`;
  });

  // Update Stats Area
  if (document.getElementById("stat-available")) {
    document.getElementById("stat-available").innerText =
      `${jumlahAvailable} Kamar`;
  }
  if (document.getElementById("stat-avg")) {
    let avg =
      jumlahKamarValid > 0 ? Math.round(totalHarga / jumlahKamarValid) : 0;
    document.getElementById("stat-avg").innerText =
      `Rp ${new Intl.NumberFormat("id-ID").format(avg)}`;
  }
}

// --- FUNGSI UPDATE NAVBAR (WAJIB SAMA DENGAN KAMARSAYA.JS) ---
window.updateProfilNavbar = function () {
  const nama = sessionStorage.getItem("user_name");
  const foto = sessionStorage.getItem("user_avatar");

  const namaEl = document.getElementById("namaUser");
  const roleEl = document.getElementById("roleUser");
  const fotoEl = document.getElementById("fotoProfil");

  if (namaEl && nama) namaEl.innerText = nama;
  if (roleEl) {
    roleEl.innerText = window.currentRoomNumber
      ? `Penghuni Kamar ${window.currentRoomNumber}`
      : "User";
  }
  if (fotoEl && foto && foto !== "null" && foto !== "") {
    fotoEl.src = foto;
  }
};

// Event Listener
document.addEventListener("DOMContentLoaded", tampilkanKamarUser);

// Navigasi Detail
window.viewDetail = (id) => (window.location.href = `infokamar.html?id=${id}`);

// Fungsi Pesan Kamar (Tetap Sama)
window.pesanSekarang = async function (roomId, roomNumber) {
  const emailLogin =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  if (!emailLogin) {
    alert("Login dulu bre!");
    window.location.href = "../LoginPage/login.html";
    return;
  }

  try {
    // 1. Ambil ID dan Nama User (Nama diambil untuk pesan WA)
    const { data: user } = await supabaseClient
      .from("Users")
      .select("id, name")
      .eq("email", emailLogin)
      .single();

    // 2. Cek apakah ada pesanan pending
    const { data: cekPesanan } = await supabaseClient
      .from("rentals")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (cekPesanan) {
      alert("Sabar bre, pesanan lu sebelumnya masih diproses Admin!");
      return;
    }

    // 3. Insert data ke tabel rentals
    const { error: insertError } = await supabaseClient
      .from("rentals")
      .insert([{ user_id: user.id, room_id: roomId, status: "pending" }]);

    if (insertError) throw insertError;

    // --- LOGIKA WHATSAPP OTOMATIS ---
    const nomorAdmin = "6283872555646"; // Ganti dengan nomor WA Admin (awali 62)
    const pesan = `Halo Admin, saya baru saja memesan kamar melalui website.
    
*Detail Pesanan:*
- *Nama:* ${user.name}
- *Kamar:* ${roomNumber}
- *Status:* Menunggu Konfirmasi

Mohon segera diproses ya Admin, terima kasih!`;

    const linkWA = `https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesan)}`;

    // Beri tahu user, lalu arahkan
    alert(
      `Pesanan Kamar ${roomNumber} berhasil disimpan! Kamu akan diarahkan ke WhatsApp Admin.`,
    );

    // Buka WA di tab baru
    window.open(linkWA, "_blank");

    // Reload halaman utama agar UI terupdate (misal muncul status pending)
    location.reload();
  } catch (err) {
    console.error("Gagal pesan:", err);
    alert("Waduh, gagal pesan nih. Cek koneksi atau konsol bre.");
  }
};
