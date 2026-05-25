// 1. Inisialisasi Supabase (PASTIKAN INI ADA DI PALING ATAS)
const { createClient } = supabase;

const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// 2. Tangkap elemen form
const formLogin = document.getElementById("formLogin");

// 3. Logika Login
formLogin.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Ambil input dan bersihkan (biar tidak ada spasi typo)
  const emailInput = document
    .getElementById("emailLogin")
    .value.trim()
    .toLowerCase();
  const passwordInput = document.getElementById("passwordLogin").value.trim();

  const tombolMasuk = document.querySelector(".btn-register");

  // Set status tombol ke loading
  tombolMasuk.textContent = "Mengecek...";
  tombolMasuk.disabled = true;

  try {
    console.log("Mencoba login untuk:", emailInput);

    // 4. Query manual ke tabel 'Users' (karena kita pakai ID int8 manual)
    const { data, error } = await supabaseClient
      .from("Users")
      .select("*")
      .eq("email", emailInput)
      .eq("password", passwordInput);

    if (error) throw error;

    // 5. Verifikasi Hasil
    // 5. Verifikasi Hasil
    if (data && data.length > 0) {
      const user = data[0];

      if (user.role === "admin") {
        alert("Login Berhasil! Selamat datang, " + user.name);

        // --- TAMBAHKAN BARIS INI (SANGAT PENTING!) ---
        sessionStorage.setItem("email_aktif", user.email);
        sessionStorage.setItem("user_name", user.name);
        // ------------------------------------------

        // Keluar satu folder, lalu masuk ke folder admint
        window.location.href = "../admint/admin.html";
      } else {
        alert("Maaf, akun ini bukan Admin. Silakan gunakan dashboard user.");
      }
    } else {
      alert("Email atau Password salah!");
    }
  } catch (err) {
    console.error("Gagal Login:", err.message);
    alert("Terjadi kesalahan sistem: " + err.message);
  } finally {
    // Apapun yang terjadi, kembalikan tombol ke normal
    tombolMasuk.textContent = "Masuk Sekarang";
    tombolMasuk.disabled = false;
  }
});
