# Quiz Live 🎯 — Trò chơi trắc nghiệm trực tiếp (kiểu Kahoot)

Web app cho phép quản trò tạo phòng, nhiều người chơi vào bằng điện thoại
qua mã phòng, chọn icon đại diện, và thi đấu qua **3 vòng**:

1. Pivot Excel
2. Excel Essential
3. PowerPoint Design

## Cơ chế "thông điệp = đáp án"

Trước mỗi vòng, quản trò gõ vào một đoạn **thông điệp** (nội dung liên quan
chủ đề của vòng đó). Hệ thống tự động phân tích đoạn văn này và sinh ra
**5 câu hỏi trắc nghiệm dạng điền từ còn thiếu** — đáp án đúng của mỗi câu
chính là một từ khoá được lấy trực tiếp từ thông điệp mà quản trò vừa nhập.
Người chơi càng nắm chắc nội dung quản trò vừa đọc, càng dễ trả lời đúng.

Nếu thông điệp quá ngắn để tạo đủ 5 câu, hệ thống sẽ tự bổ sung thêm câu hỏi
từ ngân hàng thuật ngữ có sẵn theo từng chủ đề (`lib/wordbanks.js`) để vòng
chơi vẫn luôn có đủ 5 câu.

Chấm điểm theo kiểu Kahoot: trả lời đúng **càng nhanh** thì **càng nhiều
điểm** (500–1000 điểm/câu), trả lời sai hoặc không trả lời được 0 điểm.

## Chạy thử ở máy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`:
- Một tab/máy: bấm "Tôi là Quản trò" để tạo phòng.
- Các tab/điện thoại khác (cùng mạng, dùng `http://<ip-máy-bạn>:3000`):
  bấm "Tôi là Người chơi", nhập mã phòng hiển thị trên màn hình quản trò.

## Deploy lên Vercel

1. Đưa toàn bộ thư mục này lên một repo GitHub (hoặc GitLab/Bitbucket).
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → chọn repo vừa tạo.
3. Vercel tự nhận đây là dự án Next.js, không cần cấu hình gì thêm, không
   cần biến môi trường (`Environment Variables`) nào cả — bấm **Deploy**.
4. Sau khi deploy xong, bạn sẽ có một domain dạng
   `https://ten-du-an.vercel.app`. Chia sẻ domain này cho người chơi, hoặc
   dùng chính domain đó trên máy quản trò.

Người chơi chỉ cần mở domain trên điện thoại (trình duyệt bất kỳ), chọn
"Tham gia bằng mã phòng" — không cần cài app.

## Giới hạn cần biết (đọc trước khi dùng cho sự kiện lớn)

Trạng thái phòng chơi (danh sách người chơi, điểm số, câu hỏi hiện tại...)
đang được lưu **trong bộ nhớ tạm (in-memory)** của server, để bạn deploy lên
Vercel ngay mà **không cần đăng ký thêm bất kỳ dịch vụ database nào**. Cách
này chạy tốt cho các buổi chơi nội bộ, vài chục người chơi, trên một lượt
deploy Vercel bình thường (gói Hobby).

Nếu bạn cần độ ổn định cao hơn cho sự kiện lớn (hàng trăm người chơi cùng
lúc, nhiều vùng máy chủ), nên nâng cấp phần lưu trữ sang **Vercel KV**
(chỉ cần bật trong dashboard dự án trên Vercel, không cần tài khoản riêng)
bằng cách thay thế nội dung `lib/store.js` bằng bản dùng `@vercel/kv`. Cho
một buổi chơi thông thường thì không cần bước này.

Phòng chơi sẽ tự động bị xoá sau 6 giờ không hoạt động.

## Cấu trúc project

```
app/
  page.js                 Trang chủ: tạo phòng / tham gia phòng
  host/[code]/page.js      Màn hình điều khiển của quản trò
  play/[code]/page.js      Màn hình chơi trên điện thoại người chơi
  api/rooms/...            Các API route xử lý logic phòng chơi
lib/
  store.js                 Lưu trữ trạng thái phòng (in-memory)
  questionGen.js           Thuật toán sinh câu hỏi từ thông điệp
  wordbanks.js             Ngân hàng thuật ngữ dự phòng theo từng chủ đề
  scoring.js                Công thức tính điểm theo tốc độ trả lời
  icons.js                  Danh sách icon đại diện người chơi
```

## Tuỳ chỉnh nhanh

- Đổi tên 3 chủ đề: sửa `ROUND_TOPICS` trong `app/host/[code]/page.js`
  và object `TOPICS` trong `lib/wordbanks.js` (giữ khoá 1/2/3).
- Đổi thời gian trả lời mỗi câu (mặc định 20 giây): sửa
  `QUESTION_DURATION_MS` trong `lib/scoring.js`.
- Đổi bộ icon người chơi: sửa `PLAYER_ICONS` trong `lib/icons.js`.
