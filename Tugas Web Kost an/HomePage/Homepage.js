// 1. Definisikan dulu opsinya agar tidak ReferenceError
const observerOptions = {
  threshold: 0.1,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
    }
  });
}, observerOptions);

// 2. Gunakan pengecekan agar tidak error jika elemen tidak ada
document.querySelectorAll(".card").forEach((card) => {
  observer.observe(card);
});

// 3. Gunakan addEventListener daripada window.onclick
window.addEventListener("click", function (event) {
  const modal = document.getElementById("loginModal");
  if (event.target == modal) {
    closeLoginModal();
  }
});

// 4. Pastikan fungsi tersedia secara global
window.openLoginModal = function () {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
};

window.closeLoginModal = function () {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
};

// Menutup modal jika user klik di luar kotak modal
window.onclick = function (event) {
  if (event.target == modal) {
    closeLoginModal();
  }
};

// Kode Navbar yang sebelumnya tetap dipertahankan di sini...
window.addEventListener("scroll", function () {
  const navbar = document.getElementById("navbar");
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});
