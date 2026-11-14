# Sơ đồ máy trạng thái (State Machine) Phiếu công việc cá nhân HCM-UTE

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Biểu đồ chuyển đổi trạng thái (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> draft : Cán bộ khởi tạo phiếu

    draft --> submitted : Cán bộ nộp phiếu (SUBMIT)
    draft --> [*] : Cán bộ xóa phiếu nháp

    submitted --> approved : Lãnh đạo/Admin duyệt (APPROVE)
    submitted --> changes_requested : Lãnh đạo/Admin yêu cầu bổ sung (REQUEST_CHANGES)

    changes_requested --> resubmitted : Cán bộ chỉnh sửa & nộp lại (RESUBMIT)

    resubmitted --> approved : Lãnh đạo/Admin duyệt (APPROVE)
    resubmitted --> changes_requested : Lãnh đạo/Admin tiếp tục yêu cầu bổ sung

    approved --> Gộp_B1_B2 : Lãnh đạo/Admin kích hoạt gộp dữ liệu
    Gộp_B1_B2 --> approved : Hoàn tất gộp (Idempotent)

    note right of draft
        Chỉ chủ sở hữu và Admin được xem.
        Được sửa, xóa nội dung tùy ý.
    end note

    note right of submitted
        Xuất hiện trong tab Chờ duyệt.
        Nội dung bị khóa đối với cán bộ.
    end note

    note left of changes_requested
        Cán bộ thấy rõ lý do yêu cầu bổ sung.
        Mở khóa cho cán bộ chỉnh sửa nội dung.
    end note

    note right of approved
        Dữ liệu chính thức của đơn vị.
        Bị khóa vĩnh viễn (Chỉ đọc).
        Đủ điều kiện gộp vào B1/B2.
    end note
```

---

## 2. Bảng ma trận chuyển đổi trạng thái hợp lệ

| Trạng thái hiện tại | Trạng thái tiếp theo | Thao tác (Action) | Tác nhân được phép | Điều kiện tiên quyết & Ràng buộc bảo mật |
|---|---|---|---|---|
| *(Khởi tạo)* | `draft` | `CREATE` | Cán bộ / Lãnh đạo / Admin | Phiếu được tạo cho chính mình (`owner_id = caller.email`) và đơn vị của mình. |
| `draft` | `submitted` | `SUBMIT` | Chủ sở hữu phiếu (`staff` / `unit_leader`) | Các trường bắt buộc (`maNhiemVu`, `maVtvl`, `tenCongViec`) phải đầy đủ. Ghi nhận `submitted_at = NOW()`. |
| `submitted` | `approved` | `APPROVE` | Lãnh đạo đơn vị (`unit_leader`) hoặc Admin | - Lãnh đạo chỉ duyệt phiếu thuộc đơn vị mình.<br>- **Lãnh đạo CẤM tự duyệt phiếu của chính mình** (`FORBIDDEN_SELF_REVIEW`). Phiếu của Lãnh đạo phải do Admin/TCNS duyệt.<br>- Ghi nhận `approved_by`, `approved_at = NOW()`. |
| `submitted` | `changes_requested` | `REQUEST_CHANGES` | Lãnh đạo đơn vị (`unit_leader`) hoặc Admin | - **Lý do yêu cầu bổ sung là bắt buộc** (không được rỗng).<br>- Ghi nhận `revision_reason`, `revision_requested_by`, `revision_requested_at = NOW()`. |
| `changes_requested` | `resubmitted` | `RESUBMIT` | Chủ sở hữu phiếu | Cán bộ cập nhật lại nội dung theo yêu cầu và bấm nộp lại. Ghi nhận `resubmitted_at = NOW()`. |
| `resubmitted` | `approved` | `APPROVE` | Lãnh đạo đơn vị hoặc Admin | Tương tự nhánh `submitted -> approved`. |
| `resubmitted` | `changes_requested` | `REQUEST_CHANGES` | Lãnh đạo đơn vị hoặc Admin | Tương tự nhánh `submitted -> changes_requested`. |
| `approved` | `approved` *(Đã gộp)* | `MERGE_B1_B2` | Lãnh đạo đơn vị hoặc Admin | - Chỉ thực hiện khi phiếu ở trạng thái `approved`.<br>- Sinh và liên kết dòng trong B1 (`b1-[id]`) và B2/A2 (`a2-[id]`).<br>- Idempotent: Gộp lại thì cập nhật thay vì tạo trùng lặp. Ghi `merged_at`, `merged_by`. |

---

## 3. Các chuyển đổi BỊ CẤM (Invalid Transitions)

1. `draft` -> `approved`: Cấm duyệt thẳng từ bản nháp mà chưa qua bước nộp chính thức.
2. `draft` -> `changes_requested`: Cấm yêu cầu chỉnh sửa bản nháp chưa nộp.
3. `submitted` -> `draft`: Cấm tự hạ trạng thái phiếu đã nộp về nháp mà không qua quy trình trả lại/yêu cầu bổ sung.
4. `approved` -> `draft` / `changes_requested` / `submitted`: Phiếu sau khi duyệt trở thành bản ghi lịch sử chính thức, không được sửa đổi trực tiếp.
5. `changes_requested` -> `approved`: Phiếu yêu cầu bổ sung bắt buộc cán bộ phải nộp lại (`resubmitted`) trước khi Lãnh đạo có thể phê duyệt.
