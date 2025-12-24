# ChristmasDecoration

Demo (GitHub Pages): https://quocthang0507.github.io/ChristmasDecoration/

- Tree: https://quocthang0507.github.io/ChristmasDecoration/index.html
- Card: https://quocthang0507.github.io/ChristmasDecoration/card.html
- Countdown: https://quocthang0507.github.io/ChristmasDecoration/countdown.html
- Fireworks: https://quocthang0507.github.io/ChristmasDecoration/fireworks.html
- Snow Globe: https://quocthang0507.github.io/ChristmasDecoration/globe.html
- Benchmark: https://quocthang0507.github.io/ChristmasDecoration/benchmark.html

Một trang web hiệu ứng Giáng Sinh với **cây thông Noel tạo bởi hàng nghìn đốm sáng nhiều màu trên nền tối**. Các đốm sáng có hiệu ứng **lung linh**, **đổi màu mượt**, và chuyển động **giống 3D** theo chuột hoặc chế độ **Bay tự do**.

Ngoài trang cây thông, dự án có thêm các trang mini (thiệp, countdown, pháo hoa, snow globe, benchmark) cùng một nền hiệu ứng và UI/panel thống nhất.

## Mục tiêu

- Dự án tĩnh (HTML/CSS/JS) chạy ngay trên trình duyệt, không cần build.
- Canvas 2D tập trung vào cảm giác “glow/lấp lánh”, nhẹ, rõ ràng, có tuỳ chọn hiệu năng.
- UI/panel thống nhất giữa các trang, thân thiện mobile.

## Tính năng

- Cây thông bằng canvas: glow + twinkle + đổi màu
- 3D/parallax theo chuột hoặc Bay tự do
- Tuyết rơi + gió
- Tuỳ chỉnh lượng tuyết rơi
- Dây đèn xoắn (garland)
- Auto sway + Performance mode
- Nhạc nền: bật/tắt, chọn bài, loop 1 bài, âm lượng
- UI/panel thống nhất, responsive, có nút Mở/Đóng + lưu cấu hình bằng `localStorage`
- Light/Dark mode: toggle ngay trên thanh điều hướng (lưu `localStorage`, mặc định theo system)

## Các trang

- Cây thông: [index.html](index.html)
- Thiệp chúc mừng: [card.html](card.html)
- Đếm ngược đến 00:00: [countdown.html](countdown.html)
	- Countdown tới Giáng Sinh/Năm Mới; khi về 0 sẽ “boost” (sáng hơn + tuyết dày hơn) trong vài giây.
- Pháo hoa tối giản: [fireworks.html](fireworks.html)
	- Fireworks dạng dots/glow, có toggle bật/tắt để nhẹ máy (có adaptive theo FPS).
- Snow Globe: [globe.html](globe.html)
	- Vignette tròn, tuyết xoáy theo chuột trong “quả cầu”.
- Benchmark: [benchmark.html](benchmark.html)
	- Chạy các bài test trong thời gian hữu hạn, có thể Stop bất cứ lúc nào; chấm điểm dựa trên avg FPS + p95 frame time.

## Hướng dẫn nhanh (cách dùng)

- Mở trang bất kỳ, dùng panel góc phải để chỉnh hiệu ứng.
- Trên desktop: di chuột để thấy parallax/3D; trên mobile: dùng các toggle/slider trong panel.
- Nút Light/Dark nằm trên thanh điều hướng.

### Countdown

- Có thể chọn mốc: Giáng Sinh / Năm Mới.
- Khi đếm về 0, cảnh sẽ “boost” (đốm sáng/glow mạnh hơn + tuyết dày hơn) trong vài giây.

### Fireworks

- Pháo hoa tối giản kiểu dots/glow.
- Có toggle bật/tắt để giữ FPS ổn định khi máy yếu.

### Snow Globe

- Hiển thị “quả cầu” dạng vignette tròn.
- Tuyết xoáy theo chuột bên trong quả cầu (đã giới hạn lực và không tràn ra ngoài).

### Benchmark

- Bấm Start để chạy tuần tự các bài test.
- Bấm Stop để dừng ngay lập tức (không cần chờ hết test).
- Kết quả tập trung vào:
	- `avg FPS`: FPS trung bình (càng cao càng tốt)
	- `p95 frame time`: 95% khung hình nhanh hơn giá trị này (ms), càng thấp càng “mượt”

Gợi ý đọc kết quả: nếu `avg FPS` cao nhưng `p95` lớn, máy vẫn có giật/khựng do “spike”.

## Chạy dự án (local)

Cách 1: mở trực tiếp

- Mở [index.html](index.html) bằng trình duyệt.

Cách 2 (khuyến nghị): chạy server tĩnh

```bash
python3 -m http.server 5173
```

Mở `http://localhost:5173`

Gợi ý: mở trực tiếp bằng file vẫn chạy được, nhưng server tĩnh sẽ ổn định hơn khi load nhạc và điều hướng giữa các trang.

## Theme (Light/Dark)

- Toggle theme ở navbar; trạng thái được lưu trong `localStorage`.
- Mặc định: nếu chưa chọn thủ công, theme sẽ theo `prefers-color-scheme` của hệ điều hành.

## Lưu cấu hình & Reset

Nhiều tuỳ chọn/panel được lưu trong `localStorage` để lần sau mở lại vẫn giữ trạng thái. Một số key chính:

- Theme: `cd.theme.v1`
- Trang cây thông (settings): `xmasTreeSettingsV2`
- Trang cây thông (panel): `xmasPanelCollapsedV2`
- Thiệp (panel): `christmas.cardPanelCollapsedV2`
- Countdown: `cd.countdown.target.v1`, `cd.countdown.panelCollapsed.v1`
- Fireworks: `cd.fireworks.enabled.v1`, `cd.fireworks.perf.v1`, `cd.fireworks.panelCollapsed.v1`
- Globe: `cd.globe.perf.v1`, `cd.globe.panelCollapsed.v1`
- Benchmark: `cd.benchmark.perf.v1`, `cd.benchmark.last.v1`

Reset nhanh:

- Mở DevTools → Application/Storage → Local Storage → xoá các key trên (hoặc Clear site data), rồi reload.

## Nhạc nền (music)

- Các file nhạc nằm trong thư mục [music](music).
- Danh sách bài được cấu hình trong [music/playlist.json](music/playlist.json).
- Lưu ý: nhiều trình duyệt chặn autoplay có tiếng; nếu chưa nghe thấy nhạc, hãy click/nhấn phím 1 lần trên trang.

## Tuỳ biến

Panel “Tùy biến” cho phép chỉnh: mật độ/kích thước/độ sáng đốm, 3D/bay tự do, đổi màu, tuyết/gió, dây đèn xoắn, auto sway, performance, nhạc.

Mới: có thêm slider “Lượng tuyết” để tăng/giảm mật độ tuyết.

## Performance tips

- Bật `Performance mode` nếu thấy giật.
- Tắt `Fireworks` trên máy yếu.
- Giảm mật độ/tốc độ tuyết và độ sáng glow nếu GPU/CPU nóng.
- Dùng Benchmark để so sánh nhanh trước/sau khi thay đổi tuỳ chọn.

## Cấu trúc dự án

- UI dùng chung:
	- `ui.css`: theme variables + layout navbar/panel + input styles
	- `ui.js`: init panel (mở/đóng) + theme toggle
- Engine canvas:
	- `scene.js`: render cây + tuyết + topper + fireworks + globe mode + perf stats
- Trang:
	- `index.html` / `index.js`: trang cây thông chính
	- `card.html` / `card.js`: thiệp + preview
	- `countdown.html` / `countdown.js`: đếm ngược + boost
	- `fireworks.html` / `fireworks.js`: demo pháo hoa
	- `globe.html` / `globe.js`: snow globe
	- `benchmark.html` / `benchmark.js`: đo hiệu năng

## Troubleshooting

- Nếu không nghe nhạc: click/tap 1 lần để “unlock audio” (chính sách autoplay của trình duyệt).
- Nếu điều hướng giữa trang bị lỗi asset: hãy chạy server tĩnh bằng `python3 -m http.server`.

