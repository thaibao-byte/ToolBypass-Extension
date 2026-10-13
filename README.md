# ToolBypass Auto Link4M

Extension Chrome / Kiwi Browser / Quetta tự động vượt (bypass) Link4M.

**Tác giả gốc:** [t.me/toolbypass](https://t.me/toolbypass)  
**Phiên bản:** 28.0  
**Repo public:** https://github.com/thaibao-byte/ToolBypass-Extension

## Tính năng

- Tự động xử lý trang Link4M (link4m.net / .org / .com)
- Tự click kết quả Google khi cần
- Tự săn và click nút trên trang đích
- Panel điều khiển ngay trên trang
- Lưu trạng thái, hỗ trợ reset
- Hỗ trợ Kiwi Browser (Android) và trình duyệt Chromium desktop

## Cài đặt

### Cách 1: Cài từ source (khuyến nghị)

1. Tải toàn bộ thư mục source về máy (Code → Download ZIP trên GitHub này, hoặc clone).
2. Giải nén ra thư mục `ToolBypass-Extension`.
3. Mở trình duyệt Chrome / Edge / Brave / Kiwi:
   - Vào `chrome://extensions` (hoặc `kiwi://extensions` trên Kiwi).
   - Bật **Developer mode** (Chế độ dành cho nhà phát triển).
   - Click **Load unpacked** / **Tải tiện ích đã giải nén**.
   - Chọn thư mục chứa `manifest.json`.
4. Extension sẽ xuất hiện trong danh sách. Pin nó nếu muốn.

### Cách 2: Dùng file ZIP gốc

Nếu bạn có file `Toolbypass-Extension.zip` gốc, giải nén và làm theo bước 3 ở trên.

## Hướng dẫn sử dụng

1. Mở trang Link4M cần vượt (link dạng `https://xxx.link4m.net/...` hoặc tương tự).
2. Panel ToolBypass sẽ tự xuất hiện ở góc màn hình.
3. Nhập **domain** trang đích (nếu tool yêu cầu) → nhấn **BẮT ĐẦU**.
4. Tool sẽ tự:
   - Chuyển qua Google nếu cần
   - Click kết quả tìm kiếm
   - Quay lại Link4M
   - Săn và click các nút trên trang đích
5. Khi xong, tool sẽ hiển thị code / link cuối cùng.
6. Nếu bị kẹt → nhấn **🔄 RESET TOOL** trên panel.

### Lưu ý quan trọng

- Chỉ chạy trên các trang liên quan (Link4M, Google, trang đích). Không ảnh hưởng trang khác.
- Cần cấp quyền `storage`, `tabs`, `scripting` và host permissions rộng (do Link4M redirect linh hoạt).
- Trên Android dùng **Kiwi Browser** hoặc **Quetta Browser** để load unpacked extension.
- Nếu Google Captcha / Cloudflare chặn → làm thủ công rồi tool sẽ tiếp tục.

## Cấu trúc file

```
ToolBypass-Extension/
├── manifest.json     # Manifest V3
├── background.js     # Service worker (minimal)
├── content.js        # Logic chính (auto bypass)
├── icon128.png       # Icon (tùy chọn)
└── README.md
```

## Disclaimer

- Tool chỉ hỗ trợ tự động hóa thao tác người dùng trên các trang Link4M công khai.
- Người dùng chịu trách nhiệm khi sử dụng. Không sử dụng cho mục đích vi phạm pháp luật.
- Không thu thập dữ liệu cá nhân. Toàn bộ state lưu local qua `chrome.storage.local`.

## Liên hệ / Hỗ trợ

- Telegram gốc: [@toolbypass](https://t.me/toolbypass)
- Issues trên repo này nếu cần.

---
Made public for community use. Star nếu thấy hữu ích.
