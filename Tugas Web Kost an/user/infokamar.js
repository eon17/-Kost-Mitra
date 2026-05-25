// 1. Inisialisasi Koneksi ke Supabase
const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// Array global untuk menyimpan daftar foto yang valid agar bisa diakses oleh fungsi Lightbox
let daftarSemuaFoto = [];

// 2. Fungsi Ambil ID Kamar dari URL
function getRoomIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// --- FUNGSI PARSING DATA FOTO JSON (ANTI ERROR 404) ---
function bongkarFotoJSON(fotoString) {
  if (!fotoString) return [];
  try {
    // Jika formatnya JSON string beneran (dimulai dengan {)
    if (fotoString.trim().startsWith("{")) {
      const objekFoto = JSON.parse(fotoString);
      const fotoKamar = objekFoto.kamar || [];
      const fotoUmum = objekFoto.umum || [];
      return [...fotoKamar, ...fotoUmum].filter(
        (url) => url && url.trim() !== "",
      );
    }
    // Jika data lama berbentuk string pisah koma biasa
    return fotoString
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url !== "");
  } catch (e) {
    console.error("Gagal bongkar format foto:", e);
    return [fotoString];
  }
}

// 3. Fungsi Utama Merender Detail Kamar
async function muatDetailKamar() {
  const roomId = getRoomIdFromURL();

  if (!roomId) {
    alert("Kamar tidak ditemukan!");
    window.location.href = "user.html";
    return;
  }

  const { data: room, error } = await supabaseClient
    .from("Rooms")
    .select(
      `
      *,
      room_facility (
        facilities (
          facility_name,
          category
        )
      )
    `,
    )
    .eq("id", roomId)
    .single();

  if (error || !room) {
    console.error("Error/Data kosong:", error);
    document.getElementById("loading-text").innerText =
      "Gagal memuat data kamar.";
    return;
  }

  // Sembunyikan loading, tampilkan konten
  document.getElementById("loading-text").style.display = "none";
  document.getElementById("content-area").style.display = "block";

  // --- MENGISI DATA KE HTML ---
  document.getElementById("detail-title").innerText =
    `Kamar ${room.room_number}`;

  // =========================================================================
  // AMBIL DAN GABUNGKAN FOTO DINAMIS (MAKSIMAL 6 FOTO)
  // =========================================================================
  daftarSemuaFoto = bongkarFotoJSON(room.foto_kamar);

  const galleryContainer = document.getElementById("room-gallery-container");

  if (galleryContainer) {
    galleryContainer.innerHTML = ""; // Bersihkan dummy template

    if (daftarSemuaFoto.length === 0) {
      // Jika kosong
      galleryContainer.innerHTML = `
        <div class="main-frame" style="grid-column: span 2;">
          <img src="https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af" alt="Default Kamar" />
        </div>
      `;
    } else {
      // 1. Render Frame Utama (Kiri)
      let htmlGaleri = `
        <div class="main-frame" onclick="bukaLightbox(0)" style="cursor: pointer;">
          <img id="detail-image" src="${daftarSemuaFoto[0]}" alt="Foto Utama Kamar" />
        </div>
      `;

      // 2. Render Side Frame Vertikal (Kanan) jika ada foto sisa
      if (daftarSemuaFoto.length > 1) {
        htmlGaleri += `<div class="side-frames">`;

        for (let i = 1; i < daftarSemuaFoto.length; i++) {
          // Jika sudah masuk foto ke-5 (indeks 4) dan masih ada sisa foto lagi, pasang overlay +X
          if (i === 4 && daftarSemuaFoto.length > 4) {
            const sisaFoto = daftarSemuaFoto.length - 4;
            htmlGaleri += `
              <div class="thumb-wrapper" onclick="bukaLightbox(${i})" style="cursor: pointer;">
                <img src="${daftarSemuaFoto[i]}" />
                <div style="position: absolute; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:15px; backdrop-filter: blur(2px); font-family:'Montserrat',sans-serif;">
                  +${sisaFoto} Foto
                </div>
              </div>
            `;
            break; // Stop agar layout kanan maksimal 3 baris gambar
          }

          // Box thumbnail normal (Maksimal 3 box nampil vertikal di kanan)
          if (i < 4) {
            htmlGaleri += `
              <div class="thumb-wrapper" onclick="bukaLightbox(${i})" style="cursor: pointer;">
                <img src="${daftarSemuaFoto[i]}" style="transition: opacity 0.2s;" onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1" />
              </div>
            `;
          }
        }

        htmlGaleri += `</div>`;
      }

      galleryContainer.innerHTML = htmlGaleri;
    }
  }

  // 2. Format Harga
  let rawPrice = room.price || 0;
  if (typeof rawPrice === "string") rawPrice = rawPrice.replace(/\./g, "");
  let numPrice = Number(rawPrice);
  if (numPrice > 0 && numPrice < 10000) numPrice = numPrice * 1000;
  const formattedPrice = new Intl.NumberFormat("id-ID").format(numPrice);
  document.getElementById("detail-price").innerHTML =
    `Rp ${formattedPrice} <span>/ bulan</span>`;

  // 3. Spesifikasi
  const specHTML = `
    <div class="spec-item"><span>Luas Kamar:</span> ${room.room_size || "-"}</div>
    <div class="spec-item"><span>Kapasitas:</span> Max ${room.capacity || "-"} Orang</div>
    <div class="spec-item"><span>Lantai:</span> Lantai ${room.floor || "-"}</div>
    <div class="spec-item"><span>Status:</span> ${room.status || "-"}</div>
  `;
  document.getElementById("detail-specs").innerHTML = specHTML;

  // 4. Fasilitas
  let fasilitasKamarHTML = "";
  let fasilitasUmumHTML = "";

  if (room.room_facility && room.room_facility.length > 0) {
    room.room_facility.forEach((rf) => {
      if (rf.facilities) {
        const facName = rf.facilities.facility_name;
        const facCategory = rf.facilities.category;

        if (facCategory === "Kamar") {
          fasilitasKamarHTML += `<li>- ${facName}</li>`;
        } else {
          fasilitasUmumHTML += `<li>- ${facName}</li>`;
        }
      }
    });
  }

  if (!fasilitasKamarHTML) fasilitasKamarHTML = "<li>- Belum ada data</li>";
  if (!fasilitasUmumHTML) fasilitasUmumHTML = "<li>- Belum ada data</li>";

  document.getElementById("detail-facilities").innerHTML = `
    <div class="group">
      <h3>Fasilitas Kamar</h3>
      <ul>${fasilitasKamarHTML}</ul>
    </div>
    <div class="group">
      <h3>Fasilitas Umum</h3>
      <ul>${fasilitasUmumHTML}</ul>
    </div>
  `;

  // 5. Aturan Kamar
  const rules = room.room_rules || "Tidak ada aturan khusus yang dicatat.";
  const rulesArray = rules.split("\n");
  let rulesHTML = `<h3>Aturan Kost</h3>`;
  rulesArray.forEach((rule) => {
    if (rule.trim() !== "") {
      const textRule = rule.startsWith("-") ? rule : `- ${rule}`;
      rulesHTML += `<p>${textRule}</p>`;
    }
  });
  document.getElementById("detail-rules").innerHTML = rulesHTML;

  const reportRoomInput = document.getElementById("report-room-id");
  if (reportRoomInput) reportRoomInput.value = room.id;

  // 7. Logika Proteksi Form Laporan
  const formReport = document.getElementById("form-report");
  const reportSection = document.querySelector(".report-section");
  const isRented =
    room.status === "Paid" ||
    room.status === "Booked" ||
    room.status === "Terisi";

  if (!isRented) {
    if (formReport) formReport.style.display = "none";
    const lockMessage = document.createElement("div");
    lockMessage.innerHTML = `
      <div style="background-color: #fdf0f0; padding: 20px; border-radius: 10px; text-align: center; border: 1px dashed #e74c3c; margin-top: 20px;">
        <i class="fas fa-lock" style="font-size: 2rem; color: #e74c3c; margin-bottom: 10px;"></i>
        <h4 style="color: #e74c3c; margin-bottom: 5px;">Form Terkunci</h4>
        <p style="color: #555; font-size: 0.9rem;">Hanya penghuni yang sudah menyewa kamar ini yang dapat mengirimkan laporan kerusakan.</p>
      </div>
    `;
    if (reportSection) reportSection.appendChild(lockMessage);
  } else {
    if (formReport) formReport.style.display = "block";
  }

  // Tombol WhatsApp
  const btnWA = document.getElementById("btn-wa");
  if (btnWA) {
    btnWA.addEventListener("click", () => {
      const roomNumber = room.room_number;
      const price = `Rp ${formattedPrice}`;
      const phone = "6281212889217";
      const message = `Halo Admin Kost Keiren, saya tertarik untuk menyewa Kamar ${roomNumber} dengan harga ${price}/bulan. Apakah kamar ini masih tersedia?`;
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank",
      );
    });
  }
}

// =========================================================================
// JENDELA LIGHTBOX MODAL (VIEWER FULL SCREEN PREMIUM)
// =========================================================================
let indeksLightboxSekarang = 0;

window.bukaLightbox = function (index) {
  indeksLightboxSekarang = index;

  let lightboxModal = document.getElementById("lightbox-modal");
  if (!lightboxModal) {
    lightboxModal = document.createElement("div");
    lightboxModal.id = "lightbox-modal";
    lightboxModal.style =
      "display:none; position:fixed; z-index:99999; left:0; top:0; width:100%; height:100%; background-color:rgba(15,23,42,0.95); align-items:center; justify-content:center; flex-direction:column;";
    lightboxModal.innerHTML = `
      <span onclick="tutupLightbox()" style="position:absolute; top:25px; right:35px; color:#94a3b8; font-size:40px; font-weight:bold; cursor:pointer; user-select:none;">&times;</span>
      <div style="position:relative; display:flex; align-items:center; justify-content:center; max-width:85%; max-height:80%;">
        <button onclick="geserLightbox(-1)" style="position:absolute; left:-60px; background:rgba(255,255,255,0.1); border:none; color:white; font-size:24px; padding:12px 18px; cursor:pointer; border-radius:50%;">&#10094;</button>
        <img id="lightbox-img" src="" style="max-width:100%; max-height:80vh; object-fit:contain; border-radius:8px; box-shadow:0 20px 25px rgba(0,0,0,0.5);" />
        <button onclick="geserLightbox(1)" style="position:absolute; right:-60px; background:rgba(255,255,255,0.1); border:none; color:white; font-size:24px; padding:12px 18px; cursor:pointer; border-radius:50%;">&#10095;</button>
      </div>
    `;
    document.body.appendChild(lightboxModal);
  }

  document.getElementById("lightbox-img").src = daftarSemuaFoto[index];
  lightboxModal.style.display = "flex";
};

window.tutupLightbox = function () {
  const modal = document.getElementById("lightbox-modal");
  if (modal) modal.style.display = "none";
};

window.geserLightbox = function (arah) {
  indeksLightboxSekarang += arah;
  if (indeksLightboxSekarang >= daftarSemuaFoto.length)
    indeksLightboxSekarang = 0;
  if (indeksLightboxSekarang < 0)
    indeksLightboxSekarang = daftarSemuaFoto.length - 1;
  document.getElementById("lightbox-img").src =
    daftarSemuaFoto[indeksLightboxSekarang];
};

// Jalankan saat halaman dirender
document.addEventListener("DOMContentLoaded", () => {
  muatDetailKamar();
});
