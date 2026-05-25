// ==========================================
// FILE: admin-room.js
// FUNGSI: Kelola Kamar, Fasilitas & Form (Dua Kategori Foto)
// ==========================================

function applyPriceFormatter(id) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("keyup", function () {
      let val = this.value.replace(/\D/g, "");
      if (val !== "") this.value = new Intl.NumberFormat("id-ID").format(val);
    });
  }
}
applyPriceFormatter("inputPrice");
applyPriceFormatter("editPrice");

function cleanPriceValue(val) {
  return parseInt(val.toString().replace(/\D/g, "")) || 0;
}

// --- FUNGSI PARSING DATA FOTO (Membaca JSON) ---
function parseDataFoto(fotoString) {
  if (!fotoString) return { kamar: [], umum: [] };
  try {
    if (fotoString.startsWith("{")) return JSON.parse(fotoString);
    // Backward compatibility (jika ada data lama format koma/URL biasa)
    return { kamar: fotoString.split(","), umum: [] };
  } catch (e) {
    return { kamar: [fotoString], umum: [] };
  }
}

// --- FUNGSI PREVIEW FOTO PER KATEGORI ---
window.previewKategoriFoto = function (event, containerId, maxFile) {
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = "";
  const files = event.target.files;

  if (files.length > maxFile) {
    alert(
      `Waduh bre! Maksimal hanya boleh ${maxFile} foto untuk kategori ini.`,
    );
    event.target.value = "";
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader();
    reader.onload = function (e) {
      if (container)
        container.innerHTML += `<img src="${e.target.result}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
    };
    reader.readAsDataURL(files[i]);
  }
};

// --- FUNGSI UPLOAD FOTO KE STORAGE SUPABASE ---
async function prosesUploadKategori(filesList, noKamar, namaKategori) {
  let urls = [];
  for (let i = 0; i < filesList.length; i++) {
    const fileSiap = await kompresFoto(filesList[i]);
    const namaUnik = `kamar-${noKamar}-${namaKategori}-${Date.now()}-${i}.webp`;

    const { error } = await window.supabaseClient.storage
      .from("foto_kamar")
      .upload(namaUnik, fileSiap);
    if (!error) {
      const { data } = window.supabaseClient.storage
        .from("foto_kamar")
        .getPublicUrl(namaUnik);
      urls.push(data.publicUrl);
    }
  }
  return urls;
}

async function muatFasilitas() {
  const { data: facilities, error } = await window.supabaseClient
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

async function tampilkanKamar() {
  const { data, error } = await window.supabaseClient
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

    let tglPembayaran = "-";
    const approvedRentals = kamar.rentals
      ? kamar.rentals.filter((r) => r.status === "approved")
      : [];
    const activeRental =
      approvedRentals.length > 0
        ? approvedRentals.sort((a, b) => b.id - a.id)[0]
        : null;

    if (activeRental && activeRental.end_date) {
      const tglSelesai = new Date(activeRental.end_date);
      tglSelesai.setHours(0, 0, 0, 0);
      const hariIni = new Date(skrg);
      hariIni.setHours(0, 0, 0, 0);

      const d = new Date(tglSelesai);
      d.setDate(d.getDate() + 1);
      tglPembayaran = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);

      // --- PERBAIKAN AUTO UPDATE UNPAID/PAID YANG KAMU BUAT TETAP AMAN DI SINI ---
      if (hariIni > tglSelesai && statusSekarang === "Paid") {
        statusSekarang = "Unpaid";
        await window.supabaseClient
          .from("Rooms")
          .update({ status: "Unpaid" })
          .eq("id", kamar.id);
      } else if (hariIni <= tglSelesai && statusSekarang === "Unpaid") {
        statusSekarang = "Paid";
        await window.supabaseClient
          .from("Rooms")
          .update({ status: "Paid" })
          .eq("id", kamar.id);
      }
    }

    // Membaca Data Foto dari Format JSON
    const dataFoto = parseDataFoto(kamar.foto_kamar);
    let urlFotoUtama = null;

    // Gunakan foto dalam kamar sebagai thumbnail, jika tidak ada, pakai foto umum
    if (dataFoto.kamar && dataFoto.kamar.length > 0) {
      urlFotoUtama = dataFoto.kamar[0];
    } else if (dataFoto.umum && dataFoto.umum.length > 0) {
      urlFotoUtama = dataFoto.umum[0];
    }

    const gambarKamar = urlFotoUtama
      ? `<img src="${urlFotoUtama}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 10px;">`
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

      tombolAksiHTML = `<button class="btn-action btn-reminder" onclick="kirimReminderWA('${penghuni.phone || ""}', '${penghuni.name || "Penghuni"}', '${kamar.room_number}')">Kirim Pengingat</button>`;
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

window.kirimReminderWA = function (nomor, nama, roomNumber) {
  if (!nomor || nomor === "-" || nomor === "EMPTY") {
    alert("Waduh bre, nomor WA penghuni ini nggak ada!");
    return;
  }
  let formattedPhone = nomor.replace(/\D/g, "");
  if (formattedPhone.startsWith("0"))
    formattedPhone = "62" + formattedPhone.slice(1);
  const pesan = `Halo *${nama}*, ini Admin Kost Keiren.\nMengingatkan bahwa pembayaran sewa untuk *Kamar ${roomNumber}* sudah memasuki tanggal jatuh tempo. Mohon segera melakukan konfirmasi pembayaran ya.`;
  window.open(
    `https://wa.me/${formattedPhone}?text=${encodeURIComponent(pesan)}`,
    "_blank",
  );
};

// --- LOGIKA MODAL TAMBAH & EDIT KAMAR ---
const modal = document.getElementById("modalTambah");
const btnTambahKamar = document.getElementById("btnTambahKamar");
const formTambah = document.getElementById("formTambahKamar");

if (btnTambahKamar)
  btnTambahKamar.onclick = () => (modal.style.display = "flex");

window.tutupModal = function () {
  if (modal) {
    modal.style.display = "none";
    formTambah.reset();
  }
  const prevKamar = document.getElementById("previewKamarTambah");
  if (prevKamar) prevKamar.innerHTML = "";
  const prevUmum = document.getElementById("previewUmumTambah");
  if (prevUmum) prevUmum.innerHTML = "";
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
    const lantai = document.getElementById("inputFloor").value;
    const luas = document.getElementById("inputRoomSize").value;
    const kapasitas = document.getElementById("inputCapacity").value;
    const aturanKamar = document.getElementById("inputRoomRules").value;

    const btnSubmit = formTambah.querySelector('button[type="submit"]');
    btnSubmit.textContent = "Mengupload Foto...";
    btnSubmit.disabled = true;

    try {
      const filesKamar = document.getElementById("inputFotoKamar")?.files || [];
      const filesUmum = document.getElementById("inputFotoUmum")?.files || [];

      let urlsKamar = [];
      let urlsUmum = [];
      if (filesKamar.length > 0)
        urlsKamar = await prosesUploadKategori(filesKamar, noKamar, "kamar");
      if (filesUmum.length > 0)
        urlsUmum = await prosesUploadKategori(filesUmum, noKamar, "umum");

      // Simpan dalam format JSON String
      let stringFotoDatabase = null;
      if (urlsKamar.length > 0 || urlsUmum.length > 0) {
        stringFotoDatabase = JSON.stringify({
          kamar: urlsKamar,
          umum: urlsUmum,
        });
      }

      const { data: newRoom, error: roomError } = await window.supabaseClient
        .from("Rooms")
        .insert([
          {
            room_number: noKamar,
            price: harga,
            status: statusKamar,
            foto_kamar: stringFotoDatabase,
            floor: lantai || null,
            room_size: luas,
            capacity: kapasitas || null,
            room_rules: aturanKamar,
          },
        ])
        .select();

      if (roomError) throw roomError;

      if (newRoom && newRoom.length > 0) {
        const checkboxes = document.querySelectorAll(
          '#formTambahKamar input[name="fasilitas[]"]:checked',
        );
        if (checkboxes.length > 0) {
          const fasilitasData = Array.from(checkboxes).map((cb) => ({
            room_id: newRoom[0].id,
            facility_id: cb.value,
          }));
          await window.supabaseClient
            .from("room_facility")
            .insert(fasilitasData);
        }
      }
      alert("Kamar " + noKamar + " sukses ditambah!");
      tutupModal();
      tampilkanKamar();
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      btnSubmit.textContent = "Simpan Kamar";
      btnSubmit.disabled = false;
    }
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

  const prevKamarEdit = document.getElementById("previewKamarEdit");
  if (prevKamarEdit) prevKamarEdit.innerHTML = "";
  const prevUmumEdit = document.getElementById("previewUmumEdit");
  if (prevUmumEdit) prevUmumEdit.innerHTML = "";

  document
    .querySelectorAll(".edit-fasilitas")
    .forEach((cb) => (cb.checked = false));
  const { data: roomFacs } = await window.supabaseClient
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

    try {
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
        // KOREKSI: Gunakan string '"user.id"' sesuai nama kolom di database Supabase kamu
        dataUpdate["user.id"] = null;
        try {
          await window.supabaseClient
            .from("rentals")
            .update({ status: "completed" })
            .eq("room_id", idKamar)
            .eq("status", "approved");
        } catch (err) {}
      }

      const filesKamar = document.getElementById("editFotoKamar")?.files || [];
      const filesUmum = document.getElementById("editFotoUmum")?.files || [];

      // Jika admin mengunggah foto baru saat edit
      if (filesKamar.length > 0 || filesUmum.length > 0) {
        // Hapus SEMUA foto lama dari storage
        const { data: roomData } = await window.supabaseClient
          .from("Rooms")
          .select("foto_kamar")
          .eq("id", idKamar)
          .single();
        if (roomData && roomData.foto_kamar) {
          const dataFotoLama = parseDataFoto(roomData.foto_kamar);
          const semuaFotoLama = [
            ...(dataFotoLama.kamar || []),
            ...(dataFotoLama.umum || []),
          ];
          for (const urlFoto of semuaFotoLama) {
            if (urlFoto.includes("supabase.co")) {
              try {
                await window.supabaseClient.storage
                  .from("foto_kamar")
                  .remove([urlFoto.split("/").pop()]);
              } catch (err) {}
            }
          }
        }

        // Upload foto baru ke masing-masing kategori
        let urlsKamar = [];
        let urlsUmum = [];
        if (filesKamar.length > 0)
          urlsKamar = await prosesUploadKategori(filesKamar, noKamar, "kamar");
        if (filesUmum.length > 0)
          urlsUmum = await prosesUploadKategori(filesUmum, noKamar, "umum");

        dataUpdate.foto_kamar = JSON.stringify({
          kamar: urlsKamar,
          umum: urlsUmum,
        });
      }

      const { error: updateError } = await window.supabaseClient
        .from("Rooms")
        .update(dataUpdate)
        .eq("id", idKamar);
      if (updateError) throw updateError;

      await window.supabaseClient
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
        await window.supabaseClient.from("room_facility").insert(fasilitasBaru);
      }
      alert("Sukses diperbarui!");
      if (modalEdit) modalEdit.style.display = "none";
      tampilkanKamar();
    } catch (err) {
      alert("Gagal update: " + err.message);
    } finally {
      btnUpdate.textContent = "Update Kamar";
      btnUpdate.disabled = false;
    }
  });
}

window.hapusKamar = async function (idKamar, noKamar) {
  if (confirm(`Hapus Kamar ${noKamar}? Seluruh data akan lenyap.`)) {
    const { data: roomData } = await window.supabaseClient
      .from("Rooms")
      .select("foto_kamar")
      .eq("id", idKamar)
      .single();

    // Hapus seluruh foto (kamar & umum) dari storage
    if (roomData && roomData.foto_kamar) {
      const dataFotoLama = parseDataFoto(roomData.foto_kamar);
      const semuaFotoLama = [
        ...(dataFotoLama.kamar || []),
        ...(dataFotoLama.umum || []),
      ];
      for (const urlFoto of semuaFotoLama) {
        if (urlFoto.includes("supabase.co")) {
          try {
            await window.supabaseClient.storage
              .from("foto_kamar")
              .remove([urlFoto.split("/").pop()]);
          } catch (err) {}
        }
      }
    }

    const { error } = await window.supabaseClient
      .from("Rooms")
      .delete()
      .eq("id", idKamar);
    if (!error) {
      alert("Terhapus!");
      tampilkanKamar();
    }
  }
};
