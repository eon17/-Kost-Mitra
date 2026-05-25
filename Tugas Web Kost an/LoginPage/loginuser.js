const SUPABASE_URL = "https://frvgzlsmdafichmldgrc.supabase.co";
const SUPABASE_KEY = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    // Cek data di tabel Users
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/Users?email=eq.${email}&password=eq.${password}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (data.length > 0) {
      alert("Login Berhasil! Halo " + data[0].name);

      // --- DISINI KUNCINYA ---
      sessionStorage.clear(); // Hapus semua data akun orang lain sebelum isi data baru

      sessionStorage.setItem("email_aktif", email);
      sessionStorage.setItem("user_name", data[0].name);
      sessionStorage.setItem("user_avatar", data[0].avatar_url || "");
      sessionStorage.setItem("user_role", data[0].role || "user");

      window.location.href = "../user/user.html";
    } else {
      alert("Email atau Password salah(atau belum daftar akun)");
    }
  } catch (err) {
    console.error(err);
    alert("Gagal koneksi ke server!");
  }
});
