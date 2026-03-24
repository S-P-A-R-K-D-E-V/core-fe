# Agent Instructions: Module Sản phẩm (Products) — Frontend (core-fe)

## Kiến trúc & conventions
- API gọi qua `src/api/products.ts` và `src/api/product.ts` (dùng axios, SWR)
- Types chính: `IProduct`, `IProductItem`, `IProductVariant`, `IProductUnitConversion` (định nghĩa ở `src/types/corecms-api.ts` và `src/types/product.ts`)
- UI phân tách rõ: list, details, edit, create, review, filters (theo pattern Next.js/React)
- Mapping dữ liệu từ backend: chú ý mapping từ schema cũ (KiotViet) sang schema mới (xem hàm mapProductResponse)
- Variants và unit conversions: ưu tiên lấy từ trường mới, fallback sang childProducts nếu cần

## Flow chính
- Lấy danh sách sản phẩm: `useGetProducts()` (SWR hook)
- Lấy chi tiết sản phẩm: `useGetProduct(productId)`
- Tạo/sửa/xóa sản phẩm: gọi API qua axios, cập nhật lại cache SWR
- Review sản phẩm: types và form ở `src/types/product.ts`

## Lưu ý đặc biệt
- Khi mapping dữ liệu, luôn kiểm tra tổng tồn kho (totalStock) và các trường variants/unitConversions
- Nếu backend trả về childProducts, cần phân loại thành variants hoặc unit conversions
- Khi thêm field mới, cập nhật cả types và mapping ở API layer
- Đảm bảo đồng bộ với backend entity (xem instructions.products.md ở Core-be)

## Prompt mẫu cho agent
- "Thêm trường mới vào sản phẩm (ví dụ: originCountry), cập nhật types, API, và UI"
- "Refactor mapping product để hỗ trợ schema mới từ backend"
- "Tìm tất cả nơi sử dụng IProduct và đề xuất migration sang IProductItem"
- "Tạo form tạo/sửa sản phẩm với các trường variants và unit conversions"

## Tài liệu liên quan
- [src/api/products.ts](../src/api/products.ts)
- [src/types/product.ts](../src/types/product.ts)
- [src/types/corecms-api.ts](../src/types/corecms-api.ts)
- [README.md](../README.md)

> Luôn đồng bộ conventions với backend, ưu tiên mapping rõ ràng giữa schema cũ và mới, và cập nhật types khi backend thay đổi.
