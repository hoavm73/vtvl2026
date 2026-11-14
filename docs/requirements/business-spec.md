# Đặc tả yêu cầu nghiệp vụ: Hệ thống Vị trí việc làm 360 & S-Link HCM-UTE

## 1. Mục tiêu dự án
Xây dựng nền tảng số hóa quy trình xây dựng, đo lường định mức và rà soát **Đề án Vị trí việc làm (VTVL) 360** kết hợp công cụ **S-Link & QR Code** dành cho **48 đơn vị thuộc/trực thuộc Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)**.

## 2. Năm bước nghiệp vụ VTVL 360
1. **Bước 1 — Tạo tệp đơn vị và phiếu khảo sát (`/tao-tep`):**
   - Chọn 1 trong 4 mẫu khối đơn vị của trường:
     - Khối Khoa & Viện đào tạo (`khoa-vien`)
     - Khối Phòng ban chức năng (`phong-ban`)
     - Khối Trung tâm & Đơn vị phục vụ (`trung-tam`)
     - Khối Quản trị & Đảng - Đoàn thể (`dang-doanthe`)
   - Chọn đơn vị cụ thể (ví dụ `CK` — Khoa Cơ khí, `QTTHTT` — Phòng Quản trị thương hiệu và Truyền thông, `TCNS` — Phòng Tổ chức - Nhân sự...).
   - Tự động ánh xạ mã đơn vị vào 9 biểu (`XXX-GV-CM-01` → `CK-GV-CM-01`), điền sẵn danh mục công việc, sản phẩm, ĐVT và định mức gợi ý.
   - Tải về tệp đơn vị gốc (`[MA]_K2526_v1_YYYYMMDD.xlsx`), phiếu khảo sát đầy đủ (`Phieu_B2_...xlsx`) và gói `.zip` tách riêng từng vị trí việc làm.
2. **Bước 2 — Phát phiếu từng vị trí & Chia sẻ qua S-Link / QR Code (`/s-link`):**
   - Tạo liên kết ngắn kèm mã QR gắn logo chuẩn HCM-UTE, hỗ trợ đặt mật khẩu bảo vệ, hẹn giờ hết hạn và gắn thẻ phân loại theo đơn vị để gửi cho viên chức, người lao động.
3. **Bước 3 — Bấm giờ đo định mức công việc (`/bam-gio`):**
   - Viên chức mở phiếu của đơn vị hoặc chọn trực tiếp vị trí của mình, bấm giờ thực hiện công việc thực tế hoặc nhập các phiên đo để tính `Phút/Sản phẩm`, sau đó xuất phiếu cá nhân `.xlsx`.
4. **Bước 4 — Nạp và gộp phiếu vào tệp đơn vị (`/tao-tep#buoc-4`):**
   - Đầu mối đơn vị chọn tệp đơn vị hiện tại (`v1`) và chọn cùng lúc nhiều phiếu cá nhân/vị trí đã thu về.
   - Hệ thống tự động kiểm tra xung đột dữ liệu, gộp vào biểu `B1`, `B2`, `D1`, tính lại định biên `D2`, tăng số phiên bản lên `v2`, `v3`... và ghi vào sheet `15. S_NhatKy`.
5. **Bước 5 — Rà soát 9 biểu trước khi nộp (`/ra-soat`):**
   - Kéo thả tệp `.xlsx` vào bộ máy kiểm tra chéo 9 biểu (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `C3`, `D1`, `D2`, `DM`, `K_KiemTra`).
   - Phân loại phát hiện theo 3 cấp độ: **Phải sửa**, **Cần bổ sung căn cứ**, **Nên xem lại**.

