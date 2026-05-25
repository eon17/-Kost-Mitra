const { createClient } = supabase;
const supabaseUrl = "https://frvgzlsmdafichmldgrc.supabase.co";
const supabaseKey = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function initProfilePage() {
  const emailLogin =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");

  if (!emailLogin) {
    window.location.href = "../LoginPage/login.html";
    return;
  }

  try {
    // 1. Ambil data lengkap dari tabel Users
    const { data: user, error } = await supabaseClient
      .from("Users")
      .select("id, name, email, avatar_url, phone")
      .eq("email", emailLogin)
      .single();

    if (error) throw error;

    if (user) {
      // 2. Update Tampilan Nama & Email
      if (document.getElementById("profileDisplayName"))
        document.getElementById("profileDisplayName").innerText = user.name;

      if (document.getElementById("inputName"))
        document.getElementById("inputName").value = user.name;

      if (document.getElementById("inputEmail"))
        document.getElementById("inputEmail").value = user.email;

      // 3. UPDATE NOMOR TELEPON
      const inputPhoneEl = document.getElementById("inputPhone");
      if (inputPhoneEl) {
        inputPhoneEl.value = user.phone ? user.phone : "";
      }

      // 4. Update Foto Profil
      if (user.avatar_url && document.getElementById("mainFotoProfil")) {
        document.getElementById("mainFotoProfil").src = user.avatar_url;
        sessionStorage.setItem("user_avatar", user.avatar_url);
      }

      // 5. Update Role (Cek dari tabel Rooms)
      const { data: myRoom } = await supabaseClient
        .from("Rooms")
        .select("room_number")
        .eq('"user.id"', user.id)
        .maybeSingle();

      if (document.getElementById("displayRole")) {
        document.getElementById("displayRole").innerText = myRoom
          ? `Penghuni Kamar ${myRoom.room_number}`
          : "Belum Memiliki Kamar";
      }
    }
  } catch (err) {
    console.error("Gagal sinkron profil:", err);
  }
}

// --- FUNGSI CRUD: UPDATE DATA KE SUPABASE ---
async function updateDataProfil() {
  const emailLogin =
    sessionStorage.getItem("email_aktif") ||
    sessionStorage.getItem("user_email");
  const newName = document.getElementById("inputName").value;
  const newPhone = document.getElementById("inputPhone").value;

  if (!newName) {
    alert("Nama tidak boleh kosong!");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("Users")
      .update({
        name: newName,
        phone: newPhone,
      })
      .eq("email", emailLogin);

    if (error) throw error;

    // Update sessionStorage agar nama di bagian lain web ikut berubah
    sessionStorage.setItem("user_name", newName);

    alert("Profil berhasil diperbarui!");
    initProfilePage(); // Refresh tampilan UI
  } catch (err) {
    console.error("Gagal update profil:", err);
    alert("Terjadi kesalahan saat menyimpan data.");
  }
}

function handleLogout() {
  if (confirm("Apakah Anda yakin ingin keluar dari Kost Keiren?")) {
    sessionStorage.clear();
    window.location.href = "../LoginPage/login.html";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage();

  // Tambahkan listener untuk tombol simpan
  const btnSave = document.getElementById("btn-save");
  if (btnSave) {
    btnSave.addEventListener("click", updateDataProfil);
  }
});
