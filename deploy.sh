#!/bin/bash
# =======================================================
# Script Tự Động Build, Chạy Migration PostgreSQL/Prisma & Deploy trên VPS
# Hệ thống: HCM-UTE VTVL 360 (https://kekhaivtvl.hcmute.edu.vn & https://vtvl.utehub.vn)
# Repository: https://github.com/hoavm73/vtvl2026
# Server VPS: 14.225.254.3 (App: 127.0.0.1:3360, DB: 127.0.0.1:5436)
# =======================================================
set -e

WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$WORK_DIR"

LOCK_PID_FILE="/tmp/utevtvl-deploy.pid"
if [ -f "$LOCK_PID_FILE" ]; then
  OLD_PID=$(cat "$LOCK_PID_FILE" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && [ "$OLD_PID" != "$$" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "⚠️ Hủy tiến trình deploy cũ đang chạy (PID $OLD_PID) để tránh quá tải CPU/RAM VPS..."
    pkill -TERM -P "$OLD_PID" 2>/dev/null || true
    kill -TERM "$OLD_PID" 2>/dev/null || true
    sleep 2
  fi
fi
echo "$$" > "$LOCK_PID_FILE"
trap 'rm -f "$LOCK_PID_FILE"' EXIT

echo "🚀 [1/6] Đang kéo mã nguồn mới nhất từ nhánh main (hoavm73/vtvl2026)..."
if [ -d .git ]; then
  git fetch origin main
  git checkout main
  git pull --ff-only origin main
fi
GIT_SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

echo "📦 [2/6] Kiểm tra cấu hình môi trường (.env)..."
if [ -f .env.production ]; then
  cp .env.production .env
elif [ ! -f .env ]; then
  GEN_DB_PASS=$(openssl rand -hex 18)
  GEN_ADMIN_SECRET=$(openssl rand -hex 24)
  GEN_NEXTAUTH_SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
NEXT_PUBLIC_APP_URL=https://kekhaivtvl.hcmute.edu.vn
NEXTAUTH_URL=https://kekhaivtvl.hcmute.edu.vn
NEXTAUTH_SECRET=${GEN_NEXTAUTH_SECRET}
ADMIN_SERVER_SECRET=${GEN_ADMIN_SECRET}

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ALLOWED_HD=

POSTGRES_USER=utevtvl_admin
POSTGRES_PASSWORD=${GEN_DB_PASS}
POSTGRES_DB=utevtvl_db
DATABASE_URL=postgresql://utevtvl_admin:${GEN_DB_PASS}@127.0.0.1:5436/utevtvl_db?schema=public
EOF
  chmod 600 .env
  echo "✓ Đã khởi tạo tệp .env mặc định với mật khẩu PostgreSQL riêng biệt."
fi

grep -q "^NEXT_PUBLIC_APP_URL=" .env || echo "NEXT_PUBLIC_APP_URL=https://kekhaivtvl.hcmute.edu.vn" >> .env
grep -q "^NEXTAUTH_URL=" .env || echo "NEXTAUTH_URL=https://kekhaivtvl.hcmute.edu.vn" >> .env
if ! grep -q "^NEXTAUTH_SECRET=" .env; then
  echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
fi
grep -q "^GOOGLE_CLIENT_ID=" .env || echo "GOOGLE_CLIENT_ID=" >> .env
grep -q "^GOOGLE_CLIENT_SECRET=" .env || echo "GOOGLE_CLIENT_SECRET=" >> .env
grep -q "^GOOGLE_ALLOWED_HD=" .env || echo "GOOGLE_ALLOWED_HD=" >> .env

set -a
# shellcheck disable=SC1091
source .env
set +a

# ==============================================================================
# KHÓA BẢO VỆ AN TOÀN CƠ SỞ DỮ LIỆU (DATABASE SAFETY GUARD)
# ==============================================================================
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ LỖI: DATABASE_URL không tồn tại trong .env! Hủy deploy để bảo vệ dữ liệu."
  exit 1
fi

if [[ "$DATABASE_URL" != *"utevtvl_db"* ]]; then
  echo "❌ CẢNH BÁO BẢO MẬT: DATABASE_URL không trỏ vào cơ sở dữ liệu utevtvl_db!"
  exit 1
fi

if [[ "$DATABASE_URL" == *"uteform_db"* ]] || [[ "$DATABASE_URL" == *"uteframe_db"* ]] || [[ "$DATABASE_URL" == *"neondb"* ]] || [[ "$DATABASE_URL" == *"uteshort"* ]]; then
  echo "❌ CẢNH BÁO NGUY HIỂM: Phát hiện chuỗi kết nối chứa DB hệ thống khác! DỪNG NGAY LẬP TỨC!"
  exit 1
fi

echo "🛡️ Database safety check: HỢP LỆ (utevtvl_db)."

echo "🏗️ [3/6] Build & khởi chạy containers (utevtvl-postgres, utevtvl-app)..."
if docker compose version &>/dev/null; then
  docker compose up -d --build --remove-orphans
elif command -v docker-compose &>/dev/null; then
  docker-compose up -d --build --remove-orphans
else
  echo "❌ Không tìm thấy docker compose!"
  exit 1
fi

echo "🗄️ [4/6] Thực thi bộ máy PostgreSQL & Prisma Migration (_prisma_migrations + schema_migrations + migrations.log)..."
PG_USER="${POSTGRES_USER:-utevtvl_admin}"
PG_DB="${POSTGRES_DB:-utevtvl_db}"

for _ in {1..15}; do
  if docker exec utevtvl-postgres pg_isready -U "$PG_USER" -d "$PG_DB" &>/dev/null; then
    break
  fi
  sleep 2
done

set -o pipefail
docker exec -e GIT_COMMIT="$GIT_SHORT_SHA" utevtvl-app node scripts/migrate-postgres.mjs 2>&1 | tee -a "$WORK_DIR/migrations.log"
echo "🧪 [4b/6] Kiểm thử hậu triển khai: đối soát 100% bảng Prisma & chỉ mục trên PostgreSQL..."
docker exec utevtvl-app node scripts/verify-deployed-tables.mjs 2>&1 | tee -a "$WORK_DIR/migrations.log"

mkdir -p /var/cache/nginx/vtvl_static && chown -R www-data:www-data /var/cache/nginx/vtvl_static 2>/dev/null || true

for DOMAIN_NAME in kekhaivtvl.hcmute.edu.vn vtvl.utehub.vn; do
  if [ -d "/etc/nginx/sites-available" ] && [ -f "deploy/nginx/${DOMAIN_NAME}.conf" ] && [ -f "/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem" ]; then
    if ! cmp -s "deploy/nginx/${DOMAIN_NAME}.conf" "/etc/nginx/sites-available/${DOMAIN_NAME}.conf" || [ ! -L "/etc/nginx/sites-enabled/${DOMAIN_NAME}.conf" ]; then
      cp "deploy/nginx/${DOMAIN_NAME}.conf" "/etc/nginx/sites-available/${DOMAIN_NAME}.conf"
      ln -sf "/etc/nginx/sites-available/${DOMAIN_NAME}.conf" "/etc/nginx/sites-enabled/${DOMAIN_NAME}.conf"
      nginx -t && systemctl reload nginx
    fi
  fi
done

echo "🩺 [5/6] Kiểm tra phản hồi HTTP máy chủ ứng dụng (127.0.0.1:3360)..."
HTTP_STATUS="000"
for _ in {1..15}; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3360/api/health/live || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    break
  fi
  sleep 2
done
echo "✓ HTTP Status trên cổng 3360: $HTTP_STATUS"
if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ Ứng dụng chưa phản hồi HTTP 200. Kiểm tra nhật ký: docker logs utevtvl-app --tail 50"
  exit 1
fi

git rev-parse HEAD > .deployed_sha 2>/dev/null || true

echo "🧹 [6/6] Dọn dẹp Docker image & bộ nhớ đệm cũ..."
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --keep-storage 512MB >/dev/null 2>&1 || true

echo "✅ Deploy HCM-UTE VTVL 360 (https://kekhaivtvl.hcmute.edu.vn) hoàn tất thành công!"

