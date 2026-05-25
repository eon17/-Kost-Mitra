// === KONFIGURASI SUPABASE (Ganti dengan punya lu!) ===
const SUPABASE_URL = "https://frvgzlsmdafichmldgrc.supabase.co";
const SUPABASE_KEY = "sb_publishable_F4lBuJkszRAk-GDiYokPOA_DoCmbovs";

// 1. PROTEKSI GLOBAL (Anti-Tab Baru)
window.addEventListener("dragover", (e) => e.preventDefault(), false);
window.addEventListener("drop", (e) => e.preventDefault(), false);

// 2. ELEMENT SELECTOR
const regForm = document.getElementById("registrationForm");
const fileUpload = document.getElementById("fileUpload");
const profileImg = document.getElementById("profileImg");
const ktpInput = document.getElementById("ktpInput");
const ktpDropzone = document.getElementById("ktpDropzone");
const ktpFileName = document.getElementById("ktpFileName");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");

// 3. PREVIEW & UI LOGIC
fileUpload.addEventListener("change", function () {
  if (this.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => (profileImg.src = e.target.result);
    reader.readAsDataURL(this.files[0]);
  }
});

async function compressImage(file, { quality = 0.6, maxWidth = 800 }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");

        // Hitung rasio agar foto tidak gepeng
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Ubah ke Blob dengan format JPEG & kualitas yang ditentukan (0.1 - 1.0)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Balikin sebagai File agar punya nama file asli
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Gagal mengompres gambar"));
            }
          },
          "image/jpeg",
          quality,
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

ktpDropzone.addEventListener("click", () => ktpInput.click());
ktpInput.addEventListener("change", function () {
  if (this.files.length > 0) updateKTPUI(this.files[0].name);
});

ktpDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  ktpDropzone.style.borderColor = "#00f2fe";
});

ktpDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.files.length > 0) {
    ktpInput.files = e.dataTransfer.files;
    updateKTPUI(e.dataTransfer.files[0].name);
  }
});

function updateKTPUI(fileName) {
  ktpFileName.textContent = "File terpilih: " + fileName;
  ktpDropzone.classList.add("file-selected");
}

// 4. FUNGSI UPLOAD KE STORAGE
async function uploadFile(bucket, file) {
  const fileName = `${Date.now()}_${file.name.replace(/\s/g, "_")}`;
  const filePath = `${fileName}`;

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: file,
    },
  );

  if (!response.ok) throw new Error(`Gagal upload ke ${bucket}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
}

// 5. MAIN SUBMIT LOGIC
regForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (password.value !== confirmPassword.value) {
    alert("Password nggak cocok, Chozz!");
    return;
  }

  const btn = e.target.querySelector("button");
  btn.innerText = "Sabar, lagi kompres & daftar...";
  btn.disabled = true;

  try {
    let avatarUrl = "";
    let ktpUrl = "";

    // A. Kompres & Upload Foto Profil
    if (fileUpload.files[0]) {
      console.log("Mengompres Foto Profil...");
      const compressedAvatar = await compressImage(fileUpload.files[0], {
        quality: 0.5, // Kualitas 50%
        maxWidth: 400, // Ukuran kecil saja untuk avatar
      });
      avatarUrl = await uploadFile("avatars", compressedAvatar);
    }

    // B. Kompres & Upload KTP
    if (ktpInput.files[0]) {
      console.log("Mengompres KTP...");
      const compressedKTP = await compressImage(ktpInput.files[0], {
        quality: 0.7, // Kualitas agak tinggi dikit biar teks terbaca
        maxWidth: 1000, // Resolusi lebih besar agar tidak pecah
      });
      ktpUrl = await uploadFile("ktps", compressedKTP);
    }

    // C. Simpan ke Tabel Users (Tetap sama)
    const payload = {
      name: regForm.name.value,
      phone: regForm.phone.value,
      email: regForm.email.value,
      password: password.value,
      avatar_url: avatarUrl,
      ktp_url: ktpUrl,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/Users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("Akun berhasil terdaftar dengan foto yang sudah dikompres.");
      window.location.href = "../LoginPage/login.html";
    } else {
      const err = await res.json();
      throw new Error(err.message);
    }
  } catch (err) {
    console.error(err);
    alert("Waduh gagal: " + err.message);
  } finally {
    btn.innerText = "Daftar Sekarang";
    btn.disabled = false;
  }
});
