document.addEventListener("DOMContentLoaded", () => {
  const darkModeBtn = document.getElementById("dark-mode-toggle");
  const modeIcon = document.querySelector(".mode-icon");
  const body = document.body;

  // 1. Cek apakah pengguna sebelumnya sudah memilih dark mode di localStorage
  const savedTheme = localStorage.getItem("theme");

  // 2. Fungsi untuk menyalakan Dark Mode
  const enableDarkMode = () => {
    body.setAttribute("data-theme", "dark"); // Menambahkan atribut ke body
    localStorage.setItem("theme", "dark"); // Simpan di memori browser
    if (modeIcon) modeIcon.innerHTML = "☀️ Mode"; // Ganti ikon jadi matahari
  };

  // 3. Fungsi untuk menyalakan Light Mode (Default)
  const disableDarkMode = () => {
    body.removeAttribute("data-theme"); // Hapus atribut dari body
    localStorage.setItem("theme", "light"); // Simpan di memori browser
    if (modeIcon) modeIcon.innerHTML = "🌙 Mode"; // Ganti ikon jadi bulan
  };

  // 4. Terapkan tema saat halaman pertama kali dimuat
  if (savedTheme === "dark") {
    enableDarkMode();
  }

  // 5. Jalankan aksi saat tombol diklik
  if (darkModeBtn) {
    darkModeBtn.addEventListener("click", () => {
      // Cek apakah saat ini sedang mode gelap?
      if (body.getAttribute("data-theme") === "dark") {
        disableDarkMode(); // Jika ya, matikan
      } else {
        enableDarkMode(); // Jika tidak, nyalakan
      }
    });
  }
});
