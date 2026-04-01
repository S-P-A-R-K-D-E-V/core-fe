# Agent Instructions: Module Nhập hàng (Purchase Orders) — Frontend (core-fe)

## Kiến trúc & conventions
- API gọi qua `src/api/purchase-orders.ts` (axios, RESTful)
- Types chính: `IPurchaseOrder`, `ICreatePurchaseOrderRequest`, `IUpdatePurchaseOrderRequest`, `IReceivePurchaseOrderRequest` (định nghĩa ở `src/types/corecms-api.ts`)
- UI phân tách rõ: list, detail, create, edit (theo pattern Next.js/React, MUI)
- Form nhập hàng: dùng react-hook-form + Yup validation, cho phép chọn nhiều sản phẩm, nhà cung cấp, kho, ngày dự kiến nhận
- Trạng thái đơn nhập: Draft, Confirmed, PartiallyReceived, Completed, Cancelled (mapping màu sắc, label rõ ràng)

## Flow chính
- Lấy danh sách đơn nhập: `getAllPurchaseOrders(params)`
- Lấy chi tiết đơn nhập: `getPurchaseOrderById(id)`
- Tạo mới: `createPurchaseOrder(data)`
- Cập nhật: `updatePurchaseOrder(id, data)`
- Xác nhận: `confirmPurchaseOrder(id)`
- Nhận hàng: `receivePurchaseOrder(id, data)`
- Hủy đơn: `cancelPurchaseOrder(id)`

## Lưu ý đặc biệt
- Khi tạo/cập nhật đơn nhập, validate đủ sản phẩm, số lượng, giá, VAT, discount
- Khi nhận hàng, cập nhật trạng thái và tồn kho sản phẩm
- Mapping dữ liệu với backend: đồng bộ fields, chú ý các trường liên quan đến KiotViet nếu có
- Khi thêm field mới, cập nhật cả types, API, và UI form
- Đảm bảo đồng bộ conventions với backend entity (xem instructions.purchase-orders.md ở Core-be)

## Prompt mẫu cho agent
- "Thêm trường ngày dự kiến nhận vào form nhập hàng, cập nhật types và API"
- "Tìm tất cả nơi sử dụng IPurchaseOrder và đề xuất migration khi backend thay đổi schema"
- "Tạo form nhập hàng cho phép chọn nhiều sản phẩm, validate số lượng và giá"
- "Mapping trạng thái đơn nhập sang màu sắc và label tiếng Việt cho UI"

## Tài liệu liên quan
- [src/api/purchase-orders.ts](../src/api/purchase-orders.ts)
- [src/types/corecms-api.ts](../src/types/corecms-api.ts)
- [src/sections/pos/purchase-order/](../src/sections/pos/purchase-order/)
- [README.md](../README.md)

> Luôn đồng bộ conventions với backend, validate kỹ dữ liệu nhập hàng, và cập nhật types khi backend thay đổi.
