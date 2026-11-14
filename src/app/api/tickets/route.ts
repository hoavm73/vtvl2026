import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByOwner,
  getTicketsByUnit,
  upsertTicketAndSyncUnit,
  deleteTicketAndSyncUnit,
  allocateNextTaskCode
} from '@/services/storage/server-ticket-store';
import {
  getOrCreateWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';

export async function GET(req: NextRequest) {
  const email = normalizeEmail(req.nextUrl.searchParams.get('email') || '');
  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || 'FIT').trim().toUpperCase();
  const unit = findHcmuteUnit(unitCodeParam);

  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', email || 'guest@hcmute.edu.vn', 'Cán bộ – Giảng viên');

  const myTickets = email ? getTicketsByOwner(email) : [];
  const unitTickets = getTicketsByUnit(unit.code);

  return NextResponse.json({
    myTickets,
    unitTickets,
    unitCode: unit.code,
    unitNameVi: unit.nameVi,
    a1Missions: wb.data.A1 || [],
    c1Vtvls: wb.data.C1 || [],
    unitA2Tasks: wb.data.A2 || [],
    unitB1Volumes: wb.data.B1 || []
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ownerEmail = normalizeEmail(body.ownerEmail || '');
    if (!ownerEmail) {
      return NextResponse.json({ error: 'Thiếu thông tin email người lập phiếu.' }, { status: 400 });
    }
    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) {
      return NextResponse.json(
        { error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc cụ thể.' },
        { status: 400 }
      );
    }

    const result = await upsertTicketAndSyncUnit({
      id: body.id,
      unitCode: body.unitCode || 'FIT',
      ownerEmail,
      ownerName: body.ownerName || ownerEmail.split('@')[0],
      ownerTitle: body.ownerTitle || 'Cán bộ – Giảng viên',
      status: body.status === 'Đã nộp' ? 'Đã nộp' : 'Nháp',
      maNhiemVu: String(body.maNhiemVu),
      maCongViec: String(body.maCongViec || ''),
      tenCongViec: String(body.tenCongViec),
      maVtvl: String(body.maVtvl),
      maVtvlPhoiHop: body.maVtvlPhoiHop ? String(body.maVtvlPhoiHop) : '',
      sanPham: String(body.sanPham || ''),
      chatLuong: String(body.chatLuong || ''),
      canCu: String(body.canCu || ''),
      soSpNam: Number(body.soSpNam) || 0,
      nguonSoLieu: String(body.nguonSoLieu || ''),
      phutThucTe: Number(body.phutThucTe) || 0,
      gioBoSung: Number(body.gioBoSung) || 0,
      coordinatedTasks: Array.isArray(body.coordinatedTasks) ? body.coordinatedTasks : []
    });

    return NextResponse.json({
      ok: true,
      ticket: result.ticket,
      unitWorkbookRevision: result.unitWorkbookRevision
    });
  } catch (err) {
    console.error('Ticket POST error:', err);
    return NextResponse.json({ error: 'Không thể lưu phiếu công việc.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const email = normalizeEmail(req.nextUrl.searchParams.get('email') || '');
  if (!id || !email) {
    return NextResponse.json({ error: 'Thiếu mã phiếu hoặc thông tin tài khoản.' }, { status: 400 });
  }

  const deleted = await deleteTicketAndSyncUnit(id, email);
  if (!deleted) {
    return NextResponse.json({ error: 'Không tìm thấy phiếu hoặc bạn không có quyền xóa phiếu này.' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  // API phụ trợ lấy mã công việc tự nhảy tiếp theo khi người dùng chọn Mã nhiệm vụ trên form
  const body = await req.json();
  const unitCode = (body.unitCode || 'FIT').toUpperCase();
  const maNhiemVu = String(body.maNhiemVu || '').trim();
  if (!maNhiemVu) return NextResponse.json({ nextTaskCode: '' });

  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(unitCode, '01/10/2025–30/9/2026', 'system@hcmute.edu.vn', 'System');
  const unitTickets = getTicketsByUnit(unitCode);
  const nextTaskCode = allocateNextTaskCode(unitCode, maNhiemVu, wb.data.A2 || [], unitTickets, body.excludeTicketId);
  return NextResponse.json({ nextTaskCode });
}
