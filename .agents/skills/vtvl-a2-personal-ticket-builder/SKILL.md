---
name: vtvl-a2-personal-ticket-builder
description: Chuyển đổi tệp Excel kê khai công việc cá nhân của cán bộ/giảng viên sang tệp mẫu chuẩn 14 cột `2. A2_CongViec` sẵn sàng nạp hàng loạt bằng nút `Nhập Excel A2` (Admin) tại `/phieu-don-vi` — giữ nguyên văn 100% nội dung, tự gắn tiền tố mã đơn vị cho `Mã VTVL` & `Mã VTVL phối hợp`, tự tra cứu email `@hcmute.edu.vn` chính xác và đối soát tổng quỹ giờ (1.904h / 1.760h).
---

# Skill Tạo Phiếu A2 Cá Nhân Chuẩn Nạp Hệ Thống (`2. A2_CongViec`)

Skill này dùng khi Admin / Phòng TCNS hoặc đầu mối đơn vị nhận tệp Excel kê khai công việc cá nhân của từng cán bộ/giảng viên và cần chuyển đổi nhanh sang tệp mẫu chuẩn **`2. A2_CongViec`** để nạp trực tiếp bằng nút **↑ Nhập Excel A2** (dành riêng cho Admin) tại `/phieu-don-vi`.

---

## 1. Năm nguyên tắc bắt buộc khi chuyển đổi

1. **Giữ nguyên văn 100% nội dung chữ và số từ tệp nguồn:**
   - Tuyệt đối không viết lại, rút gọn hay chỉnh sửa các cột: `Mã nhiệm vụ (A1)`, `Tên công việc cụ thể`, `Sản phẩm đầu ra`, `Yêu cầu chất lượng`, `Căn cứ`, `Số SP/năm`, `Phút/SP`, `Giờ bổ sung`, `Nguồn số liệu`.
   - Nếu tệp nguồn không có cột `Đơn vị tính`, **để trống nguyên bản (`""`)**, không tự suy luận thêm chữ.
2. **Chỉ chuẩn hóa 2 cột mã kỹ thuật theo mã đơn vị (`<MÃ_ĐV>.`):**
   - **Cột C (`Mã VTVL (từ C1)`):** Gắn tiền tố `<MÃ_ĐV>.` nếu mã chưa có dấu chấm (ví dụ `HT51` → `QTTHTT.HT51`) để khớp tuyệt đối công thức cộng giờ **Biểu C3** và kiểm tra chéo **K2 (`B1 ↔ C1`)**.
   - **Cột I (`Mã VTVL phối hợp`):** Gắn tiền tố `<MÃ_ĐV>.` cho từng mã chưa có dấu chấm (ví dụ `QL43, HT51` → `QTTHTT.QL43, QTTHTT.HT51`).
   - **Cột A (`Mã công việc`):** Luôn để trống để hệ thống tự cấp mã tăng dần `[Mã NV].CVxx` khi nạp.
3. **Tra cứu email `@hcmute.edu.vn` chính xác (tuyệt đối không đoán):**
   - Tự động đối chiếu họ tên cán bộ với `v2DS phan quyen (1).xls`, `DS phan quyen.xls` và `.data/server_accounts.json`.
   - Nếu không tìm thấy email trong danh mục, giữ nguyên họ tên cán bộ ở Cột J và báo rõ để người dùng xác nhận hoặc chọn trực tiếp từ dropdown trên bảng xem trước khi nạp.
4. **Đối soát tổng quỹ giờ tự động:**
   - Tính `Σ(Số SP/năm × Phút/SP / 60 + Giờ bổ sung)` trên toàn bộ các dòng xuất ra và đối chiếu với định mức chuẩn (`1.904 giờ/năm` phổ biến hoặc `1.760 giờ/năm` đặc thù).
5. **Xuất vào thư mục riêng `Mẫu phiếu final`:**
   - Không ghi đè tệp mẫu trống hoặc tệp gốc của cán bộ.
   - Tạo thư mục `Mẫu phiếu final` cùng cấp với tệp nguồn và lưu tệp đầu ra theo mẫu `Mau_Phieu_A2_<MÃ_ĐV>_<Ho_Ten>_READY.xlsx`, sheet tên chuẩn `2. A2_CongViec` gồm đủ 14 cột (`A..N`).

---

## 2. Cấu trúc 14 cột chuẩn `2. A2_CongViec` đầu ra

| Cột | Tiêu đề chuẩn | Quy tắc điền |
| :---: | :--- | :--- |
| **A** | `Mã công việc ([NV].CVxx)` | Để trống (hệ thống tự cấp) |
| **B** | `Mã nhiệm vụ (A1)` | Nguyên văn từ tệp nguồn (VD: `QTTHTT.NV14`) |
| **C** | `Mã VTVL (từ C1)` | Gắn tiền tố đơn vị nếu thiếu (VD: `QTTHTT.HT51`) |
| **D** | `Tên công việc cụ thể` | Nguyên văn |
| **E** | `Sản phẩm đầu ra` | Nguyên văn |
| **F** | `Đơn vị tính` | Nguyên văn (để trống nếu tệp nguồn không có) |
| **G** | `Yêu cầu chất lượng` | Nguyên văn |
| **H** | `Căn cứ (nguồn tài liệu)` | Nguyên văn |
| **I** | `Mã VTVL phối hợp` | Gắn tiền tố đơn vị cho từng mã nếu thiếu |
| **J** | `Email cán bộ (@hcmute.edu.vn)` | Email chính xác tra từ danh mục phân quyền |
| **K** | `Số SP/năm` | Nguyên văn (số) |
| **L** | `Phút/SP` | Nguyên văn (số) |
| **M** | `Giờ bổ sung` | Nguyên văn (số) |
| **N** | `Nguồn số liệu` | Nguyên văn |

---

## 3. Lệnh chạy chuyển đổi nhanh 1 chạm

```bash
node ".agents/skills/vtvl-a2-personal-ticket-builder/scripts/convert-personal-a2.mjs" \
  "<đường_dẫn_file_kê_khai_cá_nhân.xlsx>" \
  --unit QTTHTT
```

Tùy chọn mở rộng:
- `--email <email@hcmute.edu.vn>`: chỉ định trực tiếp email cán bộ (bỏ qua tra cứu tự động).
- `--unitName "<Tên đầy đủ đơn vị>"`: ghi tên đầy đủ đơn vị trên dòng tiêu đề 1.
- `--out "<đường_dẫn_file_đầu_ra.xlsx>"`: chỉ định nơi lưu tùy chọn (mặc định lưu vào `<thư_mục_file_nguồn>/Mẫu phiếu final/`).
