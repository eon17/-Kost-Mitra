window.updateProfilNavbar = function () {
  const nama = localStorage.getItem("user_name");
  const foto = localStorage.getItem("user_avatar");
  const role = localStorage.getItem("user_role") || "Penghuni";

  const namaEl = document.getElementById("namaUser");
  const roleEl = document.getElementById("roleUser");
  const fotoEl = document.getElementById("fotoProfil");

  if (nama && namaEl) namaEl.innerText = nama;
  if (roleEl) {
    // Kalau kamar udah ketemu, tulisan "User" berubah jadi nomor kamar
    roleEl.innerText = window.currentRoomNumber
      ? `Penghuni Kamar ${window.currentRoomNumber}`
      : role;
  }
  if (foto && fotoEl && foto !== "null" && foto !== "") {
    fotoEl.src = foto;
  }
};
