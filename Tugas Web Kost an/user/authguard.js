// auth-guard-user.js

async function checkUserSession() {
  const emailAktif =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  // 1. Cek keberadaan session di sessionStorage
  if (!emailAktif) {
    // Gunakan path absolut atau sesuaikan dengan folder login kamu
    window.location.href = "../LoginPage/login.html";
    return;
  }

  try {
    // 2. Verifikasi ke Supabase (Pastikan supabaseClient sudah terdefinisi)
    const { data: user, error } = await supabaseClient
      .from("Users")
      .select("role")
      .eq("email", emailAktif)
      .single();

    if (error || !user) {
      sessionStorage.clear();
      window.location.href = "../LoginPage/login.html";
      return;
    }

    // 3. Tampilkan halaman jika sukses
    document.body.style.display = "block";
    console.log("Verified User:", emailAktif);
  } catch (err) {
    window.location.href = "../LoginPage/login.html";
  }
}

// Langsung jalankan fungsi
checkUserSession();
