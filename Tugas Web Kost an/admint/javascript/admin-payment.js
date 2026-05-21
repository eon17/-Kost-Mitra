// ==========================================
// FILE: admin-payments.js
// FUNGSI: Kelola Pesanan, Pembayaran, Riwayat & Laporan
// ==========================================

/* =========================================
   FUNGSI: TAMPILKAN PESANAN PENDING
   ========================================= */
async function tampilkanPendingRentals() {
  const tabelPending = document.getElementById("tabelPending");
  if (!tabelPending) return;

  const { data: pendingData, error } = await window.supabaseClient
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

    const { error: errUpdateRental } = await window.supabaseClient
      .from("rentals")
      .update(updateData)
      .eq("id", idRental);
    if (errUpdateRental) throw errUpdateRental;

    if (statusBaru === "approved") {
      if (!idKamar || idKamar === "undefined") {
        alert("Gagal: ID Kamar nggak ketemu!");
        return;
      }

      const { data: rentalData } = await window.supabaseClient
        .from("rentals")
        .select("user_id")
        .eq("id", idRental)
        .single();
      const { data: roomData } = await window.supabaseClient
        .from("Rooms")
        .select("price")
        .eq("id", idKamar)
        .single();

      const { error: errUpdateRoom } = await window.supabaseClient
        .from("Rooms")
        .update({ status: "Paid", "user.id": rentalData.user_id })
        .eq("id", idKamar);
      if (errUpdateRoom) throw errUpdateRoom;

      const { error: errInsertPayment } = await window.supabaseClient
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
    alert("Gagal: " + err.message);
  }
};

/* =========================================
   FUNGSI: TAMPILKAN KONFIRMASI PEMBAYARAN
   ========================================= */
async function tampilkanKonfirmasiPembayaran() {
  const container = document.getElementById("tabelKonfirmasiPembayaran");
  if (!container) return;

  const { data, error } = await window.supabaseClient
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
    let paymentTerkait = null;
    if (item.payments && item.payments.length > 0) {
      paymentTerkait = item.payments.find(
        (p) => p.status === "pending_confirmation",
      );
    }

    if (paymentTerkait) {
      if (paymentTerkait.bukti_transfer) {
        linkBukti = `<a href="${paymentTerkait.bukti_transfer}" target="_blank" style="background-color: #e0f2fe; color: #0284c7; padding: 6px 10px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; display:inline-block;"><i class="fas fa-file-invoice-dollar"></i> Cek Bukti</a>`;
      } else {
        linkBukti = `
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
            <input type="file" id="bukti-rental-${item.id}" accept="image/*" style="font-size:11px; max-width:160px; padding:2px; border:1px solid #ccc; border-radius:4px;">
            <button onclick="uploadBuktiOlehAdmin('${paymentTerkait.id}', 'bukti-rental-${item.id}', this)" style="background:#007bff; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer;"><i class="fas fa-upload"></i> Upload Bukti</button>
          </div>`;
      }
    } else {
      linkBukti = `<span style="color:#666; font-size:12px; font-style:italic;">Menunggu tagihan...</span>`;
    }

    container.innerHTML += `
      <tr>
        <td>${item.Users?.name || "User"}</td>
        <td>Kamar ${item.Rooms?.room_number || "-"}</td>
        <td>${hargaFormat}</td>
        <td>${linkBukti}</td>
        <td>${tglTampil}</td>
        <td style="display:flex; gap:8px; justify-content:flex-start;">
          <button class="btn btn-success" style="background:#28a745; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="verifikasiBayar('${item.id}', '${item.end_date}', '${item.room_id}')"><i class="fas fa-check"></i> Selesai</button>
          <button class="btn btn-danger" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="batalBayar('${item.id}')"><i class="fas fa-times"></i> Batal</button>
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
    const { error: uploadError } = await window.supabaseClient.storage
      .from("bukti_transfer")
      .upload(namaFileUnik, fileSiapUpload);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = window.supabaseClient.storage
      .from("bukti_transfer")
      .getPublicUrl(namaFileUnik);

    const { error: updateErr } = await window.supabaseClient
      .from("payments")
      .update({ bukti_transfer: publicUrlData.publicUrl })
      .eq("id", paymentId);
    if (updateErr) throw updateErr;

    alert("Mantap! Bukti transfer berhasil di-upload.");
    tampilkanKonfirmasiPembayaran();
  } catch (err) {
    alert("Gagal upload bre: " + err.message);
    btnUpload.disabled = false;
    btnUpload.innerHTML = '<i class="fas fa-upload"></i> Upload Bukti';
  }
};

// --- SELESAIKAN VERIFIKASI PEMBAYARAN ---
window.verifikasiBayar = async function (idRental, currentEndDate, roomId) {
  if (!confirm("Yakin ingin menyelesaikan pembayaran kamar ini?")) return;

  try {
    const { error: errorPayment } = await window.supabaseClient
      .from("payments")
      .update({ status: "lunas" })
      .eq("rental_id", idRental)
      .eq("status", "pending_confirmation");
    if (errorPayment) throw errorPayment;

    let newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const { error: errorRental } = await window.supabaseClient
      .from("rentals")
      .update({ payment_status: "lunas", end_date: newEndDate.toISOString() })
      .eq("id", idRental);
    if (errorRental) throw errorRental;

    alert("Mantap! Pembayaran berhasil diselesaikan.");
    tampilkanKonfirmasiPembayaran();
    tampilkanHistoryPembayaran();
    tampilkanKamar(); // Memanggil fungsi dari admin-rooms.js (Aman karena global)
  } catch (error) {
    alert("Waduh, ada error saat menyelesaikan pembayaran nih bre.");
  }
};

// --- BATALKAN TAGIHAN ---
window.batalBayar = async function (idRental) {
  if (
    !confirm(
      "Yakin ingin membatalkan tagihan ini? Status akan kembali 'Unpaid'.",
    )
  )
    return;

  try {
    const { error: errorRental } = await window.supabaseClient
      .from("rentals")
      .update({ payment_status: "unpaid" })
      .eq("id", idRental);
    if (errorRental) throw errorRental;

    const { error: errorPayment } = await window.supabaseClient
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
    alert("Waduh, ada error.");
  }
};

// ==========================================
// FILTER & RIWAYAT PEMBAYARAN
// ==========================================

function inisialisasiFilterRiwayat() {
  const selectTahun = document.getElementById("filterTahun");
  if (!selectTahun) return;
  const thnSekarang = new Date().getFullYear();
  let htmlTahun = `<option value="ALL">Semua Tahun</option>`;
  for (let y = 2024; y <= thnSekarang + 10; y++) {
    htmlTahun += `<option value="${y}">${y}</option>`;
  }
  selectTahun.innerHTML = htmlTahun;
}

window.setFilterBulanDropdown = function (valueBulan) {
  tampilkanHistoryPembayaran();
};
window.setFilterTahunDropdown = function (valueTahun) {
  tampilkanHistoryPembayaran();
};

async function tampilkanHistoryPembayaran() {
  const container = document.getElementById("tabelHistoryPembayaran");
  if (!container) return;

  const filterBulan = document.getElementById("filterBulan")?.value || "ALL";
  const filterTahun = document.getElementById("filterTahun")?.value || "ALL";

  const { data, error } = await window.supabaseClient
    .from("payments")
    .select(
      `id, amount, status, bukti_transfer, payment_date, rental_id, rentals ( Users ( name ), Rooms ( room_number ) )`,
    )
    .order("id", { ascending: false });

  if (error) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data dari database.</td></tr>`;
    return;
  }

  let historyData = data.filter(
    (p) => p.status === "lunas" || p.status === "failed",
  );

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

  if (historyData.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;"><i class="fas fa-search-minus"></i> Tidak ada riwayat yang cocok...</td></tr>`;
    return;
  }

  container.innerHTML = "";
  historyData.forEach((item) => {
    const hargaFormat = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(item.amount || 0);

    let statusBadge =
      item.status === "lunas"
        ? `<span style="background:#d4edda; color:#155724; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fas fa-check-circle"></i> Selesai</span>`
        : `<span style="background:#f8d7da; color:#721c24; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="fas fa-times-circle"></i> Batal</span>`;

    let linkBukti = item.bukti_transfer
      ? `<a href="${item.bukti_transfer}" target="_blank" style="background-color: #e0f2fe; color: #0284c7; padding: 5px 10px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display:inline-block;"><i class="fas fa-eye"></i> Lihat Foto</a>`
      : `<span style="color:#999; font-style:italic; font-size:12px;">Tidak Ada</span>`;

    let tglBayarTampil = item.payment_date
      ? new Date(item.payment_date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";

    container.innerHTML += `
      <tr>
        <td>${item.rentals?.Users?.name || "User Dihapus"}</td>
        <td>Kamar ${item.rentals?.Rooms?.room_number || "-"}</td>
        <td><strong>${hargaFormat}</strong></td>
        <td>${linkBukti}</td>
        <td>${statusBadge} <br><small style="color:#888; font-size:10px;">${tglBayarTampil}</small></td>
        <td>
          <button class="btn btn-danger" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;" onclick="hapusPermanenHistory('${item.id}')"><i class="fas fa-trash-alt"></i> Hapus</button>
        </td>
      </tr>`;
  });
}

window.hapusPermanenHistory = async function (paymentId) {
  if (
    !confirm(
      "Apakah Anda yakin ingin menghapus data ini dan fotonya dari storage?",
    )
  )
    return;

  try {
    const { data: paymentData } = await window.supabaseClient
      .from("payments")
      .select("bukti_transfer")
      .eq("id", paymentId)
      .single();

    if (
      paymentData &&
      paymentData.bukti_transfer &&
      paymentData.bukti_transfer.includes("supabase.co")
    ) {
      try {
        const namaFileLama = paymentData.bukti_transfer.split("/").pop();
        await window.supabaseClient.storage
          .from("bukti_transfer")
          .remove([namaFileLama]);
      } catch (err) {
        console.error("Gagal hapus storage:", err);
      }
    }

    const { error: deleteError } = await window.supabaseClient
      .from("payments")
      .delete()
      .eq("id", paymentId);
    if (deleteError) throw deleteError;

    alert("Sip bre! Rekor pembayaran dan foto buktinya berhasil dibuang.");
    tampilkanHistoryPembayaran();
  } catch (err) {
    alert("Gagal menghapus rekor: " + err.message);
  }
};

/* =========================================
   FUNGSI: TAMPILKAN LAPORAN KERUSAKAN
   ========================================= */
async function tampilkanLaporanKerusakan() {
  const reportContainer = document.getElementById("laporanRusakContainer");
  if (!reportContainer) return;

  try {
    const { data: reports, error } = await window.supabaseClient
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
    const { error } = await window.supabaseClient
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
    const { error } = await window.supabaseClient
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
