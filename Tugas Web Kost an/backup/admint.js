// 1. Inisialisasi Koneksi ke Supabase
const { createClient } = supabase;

const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";

const supabaseClient = createClient(supabaseUrl, supabaseKey);

// --- PROTEKSI HALAMAN ADMIN (Mencegah Akses Ilegal) ---
async function proteksiHalamanAdmin() {
  const emailAktif =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  if (!emailAktif) {
    window.location.href = "../LoginPage/loginadmin.html";
    return;
  }

  try {
    const { data: user, error } = await supabaseClient
      .from("Users")
      .select("role")
      .eq("email", emailAktif)
      .single();

    if (error || !user) {
      window.location.href = "../LoginPage/loginadmin.html";
      return;
    }

    const roleUser = user.role ? user.role.toLowerCase().trim() : "user";

    if (roleUser !== "admin") {
      alert(`Akses Ditolak! Akun ${emailAktif} rolenya adalah ${roleUser}.`);
      window.location.href = "../LoginPage/loginadmin.html";
    } else {
      // JIKA LOLOS: Hilangkan loading screen / tampilkan body
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
    }
  } catch (err) {
    window.location.href = "../LoginPage/loginadmin.html";
  }
}

proteksiHalamanAdmin();

// --- LOGOUT ADMIN ---
window.logoutAdmin = function () {
  if (confirm("Yakin mau keluar, Boss?")) {
    sessionStorage.clear();
    window.location.href = "../LoginPage/loginadmin.html";
  }
};

// --- PRICE FORMATTER & CLEANER ---
function applyPriceFormatter(id) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("keyup", function () {
      let val = this.value.replace(/\D/g, "");
      if (val !== "") {
        this.value = new Intl.NumberFormat("id-ID").format(val);
      }
    });
  }
}
applyPriceFormatter("inputPrice");
applyPriceFormatter("editPrice");

function cleanPriceValue(val) {
  return parseInt(val.toString().replace(/\D/g, "")) || 0;
}

/* =========================================
   FUNGSI MEMUAT FASILITAS DARI DATABASE
   ========================================= */
async function muatFasilitas() {
  const { data: facilities, error } = await supabaseClient
    .from("facilities")
    .select("*");

  if (error) {
    console.error("Gagal memuat fasilitas:", error);
    return;
  }

  const containerKamar = document.getElementById("containerFasilitasKamar");
  const containerUmum = document.getElementById("containerFasilitasUmum");
  const editContainerKamar = document.getElementById(
    "editContainerFasilitasKamar",
  );
  const editContainerUmum = document.getElementById(
    "editContainerFasilitasUmum",
  );

  if (!containerKamar || !containerUmum) return;

  containerKamar.innerHTML = "";
  containerUmum.innerHTML = "";
  editContainerKamar.innerHTML = "";
  editContainerUmum.innerHTML = "";

  facilities.forEach((fasilitas) => {
    const checkboxHTML = `<label><input type="checkbox" name="fasilitas[]" value="${fasilitas.id}"> ${fasilitas.facility_name}</label>`;
    const editCheckboxHTML = `<label><input type="checkbox" name="edit_fasilitas[]" class="edit-fasilitas" value="${fasilitas.id}"> ${fasilitas.facility_name}</label>`;

    if (fasilitas.category === "Kamar") {
      containerKamar.innerHTML += checkboxHTML;
      editContainerKamar.innerHTML += editCheckboxHTML;
    } else {
      containerUmum.innerHTML += checkboxHTML;
      editContainerUmum.innerHTML += editCheckboxHTML;
    }
  });
}

/* =========================================
   FUNGSI UTAMA: TAMPILKAN DAFTAR KAMAR
   ========================================= */
async function tampilkanKamar() {
  const { data, error } = await supabaseClient
    .from("Rooms")
    .select(`*, Users ( name, phone ), rentals ( id, end_date, status )`)
    .order("room_number", { ascending: true });

  if (error) {
    console.error("Gagal mengambil data:", error);
    return;
  }

  const tbody = document.getElementById("tabelKamar");
  if (!tbody) return;
  tbody.innerHTML = "";
  const skrg = new Date();

  for (const kamar of data) {
    let profilHTML = "";
    let tombolAksiHTML = "";
    let statusSekarang = kamar.status;
    let badgeClass = "";
    const penghuni = kamar.Users;

    // --- LOGIKA CEK EXPIRED & AUTO UPDATE (PRESERVED & FIXED) ---
    let tglPembayaran = "-";

    // 1. Ambil data rental yang statusnya 'approved' saja
    const approvedRentals = kamar.rentals
      ? kamar.rentals.filter((r) => r.status === "approved")
      : [];

    // 2. Ambil rental dengan ID terbesar (paling terbaru)
    const activeRental =
      approvedRentals.length > 0
        ? approvedRentals.sort((a, b) => b.id - a.id)[0]
        : null;

    if (activeRental && activeRental.end_date) {
      // Set jam ke 00:00:00 agar perbandingan tanggal murni hari, bukan jam/menit
      const tglSelesai = new Date(activeRental.end_date);
      tglSelesai.setHours(0, 0, 0, 0);

      const hariIni = new Date(skrg);
      hariIni.setHours(0, 0, 0, 0);

      // Hitung Tanggal Jatuh Tempo Tampilan (+1 hari dari end_date sewa)
      const d = new Date(tglSelesai);
      d.setDate(d.getDate() + 1);
      tglPembayaran = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);

      // DEBUG LOG (Biar kamu bisa pantau di Console browser f12 kenapa dia keganti)
      console.log(
        `Room ${kamar.room_number} -> End Date Rental: ${tglSelesai.toISOString().split("T")[0]}, Hari Ini: ${hariIni.toISOString().split("T")[0]}`,
      );

      // CEK: Sistem HANYA akan mengubah ke Unpaid jika hari ini BENAR-BENAR sudah MELEWATI tglSelesai sewa
      if (hariIni > tglSelesai && statusSekarang === "Paid") {
        statusSekarang = "Unpaid"; // Ubah tampilan di UI

        // Update di Database Supabase secara silent
        await supabaseClient
          .from("Rooms")
          .update({ status: "Unpaid" })
          .eq("id", kamar.id);

        console.log(
          `[AUTO-UPDATE] Room ${kamar.room_number} diubah ke Unpaid karena masa sewa habis.`,
        );
      }
    }
    // ------------------------------------------------------------

    const gambarKamar = kamar.foto_kamar
      ? `<img src="${kamar.foto_kamar}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 10px;">`
      : `<div style="width: 40px; height: 40px; background: #eee; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 10px;"></div>`;

    if (
      statusSekarang === "Available" ||
      statusSekarang === "Tersedia" ||
      !penghuni
    ) {
      badgeClass = "badge-available";
      profilHTML = `<span class="tenant-empty">Kosong</span>`;
      tombolAksiHTML = `<button class="btn-action btn-assign">Assign</button>`;
    } else {
      let inisial = penghuni.name
        ? penghuni.name.substring(0, 2).toUpperCase()
        : "??";
      badgeClass = statusSekarang === "Paid" ? "badge-paid" : "badge-unpaid";

      profilHTML = `
        <div class="tenant-profile">
          <div class="avatar">${inisial}</div>
          <div class="tenant-info">
            <span class="tenant-name">${penghuni.name}</span>
            <span class="tenant-phone">${penghuni.phone || "-"}</span>
          </div>
        </div>`;

      const noHP = penghuni.phone || "";
      const namaPenghuni = penghuni.name || "Penghuni";

      tombolAksiHTML = `
        <button class="btn-action btn-reminder" onclick="kirimReminderWA('${noHP}', '${namaPenghuni}', '${kamar.room_number}')">
          Kirim Pengingat
        </button>`;
    }

    const formattedPriceForEdit = new Intl.NumberFormat("id-ID").format(
      kamar.price || 0,
    );
    const amanRules = (kamar.room_rules || "")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n");

    const barisHTML = `
      <tr>
        <td class="room-number">${gambarKamar} ${kamar.room_number}</td>
        <td>${profilHTML}</td>
        <td class="payment-date">${tglPembayaran}</td>
        <td><span class="badge ${badgeClass}">${statusSekarang}</span></td>
        <td class="action-buttons">
          ${tombolAksiHTML}
          <button class="icon-btn" onclick="bukaModalEdit('${kamar.id}', '${kamar.room_number}', '${formattedPriceForEdit}', '${statusSekarang}', '${kamar.room_size || ""}', '${kamar.floor || ""}', '${kamar.capacity || ""}', '${amanRules}')"><i class="fas fa-pen"></i></button>
          <button class="icon-btn" onclick="hapusKamar('${kamar.id}', '${kamar.room_number}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    tbody.innerHTML += barisHTML;
  }
}

// --- PENGINGAT WHATSAPP ---
window.kirimReminderWA = function (nomor, nama, roomNumber) {
  if (!nomor || nomor === "-" || nomor === "EMPTY") {
    alert("Waduh bre, nomor WA penghuni ini nggak ada di database!");
    return;
  }
  let formattedPhone = nomor.replace(/\D/g, "");
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "62" + formattedPhone.slice(1);
  }
  const pesan = `Halo *${nama}*, ini Admin Kost Keiren.\nMengingatkan bahwa pembayaran sewa untuk *Kamar ${roomNumber}* sudah memasuki tanggal jatuh tempo. Mohon segera melakukan konfirmasi pembayaran ya.\nJika sudah membayar, abaikan pesan ini. Terima kasih!`;
  window.open(
    `https://wa.me/${formattedPhone}?text=${encodeURIComponent(pesan)}`,
    "_blank",
  );
};

/* =========================================
   FUNGSI: TAMPILKAN PESANAN PENDING
   ========================================= */
async function tampilkanPendingRentals() {
  const tabelPending = document.getElementById("tabelPending");
  if (!tabelPending) return;

  const { data: pendingData, error } = await supabaseClient
    .from("rentals")
    .select(
      `id, start_date, room_id, Users ( name ), Rooms ( id, room_number )`,
    )
    .eq("status", "pending");

  if (error) {
    console.error("Gagal tarik pending:", error);
    return;
  }

  if (pendingData.length === 0) {
    tabelPending.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">Belum ada pesanan pending...</td></tr>`;
    return;
  }

  tabelPending.innerHTML = "";
  pendingData.forEach((item) => {
    const tgl = item.start_date
      ? new Date(item.start_date).toLocaleDateString("id-ID")
      : "-";
    const idKamarValid = item.room_id || (item.Rooms ? item.Rooms.id : null);

    tabelPending.innerHTML += `
      <tr>
        <td>${item.Users?.name || "User"}</td>
        <td>Kamar ${item.Rooms?.room_number || "-"}</td>
        <td>${tgl}</td>
        <td><span style="background:#ffc107; color:#000; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">PENDING</span></td>
        <td class="action-buttons">
          <button class="btn btn-success" style="background:#28a745; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="prosesPesanan('${item.id}', '${idKamarValid}', 'approved')">Terima</button>
          <button class="btn btn-danger" style="background:#dc3545; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="prosesPesanan('${item.id}', null, 'rejected')">Tolak</button>
        </td>
      </tr>`;
  });
}

/* =========================================
   FUNGSI: TAMPILKAN KONFIRMASI PEMBAYARAN
   ========================================= */
/* =========================================
   FIXED: TAMPILKAN KONFIRMASI PEMBAYARAN
   ========================================= */
async function tampilkanKonfirmasiPembayaran() {
  const container = document.getElementById("tabelKonfirmasiPembayaran");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("rentals")
    .select(
      `id, room_id, Users ( name ), Rooms ( room_number, price ), end_date, payments ( id, status, bukti_transfer )`,
    )
    .eq("payment_status", "pending_confirmation");

  if (error) {
    console.error("Gagal tarik data konfirmasi:", error);
    return;
  }

  if (data.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Belum ada konfirmasi pembayaran baru...</td></tr>`;
    return;
  }

  container.innerHTML = "";
  data.forEach((item) => {
    const hargaFormat = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(item.Rooms?.price || 0);

    let tglTampil = "-";
    if (item.end_date) {
      const d = new Date(item.end_date);
      d.setDate(d.getDate() + 1);
      tglTampil = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    }

    let linkBukti = `<span style="color:#999; font-size:12px;">Data Payment Kosong</span>`;

    // PERBAIKAN UTAMA: Filter dan ambil HANYA data payment bulan berjalan yang statusnya masih 'pending_confirmation'
    let paymentTerkait = null;
    if (item.payments && item.payments.length > 0) {
      paymentTerkait = item.payments.find(
        (p) => p.status === "pending_confirmation",
      );
    }

    if (paymentTerkait) {
      if (paymentTerkait.bukti_transfer) {
        // JIKA SUDAH ADA BUKTI UNTUK BULAN INI: Tampilkan tombol lihat foto
        linkBukti = `
          <a href="${paymentTerkait.bukti_transfer}" target="_blank" style="background-color: #e0f2fe; color: #0284c7; padding: 6px 10px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; display:inline-block;">
             <i class="fas fa-file-invoice-dollar"></i> Cek Bukti
          </a>`;
      } else {
        // JIKA BELUM ADA BUKTI UNTUK BULAN INI: Tampilkan form kosong agar bisa diupload (Foto bulan lalu tidak akan bocor ke sini)
        linkBukti = `
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
            <input type="file" id="bukti-rental-${item.id}" accept="image/*" style="font-size:11px; max-width:160px; padding:2px; border:1px solid #ccc; border-radius:4px;">
            <button onclick="uploadBuktiOlehAdmin('${paymentTerkait.id}', 'bukti-rental-${item.id}', this)" style="background:#007bff; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer;">
              <i class="fas fa-upload"></i> Upload Bukti
            </button>
          </div>`;
      }
    } else {
      // Jika di baris rental ini tidak ada payment berstatus 'pending_confirmation', tampilkan teks ini
      linkBukti = `<span style="color:#666; font-size:12px; font-style:italic;">Menunggu tagihan baru dibentuk...</span>`;
    }

    container.innerHTML += `
      <tr>
        <td>${item.Users?.name || "User"}</td>
        <td>Kamar ${item.Rooms?.room_number || "-"}</td>
        <td>${hargaFormat}</td>
        <td>${linkBukti}</td>
        <td>${tglTampil}</td>
        <td style="display:flex; gap:8px; justify-content:flex-start;">
          <button class="btn btn-success" style="background:#28a745; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="verifikasiBayar('${item.id}', '${item.end_date}', '${item.room_id}')"> 
            <i class="fas fa-check"></i> Selesai
          </button>
          <button class="btn btn-danger" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="batalBayar('${item.id}')"> 
            <i class="fas fa-times"></i> Batal
          </button>
        </td>
      </tr>`;
  });
}

// --- ADMIN UPLOAD BUKTI ---
window.uploadBuktiOlehAdmin = async function (paymentId, inputId, btnUpload) {
  const fileInput = document.getElementById(inputId);
  const file = fileInput.files[0];
  if (!file) {
    alert("Pilih fotonya dulu bre!");
    return;
  }

  try {
    btnUpload.disabled = true;
    btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    const opsi = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/webp",
    };
    let fileSiapUpload = file;
    try {
      fileSiapUpload = await imageCompression(file, opsi);
    } catch (e) {
      console.warn("Kompresi skip");
    }

    const namaFileUnik = `admin-upload-${Date.now()}.webp`;
    const { error: uploadError } = await supabaseClient.storage
      .from("bukti_transfer")
      .upload(namaFileUnik, fileSiapUpload);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseClient.storage
      .from("bukti_transfer")
      .getPublicUrl(namaFileUnik);

    const { error: updateErr } = await supabaseClient
      .from("payments")
      .update({ bukti_transfer: publicUrlData.publicUrl })
      .eq("id", paymentId);
    if (updateErr) throw updateErr;

    alert("Mantap! Bukti transfer berhasil di-upload.");
    tampilkanKonfirmasiPembayaran();
  } catch (err) {
    console.error(err);
    alert("Gagal upload bre: " + err.message);
    btnUpload.disabled = false;
    btnUpload.innerHTML = '<i class="fas fa-upload"></i> Upload Bukti';
  }
};

// --- SELESAIKAN VERIFIKASI PEMBAYARAN ---
window.verifikasiBayar = async function (idRental, currentEndDate, roomId) {
  if (!confirm("Yakin ingin menyelesaikan pembayaran kamar ini?")) return;

  try {
    // 1. UPDATE TABEL PAYMENTS (Menjadi lunas)
    const { error: errorPayment } = await supabaseClient
      .from("payments")
      .update({ status: "lunas" })
      .eq("rental_id", idRental)
      .eq("status", "pending_confirmation");

    if (errorPayment) throw errorPayment;

    // 2. LOGIKA PERPANJANG SEWA (+1 Bulan)
    let newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    // 3. UPDATE TABEL RENTALS
    const { error: errorRental } = await supabaseClient
      .from("rentals")
      .update({ payment_status: "lunas", end_date: newEndDate.toISOString() })
      .eq("id", idRental);

    if (errorRental) throw errorRental;

    alert("Mantap! Pembayaran berhasil diselesaikan.");
    tampilkanKonfirmasiPembayaran();
    tampilkanHistoryPembayaran();
    tampilkanKamar();
  } catch (error) {
    console.error(error);
    alert("Waduh, ada error saat menyelesaikan pembayaran nih bre.");
  }
};

// --- BATALKAN TAGIHAN (TIDAK KUNJUNG BAYAR) ---
window.batalBayar = async function (idRental) {
  if (
    !confirm(
      "Yakin ingin membatalkan tagihan ini? Status akan kembali 'Unpaid'.",
    )
  )
    return;

  try {
    const { error: errorRental } = await supabaseClient
      .from("rentals")
      .update({ payment_status: "unpaid" })
      .eq("id", idRental);
    if (errorRental) throw errorRental;

    const { error: errorPayment } = await supabaseClient
      .from("payments")
      .update({ status: "failed" })
      .eq("rental_id", idRental)
      .eq("status", "pending_confirmation");
    if (errorPayment) throw errorPayment;

    alert("Sip bre! Status pembayaran berhasil dibatalkan.");
    tampilkanKonfirmasiPembayaran();
    tampilkanKamar();
    tampilkanHistoryPembayaran();
  } catch (error) {
    console.error(error);
    alert("Waduh, ada error.");
  }
};

// --- PROSES PESANAN KAMAR BARU ---
window.prosesPesanan = async function (idRental, idKamar, statusBaru) {
  if (!idRental || idRental === "undefined") {
    alert("Maaf ID Pesanan Tidak terbaca!");
    return;
  }
  if (
    !confirm(
      `Yakin mau ${statusBaru === "approved" ? "TERIMA" : "TOLAK"} pesanan ini?`,
    )
  )
    return;

  try {
    let updateData = { status: statusBaru };
    const tglSekarang = new Date();

    if (statusBaru === "approved") {
      updateData.start_date = tglSekarang.toISOString();
      let tglSelesai = new Date(tglSekarang);
      tglSelesai.setMonth(tglSelesai.getMonth() + 1);
      updateData.end_date = tglSelesai.toISOString();
      updateData.payment_status = "lunas";
    }

    const { error: errUpdateRental } = await supabaseClient
      .from("rentals")
      .update(updateData)
      .eq("id", idRental);
    if (errUpdateRental) throw errUpdateRental;

    if (statusBaru === "approved") {
      if (!idKamar || idKamar === "undefined") {
        alert("Gagal: ID Kamar nggak ketemu!");
        return;
      }

      const { data: rentalData } = await supabaseClient
        .from("rentals")
        .select("user_id")
        .eq("id", idRental)
        .single();
      const { data: roomData } = await supabaseClient
        .from("Rooms")
        .select("price")
        .eq("id", idKamar)
        .single();

      const { error: errUpdateRoom } = await supabaseClient
        .from("Rooms")
        .update({ status: "Paid", "user.id": rentalData.user_id })
        .eq("id", idKamar);
      if (errUpdateRoom) throw errUpdateRoom;

      const { error: errInsertPayment } = await supabaseClient
        .from("payments")
        .insert([
          {
            rental_id: idRental,
            amount: roomData.price || 0,
            status: "lunas",
            payment_date: tglSekarang.toISOString(),
            due_date: tglSekarang.toISOString(),
          },
        ]);
      if (errInsertPayment) throw errInsertPayment;
    }

    alert(`Pesanan berhasil di-${statusBaru}!`);
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Gagal: " + err.message);
  }
};

/* =========================================
   FUNGSI UTAMA: TAMPILKAN RIWAYAT PEMBAYARAN
   ========================================= */
/* =========================================
   UPDATE: TAMPILKAN RIWAYAT + FITUR SORTIR
   ========================================= */
async function tampilkanHistoryPembayaran() {
  const container = document.getElementById("tabelHistoryPembayaran");
  if (!container) return;

  // 1. Membaca langsung nilai dari elemen boks dropdown HTML
  const filterBulan = document.getElementById("filterBulan")?.value || "ALL";
  const filterTahun = document.getElementById("filterTahun")?.value || "ALL";

  // Tarik data payments dari Supabase
  const { data, error } = await supabaseClient
    .from("payments")
    .select(
      `id, amount, status, bukti_transfer, payment_date, rental_id, rentals ( Users ( name ), Rooms ( room_number ) )`,
    )
    .order("id", { ascending: false });

  if (error) {
    console.error("Gagal menarik data riwayat pembayaran:", error);
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data dari database.</td></tr>`;
    return;
  }

  // 2. Filter dasar: hanya data yang statusnya 'lunas' atau 'failed'
  let historyData = data.filter(
    (p) => p.status === "lunas" || p.status === "failed",
  );

  // 3. LOGIKA FILTER BULAN DAN TAHUN (Berdasarkan payment_date)
  if (filterBulan !== "ALL" || filterTahun !== "ALL") {
    historyData = historyData.filter((item) => {
      if (!item.payment_date) return false;

      const tglTransaksi = new Date(item.payment_date);
      const matchBulan =
        filterBulan === "ALL" ||
        tglTransaksi.getMonth().toString() === filterBulan;
      const matchTahun =
        filterTahun === "ALL" ||
        tglTransaksi.getFullYear().toString() === filterTahun;

      return matchBulan && matchTahun;
    });
  }

  // Jika setelah difilter hasilnya kosong, tampilkan info
  if (historyData.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;"><i class="fas fa-search-minus"></i> Tidak ada riwayat pembayaran yang cocok dengan filter ini...</td></tr>`;
    return;
  }

  container.innerHTML = "";
  historyData.forEach((item) => {
    const hargaFormat = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(item.amount || 0);

    let statusBadge = "";
    if (item.status === "lunas") {
      statusBadge = `<span style="background:#d4edda; color:#155724; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fas fa-check-circle"></i> Selesai</span>`;
    } else {
      statusBadge = `<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fas fa-times-circle"></i> Batal</span>`;
    }

    let linkBukti = `<span style="color:#999; font-style:italic; font-size:12px;">Tidak Ada</span>`;
    if (item.bukti_transfer) {
      linkBukti = `
        <a href="${item.bukti_transfer}" target="_blank" style="background-color: #e0f2fe; color: #0284c7; padding: 5px 10px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display:inline-block;">
            <i class="fas fa-eye"></i> Lihat Foto
        </a>`;
    }

    let tglBayarTampil = "-";
    if (item.payment_date) {
      tglBayarTampil = new Date(item.payment_date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    container.innerHTML += `
      <tr>
        <td>${item.rentals?.Users?.name || "User Luar/Dihapus"}</td>
        <td>Kamar ${item.rentals?.Rooms?.room_number || "-"}</td>
        <td><strong>${hargaFormat}</strong></td>
        <td>${linkBukti}</td>
        <td>${statusBadge} <br><small style="color:#888; font-size:10px;">${tglBayarTampil}</small></td>
        <td>
          <button class="btn btn-danger" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;" onclick="hapusPermanenHistory('${item.id}')"> 
            <i class="fas fa-trash-alt"></i> Hapus 
          </button>
        </td>
      </tr>`;
  });
}

// --- HAPUS PERMANEN LOG HISTORY ---
// --- FIX OTO-HAPUS STORAGE: HAPUS PERMANEN DATA HISTORY & FOTONYA ---
window.hapusPermanenHistory = async function (paymentId) {
  const konfirmasi = confirm(
    "Apakah Anda yakin ingin menghapus permanen data riwayat pembayaran ini beserta foto buktinya dari storage?",
  );
  if (!konfirmasi) return;

  try {
    // 1. Ambil data URL bukti_transfer dari database sebelum rekornya dihapus
    const { data: paymentData, error: fetchError } = await supabaseClient
      .from("payments")
      .select("bukti_transfer")
      .eq("id", paymentId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Jika ada foto bukti transfer dan tersimpan di bucket Supabase kamu
    if (
      paymentData &&
      paymentData.bukti_transfer &&
      paymentData.bukti_transfer.includes("supabase.co")
    ) {
      try {
        // Ambil nama file unik di bagian paling akhir URL (contoh: admin-upload-171620.webp)
        const namaFileLama = paymentData.bukti_transfer.split("/").pop();

        // Hapus file secara otomatis dari bucket 'bukti_transfer'
        const { error: storageError } = await supabaseClient.storage
          .from("bukti_transfer")
          .remove([namaFileLama]);

        if (storageError) {
          console.warn(
            "Gagal menghapus file dari storage (mungkin sudah tidak ada):",
            storageError.message,
          );
        } else {
          console.log(
            `[STORAGE-CLEANUP] File ${namaFileLama} berhasil dihapus permanen.`,
          );
        }
      } catch (err) {
        console.error("Gagal memproses penghapusan file di storage:", err);
      }
    }

    // 3. Setelah storage bersih, baru hapus rekor baris data di tabel payments
    const { error: deleteError } = await supabaseClient
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (deleteError) throw deleteError;

    alert(
      "Sip bre! Rekor pembayaran dan foto buktinya di storage berhasil dibuang secara permanen.",
    );
    tampilkanHistoryPembayaran(); // Refresh tampilan tabel riwayat
  } catch (err) {
    console.error("Error penghapusan total:", err);
    alert(
      "Gagal menghapus rekor riwayat pembayaran secara bersih: " + err.message,
    );
  }
};

/* =========================================
   FUNGSI: TAMPILKAN LAPORAN KERUSAKAN
   ========================================= */
async function tampilkanLaporanKerusakan() {
  const reportContainer = document.getElementById("laporanRusakContainer");
  if (!reportContainer) return;

  try {
    const { data: reports, error } = await supabaseClient
      .from("maintenance_reports")
      .select(`*`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!reports || reports.length === 0) {
      reportContainer.innerHTML =
        '<p style="text-align:center; padding:20px; color:#999;">Belum ada laporan kerusakan baru.</p>';
      return;
    }

    reportContainer.innerHTML = "";
    reports.forEach((rp) => {
      const tglObj = rp.created_at ? new Date(rp.created_at) : new Date();
      const jam = tglObj.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const hari = tglObj.toLocaleDateString("id-ID", { weekday: "long" });

      const isUmum =
        rp.category === "umum" || rp.category === "Area Umum / Fasilitas Kost";
      const badgeUrgency = isUmum ? "badge-normal" : "badge-urgent";
      const iconClass = isUmum ? "fa-snowflake" : "fa-wrench";
      const bgIcon = isUmum ? "icon-normal" : "icon-urgent";

      reportContainer.innerHTML += `
        <div class="report-item" id="report-${rp.id}">
            <div class="report-icon ${bgIcon}"><i class="fas ${iconClass}"></i></div>
            <div class="report-details">
                <h3>${rp.item_name}</h3>
                <p>Kamar ${rp.Rooms?.room_number || "Umum"} &bull; ${hari}, ${jam}</p>
                <small style="color: #666; display:block; margin-top:5px;">"${rp.description}"</small>
            </div>
            <div class="report-badge ${rp.status === "resolved" ? "badge-normal" : badgeUrgency}" style="cursor:pointer;" onclick="ubahStatusKeResolved('${rp.id}')">
                 ${(rp.status || "PENDING").toUpperCase()}
            </div>
            <button onclick="hapusLaporanPermanen('${rp.id}')" style="background:none; border:none; color:#dc3545; cursor:pointer; margin-left:15px; font-size:1.1rem;">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
    });
  } catch (err) {
    console.error(err);
  }
}

window.ubahStatusKeResolved = async function (reportId) {
  if (!confirm("Masalah ini sudah diperbaiki?")) return;
  try {
    const { error } = await supabaseClient
      .from("maintenance_reports")
      .update({ status: "resolved" })
      .eq("id", reportId);
    if (error) throw error;
    alert("Mantap! Laporan ditandai selesai.");
    tampilkanLaporanKerusakan();
  } catch (err) {
    alert("Gagal update status bre!");
  }
};

window.hapusLaporanPermanen = async function (reportId) {
  if (!confirm("Laporan ini bakal dihapus permanen dari database. Yakin?"))
    return;
  try {
    const { error } = await supabaseClient
      .from("maintenance_reports")
      .delete()
      .eq("id", reportId);
    if (error) throw error;
    alert("Data berhasil dibuang!");
    tampilkanLaporanKerusakan();
  } catch (err) {
    alert("Waduh, gagal hapus bre!");
  }
};

// --- SISTEM MANAGEMENT TAB (DENGAN REFRESH MEMORI) ---
window.bukaTab = function (tabId, element) {
  sessionStorage.setItem("tab_aktif_admin", tabId);

  // Sesuaikan selector dengan element class admin-section milikmu
  const sections = document.querySelectorAll(".admin-section");
  sections.forEach((sec) => sec.classList.remove("active"));

  const buttons = document.querySelectorAll(".sub-nav-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  const targetTab = document.getElementById("tab-" + tabId);
  if (targetTab) targetTab.classList.add("active");

  if (element) element.classList.add("active");
};

// --- SINKRONISASI AKTIVASI DATA SAAT ONLOAD ---
window.onload = () => {
  muatFasilitas();
  tampilkanKamar();
  tampilkanPendingRentals();
  tampilkanLaporanKerusakan();
  tampilkanKonfirmasiPembayaran();
  tampilkanHistoryPembayaran();
  inisialisasiFilterRiwayat();
  tampilkanHistoryPembayaran();

  // Kembalikan posisi tab terakhir sebelum di-refresh
  const tabTerakhir = sessionStorage.getItem("tab_aktif_admin");
  if (tabTerakhir) {
    const tombolTarget = document.querySelector(
      `.sub-nav-btn[onclick*="'${tabTerakhir}'"]`,
    );
    if (tombolTarget) {
      bukaTab(tabTerakhir, tombolTarget);
    }
  }
};

/* =========================================
   LOGIKA MODAL TAMBAH & EDIT KAMAR
   ========================================= */
const modal = document.getElementById("modalTambah");
const btnTambahKamar = document.getElementById("btnTambahKamar");
const formTambah = document.getElementById("formTambahKamar");

if (btnTambahKamar) {
  btnTambahKamar.onclick = () => (modal.style.display = "flex");
}

window.tutupModal = function () {
  if (modal) {
    modal.style.display = "none";
    formTambah.reset();
  }
};

if (document.getElementById("closeModal"))
  document.getElementById("closeModal").onclick = tutupModal;
if (document.getElementById("btnBatal"))
  document.getElementById("btnBatal").onclick = tutupModal;

async function kompresFoto(file) {
  const opsi = {
    maxSizeMB: 0.7,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/webp",
  };
  try {
    return await imageCompression(file, opsi);
  } catch (error) {
    return file;
  }
}

if (formTambah) {
  formTambah.addEventListener("submit", async function (e) {
    e.preventDefault();
    const noKamar = document.getElementById("inputRoomNumber").value;
    const harga = cleanPriceValue(document.getElementById("inputPrice").value);
    const statusKamar = document.getElementById("inputStatus").value;
    const fileFoto = document.getElementById("inputFoto").files[0];
    const lantai = document.getElementById("inputFloor").value;
    const luas = document.getElementById("inputRoomSize").value;
    const kapasitas = document.getElementById("inputCapacity").value;
    const aturanKamar = document.getElementById("inputRoomRules").value;

    const btnSubmit = formTambah.querySelector('button[type="submit"]');
    btnSubmit.textContent = "Menyimpan...";
    btnSubmit.disabled = true;

    let urlFoto = null;

    if (fileFoto) {
      const fileSiapUpload = await kompresFoto(fileFoto);
      const namaFileUnik = `${Date.now()}-${noKamar}.webp`;
      const { error: uploadError } = await supabaseClient.storage
        .from("foto_kamar")
        .upload(namaFileUnik, fileSiapUpload);
      if (uploadError) {
        alert("Gagal upload foto: " + uploadError.message);
        btnSubmit.textContent = "Simpan Kamar";
        btnSubmit.disabled = false;
        return;
      }
      urlFoto = supabaseClient.storage
        .from("foto_kamar")
        .getPublicUrl(namaFileUnik).data.publicUrl;
    }

    const { data: newRoom, error: roomError } = await supabaseClient
      .from("Rooms")
      .insert([
        {
          room_number: noKamar,
          price: harga,
          status: statusKamar,
          foto_kamar: urlFoto,
          floor: lantai || null,
          room_size: luas,
          capacity: kapasitas || null,
          room_rules: aturanKamar,
        },
      ])
      .select();

    if (roomError) {
      alert("Kesalahan: " + roomError.message);
      btnSubmit.textContent = "Simpan Kamar";
      btnSubmit.disabled = false;
      return;
    }

    if (newRoom && newRoom.length > 0) {
      const checkboxes = document.querySelectorAll(
        '#formTambahKamar input[name="fasilitas[]"]:checked',
      );
      if (checkboxes.length > 0) {
        const fasilitasData = Array.from(checkboxes).map((cb) => ({
          room_id: newRoom[0].id,
          facility_id: cb.value,
        }));
        await supabaseClient.from("room_facility").insert(fasilitasData);
      }
    }

    alert("Kamar " + noKamar + " sukses ditambah!");
    tutupModal();
    tampilkanKamar();
    btnSubmit.textContent = "Simpan Kamar";
    btnSubmit.disabled = false;
  });
}

const modalEdit = document.getElementById("modalEdit");
const formEdit = document.getElementById("formEditKamar");

window.bukaModalEdit = async function (
  id,
  roomNumber,
  price,
  status,
  size,
  floor,
  capacity,
  rules,
) {
  document.getElementById("editIdKamar").value = id;
  document.getElementById("editRoomNumber").value = roomNumber;
  document.getElementById("editStatus").value = status;
  document.getElementById("editPrice").value = price !== "null" ? price : "";
  document.getElementById("editRoomSize").value = size !== "null" ? size : "";
  document.getElementById("editFloor").value = floor !== "null" ? floor : "";
  document.getElementById("editCapacity").value =
    capacity !== "null" ? capacity : "";
  document.getElementById("editRoomRules").value =
    rules !== "null" ? rules : "";

  document
    .querySelectorAll(".edit-fasilitas")
    .forEach((cb) => (cb.checked = false));
  const { data: roomFacs } = await supabaseClient
    .from("room_facility")
    .select("facility_id")
    .eq("room_id", id);
  if (roomFacs) {
    roomFacs.forEach((rf) => {
      const targetCb = document.querySelector(
        `.edit-fasilitas[value="${rf.facility_id}"]`,
      );
      if (targetCb) targetCb.checked = true;
    });
  }
  if (modalEdit) modalEdit.style.display = "flex";
};

if (document.getElementById("closeModalEdit"))
  document.getElementById("closeModalEdit").onclick = () =>
    (modalEdit.style.display = "none");
if (document.getElementById("btnBatalEdit"))
  document.getElementById("btnBatalEdit").onclick = () =>
    (modalEdit.style.display = "none");

if (formEdit) {
  formEdit.addEventListener("submit", async function (e) {
    e.preventDefault();
    const idKamar = document.getElementById("editIdKamar").value;
    const noKamar = document.getElementById("editRoomNumber").value;
    const statusBaru = document.getElementById("editStatus").value;
    const harga = cleanPriceValue(document.getElementById("editPrice").value);
    const btnUpdate = formEdit.querySelector('button[type="submit"]');

    btnUpdate.textContent = "Mengupdate...";
    btnUpdate.disabled = true;

    let dataUpdate = {
      room_number: noKamar,
      price: harga,
      status: statusBaru,
      floor: document.getElementById("editFloor").value || null,
      room_size: document.getElementById("editRoomSize").value,
      capacity: document.getElementById("editCapacity").value || null,
      room_rules: document.getElementById("editRoomRules").value,
    };

    if (statusBaru === "Tersedia" || statusBaru === "Available") {
      dataUpdate["user.id"] = null;
      try {
        await supabaseClient
          .from("rentals")
          .update({ status: "completed" })
          .eq("room_id", idKamar)
          .eq("status", "approved");
      } catch (err) {}
    }

    const fileFotoBaru = document.getElementById("editFoto").files[0];
    if (fileFotoBaru) {
      const { data: roomData } = await supabaseClient
        .from("Rooms")
        .select("foto_kamar")
        .eq("id", idKamar)
        .single();
      if (roomData?.foto_kamar?.includes("supabase.co")) {
        try {
          await supabaseClient.storage
            .from("foto_kamar")
            .remove([roomData.foto_kamar.split("/").pop()]);
        } catch (err) {}
      }
      const fileSiapUpload = await kompresFoto(fileFotoBaru);
      const namaFileUnik = `${Date.now()}-${noKamar}.webp`;
      await supabaseClient.storage
        .from("foto_kamar")
        .upload(namaFileUnik, fileSiapUpload);
      dataUpdate.foto_kamar = supabaseClient.storage
        .from("foto_kamar")
        .getPublicUrl(namaFileUnik).data.publicUrl;
    }

    const { error: updateError } = await supabaseClient
      .from("Rooms")
      .update(dataUpdate)
      .eq("id", idKamar);
    if (!updateError) {
      await supabaseClient
        .from("room_facility")
        .delete()
        .eq("room_id", idKamar);
      const checkboxes = document.querySelectorAll(
        "#formEditKamar .edit-fasilitas:checked",
      );
      if (checkboxes.length > 0) {
        const fasilitasBaru = Array.from(checkboxes).map((cb) => ({
          room_id: idKamar,
          facility_id: cb.value,
        }));
        await supabaseClient.from("room_facility").insert(fasilitasBaru);
      }
      alert("Sukses diperbarui!");
      if (modalEdit) modalEdit.style.display = "none";
      tampilkanKamar();
    }
    btnUpdate.textContent = "Update Kamar";
    btnUpdate.disabled = false;
  });
}

window.hapusKamar = async function (idKamar, noKamar) {
  if (confirm(`Hapus Kamar ${noKamar}? Seluruh data akan lenyap.`)) {
    const { data: roomData } = await supabaseClient
      .from("Rooms")
      .select("foto_kamar")
      .eq("id", idKamar)
      .single();
    if (roomData?.foto_kamar?.includes("supabase.co")) {
      try {
        await supabaseClient.storage
          .from("foto_kamar")
          .remove([roomData.foto_kamar.split("/").pop()]);
      } catch (err) {}
    }
    const { error } = await supabaseClient
      .from("Rooms")
      .delete()
      .eq("id", idKamar);
    if (!error) {
      alert("Terhapus!");
      tampilkanKamar();
    }
  }
};
// --- DEKLARASI GLOBAL FILTER FILTER KALENDER ---
let currentFilterBulan = "ALL";
let currentFilterTahun = "ALL";

// --- FUNGSI DINAMIS GENERATOR PIL TAHUN ---
// --- GENERATOR DAN INJEKSI TAHUN SECARA DINAMIS KEDALAM DROPDOWN ---
function inisialisasiFilterRiwayat() {
  const selectTahun = document.getElementById("filterTahun");
  if (!selectTahun) return;

  const thnSekarang = new Date().getFullYear();
  let htmlTahun = `<option value="ALL">Semua Tahun</option>`;

  // Looping otomatis menghasilkan opsi dari tahun 2024 sampai 5 tahun mendatang
  for (let y = 2026; y <= thnSekarang + 10; y++) {
    htmlTahun += `<option value="${y}">${y}</option>`;
  }
  selectTahun.innerHTML = htmlTahun;
}

// --- FUNGSI PEMICU KETIKA PILIHAN DROPDOWN DIUBAH OLEH ADMIN ---
window.setFilterBulanDropdown = function (valueBulan) {
  tampilkanHistoryPembayaran(); // Langsung jalankan penyaringan ulang
};

window.setFilterTahunDropdown = function (valueTahun) {
  tampilkanHistoryPembayaran(); // Langsung jalankan penyaringan ulang
};

window.setFilterBulan = function (bln, el) {
  currentFilterBulan = bln;
  document
    .querySelectorAll(".month-chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  tampilkanHistoryPembayaran();
};

window.setFilterTahun = function (thn, el) {
  currentFilterTahun = thn;
  document
    .querySelectorAll(".year-pill")
    .forEach((p) => p.classList.remove("active"));
  el.classList.add("active");
  tampilkanHistoryPembayaran();
};

// --- CORE SYSTEM: MANAGEMENT TAB (DENGAN REFRESH MEMORI) ---
window.bukaTab = function (tabId, element) {
  sessionStorage.setItem("tab_aktif_admin", tabId);

  // Menyembunyikan semua section
  const sections = document.querySelectorAll(".admin-section");
  sections.forEach((sec) => sec.classList.remove("active"));

  // Menghapus kelas active pada navigasi
  const buttons = document.querySelectorAll(".sub-nav-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  // Mengaktifkan section target
  const targetTab = document.getElementById("tab-" + tabId);
  if (targetTab) targetTab.classList.add("active");

  if (element) element.classList.add("active");
};

// --- PEMBARUAN PANGGILAN DI ONLOAD KUNCI ---
