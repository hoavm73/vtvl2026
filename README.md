# HCM-UTE Vị trí việc làm

Hệ thống **Vị trí việc làm** dành cho **48 đơn vị thuộc/trực thuộc Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)**, được xây dựng với đầy đủ tính năng nghiệp vụ của `vtvl.tranghoaivu.vn` và ngôn ngữ thiết kế giao diện hiện đại của hệ sinh thái HCM-UTE (`link.hcmute.edu.vn`).

## 4 phân hệ chính trong quy trình 5 bước
1. **Trang chủ điều phối (`/`)**: Quy trình 5 bước trực quan, thanh mốc thời gian nộp hồ sơ đếm ngược (Milestones), nơi nộp hồ sơ và nhật ký thao tác trên trình duyệt.
2. **Tạo tệp đơn vị & Nạp phiếu (`/tao-tep`)**:
   - Chọn mẫu cho 4 khối đơn vị HCM-UTE (Khoa & Viện đào tạo, Phòng ban chức năng, Trung tâm & Phân hiệu, Quản trị & Đảng - Đoàn thể).
   - Chọn đơn vị từ danh mục 48 đơn vị chuẩn hóa, tự động ánh xạ mã VTVL (`XXX-DT-GV-01` → `CK-DT-GV-01`), điều chỉnh định biên ngạch viên chức.
   - Tách tệp đơn vị 9 biểu `.xlsx`, phiếu khảo sát `Phieu_B2` và gói `.zip` phiếu từng vị trí.
   - Nạp và gộp nhiều phiếu khảo sát / phiếu bấm giờ vào tệp đơn vị, phát hiện xung đột dữ liệu và tự động nâng cấp phiên bản (`v1` → `v2`).
3. **Bấm giờ công việc (`/bam-gio`)**:
   - Chọn đơn vị và vị trí việc làm, bấm đồng hồ đo thời gian thực hiện hoặc nhập phiên đo để tính `Phút/SP` thực tế và xuất phiếu cá nhân `.xlsx`.
4. **Rà soát 9 biểu (`/ra-soat`)**:
   - Kéo-thả một hoặc nhiều tệp `.xlsx` đơn vị để kiểm tra chéo 9 biểu (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `C3`, `D1`, `D2`, `DM`, `K_KiemTra`), phân loại theo 3 mức độ: **Phải sửa**, **Cần bổ sung căn cứ**, **Nên xem lại**, kèm tính năng nạp tệp mẫu thử nghiệm và xuất báo cáo rà soát.

## Khởi chạy dự án
```bash
npm install
npm run generate:templates
npm run dev
```
Truy cập tại: `http://localhost:3360`
