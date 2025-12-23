# ChristmasDecoration

Demo (GitHub Pages): https://quocthang0507.github.io/ChristmasDecoration/

Một trang web hiệu ứng Giáng Sinh với **cây thông Noel tạo bởi hàng nghìn đốm sáng nhiều màu trên nền tối**. Các đốm sáng có hiệu ứng **lung linh**, **đổi màu mượt**, và chuyển động **giống 3D** theo chuột hoặc chế độ **Bay tự do**.

## Tính năng

- Cây thông bằng canvas: glow + twinkle + đổi màu
- 3D/parallax theo chuột hoặc Bay tự do
- Tuyết rơi + gió
- Dây đèn xoắn (garland)
- Auto sway + Performance mode
- Nhạc nền: bật/tắt, chọn bài, loop 1 bài, âm lượng
- Panel tuỳ biến có nút Mở/Đóng (mobile-friendly) + lưu cấu hình bằng `localStorage`

## Chạy dự án (local)

Cách 1: mở trực tiếp

- Mở [index.html](index.html) bằng trình duyệt.

Cách 2 (khuyến nghị): chạy server tĩnh

```bash
python3 -m http.server 5173
```

Mở `http://localhost:5173`

## Nhạc nền (music)

- Các file nhạc nằm trong thư mục [music](music).
- Danh sách bài được cấu hình trong [music/playlist.json](music/playlist.json).
- Lưu ý: nhiều trình duyệt chặn autoplay có tiếng; nếu chưa nghe thấy nhạc, hãy click/nhấn phím 1 lần trên trang.

## Tuỳ biến

Panel “Tùy biến” cho phép chỉnh: mật độ/kích thước/độ sáng đốm, 3D/bay tự do, đổi màu, tuyết/gió, dây đèn xoắn, auto sway, performance, nhạc.

