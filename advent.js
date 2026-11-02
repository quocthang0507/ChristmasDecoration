(() => {
  // 24 small daily challenges (1–24/12). Kept short so they fit on one card.
  const DAYS = [
    { emoji: '☕', title: 'Cà phê bất ngờ', text: 'Mời một đồng nghiệp hoặc người bạn một ly cà phê mà không cần lý do.' },
    { emoji: '📵', title: '1 giờ không điện thoại', text: 'Cất điện thoại 60 phút và làm một việc bạn thích bằng tay.' },
    { emoji: '💌', title: 'Tin nhắn cảm ơn', text: 'Nhắn cho 3 người một lời cảm ơn thật cụ thể về điều họ đã làm.' },
    { emoji: '🎶', title: 'Playlist mùa đông', text: 'Tạo playlist 10 bài Giáng Sinh và gửi cho bạn thân.' },
    { emoji: '🍪', title: 'Vào bếp', text: 'Thử làm bánh quy gừng, bánh flan hoặc bất kỳ món ngọt nào.' },
    { emoji: '🧹', title: 'Dọn 15 phút', text: 'Dọn góc bàn làm việc trong 15 phút — bắt đầu năm mới thật gọn.' },
    { emoji: '📸', title: 'Săn đèn Noel', text: 'Chụp bức ảnh đèn trang trí đẹp nhất bạn gặp hôm nay.' },
    { emoji: '🎁', title: 'Quà tự làm', text: 'Làm một món quà nhỏ handmade: thiệp, vòng tay, hũ kẹo…' },
    { emoji: '🚶', title: '5.000 bước', text: 'Đi bộ ít nhất 5.000 bước, tốt nhất là cùng một người bạn.' },
    { emoji: '📖', title: '10 trang sách', text: 'Đọc 10 trang của một cuốn sách bạn đã muốn đọc từ lâu.' },
    { emoji: '🫶', title: 'Quyên góp', text: 'Chọn vài món đồ còn tốt để tặng cho người cần hơn.' },
    { emoji: '📞', title: 'Gọi về nhà', text: 'Gọi điện (không nhắn tin) cho ông bà, bố mẹ hoặc người thân.' },
    { emoji: '🎬', title: 'Phim Giáng Sinh', text: 'Xem một bộ phim Giáng Sinh kinh điển với gói bỏng ngô.' },
    { emoji: '🌱', title: 'Một mầm xanh', text: 'Tưới cây, mua một chậu cây nhỏ hoặc trồng một hạt giống.' },
    { emoji: '✍️', title: 'Nhật ký 2026', text: 'Viết ra 3 khoảnh khắc đáng nhớ nhất của năm nay.' },
    { emoji: '🧣', title: 'Diện đồ Noel', text: 'Mặc một món đồ màu đỏ hoặc xanh lá cả ngày hôm nay.' },
    { emoji: '😂', title: 'Meme mùa lễ', text: 'Gửi meme Giáng Sinh vui nhất bạn tìm được vào group chat.' },
    { emoji: '🧘', title: '5 phút thở', text: 'Ngồi yên, hít sâu 4 giây – giữ 4 giây – thở ra 6 giây, trong 5 phút.' },
    { emoji: '🎤', title: 'Hát một bài', text: 'Hát (hoặc ngân nga) trọn vẹn một bài Giáng Sinh. Không ai chấm điểm!' },
    { emoji: '💡', title: 'Trang trí', text: 'Thêm một món trang trí cho phòng: dây đèn, quả châu, cành thông.' },
    { emoji: '🥘', title: 'Bữa tối sum họp', text: 'Ăn tối cùng gia đình hoặc bạn bè, không ai dùng điện thoại.' },
    { emoji: '🎯', title: 'Mục tiêu 2027', text: 'Viết 3 mục tiêu nhỏ, cụ thể cho năm tới và dán ở nơi dễ thấy.' },
    { emoji: '🎅', title: 'Secret Santa', text: 'Chuẩn bị xong quà Secret Santa — hoặc tổ chức một vòng bốc thăm!' },
    { emoji: '⭐', title: 'Đêm Thánh', text: 'Tắt đèn, bật cây thông và gửi lời chúc Giáng Sinh tới người bạn thương.' },
  ];

  // Fixed shuffled order so the grid looks like a real advent calendar.
  const ORDER = [7, 18, 3, 12, 22, 1, 15, 9, 24, 5, 20, 11, 2, 17, 13, 23, 6, 10, 19, 4, 14, 21, 8, 16];

  const elGrid = document.getElementById('advent-grid');
  const elProgress = document.getElementById('advent-progress');
  const elNote = document.getElementById('advent-note');
  const elPreview = /** @type {HTMLInputElement|null} */ (document.getElementById('advent-preview'));
  const elReset = document.getElementById('advent-reset');
  const elDialog = /** @type {HTMLDialogElement|null} */ (document.getElementById('advent-dialog'));
  const elDlgDay = document.getElementById('advent-dlg-day');
  const elDlgEmoji = document.getElementById('advent-dlg-emoji');
  const elDlgTitle = document.getElementById('advent-dlg-title');
  const elDlgText = document.getElementById('advent-dlg-text');
  const elDlgDone = /** @type {HTMLInputElement|null} */ (document.getElementById('advent-dlg-done'));

  /**
   * The season runs 1/12 → 6/1. Returns { year, unlockedUpTo } where unlockedUpTo is 0..24.
   */
  function season(now = new Date()) {
    const m = now.getMonth();
    const d = now.getDate();
    if (m === 11) return { year: now.getFullYear(), unlockedUpTo: Math.min(24, d) };
    if (m === 0 && d <= 6) return { year: now.getFullYear() - 1, unlockedUpTo: 24 };
    return { year: now.getFullYear(), unlockedUpTo: 0 };
  }

  const { year, unlockedUpTo } = season();
  const STORAGE_KEY = `cd.advent.${year}.v1`;

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { opened: Array.isArray(raw.opened) ? raw.opened : [], done: Array.isArray(raw.done) ? raw.done : [] };
    } catch {
      return { opened: [], done: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  const state = loadState();

  function isUnlocked(day) {
    return day <= unlockedUpTo || Boolean(elPreview?.checked);
  }

  function render() {
    if (!elGrid) return;
    elGrid.innerHTML = '';
    for (const day of ORDER) {
      const info = DAYS[day - 1];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'advent__door';
      btn.dataset.day = String(day);
      const opened = state.opened.includes(day);
      const unlocked = isUnlocked(day);
      btn.classList.toggle('is-open', opened);
      btn.classList.toggle('is-locked', !unlocked);
      btn.classList.toggle('is-done', state.done.includes(day));
      btn.classList.toggle('is-today', day === unlockedUpTo && !elPreview?.checked);
      btn.setAttribute('aria-label', unlocked ? `Ngày ${day}${opened ? `: ${info.title}` : ''}` : `Ngày ${day} (chưa mở được)`);
      btn.innerHTML = `<span class="advent__num">${day}</span><span class="advent__emoji" aria-hidden="true">${
        opened ? info.emoji : unlocked ? '🎁' : '🔒'
      }</span>`;
      elGrid.appendChild(btn);
    }

    const done = state.done.length;
    if (elProgress) elProgress.textContent = `Đã mở ${state.opened.length}/24 • Hoàn thành ${done}/24`;
    if (elNote) {
      if (unlockedUpTo === 0) {
        const dec1 = new Date(year, 11, 1);
        const days = Math.ceil((dec1.getTime() - Date.now()) / 86400000);
        elNote.textContent = `Lịch mở từ 01/12 — còn ${days} ngày. Bật “Xem trước” để xem thử.`;
      } else if (unlockedUpTo < 24) {
        elNote.textContent = `Hôm nay mở được đến ô số ${unlockedUpTo}.`;
      } else {
        elNote.textContent = 'Tất cả 24 ô đã mở được. Giáng Sinh vui vẻ! 🎄';
      }
    }
  }

  let currentDay = 0;

  function openDay(day) {
    if (!isUnlocked(day)) {
      elGrid?.querySelector(`[data-day="${day}"]`)?.animate?.(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 260 }
      );
      return;
    }
    const info = DAYS[day - 1];
    // Preview peeks don't count as progress.
    const counts = day <= unlockedUpTo;
    const first = counts && !state.opened.includes(day);
    if (first) {
      state.opened.push(day);
      saveState();
      window.CD_Scene?.triggerBoost({ durationMs: 2600, strength: 0.8 });
      navigator.vibrate?.(30);
    }

    currentDay = day;
    if (elDlgDay) elDlgDay.textContent = `Ngày ${day}/12`;
    if (elDlgEmoji) elDlgEmoji.textContent = info.emoji;
    if (elDlgTitle) elDlgTitle.textContent = info.title;
    if (elDlgText) elDlgText.textContent = info.text;
    if (elDlgDone) {
      elDlgDone.checked = state.done.includes(day);
      elDlgDone.disabled = !counts;
    }
    render();
    if (typeof elDialog?.showModal === 'function') elDialog.showModal();
    else elDialog?.setAttribute('open', '');
  }

  function init() {
    window.CD_UI?.initCornerPanel({
      panelSelector: '.card-ui__panel',
      toggleSelector: '#advent-panel-toggle',
      storageKey: 'cd.advent.panelCollapsed.v1',
      defaultCollapsed: true,
      collapsedLabel: 'Lịch',
      expandedLabel: 'Thu gọn',
    });

    window.CD_Scene?.setSettings({ mode: 'default', snow: true, fireworks: false }, { rebuild: true });

    elGrid?.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest?.('.advent__door');
      if (btn) openDay(Number(btn.getAttribute('data-day')));
    });

    elDlgDone?.addEventListener('change', () => {
      if (!currentDay) return;
      state.done = state.done.filter((d) => d !== currentDay);
      if (elDlgDone.checked) {
        state.done.push(currentDay);
        window.CD_Scene?.triggerBoost({ durationMs: 1800, strength: 0.6 });
      }
      saveState();
      render();
    });

    elDialog?.addEventListener('click', (e) => {
      // Click on the backdrop closes the dialog.
      if (e.target === elDialog) elDialog.close?.();
    });

    elPreview?.addEventListener('change', render);

    elReset?.addEventListener('click', () => {
      if (!window.confirm('Xoá tiến độ lịch Mùa Vọng năm nay?')) return;
      state.opened = [];
      state.done = [];
      saveState();
      render();
    });

    render();
  }

  init();
})();
