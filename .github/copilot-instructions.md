# Workspace Instructions for Core FE (Next.js)

## Build & Run
- Node.js 16.x hoặc 18.x
- Khuyến nghị dùng Yarn:
  - `yarn install`
  - `yarn dev`
- Hoặc dùng NPM:
  - `npm i` hoặc `npm i --legacy-peer-deps`
  - `npm run dev`
- Để build production: `yarn build` hoặc `npm run build`

## Kiến trúc & conventions
- Sử dụng Next.js (App Router)
- Phân tách module rõ ràng: `src/api/`, `src/sections/`, `src/types/`, `src/utils/`
- API nội bộ: tạo ở `src/api/` hoặc `app/api/`
- Types dùng chung: `src/types/`
- Utils: `src/utils/`
- Đặt env vars trong `.env.local` (dev) hoặc cấu hình trên Vercel (prod)

## Lưu ý đặc biệt
- Shift module: sử dụng versioning, lock/unlock cho payroll, phân quyền rõ ràng (Admin/Manager/Staff)
- Khi migrate dữ liệu hoặc refactor lớn, luôn cập nhật README/module docs
- Link tài liệu thay vì lặp lại: xem thêm ở `README.md`, `src/sections/shift/README.md`, `Core-be/README.md`

## Tài liệu liên quan
- [README.md](../README.md) (FE tổng quan)
- [src/sections/shift/README.md](../src/sections/shift/README.md) (Shift module)
- [Core-be/README.md](../../Core-be/README.md) (Backend)

## Prompt mẫu cho agent
- "Tạo API route mới cho Claude chat, bảo mật API key bằng env"
- "Refactor ShiftSchedule để hỗ trợ versioning tự động"
- "Thêm endpoint mới vào src/api/ và cập nhật types liên quan"
- "Tìm tất cả nơi sử dụng ShiftAssignment và đề xuất migration sang ShiftScheduleId"

## Đề xuất agent customization tiếp theo
- /create-instruction: Hướng dẫn chi tiết cho từng module lớn (Shift, Payroll, Auth)
- /create-skill: Skill cho best practices Next.js, hoặc skill tích hợp Claude API an toàn
- /create-prompt: Prompt mẫu cho migration, refactor, hoặc tích hợp AI

---

> Luôn ưu tiên link tài liệu nội bộ, tránh lặp lại nội dung dài. Nếu workspace phức tạp, nên chia nhỏ hướng dẫn theo module bằng applyTo.
