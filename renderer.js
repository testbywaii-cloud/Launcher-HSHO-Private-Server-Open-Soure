window.addEventListener('DOMContentLoaded', async () => {
  // Elements หลัก
  const btnSelectFile = document.getElementById('btn-select-file');
  const btnChangeVersion = document.getElementById('btn-change-version');
  const btnInstallFix = document.getElementById('btn-install-fix');
  const btnPlay = document.getElementById('btn-play');
  const gamePathText = document.getElementById('game-path-text');
  const playStatusText = document.getElementById('play-status-text');
  const langSelect = document.querySelector('.lang-select');

  // Modal Elements
  const modal = document.getElementById('version-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnResetPath = document.getElementById('btn-reset-path');
  const btnSaveVersion = document.getElementById('btn-save-version');
  const modalPathDisplay = document.getElementById('modal-path-display');
  const inputVersion = document.getElementById('input-project-version');

  // 💾 ดึง Path จาก LocalStorage
  let currentFolderPath = localStorage.getItem('savedGamePath') || '';
  let currentLang = localStorage.getItem('savedLang') || 'EN';

  // พจนานุกรมแปลภาษา
  const translations = {
    EN: {
      selectGame: 'Not Selected',
      pleaseSelect: 'Please Select Game',
      readyToPlay: 'Ready to Play',
      playBtn: '▶ PLAY _ SETUP'
    },
    TH: {
      selectGame: 'ยังไม่ได้เลือกเกม',
      pleaseSelect: 'กรุณาเลือกโฟลเดอร์เกม',
      readyToPlay: 'พร้อมเข้าเล่นเกม',
      playBtn: '▶ เข้าเล่นเกม'
    }
  };

  if (langSelect) langSelect.value = currentLang;

  // 🔄 ฟังก์ชันอัปเดตสถานะ UI ทั้งหน้าจอ
  const updateGameUI = async () => {
    const t = translations[currentLang] || translations.EN;

    if (currentFolderPath) {
      // เมื่อเลือกเกมแล้ว
      if (gamePathText) gamePathText.innerText = currentFolderPath;
      if (modalPathDisplay) modalPathDisplay.innerText = `Path: ${currentFolderPath}`;
      if (playStatusText) {
        playStatusText.innerText = t.readyToPlay;
        playStatusText.style.color = '#22c55e'; // เปลี่ยนเป็นสีเขียว
      }
      if (btnPlay) btnPlay.classList.add('active'); // เปิดไฟปุ่ม PLAY

      // อ่านเวอร์ชันมาใส่ใน Modal
      const version = await window.electronAPI?.getProjectVersion(currentFolderPath);
      if (version && inputVersion) inputVersion.value = version;

    } else {
      // เมื่อยังไม่ได้เลือกเกม / รีเซ็ต Path
      if (gamePathText) gamePathText.innerText = t.selectGame;
      if (modalPathDisplay) modalPathDisplay.innerText = 'Path: ' + t.selectGame;
      if (playStatusText) {
        playStatusText.innerText = t.pleaseSelect;
        playStatusText.style.color = '#f59e0b'; // สีส้มเตือน
      }
      if (btnPlay) btnPlay.classList.remove('active');
      if (inputVersion) inputVersion.value = '';
    }
  };

  // โหลดสถานะเริ่มต้นทันทีที่เปิดโปรแกรม
  await updateGameUI();

  // --- Controls หน้าต่างหลัก ---
  document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI?.minimize());
  document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI?.close());

  // --- 🌐 ระบบเปลี่ยนภาษา (EN / TH) ---
  langSelect?.addEventListener('change', (e) => {
    currentLang = e.target.value;
    localStorage.setItem('savedLang', currentLang);
    updateGameUI();
  });

  // --- 1. เลือกไฟล์/โฟลเดอร์เกม (Select Game) ---
  btnSelectFile?.addEventListener('click', async () => {
    const selectedFile = await window.electronAPI?.selectGameFile();
    if (selectedFile) {
      currentFolderPath = selectedFile;
      localStorage.setItem('savedGamePath', currentFolderPath);
      await updateGameUI();
    }
  });

  // --- 2. เปิด Modal Change Version ---
  btnChangeVersion?.addEventListener('click', async () => {
    modal.classList.remove('hidden');
    await updateGameUI();

    // Focus ช่องพิมพ์อัตโนมัติ
    setTimeout(() => {
      inputVersion?.focus();
      inputVersion?.select();
    }, 100);
  });

  btnCloseModal?.addEventListener('click', () => modal.classList.add('hidden'));

  // --- 3. ปุ่ม Reset Path Folder ---
  btnResetPath?.addEventListener('click', () => {
    currentFolderPath = '';
    localStorage.removeItem('savedGamePath');
    updateGameUI();
    alert(currentLang === 'TH' ? 'รีเซ็ต Path เรียบร้อยแล้ว' : 'Path reset successfully');
  });

  // --- 4. บันทึกเวอร์ชัน (Save) ---
  btnSaveVersion?.addEventListener('click', async () => {
    const newVersion = inputVersion.value.trim();
    if (!currentFolderPath) {
      alert(currentLang === 'TH' ? 'กรุณาเลือกเกมก่อนครับ!' : 'Please select game folder first!');
      return;
    }
    if (!newVersion) {
      alert(currentLang === 'TH' ? 'กรุณากรอกเวอร์ชัน!' : 'Please enter project version!');
      return;
    }

    const res = await window.electronAPI?.saveProjectVersion({
      folderPath: currentFolderPath,
      version: newVersion
    });

    if (res?.success) {
      alert(`✅ ${res.message}`);
      modal.classList.add('hidden');
    } else {
      alert(`❌ ${res?.message || 'เกิดข้อผิดพลาดในการบันทึก'}`);
    }
  });

  // --- 5. ปุ่ม Fix CA ---
  btnInstallFix?.addEventListener('click', async () => {
    await window.electronAPI?.installCert();
    await window.electronAPI?.fixHosts('lywp');
    alert(currentLang === 'TH' ? 'ติดตั้ง CA และ Fix Hosts เรียบร้อยแล้ว' : 'Certificate & Hosts updated successfully');
  });

  // --- 6. ปุ่ม PLAY ---
  btnPlay?.addEventListener('click', async () => {
    if (!currentFolderPath) {
      alert(currentLang === 'TH' ? 'กรุณาเลือกโฟลเดอร์เกมผ่านปุ่ม Select Game ก่อนเข้าเล่น' : 'Please select game folder first!');
      return;
    }
    const launched = await window.electronAPI?.launchGame(currentFolderPath);
    if (!launched) {
      alert(currentLang === 'TH' ? 'ไม่สามารถเปิดเกมได้ กรุณาตรวจสอบไฟล์เกมอีกครั้ง' : 'Failed to launch game');
    }
  });
});