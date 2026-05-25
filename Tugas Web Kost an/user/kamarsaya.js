const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// --- JANGAN TARUH DISPLAY:BLOCK DI SINI ---

async function muatDetailKamarSaya() {
  // Gunakan sessionStorage sesuai kesepakatan multi-login tadi
  const emailLogin =
    sessionStorage.getItem("email_aktif") ||
    localStorage.getItem("email_aktif");

  const punyaKamarDiv = document.getElementById("punya-kamar");
  const belumPunyaDiv = document.getElementById("belum-punya-kamar");

  if (!emailLogin) {
    window.location.href = "../LoginPage/login.html";
    return;
  }

  try {
    // 1. Cari ID User
    const { data: user, error: userError } = await supabaseClient
      .from("Users")
      .select("id, name")
      .eq("email", emailLogin)
      .single();

    if (userError || !user) throw new Error("User tidak ditemukan");

    const myId = parseInt(user.id);

    // 2. Cari Kamar
    const { data: kamar, error: roomError } = await supabaseClient
      .from("Rooms")
      .select(`*, room_facility ( facilities ( facility_name ) )`)
      .eq('"user.id"', myId)
      .maybeSingle();

    if (roomError) throw roomError;

    // 3. LOGIKA SAKLAR KONTEN (Anti-Glitch)
    if (kamar) {
      // Tampilkan wadah punya kamar, sembunyikan wadah kosong
      if (punyaKamarDiv) punyaKamarDiv.style.display = "block";
      if (belumPunyaDiv) belumPunyaDiv.style.display = "none";

      // Isi Data Kamar
      document.getElementById("myRoomNumber").innerText =
        `Room ${kamar.room_number}`;
      document.getElementById("myStatusSewa").innerText = "Aktif";

      // =========================================================================
      // REPARASI JSON FOTO - MUNCULKAN FOTO KATEGORI KAMAR (SEPERTI HALAMAN USER)
      // =========================================================================
      let urlFotoKamar =
        "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af"; // Gambar default jika kosong

      if (kamar.foto_kamar) {
        try {
          const fotoString = kamar.foto_kamar.trim();
          if (fotoString.startsWith("{")) {
            // Bongkar Object JSON
            const objekFoto = JSON.parse(fotoString);
            // Ambil dari array kategori 'kamar' pertama
            if (objekFoto.kamar && objekFoto.kamar.length > 0) {
              urlFotoKamar = objekFoto.kamar[0];
            } else if (objekFoto.umum && objekFoto.umum.length > 0) {
              // Jika array kamar kosong, fallback pakai foto fasilitas umum
              urlFotoKamar = objekFoto.umum[0];
            }
          } else {
            // Skenario sisa data lama (masih format string pisah koma biasa)
            const kepinganFoto = fotoString
              .split(",")
              .map((url) => url.trim())
              .filter((url) => url !== "");
            if (kepinganFoto.length > 0) urlFotoKamar = kepinganFoto[0];
          }
        } catch (e) {
          console.error(
            "Gagal urai JSON foto_kamar di halaman kamarsaya.js",
            e,
          );
        }
      }

      // Pasang URL foto yang valid ke tag gambar HTML
      const roomImgEl = document.getElementById("myRoomImg");
      if (roomImgEl) {
        roomImgEl.src = urlFotoKamar;
        roomImgEl.onerror = function () {
          this.src =
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af";
        };
      }
      // =========================================================================

      // --- LOGIKA TANGGAL ---
      const { data: rentalData } = await supabaseClient
        .from("rentals")
        .select("id, start_date, end_date")
        .eq("room_id", kamar.id)
        .eq("user_id", myId)
        .eq("status", "approved")
        .maybeSingle();

      if (rentalData && rentalData.start_date) {
        const opsi = { year: "numeric", month: "long", day: "numeric" };
        const tglMasuk = new Date(rentalData.start_date);
        document.getElementById("myCheckIn").innerText =
          tglMasuk.toLocaleDateString("id-ID", opsi);

        let tglKeluar;
        if (rentalData.end_date) {
          tglKeluar = new Date(rentalData.end_date);
        } else {
          tglKeluar = new Date(tglMasuk);
          tglKeluar.setMonth(tglKeluar.getMonth() + 1);
          await supabaseClient
            .from("rentals")
            .update({ end_date: tglKeluar.toISOString() })
            .eq("id", rentalData.id);
        }
        document.getElementById("myCheckOut").innerText =
          tglKeluar.toLocaleDateString("id-ID", opsi);
      }

      // Update Fasilitas & Peraturan
      renderFasilitas(kamar);
      renderPeraturan(kamar);

      window.currentRoomNumber = kamar.room_number;
    } else {
      // Tampilkan wadah kosong, sembunyikan wadah punya kamar
      if (punyaKamarDiv) punyaKamarDiv.style.display = "none";
      if (belumPunyaDiv) belumPunyaDiv.style.display = "block";
    }
  } catch (err) {
    console.error("Fatal Error:", err);
    if (belumPunyaDiv) belumPunyaDiv.style.display = "block";
  } finally {
    // --- KUNCI: Aktifkan body HANYA setelah semua pengecekan selesai ---
    document.body.style.setProperty("display", "block", "important");
    document.body.style.opacity = "1";
    updateProfilNavbar();
  }
}

// Fungsi Render Terpisah biar rapi
function renderFasilitas(kamar) {
  const list = document.getElementById("myFacilityList");
  if (!list || !kamar.room_facility) return;
  list.innerHTML = kamar.room_facility
    .map((rf) =>
      rf.facilities
        ? `<li><i class="ph ph-check-circle"></i> ${rf.facilities.facility_name}</li>`
        : "",
    )
    .join("");
}

function renderPeraturan(kamar) {
  const list = document.getElementById("myRulesList");
  if (!list) return;
  if (kamar.room_rules && kamar.room_rules !== "EMPTY") {
    const rules = kamar.room_rules.split(/[;\n]/);
    list.innerHTML = rules
      .filter((r) => r.trim())
      .map((r) => `<li>${r.trim()}</li>`)
      .join("");
  } else {
    list.innerHTML = "<li>Tidak ada peraturan khusus.</li>";
  }
}

// Navbar Sync
window.updateProfilNavbar = function () {
  const nama =
    sessionStorage.getItem("user_name") || localStorage.getItem("user_name");
  const foto =
    sessionStorage.getItem("user_avatar") ||
    localStorage.getItem("user_avatar");
  if (document.getElementById("namaUser"))
    document.getElementById("namaUser").innerText = nama;
  if (document.getElementById("roleUser")) {
    document.getElementById("roleUser").innerText = window.currentRoomNumber
      ? `Penghuni Kamar ${window.currentRoomNumber}`
      : "User";
  }
  if (foto && document.getElementById("fotoProfil"))
    document.getElementById("fotoProfil").src = foto;
};

// Jalankan saat DOM siap
document.addEventListener("DOMContentLoaded", muatDetailKamarSaya);

// Event Listener untuk Laporan Kerusakan
document
  .getElementById("reportForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const btnSubmit = this.querySelector("button");
    const emailLogin =
      sessionStorage.getItem("email_aktif") ||
      localStorage.getItem("email_aktif");
    const kategori = document.getElementById("kategori").value;
    const fasilitas = document.getElementById("fasilitasInput").value;
    const deskripsi = document.getElementById("deskripsiInput").value;

    try {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengirim...';

      // 1. Cari ID User
      const { data: userData, error: userErr } = await supabaseClient
        .from("Users")
        .select("id")
        .eq("email", emailLogin)
        .single();

      if (userErr) throw new Error("User gak ketemu!");

      // 2. Cari ID Kamar (Menggunakan format '"user.id"' sesuai skema table editor)
      const { data: kamarData, error: roomErr } = await supabaseClient
        .from("Rooms")
        .select("id")
        .eq('"user.id"', userData.id)
        .maybeSingle();

      if (!kamarData) throw new Error("Lu belum punya kamar aktif!");

      // 3. Insert ke DB
      const { error: insertErr } = await supabaseClient
        .from("maintenance_reports")
        .insert([
          {
            user_id: userData.id,
            room_id: kamarData.id,
            category: kategori,
            item_name: fasilitas,
            description: deskripsi,
            status: "pending",
            title: "Laporan dari Kamar " + window.currentRoomNumber,
          },
        ]);

      if (insertErr) throw insertErr;

      alert("Laporan berhasil dikirim ke Admin!");
      this.reset();
    } catch (err) {
      console.error(err);
      alert("Gagal bre! " + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML =
        '<i class="ph ph-paper-plane-tilt"></i> Kirim Laporan';
    }
  });
