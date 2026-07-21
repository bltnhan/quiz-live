# Quiz Live 🎯 — Trò chơi trắc nghiệm trực tiếp (kiểu Kahoot)

Web app cho phép quản trò tạo phòng, nhiều người chơi vào bằng điện thoại
qua mã phòng, chọn icon đại diện, và thi đấu qua **3 vòng**:

1. Pivot Excel
2. Excel Essential
3. PowerPoint Design

## Cơ chế "thông điệp = đáp án"

Quản trò **không cần gõ tay** thông điệp nữa. Trước khi bắt đầu, quản trò tải
lên **một file Excel** chứa nội dung của cả 3 vòng (dùng đúng file mẫu đã
cung cấp, hoặc tự soạn file với cột "Vòng" và cột "Thông điệp"). Hệ thống tự
đọc file, ghép nội dung theo từng vòng, và sinh ra **5 câu hỏi trắc nghiệm
dạng điền từ còn thiếu** cho mỗi vòng — đáp án đúng của mỗi câu chính là một
từ khoá lấy trực tiếp từ thông điệp trong file Excel. Người chơi càng nắm
chắc nội dung vừa đọc, càng dễ trả lời đúng.

Nếu file có nhiều dòng cho cùng một vòng (ví dụ cả sheet mẫu "Thong diep mau"
lẫn sheet tự soạn "Mau trong de tu soan"), toàn bộ nội dung các dòng đó được
**ghép lại** thành một thông điệp duy nhất cho vòng đó — càng nhiều nội dung,
câu hỏi sinh ra càng đa dạng. Nếu thông điệp vẫn quá ngắn để tạo đủ 5 câu,
hệ thống tự bổ sung thêm câu hỏi từ ngân hàng thuật ngữ có sẵn theo từng chủ
đề (`lib/wordbanks.js`).

## Chạy tự động theo từng vòng

Sau khi quản trò bấm "Bắt đầu Vòng N", **cả 5 câu hỏi của vòng đó tự chạy
liên tục** — không cần bấm "câu tiếp theo" từng câu. Quản trò có thể bấm nút
**⏸ Tạm ngưng** bất cứ lúc nào giữa vòng để dừng đồng hồ (ví dụ để giải
thích thêm), rồi bấm **▶ Tiếp tục** để chạy tiếp đúng chỗ đang dừng.

Khi hết 5 câu của một vòng, trò chơi **tự động dừng hẳn** ở màn hình bảng xếp
hạng của vòng đó — quản trò bấm nút **▶ Tiếp tục** khi sẵn sàng để chuyển
sang vòng kế tiếp (hoặc xem kết quả chung cuộc sau vòng 3).

Ngoài nút Tạm ngưng, quản trò còn có nút **⏭ Qua câu kế tiếp ngay** để tua
qua bất cứ lúc nào (không cần chờ hết giờ hoặc chờ hết thời gian xem đáp án).

**Bảo mật đáp án:** nội dung thông điệp (chứa toàn bộ đáp án) sau khi tải
lên sẽ **ẩn mặc định** ở màn hình quản trò — chỉ hiện ra khi quản trò chủ
động bấm nút "👁 Xem lại nội dung (riêng tư)". Nếu màn hình quản trò đang
được chiếu cho người chơi xem (kiểu Kahoot), đừng bấm nút này.

## Chấm điểm & bảng xếp hạng

Mỗi câu hỏi có **15 giây** để trả lời. Chấm điểm theo kiểu Kahoot: trả lời
đúng **càng nhanh** thì **càng nhiều điểm** (500–1000 điểm/câu, giảm dần theo
thời gian), trả lời sai hoặc không trả lời được 0 điểm. Đổi thời gian mỗi câu
bằng cách sửa `QUESTION_DURATION_MS` trong `lib/scoring.js`.

Sau **mỗi câu hỏi** (không chỉ cuối vòng), màn hình quản trò và màn hình
người chơi đều hiện **bảng xếp hạng tạm thời** ngay bên dưới phần đáp án
đúng/sai, để mọi người theo dõi điểm số liên tục suốt trận đấu.

## Đăng nhập Quản trò

Chỉ ai biết mật khẩu mới vào được khu vực quản trò (đăng nhập bằng nút
**🔐 Quản trò** ở góc trên bên phải trang chủ). Mật khẩu mặc định là
`12346789`, cấu hình trong `lib/config.js`.

Đăng nhập và tạo phòng giờ là **hai bước riêng**: đăng nhập xong sẽ vào
trang `/host` (bảng điều khiển quản trò) có nút **➕ Tạo phòng mới** — mỗi
lần bấm tạo một phòng mới với mã ngẫu nhiên, rồi chuyển thẳng vào màn hình
điều khiển phòng đó. Ngay khi phòng được tạo, người chơi sẽ thấy phòng này
xuất hiện trong danh sách **"Phòng đang mở"** ở trang chủ, hoặc có thể quét
mã QR trên màn hình quản trò để vào thẳng — khi vào bằng QR, tên và nhân
vật được điền ngẫu nhiên sẵn nên chỉ cần bấm "Tham gia" là xong (vẫn đổi
lại được nếu muốn).

Để đổi mật khẩu khi deploy lên Vercel, vào **Project Settings → Environment
Variables**, thêm biến `HOST_PASSWORD` với giá trị mật khẩu mới, rồi deploy
lại — không cần sửa code. Chạy local thì có thể sửa thẳng giá trị mặc định
trong `lib/config.js` hoặc tạo file `.env.local` với dòng
`HOST_PASSWORD=matkhaumoi`.

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

## ⚠️ Bắt buộc trên Vercel: bật lưu trữ Storage (Upstash Redis)

Vercel chạy mỗi request trên một trong nhiều "instance" (tiến trình) khác
nhau — request quản trò tạo phòng có thể chạy trên instance A, còn request
người chơi tham gia lại rơi vào instance B, hoàn toàn không biết instance A
vừa tạo phòng gì. Đây là lý do quản trò tạo mã phòng xong mà người chơi báo
"không tìm thấy phòng": bộ nhớ tạm (in-memory) trong code KHÔNG được chia sẻ
giữa các instance trên Vercel.

Code đã được sửa để tự động dùng **Upstash Redis** (một dịch vụ Storage có
sẵn ngay trong dashboard Vercel, không cần tài khoản riêng, có gói miễn phí)
làm nơi lưu chung cho mọi instance. Bắt buộc phải bật bước này thì game mới
chạy đúng khi có nhiều người truy cập:

1. Vào project trên [vercel.com](https://vercel.com) → tab **Storage**.
2. Bấm **Create Database** → chọn **Upstash** → chọn **Redis** → đặt tên
   tuỳ ý (VD `quiz-live-store`) → chọn vùng gần Việt Nam (Singapore) →
   **Create**.
3. Sau khi tạo xong, Vercel hỏi **Connect to Project** — chọn đúng project
   `quiz-live` → **Connect**. Bước này tự động thêm các biến môi trường cần
   thiết (`KV_REST_API_URL`, `KV_REST_API_TOKEN` hoặc tên tương tự) vào
   project, code đã viết sẵn để tự nhận diện các biến này.
4. Vào tab **Deployments** → bấm **Redeploy** ở bản deploy mới nhất (hoặc
   `git push` một thay đổi bất kỳ) để áp dụng biến môi trường mới.

Sau bước này, tạo phòng ở đâu người chơi cũng vào được, kể cả khi có hàng
trăm người truy cập cùng lúc.

Nếu **không** bật Storage, ứng dụng vẫn chạy được nhưng chỉ ổn định khi cả
quản trò và người chơi đều tình cờ rơi vào cùng một instance — không đáng
tin cậy, không nên dùng cho buổi chơi thật. Chạy `npm run dev` ở máy local
thì không cần bước này (local luôn chỉ có một instance).

Phòng chơi sẽ tự động bị xoá sau 6 giờ không hoạt động (đủ dài cho một buổi
chơi 2–3 tiếng); người chơi rớt mạng/khoá màn hình rồi mở lại đúng trình
duyệt đó sẽ tự vào lại đúng phòng, đúng điểm số đang có — trình duyệt ghi
nhớ chỗ ngồi bằng một mã riêng lưu cục bộ, không phải gõ lại tên/mã phòng.
(Nếu người chơi đổi sang máy/trình duyệt khác hẳn, hoặc xoá dữ liệu trình
duyệt, họ cần tham gia lại từ đầu — đó là giới hạn của cách lưu này.)

### Kiểm tra xem Storage đã thực sự hoạt động chưa

Vercel's Storage integration đôi khi đặt tên biến môi trường khác với
`KV_REST_API_URL` mặc định (tuỳ luồng kết nối), nên code đã được sửa để tự
dò bất kỳ cặp biến nào "trông giống" REST URL/token thay vì chỉ tìm đúng 1
tên cố định. Để chắc chắn Storage đã được nhận đúng, mở:

```
https://<domain-của-bạn>.vercel.app/api/debug
```

Nếu thấy `"storageMode": "redis"` — Storage đã hoạt động, lỗi "không tìm
thấy phòng" sẽ không còn xảy ra do nguyên nhân này. Nếu thấy
`"storageMode": "memory"` — biến môi trường chưa được nhận, hãy kiểm tra lại
bước Connect to Project ở trên và **Redeploy** lại (biến môi trường mới chỉ
áp dụng cho lần deploy tiếp theo, không áp dụng ngược cho bản đã deploy
trước đó).

## Chơi với ~100 người trong 2–3 tiếng

Ứng dụng dùng cách "polling" (mỗi máy tự hỏi máy chủ trạng thái mới nhất mỗi
1.5 giây) thay vì kết nối trực tiếp kiểu WebSocket — đơn giản, chạy tốt trên
Vercel, nhưng với 100 người chơi cùng lúc trong vài tiếng thì tổng số lượt
gọi API sẽ khá lớn (khoảng 60–70 lượt/giây, cộng dồn có thể lên tới hàng
trăm nghìn lượt cho một buổi 2–3 tiếng). Một vài lưu ý để đảm bảo ổn định:

- **Gói Upstash Redis miễn phí có giới hạn số lệnh/ngày** (thường khoảng
  10.000 lệnh/ngày) — với quy mô 100 người chơi nhiều giờ, gói miễn phí
  **sẽ không đủ**. Vào Upstash → database vừa tạo → **Pricing/Plan** để
  chuyển sang gói trả theo dùng (pay-as-you-go), vốn khá rẻ cho lưu lượng
  này, để tránh bị chặn giữa chừng khi hết quota.
- Vercel's Serverless Functions cũng tính phí/giới hạn theo số lượt gọi
  (execution) trên các gói miễn phí — kiểm tra gói hiện tại của bạn nếu lo
  ngại vượt hạn mức.
- Nếu vẫn thấy giật/lag khi đông người, có thể tăng nhẹ chu kỳ polling
  (1.5s hiện tại) lên 2s ở `app/play/[code]/page.js` và
  `app/host/[code]/page.js` để giảm tải, đổi lại độ trễ hiển thị tăng nhẹ.

## Cấu trúc project

```
app/
  page.js                 Trang chủ: danh sách phòng đang mở / tham gia phòng
  host/page.js             Bảng điều khiển quản trò (nút Tạo phòng mới)
  host/[code]/page.js      Màn hình điều khiển của quản trò cho 1 phòng cụ thể
  join/[code]/page.js      Trang vào phòng khi quét mã QR (tên/nhân vật ngẫu nhiên)
  play/[code]/page.js      Màn hình chơi trên điện thoại người chơi
  api/rooms/...            Các API route xử lý logic phòng chơi
  api/host/login/route.js  Kiểm tra mật khẩu quản trò (không tạo phòng)
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
- Đổi thời gian trả lời mỗi câu (mặc định 15 giây): sửa
  `QUESTION_DURATION_MS` trong `lib/scoring.js`.
- Đổi bộ icon người chơi: sửa `PLAYER_ICONS` trong `lib/icons.js`.
