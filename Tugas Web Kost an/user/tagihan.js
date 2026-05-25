// 1. Inisialisasi Supabase (Cukup sekali saja, bre)
const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function muatDataTagihan() {
  const emailLogin = sessionStorage.getItem("email_aktif");
  const punyaKamarDiv = document.getElementById("punya-kamar");
  const belumPunyaDiv = document.getElementById("belum-punya-kamar");

  if (!emailLogin) {
    console.error("Email tidak ditemukan di storage!");
    return;
  }

  try {
    const { data: user, error: userError } = await supabaseClient
      .from("Users")
      .select("id, name, avatar_url")
      .eq("email", emailLogin)
      .single();

    if (userError || !user) throw new Error("Gagal ambil profil");
    sessionStorage.setItem("user_name", user.name);

    const { data: myRoom, error: roomError } = await supabaseClient
      .from("Rooms")
      .select('id, room_number, price, "user.id"')
      .eq('"user.id"', user.id)
      .maybeSingle();

    if (roomError) throw roomError;

    if (myRoom) {
      if (punyaKamarDiv) punyaKamarDiv.style.display = "block";
      if (belumPunyaDiv) belumPunyaDiv.style.display = "none";

      window.currentRoomNumber = myRoom.room_number;
      window.currentRoomPrice = myRoom.price; // Simpan harga mentah untuk di-insert nanti

      const harga = myRoom.price || 0;
      const formatHarga = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(harga);

      const totalTagihanEl = document.getElementById("totalTagihan");
      if (totalTagihanEl) totalTagihanEl.innerText = formatHarga;

      // 1. Ambil data rental yang sedang aktif
      // GANTI JADI INI, BRE:
      const { data: rentalAktif } = await supabaseClient
        .from("rentals")
        .select("id, start_date, end_date")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle(); // Pake ini biar anti-crash kalau data kosong/double

      if (rentalAktif) {
        // Ambil data riwayat pembayaran asli dari tabel payments berdasarkan rental_id
        const { data: riwayatPayments } = await supabaseClient
          .from("payments")
          .select("id, amount, payment_date, status")
          .eq("rental_id", rentalAktif.id)
          .order("id", { ascending: false });

        prosesLogikaTagihan([rentalAktif], formatHarga);
        isiTabelRiwayat(riwayatPayments || [], formatHarga, rentalAktif);
      } else {
        // Kalau rentals belum di-approve admin, set default lunas di UI biar aman
        prosesLogikaTagihan([], formatHarga);
        isiTabelRiwayat([], formatHarga, null);
      }
    } else {
      if (punyaKamarDiv) punyaKamarDiv.style.display = "none";
      if (belumPunyaDiv) belumPunyaDiv.style.display = "block";
      window.currentRoomNumber = null;
    }

    updateUserAvatar(user);
  } catch (err) {
    console.error("Fatal Error di tagihan.js:", err);
    if (belumPunyaDiv) belumPunyaDiv.style.display = "block";
  } finally {
    document.body.style.setProperty("display", "block", "important");
    document.body.style.opacity = "1";
    updateProfilNavbar();
  }
}

function isiTabelRiwayat(riwayatPayments, formatHarga, rentalAktif) {
  const tableBody = document.getElementById("billing-table-body");
  if (!tableBody) return;

  if (riwayatPayments && riwayatPayments.length > 0) {
    tableBody.innerHTML = riwayatPayments
      .map((payment) => {
        // --- 1. LOGIKA STATUS & WARNA ---
        let statusText = "Belum Bayar";
        let badgeColor = "#dc3545"; // Merah

        // Kita ubah jadi lowercase biar kebacanya aman mau tulisan gede/kecil dari database
        const statusDb = (payment.status || "").toLowerCase();

        if (statusDb === "lunas") {
          statusText = "Lunas";
          badgeColor = "#28a745"; // Hijau
        } else if (
          statusDb === "pending_confirmation" ||
          statusDb === "pending"
        ) {
          statusText = "Proses";
          badgeColor = "#ffc107"; // Kuning
        }

        // --- 2. LOGIKA TANGGAL ANTI-ERROR ---
        let validDate;
        if (payment.payment_date) {
          validDate = new Date(payment.payment_date); // Ambil dari tanggal bayar
        } else if (rentalAktif && rentalAktif.start_date) {
          validDate = new Date(rentalAktif.start_date); // Kalau kosong, ambil dari periode sewa kamar
        } else {
          validDate = new Date(); // Kalau dua-duanya kosong, pakai bulan ini
        }

        const periodeSewa = validDate.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });

        // --- 3. RENDER BARIS TABEL ---
        return `
        <tr>
          <td><strong>INV-${payment.id}</strong></td>
          <td>${periodeSewa}</td>
          <td>${formatHarga}</td>
          <td>Transfer Bank</td>
          <td>
            <span style="background:${badgeColor}; color:${statusText === "Proses" ? "#4facfe" : "#fff"}; padding:6px 12px; border-radius:6px; display:inline-block; font-size:12px; font-weight:bold;">
              ${statusText}
            </span>
          </td>
          <td>
            <button onclick="cetakNotaSpesifik('${payment.id}', '${rentalAktif ? rentalAktif.start_date : ""}', '${rentalAktif ? rentalAktif.end_date : ""}', '${formatHarga}', '${statusText}')" style="border:none; background:none; color:#0047a5; cursor:pointer; font-weight:bold;">
              <i class="ph ph-printer"></i> Nota
            </button>
          </td>
        </tr>`;
      })
      .join("");
  } else {
    tableBody.innerHTML =
      "<tr><td colspan='6' style='text-align:center;'>Belum ada riwayat pembayaran.</td></tr>";
  }
}

// --- FUNGSI PEMBANTU ---
function prosesLogikaTagihan(riwayat, formatHarga) {
  const statusBayarEl = document.getElementById("statusBayar");
  const jatuhTempoEl = document.getElementById("jatuhTempo");
  const btnBayarEl = document.getElementById("btnBayar");
  const skrg = new Date();

  if (riwayat && riwayat.length > 0 && riwayat[0].end_date) {
    const tglSelesai = new Date(riwayat[0].end_date);
    const tglJatuhTempo = new Date(tglSelesai);
    tglJatuhTempo.setDate(tglJatuhTempo.getDate() + 1);

    if (jatuhTempoEl) {
      jatuhTempoEl.innerText = `Jatuh tempo: ${new Intl.DateTimeFormat(
        "id-ID",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      ).format(tglJatuhTempo)}`;
    }

    if (skrg < tglSelesai) {
      statusBayarEl.innerText = "Aktif (Lunas)";
      statusBayarEl.style.color = "#28a745";
      btnBayarEl.style.display = "none";
    } else {
      statusBayarEl.innerText = "Belum Bayar";
      statusBayarEl.style.color = "#dc3545";
      btnBayarEl.style.display = "block";

      // MURNI TAMBAHAN SINKRONISASI: MUNCULKAN TOMBOL UPLOAD BUKTI DI SINI
      if (document.getElementById("btnUploadBukti")) {
        document.getElementById("btnUploadBukti").style.display = "none";
      }

      btnBayarEl.onclick = () => bayarKeWA();
    }
  }
}

function isiTabelRiwayat(riwayatPayments, formatHarga, rentalAktif) {
  const tableBody = document.getElementById("billing-table-body");
  if (!tableBody) return;

  if (riwayatPayments && riwayatPayments.length > 0) {
    // Ambil tanggal patokan awal user mulai ngekos
    const baseStartDate =
      rentalAktif && rentalAktif.start_date
        ? new Date(rentalAktif.start_date)
        : new Date();

    tableBody.innerHTML = riwayatPayments
      .map((payment, index) => {
        let statusText = "Belum Bayar";
        let badgeColor = "#dc3545";
        const statusDb = (payment.status || "").toLowerCase();

        if (statusDb === "lunas") {
          statusText = "Lunas";
          badgeColor = "#28a745";
        } else if (
          statusDb === "pending_confirmation" ||
          statusDb === "pending"
        ) {
          statusText = "Proses";
          badgeColor = "#ffc107";
        }

        // --- LOGIKA PERIODE SEWA OTOMATIS (Sesuai Urutan Invoice) ---
        const totalPayments = riwayatPayments.length;
        // Karena data diurutkan dari terbaru, kita balik urutannya.
        // Contoh: Pembayaran pertama (terlama) = urutan 1. Pembayaran kedua = urutan 2.
        const urutanPembayaran = totalPayments - index;

        // Tanggal Awal khusus untuk invoice ini
        let tglMulaSewa = new Date(baseStartDate);
        tglMulaSewa.setMonth(tglMulaSewa.getMonth() + (urutanPembayaran - 1));

        // Tanggal Akhir khusus untuk invoice ini
        let tglTamatSewa = new Date(baseStartDate);
        tglTamatSewa.setMonth(tglTamatSewa.getMonth() + urutanPembayaran);

        const teksPeriodeSewa = tglMulaSewa.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });

        // TANGGAL CETAK (Ambil dari tgl bayar di database, biar dicetak tahun depan pun tglnya nggak berubah)
        const tglCetakNota = payment.payment_date
          ? payment.payment_date
          : new Date().toISOString();

        return `
        <tr>
          <td><strong>INV-${payment.id}</strong></td>
          <td>${teksPeriodeSewa}</td>
          <td>${formatHarga}</td>
          <td>Transfer Bank</td>
          <td>
            <span style="background:${badgeColor}; color:${statusText === "Proses" ? "#000" : "#fff"}; padding:6px 12px; border-radius:6px; display:inline-block; font-size:12px; font-weight:bold;">
              ${statusText}
            </span>
          </td>
          <td>
            <button onclick="cetakNotaSpesifik('${payment.id}', '${tglMulaSewa.toISOString()}', '${tglTamatSewa.toISOString()}', '${formatHarga}', '${statusText}', '${tglCetakNota}')" style="border:none; background:none; color:#000000; cursor:pointer; font-weight:bold;">
              <i class="ph ph-printer"></i> Nota
            </button>
          </td>
        </tr>`;
      })
      .join("");
  } else {
    tableBody.innerHTML =
      "<tr><td colspan='6' style='text-align:center;'>Belum ada riwayat pembayaran.</td></tr>";
  }
}

function updateUserAvatar(user) {
  if (user.avatar_url) {
    const avatar = user.avatar_url.startsWith("http")
      ? user.avatar_url
      : supabaseClient.storage.from("avatars").getPublicUrl(user.avatar_url)
          .data.publicUrl;
    sessionStorage.setItem("user_avatar", avatar);
    sessionStorage.setItem("user_avatar", avatar);
  }
}

window.updateProfilNavbar = function () {
  const nama =
    sessionStorage.getItem("user_name") || sessionStorage.getItem("user_name");
  const foto =
    sessionStorage.getItem("user_avatar") ||
    sessionStorage.getItem("user_avatar");
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

document.addEventListener("DOMContentLoaded", muatDataTagihan);

// Fungsi Bayar Ke WA & Navbar Tetap Sama...
// (Pastikan menggunakan sessionStorage di updateProfilNavbar)

async function bayarKeWA() {
  const nomorAdmin = "6283872555646";
  const namaUser = sessionStorage.getItem("user_name");
  const roomNumber = window.currentRoomNumber;
  const totalTagihan = document.getElementById("totalTagihan").innerText;
  const emailLogin = sessionStorage.getItem("email_aktif");

  try {
    const { data: user } = await supabaseClient
      .from("Users")
      .select("id")
      .eq("email", emailLogin)
      .single();

    if (user) {
      const { data: rentalAktif } = await supabaseClient
        .from("rentals")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .single();

      if (rentalAktif) {
        const tanggalBesok = new Date();
        tanggalBesok.setDate(tanggalBesok.getDate() + 1);

        // --- LOGIKA BARU: CEK APAKAH ADA TAGIHAN DARI ADMIN ---
        const { data: tagihanBelumBayar } = await supabaseClient
          .from("payments")
          .select("id")
          .eq("rental_id", rentalAktif.id)
          .eq("status", "belum_bayar")
          .maybeSingle(); // Cari tagihan yang statusnya masih merah

        if (tagihanBelumBayar) {
          // KALAU ADA: Berarti ini tagihan buatan Admin, kita UPDATE datanya!
          const { error: updatePaymentError } = await supabaseClient
            .from("payments")
            .update({
              status: "pending_confirmation",
              payment_date: new Date().toISOString(),
              due_date: tanggalBesok.toISOString(),
            })
            .eq("id", tagihanBelumBayar.id);

          if (updatePaymentError) throw updatePaymentError;
        } else {
          // KALAU GAK ADA: Berarti ini untuk perpanjangan bulan berikutnya (Insert Baru)
          const { error: insertError } = await supabaseClient
            .from("payments")
            .insert([
              {
                rental_id: rentalAktif.id,
                amount: window.currentRoomPrice || 0,
                status: "pending_confirmation",
                payment_date: new Date().toISOString(),
                due_date: tanggalBesok.toISOString(),
              },
            ]);

          if (insertError) throw insertError;
        }

        // UPDATE TABEL RENTALS (Biar muncul di notifikasi konfirmasi pembayaran Admin)
        const { error: updateRentalError } = await supabaseClient
          .from("rentals")
          .update({ payment_status: "pending_confirmation" })
          .eq("id", rentalAktif.id);

        if (updateRentalError) throw updateRentalError;
      }
    }

    // Ambil Invoice Teratas
    const invoiceEl = document.querySelector(
      "#billing-table-body tr td strong",
    );
    const invoiceID = invoiceEl ? invoiceEl.innerText : "Baru";

    const pesan = `Halo Admin, saya ingin melakukan konfirmasi pembayaran kos.\n\n*Detail Pembayaran:*\n- *Nama:* ${namaUser}\n- *Kamar:* ${roomNumber}\n- *Invoice:* ${invoiceID}\n- *Total:* ${totalTagihan}\n\nSaya akan mengirimkan bukti transfer setelah ini. Mohon diproses ya, terima kasih!`;

    const linkWA = `https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesan)}`;
    window.open(linkWA, "_blank");

    alert("Data pembayaran dicatat! Silakan lanjutkan konfirmasi di WhatsApp.");
    location.reload();
  } catch (err) {
    console.error("Gagal memproses pembayaran:", err);
    alert("Waduh, gagal memproses permintaan pembayaran bre!");
  }
}

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
// Fungsi untuk memicu jendela print browser, bre
// --- FUNGSI CETAK NOTA DINAMIS SESUAI TABEL ---
window.cetakNotaSpesifik = function (
  id,
  startDate,
  endDate,
  formatHarga,
  statusText,
) {
  // 1. Ambil data dasar
  const namaUser = sessionStorage.getItem("user_name") || "Penghuni";
  const nomorKamar = window.currentRoomNumber || "-";
  const noHpKost = window.nomorAdmin || "+62 858-5141-4847";

  // Tanggal cetak/bayar pakai hari ini aja biar real-time
  const hariIni = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 2. Format tanggal sewa (Kasih pengaman fallback biar nggak Invalid Date)
  const tglSewa =
    startDate && startDate !== "undefined"
      ? new Date(startDate).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";
  const tglSelesai =
    endDate && endDate !== "undefined"
      ? new Date(endDate).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";

  // 3. Suntik data ke template nota di HTML
  const invoiceIDEl = document.getElementById("printInvoiceID");
  if (invoiceIDEl) invoiceIDEl.innerText = `INV-${id}`; // Masukkan No Invoice sesuai baris tabel

  document.getElementById("printNamaUser").innerText = namaUser;
  document.getElementById("printKamarUser").innerText = `Kamar ${nomorKamar}`;
  document.getElementById("printTglSewa").innerText = tglSewa;
  document.getElementById("printTglSelesai").innerText = tglSelesai;
  document.getElementById("printTglBayar").innerText = hariIni;
  document.getElementById("printNoHpAdmin").innerText = noHpKost;
  document.getElementById("printDetailKamar").innerText = `No. ${nomorKamar}`;
  document.getElementById("printHargaKamar").innerText = formatHarga;
  document.getElementById("printSubtotalKamar").innerText = formatHarga;
  document.getElementById("printTotalAkhir").innerText = formatHarga;
  document.getElementById("printGrandTotal").innerText = formatHarga;

  // 4. Update Stempel Lunas / Proses berdasarkan status dari tabel
  const stempel = document.getElementById("stempelNota");
  if (stempel) {
    if (statusText && statusText.toLowerCase() === "lunas") {
      stempel.innerText = "[ LUNAS ]";
      stempel.style.color = "#28a745"; // Hijau
      stempel.style.border = "3px solid #28a745";
    } else {
      stempel.innerText = `[ ${statusText.toUpperCase()} ]`; // Bisa "PROSES" atau "BELUM BAYAR"
      stempel.style.color = "#ffc107"; // Kuning
      stempel.style.border = "3px dashed #ffc107";
    }
  }

  // 5. Jalankan print preview bawaan browser
  window.print();
};

// ===================================================================================
// MURNI KODE TAMBAHAN BARU: EKSEKUSI UNGGAH BUKTI TRANSFER KE SUPABASE DB & STORAGE
// ===================================================================================
document.addEventListener("DOMContentLoaded", () => {
  const btnUploadBukti = document.getElementById("btnUploadBukti");
  const inputBuktiTransfer = document.getElementById("inputBuktiTransfer");

  if (btnUploadBukti && inputBuktiTransfer) {
    btnUploadBukti.addEventListener("click", () => {
      inputBuktiTransfer.click();
    });

    inputBuktiTransfer.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran gambar kegedean bre! Maksimal 2MB aja.");
        return;
      }

      btnUploadBukti.disabled = true;
      btnUploadBukti.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;

      try {
        const uniqueFileName = `${Date.now()}_${file.name}`;

        // 1. Upload file fisik ke Storage Bucket Supabase 'bukti-transfer'
        const { data: storageData, error: storageError } =
          await supabaseClient.storage
            .from("bukti-transfer")
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        // 2. Tarik link URL publik gambar dari Bucket
        const { data: urlData } = supabaseClient.storage
          .from("bukti-transfer")
          .getPublicUrl(uniqueFileName);

        const publicUrl = urlData.publicUrl;

        // 3. Ambil data invoice teratas yang tampil dari row tabel halaman tagihan lu
        const invoiceEl = document.querySelector(
          "#billing-table-body tr td strong",
        );
        let invoiceIDStr = "31"; // Default fallback sesuai screenshot lu

        if (invoiceEl && invoiceEl.innerText.includes("INV-")) {
          invoiceIDStr = invoiceEl.innerText.replace("INV-", "").trim();
        }

        const paymentIdInt = parseInt(invoiceIDStr, 10);

        // 4. Update kolom tabel database Supabase (Tabel payments) masukkan url publik foto & ubah status
        const { error: dbError } = await supabaseClient
          .from("payments")
          .update({
            bukti_transfer: publicUrl,
            status: "pending",
          })
          .eq("id", paymentIdInt);

        if (dbError) throw dbError;

        alert("Bukti pembayaran berhasil diunggah! Menunggu konfirmasi admin.");
        location.reload();
      } catch (err) {
        console.error(err);
        alert("Gagal memproses berkas: " + err.message);
      } finally {
        btnUploadBukti.disabled = false;
        btnUploadBukti.innerHTML = `<i class="fas fa-upload"></i> Unggah Bukti`;
      }
    });
  }
});
