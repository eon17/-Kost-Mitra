// 1. Inisialisasi Supabase
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
      window.currentRoomPrice = myRoom.price;

      const harga = myRoom.price || 0;
      const formatHarga = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(harga);

      const totalTagihanEl = document.getElementById("totalTagihan");
      if (totalTagihanEl) totalTagihanEl.innerText = formatHarga;

      const { data: rentalAktif } = await supabaseClient
        .from("rentals")
        .select("id, start_date, end_date")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (rentalAktif) {
        const { data: riwayatPayments } = await supabaseClient
          .from("payments")
          .select("id, amount, payment_date, status")
          .eq("rental_id", rentalAktif.id)
          .order("id", { ascending: false });

        prosesLogikaTagihan([rentalAktif], formatHarga);
        isiTabelRiwayat(riwayatPayments || [], formatHarga, rentalAktif);
      } else {
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

      // Sembunyikan tombol upload terpisah kalau ada di HTML
      if (document.getElementById("btnUploadBukti")) {
        document.getElementById("btnUploadBukti").style.display = "none";
      }

      // LANGSUNG BUKA FILE BROWSER SAAT KLIK BAYAR
      btnBayarEl.onclick = () => {
        const inputBuktiTransfer =
          document.getElementById("inputBuktiTransfer");
        if (inputBuktiTransfer) {
          inputBuktiTransfer.click();
        } else {
          alert("Sistem error: Input file tidak ditemukan di HTML.");
        }
      };
    }
  }
}

function isiTabelRiwayat(riwayatPayments, formatHarga, rentalAktif) {
  const tableBody = document.getElementById("billing-table-body");
  if (!tableBody) return;

  if (riwayatPayments && riwayatPayments.length > 0) {
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

        const totalPayments = riwayatPayments.length;
        const urutanPembayaran = totalPayments - index;

        let tglMulaSewa = new Date(baseStartDate);
        tglMulaSewa.setMonth(tglMulaSewa.getMonth() + (urutanPembayaran - 1));

        let tglTamatSewa = new Date(baseStartDate);
        tglTamatSewa.setMonth(tglTamatSewa.getMonth() + urutanPembayaran);

        const teksPeriodeSewa = tglMulaSewa.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });

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

window.cetakNotaSpesifik = function (
  id,
  startDate,
  endDate,
  formatHarga,
  statusText,
) {
  const namaUser = sessionStorage.getItem("user_name") || "Penghuni";
  const nomorKamar = window.currentRoomNumber || "-";
  const noHpKost = window.nomorAdmin || "+62 858-5141-4847";

  const hariIni = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

  const invoiceIDEl = document.getElementById("printInvoiceID");
  if (invoiceIDEl) invoiceIDEl.innerText = `INV-${id}`;

  if (document.getElementById("printNamaUser"))
    document.getElementById("printNamaUser").innerText = namaUser;
  if (document.getElementById("printKamarUser"))
    document.getElementById("printKamarUser").innerText = `Kamar ${nomorKamar}`;
  if (document.getElementById("printTglSewa"))
    document.getElementById("printTglSewa").innerText = tglSewa;
  if (document.getElementById("printTglSelesai"))
    document.getElementById("printTglSelesai").innerText = tglSelesai;
  if (document.getElementById("printTglBayar"))
    document.getElementById("printTglBayar").innerText = hariIni;
  if (document.getElementById("printNoHpAdmin"))
    document.getElementById("printNoHpAdmin").innerText = noHpKost;
  if (document.getElementById("printDetailKamar"))
    document.getElementById("printDetailKamar").innerText = `No. ${nomorKamar}`;
  if (document.getElementById("printHargaKamar"))
    document.getElementById("printHargaKamar").innerText = formatHarga;
  if (document.getElementById("printSubtotalKamar"))
    document.getElementById("printSubtotalKamar").innerText = formatHarga;
  if (document.getElementById("printTotalAkhir"))
    document.getElementById("printTotalAkhir").innerText = formatHarga;
  if (document.getElementById("printGrandTotal"))
    document.getElementById("printGrandTotal").innerText = formatHarga;

  const stempel = document.getElementById("stempelNota");
  if (stempel) {
    if (statusText && statusText.toLowerCase() === "lunas") {
      stempel.innerText = "[ LUNAS ]";
      stempel.style.color = "#28a745";
      stempel.style.border = "3px solid #28a745";
    } else {
      stempel.innerText = `[ ${statusText.toUpperCase()} ]`;
      stempel.style.color = "#ffc107";
      stempel.style.border = "3px dashed #ffc107";
    }
  }

  window.print();
};

document.addEventListener("DOMContentLoaded", muatDataTagihan);

// ===================================================================================
// LOGIKA UNGGAH BUKTI & REDIRECT WHATSAPP (SINGLE EVENT)
// ===================================================================================
// ===================================================================================
// LOGIKA UNGGAH BUKTI & REDIRECT WHATSAPP (SOLUSI ANTI BLOKIR)
// ===================================================================================
document.addEventListener("DOMContentLoaded", () => {
  const inputBuktiTransfer = document.getElementById("inputBuktiTransfer");
  const btnBayarEl = document.getElementById("btnBayar");

  if (inputBuktiTransfer) {
    inputBuktiTransfer.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran gambar kegedean bre! Maksimal 2MB aja.");
        inputBuktiTransfer.value = "";
        return;
      }

      if (btnBayarEl) {
        // Ubah tombol jadi loading dan matikan sementara
        btnBayarEl.disabled = true;
        btnBayarEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses...`;

        // Lepas aksi klik bayar biar gak ketindih
        btnBayarEl.onclick = null;
      }

      try {
        const emailLogin = sessionStorage.getItem("email_aktif");
        const namaUser = sessionStorage.getItem("user_name");
        const roomNumber = window.currentRoomNumber;
        const totalTagihan = document.getElementById("totalTagihan").innerText;
        const nomorAdmin = "6283872555646";

        // 1. Ambil Data
        const { data: user } = await supabaseClient
          .from("Users")
          .select("id")
          .eq("email", emailLogin)
          .single();
        if (!user) throw new Error("User tidak ditemukan");

        const { data: rentalAktif } = await supabaseClient
          .from("rentals")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .single();
        if (!rentalAktif) throw new Error("Kamar aktif tidak ditemukan");

        // 2. Upload File ke Storage
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const { error: storageError } = await supabaseClient.storage
          .from("bukti_transfer")
          .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        const { data: urlData } = supabaseClient.storage
          .from("bukti_transfer")
          .getPublicUrl(uniqueFileName);
        const publicUrl = urlData.publicUrl;

        // 3. Database Logika (Insert/Update tabel payments)
        const tanggalBesok = new Date();
        tanggalBesok.setDate(tanggalBesok.getDate() + 1);

        const { data: tagihanBelumBayar } = await supabaseClient
          .from("payments")
          .select("id")
          .eq("rental_id", rentalAktif.id)
          .eq("status", "belum_bayar")
          .maybeSingle();

        let invoiceIDStr = "Baru";

        if (tagihanBelumBayar) {
          const { error: updatePaymentError } = await supabaseClient
            .from("payments")
            .update({
              status: "pending_confirmation",
              payment_date: new Date().toISOString(),
              due_date: tanggalBesok.toISOString(),
              bukti_transfer: publicUrl,
            })
            .eq("id", tagihanBelumBayar.id);

          if (updatePaymentError) throw updatePaymentError;
          invoiceIDStr = tagihanBelumBayar.id;
        } else {
          const { data: newPayment, error: insertError } = await supabaseClient
            .from("payments")
            .insert([
              {
                rental_id: rentalAktif.id,
                amount: window.currentRoomPrice || 0,
                status: "pending_confirmation",
                payment_date: new Date().toISOString(),
                due_date: tanggalBesok.toISOString(),
                bukti_transfer: publicUrl,
              },
            ])
            .select("id")
            .single();

          if (insertError) throw insertError;
          if (newPayment) invoiceIDStr = newPayment.id;
        }

        await supabaseClient
          .from("rentals")
          .update({ payment_status: "pending_confirmation" })
          .eq("id", rentalAktif.id);

        // 4. Siapkan Link WA
        const pesan = `Halo Admin, saya ingin melakukan konfirmasi pembayaran kos.\n\n*Detail Pembayaran:*\n- *Nama:* ${namaUser}\n- *Kamar:* ${roomNumber}\n- *Invoice:* INV-${invoiceIDStr}\n- *Total:* ${totalTagihan}\n\nSaya telah mengunggah bukti transfer di sistem. Mohon diproses ya, terima kasih!`;
        const linkWA = `https://wa.me/${nomorAdmin}?text=${encodeURIComponent(pesan)}`;

        alert(
          "Bukti pembayaran berhasil diunggah! Klik tombol 'Lanjut ke WA' untuk mengirim pesan ke Admin.",
        );

        // 5. UBAH TOMBOL JADI "LANJUT KE WA"
        if (btnBayarEl) {
          btnBayarEl.disabled = false;
          btnBayarEl.style.backgroundColor = "#25D366"; // Warna hijau khas WhatsApp
          btnBayarEl.style.borderColor = "#25D366";
          btnBayarEl.style.color = "#fff";
          btnBayarEl.innerHTML = `<i class="fab fa-whatsapp" style="font-size:18px;"></i> Lanjut ke WA`;

          // Kasih aksi klik baru yang 100% aman dari pop-up blocker
          btnBayarEl.onclick = () => {
            window.open(linkWA, "_blank"); // Buka tab baru
            location.reload(); // Refresh halaman ini
          };
        }
      } catch (err) {
        console.error("Gagal memproses pembayaran:", err);
        alert(
          "Waduh, gagal memproses permintaan pembayaran bre! Pastikan internet lancar.",
        );

        if (btnBayarEl) {
          btnBayarEl.disabled = false;
          btnBayarEl.innerHTML = "Bayar Sekarang";
        }
      } finally {
        inputBuktiTransfer.value = "";
      }
    });
  }
});
