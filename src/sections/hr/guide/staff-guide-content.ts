import type { StaffGuide } from './staff-guide-types';

// ----------------------------------------------------------------------
// Nội dung "Hướng dẫn sử dụng app cho nhân viên CiCi" — một nguồn cho trang /dashboard/hr/guide và bản PDF
// (scripts/build-staff-guide-pdf.mts). Thứ tự theo chủ cửa hàng (06/11/2026): chào mừng → về app → đăng nhập →
// thông tin cá nhân → nội quy → ca làm → đăng ký ca → khuôn mặt + chấm công vào → chấm công ra → công việc trong ca →
// kiểm quầy → đổi ca, làm hộ → lương, điểm trừ, khiếu nại. Mỗi bước ghi cách làm trên app S Store và trên web.
// Quy định lấy theo Nội quy lao động và Quy chế lương thưởng CiCi bản T11–T12/2026. Nhãn nút giữ đúng chữ trên app/web.
// Xin nghỉ ca chưa áp dụng nên không hướng dẫn. Không import gì ngoài kiểu (để Node chạy thẳng được khi dựng PDF).
// ----------------------------------------------------------------------

export const STAFF_GUIDE: StaffGuide = {
  title: 'Hướng dẫn sử dụng app cho nhân viên CiCi',
  subtitle:
    'Từng bước dùng app S Store và trang web cici21chualang.vn trong công việc hằng ngày, kèm những quy định cần nhớ trong Nội quy lao động và Quy chế lương thưởng (chạy thử 01/11–31/12/2026). Khi có chỗ khác nhau, văn bản Nội quy và Quy chế là bản gốc. Ảnh chụp từ app S Store 1.0.4 (Android) và trang web; tên, ảnh đại diện, email, giấy tờ và số tiền đã được làm mờ.',
  updatedAt: '06/11/2026',
  parts: [
    // ------------------------------------------------------------------
    {
      id: 'chao-mung',
      title: '1. Chào mừng',
      sections: [
        {
          id: 'chao-mung-ban',
          title: 'Chào mừng bạn đến với CiCi',
          lead: 'Mọi việc trong ca của bạn — lịch làm, chấm công, việc được giao, kiểm quầy, lương và điểm — đều nằm trên app S Store.',
          blocks: [
            {
              kind: 'p',
              text: 'Tài liệu này đi theo đúng trình tự một nhân viên mới bắt đầu: vào app, điền thông tin, đọc nội quy, đăng ký ca, chấm công, làm việc trong ca, kiểm quầy, đổi ca khi cần và theo dõi lương. Mỗi bước có cách làm trên điện thoại (app) và trên máy tính (web).',
            },
            {
              kind: 'bullets',
              title: 'Ngày đầu tiên, bạn cần làm xong',
              items: [
                'Cài app S Store và đăng nhập (mục 3).',
                'Điền hồ sơ: số điện thoại, tài khoản ngân hàng nhận lương, CCCD (mục 4).',
                'Đọc và bấm xác nhận Nội quy lao động và Quy chế lương thưởng (mục 5).',
                'Đăng ký khuôn mặt để chấm công (mục 8).',
                'Đăng ký ca cho tuần tới trước hạn (mục 7).',
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Cần hỗ trợ: hỏi trưởng ca hoặc quản lý. Trang hướng dẫn này luôn mở được trên web: Nhân sự → "Hướng dẫn sử dụng app".',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 've-app',
      title: '2. Về app và trang web',
      sections: [
        {
          id: 'app-va-web',
          title: 'App S Store và trang web',
          blocks: [
            {
              kind: 'table',
              head: ['', 'App S Store (điện thoại)', 'Trang web cici21chualang.vn (máy tính, máy quầy)'],
              rows: [
                ['Cài đặt', 'App Store (iPhone) hoặc Google Play (Android), tìm "S Store"', 'Mở trình duyệt, vào cici21chualang.vn'],
                ['Dùng để', 'Mọi việc hằng ngày: chấm công, lịch, việc trong ca, kiểm quầy, lương, điểm', 'Như app; tiện khi làm ở máy quầy hoặc xem bảng lớn'],
                ['Chấm công', 'Bằng khuôn mặt và vị trí điện thoại', 'Bằng camera máy và vị trí trình duyệt (phải cho phép vị trí)'],
                ['Thông báo', 'Có thông báo đẩy về điện thoại', 'Xem ở biểu tượng chuông'],
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'App và web dùng chung một tài khoản và một dữ liệu: đăng ký ca trên web thì app cũng thấy ngay, và ngược lại.',
            },
          ],
        },
        {
          id: 'trang-chu',
          title: 'Trang chủ và thanh tab của app',
          blocks: [
            {
              kind: 'shots',
              items: [
                { file: 'app-trang-chu.webp', caption: 'Trang chủ: lương tạm tính, Dùng nhanh, Ca làm hôm nay' },
                { file: 'app-trang-chu-2.webp', caption: 'Kéo xuống: Nhân sự, target tuần, điểm trừ, việc trong ca' },
                { file: 'app-popup.webp', caption: 'Popup thông báo của cửa hàng: đọc rồi bấm "Đã hiểu"' },
              ],
            },
            {
              kind: 'table',
              head: ['Tab', 'Dùng để'],
              rows: [
                ['Trang chủ', 'Lương tạm tính, ca hôm nay, việc cần làm, điểm trừ, target tuần'],
                ['Lịch làm', 'Lịch ca theo tuần, đăng ca lên chợ (làm hộ, đổi ca), mở Đăng ký ca và Công việc'],
                ['Điểm danh (nút giữa)', 'Chấm công vào và ra ca'],
                ['Lương', 'Phiếu lương từng kỳ, chi tiết ca, tiền phạt, khiếu nại phiếu lương'],
                ['Tiện ích', 'Mọi tính năng: Đăng ký ca, Đổi ca, Nhận ca, Kiểm quầy, Kiểm tra ca, Công việc, Nhân sự, Thông báo, Tin nhắn…'],
              ],
            },
            {
              kind: 'bullets',
              title: 'Trên Trang chủ cần để ý',
              items: [
                '"Lương tạm tính": số tiền ẩn sẵn, bấm biểu tượng con mắt để xem.',
                '"Ca làm hôm nay": trạng thái ca và nút "Chấm công".',
                'Thẻ "Nhân sự": văn bản cần đọc và xác nhận, biên bản chờ ký, việc giao riêng, phiếu kiểm hàng ca. Thấy số nào thì bấm vào làm ngay.',
                '"Dùng nhanh": ghim tối đa 8 tiện ích hay dùng (bấm "Tùy chỉnh").',
              ],
            },
            {
              kind: 'p',
              text: 'Trên web, menu bên trái có nhóm "Cá nhân" (Điểm danh vào/ra, Lịch làm cá nhân, Đăng ký khuôn mặt, Đăng ký ca, Bảng lương cá nhân), nhóm "Công việc", nhóm "Nhân sự" và "Đổi ca & Làm hộ". Ảnh đại diện góc phải trên mở Tài khoản.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'dang-nhap-phan',
      title: '3. Đăng nhập',
      sections: [
        {
          id: 'link-moi',
          title: 'Nhận lời mời bằng link',
          lead: 'Nhân viên mới thường nhận được link mời từ quản lý. Mở link là vào thẳng cửa hàng, không cần chờ quản lý tạo tài khoản.',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Mở link mời quản lý gửi (qua Zalo, tin nhắn) hoặc quét mã QR mời.',
                'Trang lời mời hiện tên cửa hàng. Bấm "Tiếp tục với Google" (chưa có tài khoản thì hệ thống tự tạo từ Google).',
                'Thấy "Bạn đã là nhân viên của CiCi 21 Chùa Láng" là xong.',
                'Mở app S Store trên điện thoại, đăng nhập bằng đúng tài khoản Google vừa dùng — cửa hàng hiện ngay trong danh sách.',
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Mỗi link chỉ dùng được một lần và có hạn. Link báo đã dùng, đã thu hồi hoặc hết hạn thì nhờ quản lý gửi link mới.',
            },
          ],
        },
        {
          id: 'dang-nhap',
          title: 'Đăng nhập trên app',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Mở app S Store. Nếu app hỏi cửa hàng, nhập cici21chualang.vn (hoặc bỏ trống để app tự tìm cửa hàng của tài khoản).',
                'Ở màn "CiCi 21 Chùa Láng": tài khoản Gmail thì bấm "Tiếp tục với Google"; tài khoản có mật khẩu thì bấm "Đăng nhập bằng tài khoản email", nhập Email và Mật khẩu rồi bấm "Đăng nhập".',
                'Lần đầu vào app, cho phép app dùng Vị trí, Máy ảnh và Thông báo. Thiếu quyền Vị trí thì không chấm công được.',
              ],
            },
            {
              kind: 'shots',
              items: [{ file: 'app-dang-nhap.webp', caption: 'Màn đăng nhập của cửa hàng trên app' }],
            },
            {
              kind: 'note',
              tone: 'warning',
              text: 'Không dùng tài khoản của người khác, không cho người khác dùng tài khoản của mình, không chia sẻ mật khẩu. Thao tác trên tài khoản nào thì người được cấp tài khoản đó chịu trách nhiệm, trừ khi đã báo quản lý là mất hoặc lộ mật khẩu. Dùng hoặc cho mượn tài khoản là vi phạm Nghiêm trọng (15 điểm).',
            },
          ],
        },
        {
          id: 'dang-nhap-web',
          title: 'Đăng nhập trên web và máy quầy',
          blocks: [
            {
              kind: 'steps',
              title: 'Máy tính cá nhân',
              items: [
                'Vào cici21chualang.vn. Tài khoản Gmail bấm "Tiếp tục sử dụng dịch vụ bằng Google"; tài khoản có mật khẩu nhập Email, Password rồi bấm "Login".',
                'Hoặc bấm "Đăng nhập bằng mã QR": trên điện thoại mở Tài khoản → "Quét mã đăng nhập web", quét mã trên màn hình rồi bấm "Đồng ý đăng nhập". Phiên trên web tự hết sau 12 giờ.',
              ],
            },
            {
              kind: 'steps',
              title: 'Máy quầy của cửa hàng',
              items: [
                'Màn máy quầy hiện danh sách người có ca hôm nay. Bấm vào tên mình.',
                'Nhập mã 6 số app gửi về điện thoại của bạn. Chưa có app thì dùng mật khẩu tài khoản; hoặc bấm "Quét QR bằng điện thoại".',
                'Đăng nhập xong, máy quầy vào thẳng màn "Kiểm tiền quầy".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'web-dang-nhap.webp', caption: 'Đăng nhập trên web: Google, email hoặc mã QR' },
                { file: 'web-may-quay-chon-ten.webp', caption: 'Máy quầy: chọn tên của bạn, mã 6 số gửi về app' },
              ],
            },
            {
              kind: 'bullets',
              items: [
                'Quên mật khẩu: bấm "Forgot password?" trên trang đăng nhập web hoặc nhờ quản lý.',
                'Xem và đăng xuất các máy đang đăng nhập: Tài khoản → "Thiết bị đang đăng nhập".',
                'Hết ca hoặc rời quầy quá 15 phút trên thiết bị dùng chung: đăng xuất.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'thong-tin',
      title: '4. Cập nhật thông tin cá nhân',
      sections: [
        {
          id: 'ho-so',
          title: 'Điền hồ sơ',
          lead: 'Lương được chuyển khoản vào tài khoản ngân hàng đứng tên bạn, nên hồ sơ phải đủ và đúng.',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Bấm ảnh đại diện ở góc trên Trang chủ để mở Tài khoản → "Chỉnh sửa hồ sơ".',
                'Điền Số điện thoại, Địa chỉ, Ngân hàng và Số tài khoản nhận lương.',
                'Chạm vào từng ô "Mặt trước", "Mặt sau" để chụp CCCD (hoặc chọn ảnh từ thư viện).',
                'Bấm "Lưu".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-tai-khoan.webp', caption: 'Tài khoản: Chỉnh sửa hồ sơ, Đăng ký khuôn mặt, Quét mã đăng nhập web' },
                { file: 'app-ho-so.webp', caption: 'Chỉnh sửa hồ sơ: ảnh đại diện, họ tên, số điện thoại' },
                { file: 'app-ho-so-2.webp', caption: 'Kéo xuống: tài khoản ngân hàng nhận lương, CCCD, nút Lưu' },
              ],
            },
            {
              kind: 'p',
              text: 'Trên web: bấm ảnh đại diện góc phải trên → Tài khoản (Account), sửa thông tin rồi lưu.',
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Đổi số tài khoản ngân hàng thì cập nhật ngay trước kỳ trả lương. Ảnh CCCD chỉ dùng nội bộ cho hồ sơ nhân viên.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'noi-quy-phan',
      title: '5. Xem và đọc hiểu nội quy',
      sections: [
        {
          id: 'noi-quy',
          title: 'Đọc và xác nhận nội quy',
          lead: 'Mỗi nhân viên phải xác nhận đã đọc Nội quy lao động và Quy chế lương thưởng trước ca làm đầu tiên.',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Tiện ích → Nhân sự → "Nội quy & văn bản cần xác nhận" (hoặc bấm dòng "văn bản cần đọc và xác nhận" trên Trang chủ).',
                'Bấm "Mở tệp văn bản" và đọc hết.',
                'Bấm "Tôi đã đọc và hiểu", rồi bấm "Tôi đã đọc và hiểu" lần nữa ở hộp "Xác nhận đã đọc".',
                'Văn bản chuyển sang "Đã xác nhận" kèm giờ xác nhận. Làm lần lượt cho từng văn bản.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-noi-quy.webp', caption: 'Hai văn bản "Chưa xác nhận"' },
                { file: 'app-noi-quy-xac-nhan.webp', caption: 'Hộp "Xác nhận đã đọc"' },
                { file: 'app-noi-quy-xong.webp', caption: 'Đã xác nhận cả hai văn bản' },
              ],
            },
            {
              kind: 'p',
              text: 'Trên web: Nhân sự → "Nội quy & ký xác nhận", mở tệp văn bản và bấm xác nhận.',
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Khi văn bản được sửa thành bản mới, bạn phải xác nhận lại. Chưa xác nhận thì có thể không chấm công được: app sẽ tự mở trang văn bản để bạn đọc và xác nhận. Có Trợ lý AI thì bạn có thể hỏi trợ lý về nội quy, quy chế.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'ca-lam',
      title: '6. Ca làm',
      sections: [
        {
          id: 'cach-xep-lich',
          title: 'Quản lý xếp lịch như thế nào',
          lead: 'Bạn đăng ký những ca muốn làm; quản lý xếp lịch dựa trên đăng ký ca của mọi người và tình hình làm việc của từng người. Lịch đã xếp hiện ở tab Lịch làm.',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Bạn đăng ký ca cho tuần tới trước hạn (mục 7).',
                'Quản lý xếp lịch dựa trên đăng ký và tình hình làm việc (chuyên cần, điểm, nhu cầu từng ca).',
                'Lịch chốt hiện trong tab "Lịch làm" của app và "Lịch làm cá nhân" trên web; app gửi thông báo "Lịch ca làm đã được cập nhật".',
                'Đã có lịch mà cần thay đổi: dùng Chợ ca để nhờ làm hộ hoặc đổi ca (mục 12).',
              ],
            },
            {
              kind: 'shots',
              items: [{ file: 'app-lich-lam.webp', caption: 'Tab Lịch làm: lịch của tôi theo tuần, nút Đăng ký ca và Công việc' }],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Đăng ký ca là nguyện vọng, không phải lịch chốt. Điểm hiệu suất hiện ở trang đăng ký ca để người xếp lịch tham khảo, nhưng không quyết định thứ tự đăng ký và không giới hạn số ca.',
            },
          ],
        },
        {
          id: 'gio-ca',
          title: 'Các ca và khu phụ trách',
          blocks: [
            {
              kind: 'table',
              head: ['Ca', 'Giờ', 'Ghi chú'],
              rows: [
                ['Sáng', '08:30 – 12:30 (4 giờ)', 'Mở cửa'],
                ['Chiều', '12:30 – 18:00 (5,5 giờ)', 'Cao điểm 12:00–13:00 và 17:00–18:00; giao ca 12:30 và 18:00'],
                ['Tối', '18:00 – 22:30 (4,5 giờ)', 'Cao điểm 20:00–21:00; đóng cửa. Ở lại sau 22:30 để đóng cửa tính giờ theo chấm công'],
                ['Phụ', '15:00 – 18:00 hoặc 19:00 – 22:30', 'Cố định tối thứ Bảy và theo lịch công bố'],
              ],
            },
            {
              kind: 'table',
              head: ['Khu', 'Phạm vi', 'Việc chính'],
              rows: [
                ['A', 'Vỉa hè, cửa, kính bày, quầy thu ngân, kệ bán kèm (ca 2 người: cả tầng 1)', 'Đón khách, thu tiền, bán kèm, giữ cửa'],
                ['B', 'Phần trong tầng 1, cầu thang, WC tầng 1 (chỉ khi ca từ 3 người)', 'Tư vấn, châm hàng, giữ trật tự kệ'],
                ['C', 'Toàn bộ tầng 2', 'Tư vấn hàng giá cao, trực online, đóng đơn; không thu tiền'],
              ],
            },
            {
              kind: 'bullets',
              items: [
                'Khu của bạn và "Trưởng ca" ghi trên lịch ca.',
                'Luôn có ít nhất 1 người ở quầy và 1 người ở tầng 2. Người tầng 2 chỉ xuống hỗ trợ quầy khi có từ 3 khách chờ và tầng 2 không có khách. Để trống quầy hoặc tầng 2 bị trừ 3 điểm.',
                'Mỗi người làm tối đa 1 ca chính/ngày; làm 2 ca trong ngày vượt 8 giờ phải được quản lý duyệt trước trên app; tổng không quá 12 giờ/ngày. Mỗi tuần có ít nhất 1 ngày không xếp ca.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'dang-ky-ca-phan',
      title: '7. Đăng ký ca',
      sections: [
        {
          id: 'dang-ky-ca',
          title: 'Đăng ký ca cho tuần tới',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Tiện ích → "Đăng ký ca" (hoặc Lịch làm → "Đăng ký ca"). Màn "Đăng ký lịch tuần" hiện các ca của tuần kèm target từng ca.',
                'Bấm mũi tên để sang tuần cần đăng ký. Dòng trên cùng ghi "Hạn đăng ký" và thời gian còn lại.',
                'Chạm vào ca để đăng ký (chạm lại để bỏ). Ghi chú cho quản lý nếu cần (tối đa 200 ký tự).',
                'Bấm "Lưu thay đổi" trước hạn.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-dang-ky-ca.webp', caption: 'Tuần đang mở đăng ký: chạm vào ca muốn làm' },
                { file: 'app-dang-ky-ca-chot.webp', caption: 'Tuần đã chốt: các ô bị khoá, muốn đổi thì dùng Chợ ca' },
                { file: 'web-dang-ky-ca.webp', caption: 'Trên web: Cá nhân → Đăng ký ca → "Đăng ký lịch tuần"' },
              ],
            },
            {
              kind: 'p',
              text: 'Trên web: Cá nhân → "Đăng ký ca", bấm "Đăng ký lịch tuần", chọn ca rồi lưu. Lịch bên dưới cho thấy ai đã đăng ký ca nào.',
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Sau hạn, tuần bị chốt đăng ký và mọi ô bị khoá. Muốn thay đổi thì dùng Chợ ca: nhờ làm hộ hoặc đổi ca (mục 12).',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'cham-cong-vao-phan',
      title: '8. Có ca thì chấm công vào',
      sections: [
        {
          id: 'khuon-mat',
          title: 'Đăng ký khuôn mặt (làm một lần, trước ca đầu tiên)',
          lead: 'Cửa hàng chấm công bằng khuôn mặt. Chưa có khuôn mặt được duyệt thì không chấm công được.',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Tài khoản → "Đăng ký khuôn mặt" (hoặc bấm "Đăng ký khuôn mặt để check-in" ở tab Điểm danh).',
                'Đưa khuôn mặt vào trong khung tròn, làm theo 5 bước "Nhìn thẳng", "Quay trái", "Quay phải", "Ngước lên", "Cúi xuống". App tự chụp.',
                'Gửi xong app báo "Đã gửi — chờ quản lý duyệt". Báo quản lý duyệt.',
                'Đã duyệt thì có thể bấm "Kiểm tra so khớp" để thử. Đổi kiểu tóc, kính… mà máy khó nhận thì bấm "Đăng ký lại".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-khuon-mat.webp', caption: 'Đăng ký khuôn mặt: đưa mặt vào khung tròn' },
                { file: 'web-khuon-mat.webp', caption: 'Trên web: Cá nhân → Đăng ký khuôn mặt' },
              ],
            },
            {
              kind: 'bullets',
              items: [
                'Chụp nơi đủ sáng, chỉ một người trước camera, không đeo khẩu trang.',
                'Trên web: Cá nhân → "Đăng ký khuôn mặt", dùng camera của máy.',
              ],
            },
          ],
        },
        {
          id: 'cham-cong-vao',
          title: 'Chấm công vào ca',
          lead: 'Chấm công tại cửa hàng. App kiểm tra vị trí của bạn có ở trong khu vực cửa hàng không.',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Tới cửa hàng, bật Định vị (GPS) của điện thoại.',
                'Bấm nút giữa "Điểm danh". Trước giờ mở, app hiện "CHƯA ĐẾN GIỜ CHECK-IN" và giờ mở check-in (15 phút trước giờ vào ca).',
                'Tới giờ, trạng thái chuyển sang "SẴN SÀNG LÀM VIỆC", dòng "GPS sẵn sàng" màu xanh.',
                'Bấm nút check-in, giữ mặt trước camera, nhìn thẳng; app tự nhận ra rồi ghi giờ vào.',
                'Xong, màn hình chuyển sang "ĐANG LÀM VIỆC" và hiện giờ vào, "Đúng giờ" hoặc "Trễ … phút".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-cham-cong-chua-gio.webp', caption: 'Chưa đến giờ: app ghi giờ mở check-in' },
                { file: 'app-cham-cong-san-sang.webp', caption: 'Sẵn sàng làm việc. Ví dụ này chưa đăng ký khuôn mặt nên nút là "Đăng ký khuôn mặt để check-in"' },
                { file: 'web-cham-cong.webp', caption: 'Trên web: phải cho phép vị trí trong trình duyệt' },
              ],
            },
            {
              kind: 'steps',
              title: 'Trên web',
              items: [
                'Cá nhân → "Điểm danh vào/ra".',
                'Trình duyệt hỏi vị trí thì bấm Cho phép. Thấy dòng "Trình duyệt chưa cho phép vị trí" thì bật quyền vị trí cho trang rồi tải lại.',
                'Bấm "Quét khuôn mặt & Check-in" và nhìn vào camera.',
              ],
            },
            {
              kind: 'table',
              title: 'App báo gì thì làm gì',
              head: ['App báo', 'Cách xử lý'],
              rows: [
                ['"Chưa đến giờ" / "Check-in mở lúc …"', 'Chờ tới giờ mở.'],
                ['"Chưa cho phép truy cập vị trí"', 'Bấm "Cho phép", hoặc vào Cài đặt của máy cấp quyền Vị trí cho app.'],
                ['"Định vị (GPS) của máy đang tắt"', 'Bấm "Mở cài đặt" và bật Định vị.'],
                ['"Ngoài khu vực cửa hàng"', 'Vào hẳn trong cửa hàng rồi thử lại. Không chấm được cả vào lẫn ra khi ở ngoài vùng.'],
                ['"Không lấy được GPS sau 5 giây — vẫn chấm công…"', 'Đã chấm công nhưng không có vị trí. Lần sau đứng gần cửa ra vào hoặc bật Wi-Fi để định vị nhanh hơn.'],
                ['"Đăng ký khuôn mặt để check-in"', 'Chưa có khuôn mặt được duyệt: đăng ký và báo quản lý duyệt.'],
                ['App tự mở trang văn bản', 'Còn văn bản chưa xác nhận: đọc, bấm "Tôi đã đọc và hiểu" rồi chấm lại.'],
              ],
            },
            {
              kind: 'note',
              tone: 'warning',
              text: 'Chấm công hộ người khác hoặc gian lận giờ làm là vi phạm Nghiêm trọng: 15 điểm cho cả hai người. App ghi vị trí lúc chấm và chống vị trí giả lập.',
            },
            {
              kind: 'bullets',
              title: '"Check-in ngoài giờ"',
              items: [
                'Dùng khi bạn đang ở cửa hàng làm việc nhưng không có ca phù hợp lúc đó (ví dụ quản lý gọi vào hỗ trợ).',
                'Lần chấm này chỉ ghi lại giờ để quản lý đối chiếu, không tự tính vào lương; báo quản lý để được ghi nhận.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'cham-cong-ra-phan',
      title: '9. Chấm công ra khi hết giờ',
      sections: [
        {
          id: 'cham-cong-ra',
          title: 'Kết thúc ca',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Đánh dấu xong các việc trong ca (mục 10). Trưởng ca chốt tiền quầy (mục 11).',
                'Bàn giao việc dở dang (đơn giữ hàng, khách hẹn đổi trả, hàng cần châm) cho ca sau.',
                'Đăng xuất tài khoản trên thiết bị dùng chung.',
                'App: mở "Điểm danh" → check-out → xác nhận "Bạn có muốn check-out không?". Web: Cá nhân → "Điểm danh vào/ra" → check-out.',
              ],
            },
            {
              kind: 'note',
              tone: 'warning',
              text: 'Quên chấm công vào hoặc ra bị trừ 3 điểm (30.000đ). Lỡ quên thì báo quản lý ngay trong ngày để tạo yêu cầu điều chỉnh. Về sớm khi chưa được duyệt bị trừ 3 điểm; đi muộn hoặc về sớm thì không được trả lương cho thời gian không làm.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'cong-viec',
      title: '10. Công việc trong ca',
      sections: [
        {
          id: 'viec-trong-ca',
          title: 'Việc của tôi',
          lead: 'Làm xong việc nào thì đánh dấu ngay việc đó; việc cần ảnh thì chụp ảnh nghiệm thu.',
          blocks: [
            {
              kind: 'steps',
              title: 'Trên app',
              items: [
                'Tiện ích → "Công việc" (hoặc Lịch làm → "Công việc", hoặc thẻ "Việc trong ca hôm nay" trên Trang chủ).',
                'Làm xong việc nào bấm "Đã làm" hoặc "Chọn ảnh & hoàn thành". Mục ghi "Chụp ảnh (bắt buộc)" thì chụp bằng camera (tối đa 5 ảnh), có thể ghi chú.',
                'Việc giao riêng: bấm "Nộp", kèm ảnh nếu cần. Bị "Trả lại" thì làm lại và "Nộp lại".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-viec-cua-toi.webp', caption: 'Việc của tôi: việc trong ca theo ngày và việc giao riêng' },
                { file: 'app-viec-da-lam.webp', caption: 'Bấm "Đã làm": ghi chú, chụp ảnh nghiệm thu' },
              ],
            },
            {
              kind: 'table',
              head: ['Mục', 'Cách làm'],
              rows: [
                ['Việc trong ca', 'Việc cố định của ca (vệ sinh, mở cửa, giao ca, đóng cửa…). Làm xong bấm "Đã làm"; trưởng ca chấm "Đạt" / "Không đạt".'],
                ['Lỗi cần sửa', 'Lỗi phát hiện khi kiểm tra ca. Sửa xong bấm "Ghi nhận đã sửa", chụp ảnh sau khi sửa nếu mục yêu cầu. Mục loại B sửa trong 15 phút, mục loại T sửa trong ca.'],
                ['Việc giao riêng cho tôi', 'Việc quản lý giao kèm hạn. Bấm "Nộp", chụp ảnh nghiệm thu nếu cần.'],
                ['Sửa tận gốc', 'Việc khắc phục lâu dài sau lỗi lặp lại. Làm xong bấm "Xong" → "Ghi nhận xong".'],
              ],
            },
            {
              kind: 'p',
              text: 'Trên web: Công việc → "Việc của tôi".',
            },
            {
              kind: 'note',
              tone: 'warning',
              text: 'Việc quá hạn: app bắt ghi "Lý do trễ hạn". Không ghi lý do bị trừ 2 điểm. Việc không làm được thì ghi lý do trên app và báo trưởng ca hoặc quản lý trước khi hết ca. Ảnh chỉ dùng nội bộ; không chụp mặt khách, không chụp thay đồ và WC khi có người.',
            },
          ],
        },
        {
          id: 'kiem-tra-ca',
          title: 'Kiểm tra ca và kiểm hàng ca',
          blocks: [
            {
              kind: 'bullets',
              items: [
                'Tiện ích → "Kiểm tra ca": mục "Lỗi của tôi" và kết quả kiểm nhanh của trưởng ca trong ngày.',
                'Phiếu "Kiểm hàng ca" tự tạo khi ca bắt đầu: Tiện ích → Nhân sự → "Kiểm hàng ca", đếm số thật trên kệ (không cần nhìn số trên máy), nhập "Số đếm", bấm "Lưu số đếm" rồi "Nộp phiếu" trước hạn. Mã hỏng tag, sai giá… ghi vào "Ghi chú cho quản lý".',
                'Trên web: Công việc → "Kiểm hàng ca".',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-kiem-tra-ca.webp', caption: 'Kiểm tra ca: Lỗi của tôi và ca đang kiểm' },
                { file: 'app-nhan-su.webp', caption: 'Tiện ích → Nhân sự: Kiểm hàng ca, Biên bản, Vi phạm…' },
                { file: 'app-kiem-hang-ca.webp', caption: 'Kiểm hàng ca: phiếu tự tạo khi ca bắt đầu' },
              ],
            },
          ],
        },
        {
          id: 'truong-ca',
          title: 'Việc của trưởng ca',
          lead: 'Trưởng ca chịu trách nhiệm mở ca, giao ca, đóng cửa và đối soát tiền của ca; mọi mốc có tiền hoặc hàng đều xác nhận trên app.',
          blocks: [
            {
              kind: 'bullets',
              items: [
                '"Kiểm nhanh ca này": Trang chủ hiện thẻ này từ 30 phút trước giờ vào ca. Đi từng mục, chấm "Đạt" / "Không đạt" / "NA"; mục "Không đạt" phải chụp ảnh lỗi. Bấm "Nộp" — sau khi nộp chỉ quản lý sửa được.',
                'Chấm "Việc trong ca" của nhân viên trong ca sau mỗi đợt dọn.',
                'Kiểm quầy (mục 11): mở quầy, ghi thu chi, chốt tiền cuối ca.',
                'Trước khi hết ca: báo việc đã xong và chưa xong kèm lý do, kết quả bàn giao tiền và hàng, tin nhắn và đơn còn dở, hàng hết hoặc sắp hết, sự cố. Trưởng ca không gửi báo cáo ca bị trừ 2 điểm.',
                'Chỉ trưởng ca mở két, trừ khi quản lý phân công người khác trên app.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'kiem-quay-phan',
      title: '11. Kiểm quầy',
      sections: [
        {
          id: 'kiem-quay',
          title: 'Kiểm tiền quầy',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Mở: app → Tiện ích → "Kiểm quầy"; web → menu "Kiểm tiền ca". Trên máy quầy, đăng nhập xong là vào thẳng màn này.',
                'Đầu ca: người nhận ca đếm quỹ tiền mặt trong 15 phút đầu ca, xác nhận trên app. Thiếu so với ca trước thì báo quản lý ngay; quá 15 phút không báo thì coi như đã nhận đủ.',
                '"Thu chi quầy": mỗi khoản thu hoặc chi tiền mặt tại quầy bấm "Thêm thu" / "Thêm chi", ghi số tiền và nội dung.',
                '"Chốt tiền" khi giao ca và cuối ngày: nhập số tờ từng mệnh giá (1.000đ đến 500.000đ), có thể lưu tạm; đếm xong bấm chốt. App hiện tổng tiền mặt, tồn cuối dự kiến và chênh lệch.',
                'Ca Tối chụp ảnh quỹ tiền mặt gửi quản lý trước khi khoá két.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-kiem-quay.webp', caption: 'Kiểm tiền quầy: Tổng hợp, chênh lệch, tiền mặt trong quầy' },
                { file: 'app-kiem-quay-2.webp', caption: 'Kéo xuống: tổng tiền mặt, Thu chi quầy (Thêm thu / Thêm chi)' },
                { file: 'web-kiem-quay.webp', caption: 'Trên web: bảng mệnh giá và nút "Chốt tiền"' },
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Trên điện thoại, Kiểm quầy chỉ dùng được khi hôm nay bạn có ca và đang ở trong vùng cửa hàng (GPS đủ chính xác, không dùng vị trí giả lập). Trên máy quầy của cửa hàng không cần kiểm vị trí.',
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Thiếu tiền mặt dưới 20.000đ: ghi nhận. Từ 20.000đ: lập biên bản và đối chiếu hoá đơn, camera trong 48 giờ. Thừa tiền: ghi nhận, nộp vào quỹ, không bồi thường, không thưởng.',
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'doi-ca-phan',
      title: '12. Nhờ đổi ca, làm hộ',
      sections: [
        {
          id: 'cho-ca',
          title: 'Chợ ca: làm hộ và đổi ca',
          lead: 'Đổi ca hoặc nhờ làm hộ phải tạo trên app và được duyệt trước giờ bắt đầu ca. Tự đổi, tự nhờ làm hộ ngoài app bị trừ 5 điểm cho cả hai người.',
          blocks: [
            {
              kind: 'steps',
              title: 'Người cần nhờ',
              items: [
                'Lịch làm → bấm vào ca của mình → hộp "Đăng ca lên chợ" → chọn "Làm hộ cả ca", "Làm hộ một phần" hoặc "Đổi ca".',
                'Làm hộ một phần: chọn "Đầu ca (tôi đến trễ)", "Cuối ca (tôi về sớm)" hoặc "Giữa ca (rời rồi quay lại)" và giờ ước tính.',
                'Bấm "Đăng lên chợ". Khi có người nhận, mở bài đăng của mình bấm "Xác nhận" (hoặc "Từ chối"); chờ quản lý duyệt.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-dang-ca-len-cho.webp', caption: 'Đăng ca lên chợ: Làm hộ cả ca, Làm hộ một phần hoặc Đổi ca' },
                { file: 'app-lam-ho-mot-phan.webp', caption: 'Làm hộ một phần: chọn phần cần người làm hộ' },
                { file: 'app-nhan-ca.webp', caption: 'Tiện ích → Nhận ca: Chợ ca, Hỗ trợ, Tôi đăng, Tôi nhận' },
              ],
            },
            {
              kind: 'steps',
              title: 'Người nhận',
              items: [
                'Tiện ích → "Nhận ca", tab "Chợ ca" → "Nhận ca". Bài đổi ca thì vào Lịch làm, bật lớp "Chợ ca", bấm bài và chọn ca của mình để đổi lại.',
                'Tab "Hỗ trợ": ca hỗ trợ quản lý đăng, bấm "Nhận ca hỗ trợ"; quản lý duyệt xong ca vào lịch của bạn.',
                'Nhận làm hộ giữa ca: tới giờ, vào tab "Tôi nhận" → "Check-in làm hộ" để bắt đầu và kết thúc phần làm hộ.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-doi-ca.webp', caption: 'Tiện ích → Đổi ca: theo dõi yêu cầu đổi ca' },
                { file: 'web-cho-ca.webp', caption: 'Trên web: Đổi ca & Làm hộ → Chợ ca, bấm vào ca để nhận' },
              ],
            },
            {
              kind: 'bullets',
              items: [
                'Tiện ích → "Đổi ca" (tab "Của tôi" / "Chờ xác nhận"): "Chờ đồng nghiệp xác nhận", "Chờ quản lý duyệt", "Đã duyệt", "Bị từ chối". Khi được nhờ, bấm "Đồng ý đổi" hoặc "Từ chối".',
                'Trên web: menu "Đổi ca & Làm hộ" → "Chợ ca" (bấm vào ca để nhận).',
                'Người làm hộ hưởng lương giờ của chính mình; giờ làm hộ tính vào giới hạn giờ làm trong ngày.',
                'Không đi làm được ca đã nhận: báo quản lý trên app càng sớm càng tốt và đăng ca lên chợ tìm người làm hộ.',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'luong-thuong',
      title: '13. Lương, điểm trừ, khiếu nại',
      sections: [
        {
          id: 'thu-nhap',
          title: 'Thu nhập gồm những gì',
          blocks: [
            {
              kind: 'table',
              head: ['Khoản', 'Cách tính'],
              rows: [
                ['Lương sàn', '25.500đ × giờ làm thực tế (giờ vào đến giờ ra trên hệ thống chấm công)'],
                ['Thưởng chuyên cần', '100.000đ/tháng khi cả tháng không có điểm trừ nào; người thử việc không có'],
                ['Thưởng doanh số tuần', 'Theo doanh thu cả cửa hàng trong tuần (Thứ Hai – Chủ nhật): 10% phần vượt target trong khoảng 100–110%, 20% phần vượt trên 110%; quỹ chia cho mọi người làm trong tuần theo tỷ lệ giờ làm'],
                ['Thưởng hoàn thành quý', 'Quý IV/2026 (xét 01/11–31/12): nhân viên làm từ 6 tháng 400.000đ, quản lý cửa hàng 800.000đ; cần làm từ 80 giờ trong quý, không tháng nào có từ 10 điểm trừ, không vi phạm Nghiêm trọng, không bỏ ca không báo'],
                ['Hoa hồng đơn online', '3% đơn chốt qua inbox, đã giao thành công và hết hạn đổi trả — chưa áp dụng trong giai đoạn chạy thử'],
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Doanh số thấp không bị phạt. Thưởng tuần tính theo kết quả chung của cả cửa hàng, không tính riêng từng ca. Target tuần và target từng ca hiện trên app; bạn xem được target ca trước khi đăng ký.',
            },
          ],
        },
        {
          id: 'ky-luong',
          title: 'Kỳ trả lương và xem phiếu lương',
          blocks: [
            {
              kind: 'table',
              head: ['Kỳ', 'Ngày làm', 'Trả chậm nhất', 'Gồm'],
              rows: [
                ['Kỳ 1', 'Ngày 1 – 15', 'Ngày 20 cùng tháng', 'Lương sàn; trừ tiền phạt, bồi thường phát sinh ngày 1 – 15'],
                ['Kỳ 2', 'Ngày 16 – cuối tháng', 'Ngày 5 tháng sau', 'Lương sàn + thưởng doanh số các tuần của tháng + thưởng chuyên cần (+ thưởng quý ở tháng cuối quý); trừ tiền phạt, bồi thường phát sinh ngày 16 – cuối tháng'],
              ],
            },
            {
              kind: 'steps',
              title: 'Xem phiếu lương',
              items: [
                'App: tab "Lương" → chọn kỳ. Badge "Tạm tính" là đang tính, "Đã duyệt" là đã chốt. Web: Cá nhân → "Bảng lương cá nhân".',
                'Xem "Tổng quan công" (ca, giờ làm, đi muộn, quên chấm công), "Chi tiết khoản", dòng "Tiền phạt" (bấm để xem từng khoản) và "Chi tiết ca làm".',
                'Trang chủ có "Lương tạm tính" của kỳ đang chạy; Nhân sự → "Điểm, lương & thưởng" có lương tạm tính, thưởng doanh số tuần và điểm các tháng.',
              ],
            },
            {
              kind: 'shots',
              items: [
                { file: 'app-luong.webp', caption: 'Tab Lương: phiếu lương hiện khi kỳ lương được tạo' },
                { file: 'app-diem-luong-thuong.webp', caption: 'Nhân sự → Điểm, lương & thưởng: điểm trừ, lương tạm tính, thưởng tuần' },
              ],
            },
          ],
        },
        {
          id: 'diem-tru',
          title: 'Điểm trừ và tiền phạt',
          lead: 'Mỗi điểm trừ bị phạt 10.000đ, trừ thẳng vào lương của kỳ có vi phạm, áp dụng cả người thử việc, từ ngày 01/11/2026.',
          blocks: [
            {
              kind: 'steps',
              title: 'Xem điểm trừ',
              items: [
                'App: Trang chủ → thẻ "Điểm trừ tháng", hoặc Nhân sự → "Vi phạm & điểm trừ". Web: Nhân sự → "Vi phạm & điểm trừ".',
                'Mỗi lần vi phạm có "Căn cứ" (chấm công, lịch ca, bảng kiểm, biên bản, camera…), số điểm và tiền phạt. Không có căn cứ thì không trừ điểm.',
              ],
            },
            {
              kind: 'shots',
              items: [{ file: 'app-vi-pham.webp', caption: 'Vi phạm & điểm trừ: điểm trừ tháng, mức thưởng tuần, tiền phạt' }],
            },
            {
              kind: 'table',
              title: 'Bảng điểm trừ (Nội quy Điều 26, Quy chế Phụ lục E)',
              head: ['Nhóm', 'Hành vi', 'Điểm', 'Phạt'],
              rows: [
                ['Giờ giấc', 'Đi muộn trên 5 đến 15 phút', '2', '20.000đ'],
                ['Giờ giấc', 'Đi muộn trên 15 phút', '4', '40.000đ'],
                ['Giờ giấc', 'Đi muộn trên 30 phút mà không báo trước trên app', '6', '60.000đ'],
                ['Giờ giấc', 'Về sớm khi chưa được duyệt', '3', '30.000đ'],
                ['Giờ giấc', 'Quên chấm công vào hoặc ra', '3', '30.000đ'],
                ['Ca làm', 'Tự đổi ca, nhờ làm hộ không qua app (mỗi người)', '5', '50.000đ'],
                ['Ca làm', 'Nghỉ ca đã nhận, báo trước dưới 24 giờ, không có lý do chính đáng', '8', '80.000đ'],
                ['Ca làm', 'Bỏ ca không báo', '15', '150.000đ'],
                ['Công việc', 'Trưởng ca không gửi báo cáo ca', '2', '20.000đ'],
                ['Công việc', 'Việc được giao trễ hạn mà không ghi lý do', '2', '20.000đ'],
                ['Công việc', 'Việc bị trả lại lần 2 vẫn không đạt', '2', '20.000đ'],
                ['Công việc', 'Không làm đủ việc mở cửa, giao ca, đóng cửa', '2', '20.000đ'],
                ['Công việc', 'Khu phụ trách không đạt một mục Bảng kiểm tra (mỗi mục)', '2', '20.000đ'],
                ['Tác phong', 'Dùng điện thoại riêng cho việc riêng khi có khách', '2', '20.000đ'],
                ['Tác phong', 'Để trống quầy thu ngân hoặc tầng 2', '3', '30.000đ'],
                ['Tác phong', 'Khách phản ánh thái độ, đã xác minh', '5', '50.000đ'],
                ['Bán hàng', 'Bán sai giá; giảm giá, huỷ hoá đơn, đổi trả sai quy trình', '5', '50.000đ'],
                ['Bán hàng', 'Bán hàng không quét mã, không ra hoá đơn', '10', '100.000đ'],
                ['Tiền, hàng', 'Chênh lệch tiền hoặc hàng từ 20.000đ, có biên bản xác định lỗi', '5', '50.000đ'],
                ['Nghiêm trọng', 'Nhận chuyển khoản vào tài khoản cá nhân; dùng hoặc cho mượn tài khoản S Store; giao hàng khi chưa xác nhận tiền; mang hàng ra khi chưa có hoá đơn', '15', '150.000đ'],
                ['Nghiêm trọng', 'Chấm công hộ, gian lận giờ làm (mỗi người)', '15', '150.000đ'],
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Nhóm Trực page (để hội thoại chờ quá 2 giờ: 1 điểm/hội thoại; tỷ lệ phản hồi đúng hạn của ca dưới 70%: 3 điểm/người) chỉ áp dụng từ khi cửa hàng thông báo giao nhiệm vụ trực page trên app.',
            },
            {
              kind: 'table',
              title: 'Tổng điểm trừ trong tháng và thưởng',
              head: ['Tổng điểm trừ trong tháng', 'Thưởng doanh số tuần của tháng', 'Khác'],
              rows: [
                ['0', 'Nhận 100%', 'Nhận thêm thưởng chuyên cần 100.000đ (nhân viên chính thức)'],
                ['1 – 5', 'Nhận 100%', 'Nhắc nhở trên app; không có thưởng chuyên cần'],
                ['6 – 9', 'Nhận 50%', '—'],
                ['10 – 14', 'Không nhận', 'Xếp loại cao nhất là Hoàn thành; mất điều kiện thưởng quý'],
                ['Từ 15', 'Không nhận', 'Xếp loại Không hoàn thành; lập biên bản cảnh báo'],
              ],
            },
          ],
        },
        {
          id: 'khieu-nai',
          title: 'Khiếu nại điểm trừ và phiếu lương',
          blocks: [
            {
              kind: 'steps',
              title: 'Khiếu nại điểm trừ',
              items: [
                'Mở lần vi phạm trong "Vi phạm & điểm trừ", bấm "Khiếu nại (hạn dd/MM)".',
                'Ghi "Lý do khiếu nại" → "Gửi khiếu nại". Hạn là 3 ngày làm việc.',
                'Lần vi phạm được xoá sau khiếu nại thì tiền phạt được hoàn ở kỳ lương kế tiếp.',
              ],
            },
            {
              kind: 'steps',
              title: 'Khiếu nại phiếu lương',
              items: [
                'Mở phiếu lương → "Khiếu nại phiếu lương".',
                'Ghi rõ "Nội dung khiếu nại" (sai ca nào, khoản nào) → "Gửi khiếu nại".',
                'Theo dõi trạng thái: "Chờ trả lời", "Có sai sót", "Phiếu đúng". Khiếu nại đang chờ có thể "Rút".',
              ],
            },
            {
              kind: 'note',
              tone: 'info',
              text: 'Hạn khiếu nại phiếu lương: 3 ngày làm việc kể từ ngày nhận phiếu (app ghi rõ "đến hết ngày dd/MM"). Cửa hàng trả lời trong 3 ngày làm việc. Quá hạn thì trao đổi trực tiếp với quản lý.',
            },
          ],
        },
        {
          id: 'danh-gia',
          title: 'Điểm hiệu suất và xếp loại',
          blocks: [
            {
              kind: 'bullets',
              items: [
                'Điểm hiệu suất tháng (thang 100): doanh số tại cửa hàng 40, chất lượng bán 15, nhiệm vụ online và vận hành 20, kỷ luật và tuân thủ 15, đối soát ca 10, cộng sáng kiến tối đa 5.',
                'Doanh số được so theo tỷ lệ đạt target của chính các ca bạn làm, nên ca vắng và ca đông được so công bằng.',
                'Chất lượng bán tính theo giá trị đơn trung bình, số món/đơn và tỷ lệ đơn có số điện thoại khách.',
                'Xếp loại theo tháng, chỉ xét khi làm từ 10 ca trong tháng: Hoàn thành xuất sắc (từ 110% target), Hoàn thành tốt (90–110%), Hoàn thành (70–90%), Không hoàn thành (dưới 70%, hoặc từ 15 điểm trừ, hoặc 3 lần chênh lệch tiền/hàng do lỗi cá nhân).',
                'Kết quả gửi chậm nhất ngày 5 tháng sau. Thấy chưa đúng: Nhân sự → "Điểm, lương & thưởng" → "Đề nghị xem xét lại (hạn dd/MM)", trong 3 ngày làm việc.',
                'Phiếu đề xuất chương trình, sự kiện đủ nội dung được cộng 1 điểm (tối đa 2 điểm/tháng); được chọn triển khai cộng thêm 3 điểm.',
              ],
            },
          ],
        },
        {
          id: 'bien-ban',
          title: 'Biên bản, bồi thường, hợp đồng',
          blocks: [
            {
              kind: 'bullets',
              items: [
                'Biên bản (chênh lệch tiền hàng, vi phạm): Nhân sự → "Biên bản". Bấm "Ký xác nhận" (có thể ghi ý kiến) hoặc "Không ký" và ghi lý do. Khiếu nại biên bản trong 3 ngày làm việc kể từ ngày ký.',
                'Bồi thường chỉ khi có thiệt hại thật và biên bản xác định lỗi: không tuân thủ quy trình bồi thường 100% theo giá nhập (tiền mặt theo số thiếu); sơ suất khi đã làm đúng quy trình 50% theo giá nhập; không xác định được lỗi hoặc lý do khách quan thì không bồi thường. Khoản bồi thường khấu trừ một lần vào lương kỳ phát sinh.',
                'Hàng giá trị cao là hàng giá bán từ 200.000đ và các mặt hàng trong danh sách trên app (trang sức, gấu bông lớn, đồ điện, nước hoa).',
                'Hợp đồng: Nhân sự → "Hợp đồng của tôi" → đọc, ký vào ô "Ký tên vào đây", tích ô cam kết → "Ký hợp đồng".',
              ],
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'them',
      title: '14. Thêm: bán hàng, thông báo, quy định khác',
      sections: [
        {
          id: 'sau-buoc',
          title: 'Sáu bước bán hàng',
          lead: 'Bán kèm, xin số điện thoại và lập hoá đơn đúng quy trình là căn cứ chấm điểm chất lượng bán.',
          blocks: [
            {
              kind: 'steps',
              items: [
                'Chào khách trong vòng 5 giây khi khách vào cửa, giới thiệu chương trình đang chạy trong một câu.',
                'Tư vấn: hỏi nhu cầu (dùng hay làm quà, cho ai, ngân sách), gợi ý 2–3 lựa chọn, không ép mua.',
                'Bán kèm: gợi ý ít nhất một món trước khi tính tiền (thiệp, túi quà, chun, kẹp cùng bộ, combo).',
                'Xin số điện thoại để tích điểm; chỉ ghi khi khách đồng ý, không tự nhập số không đúng.',
                'Thanh toán: lập hoá đơn bằng KiotViet, đọc lại tổng tiền, kiểm tiền nhận hoặc xác nhận chuyển khoản đã vào tài khoản cửa hàng rồi mới giao hàng.',
                'Gói hàng, tiễn khách, mời khách quay lại và nhắc chương trình tích điểm.',
              ],
            },
          ],
        },
        {
          id: 'chuyen-khoan',
          title: 'Chuyển khoản, giảm giá, đổi trả',
          blocks: [
            {
              kind: 'bullets',
              items: [
                'Chỉ giao hàng khi đã thấy tiền vào tài khoản cửa hàng (app ngân hàng hoặc thông báo của hệ thống). Ảnh chụp màn hình của khách không đủ.',
                'Chỉ dùng mã QR do cửa hàng cung cấp; không nhận chuyển khoản vào tài khoản cá nhân dưới bất kỳ lý do nào.',
                'Chỉ giảm giá theo chương trình đã cài trên hệ thống. Giảm ngoài chương trình, sửa giá, huỷ hoá đơn đã thanh toán phải có quản lý duyệt.',
                'Đổi hàng trong 3 ngày kể từ ngày mua, còn nguyên tem, hoá đơn, chưa sử dụng; không áp dụng với trang sức xỏ tai, đồ lót, hàng giảm giá cuối mùa. Lập phiếu trả hàng trên hệ thống; hoàn tiền phải có quản lý duyệt.',
                'Nhân viên mua hàng thanh toán như khách, do một nhân viên khác lập hoá đơn.',
              ],
            },
          ],
        },
        {
          id: 'thong-bao',
          title: 'Thông báo, trợ lý và tin nhắn',
          blocks: [
            {
              kind: 'shots',
              items: [{ file: 'app-thong-bao.webp', caption: 'Thông báo: lịch ca cập nhật, văn bản cần xác nhận, target tuần' }],
            },
            {
              kind: 'bullets',
              items: [
                'Biểu tượng chuông hiện số thông báo chưa đọc. Bấm một thông báo để mở thẳng màn liên quan (ca, việc, phiếu lương…). Bật thông báo trong Cài đặt của máy cho app để không lỡ lịch ca, việc giao, biên bản.',
                'Popup thông báo của cửa hàng có mức Thông tin / Lưu ý / Khẩn. Popup bắt buộc xác nhận thì đọc và bấm "Đã hiểu".',
                'Trợ lý AI (nếu tài khoản của bạn có): hỏi về dữ liệu của riêng bạn và về quy chế, ví dụ "Tuần này tôi làm ca nào?", "Tháng này tôi bị trừ mấy điểm, vì sao?". Trợ lý chỉ xem được dữ liệu của bạn; câu trả lời về quy chế có trích Điều, khi cần chắc chắn thì đối chiếu văn bản gốc.',
                'Tin nhắn nội bộ: gửi được ảnh và tệp (mỗi tệp tối đa 10 MB). Không gửi giá nhập, doanh thu, danh sách khách hàng ra ngoài.',
              ],
            },
          ],
        },
        {
          id: 'tac-phong',
          title: 'Tác phong, vệ sinh, an toàn',
          blocks: [
            {
              kind: 'bullets',
              title: 'Tác phong và trật tự',
              items: [
                'Trang phục gọn gàng, đeo bảng tên hoặc đồng phục nếu cửa hàng cấp; lịch sự với khách và đồng nghiệp, có mâu thuẫn thì chuyển quản lý.',
                'Không dùng điện thoại cá nhân cho việc riêng khi có khách; được dùng khi vắng, ở khu vực quầy, không quay lưng với khách.',
                'Ăn uống phía sau quầy, mỗi lần không quá 15 phút, luân phiên để quầy luôn có người.',
                'Không đưa người thân, bạn bè vào quầy thu ngân và kho.',
                'Tiền mặt chỉ để trong ngăn kéo quầy hoặc két; không giữ tiền cửa hàng trong người; không đổi tiền, cho vay, tạm ứng từ quỹ khi chưa có duyệt của chủ hộ.',
                'Không mang hàng ra khỏi cửa hàng khi chưa có hoá đơn. Hàng hỏng, lỗi lập phiếu huỷ hoặc phiếu dùng nội bộ trên hệ thống.',
                'Thấy khách lấy hàng không thanh toán: lịch sự đề nghị khách kiểm tra lại và báo quản lý ngay; không tự khám người, không giữ khách.',
              ],
            },
            {
              kind: 'table',
              title: 'Vệ sinh theo ca',
              head: ['Ca', 'Thời điểm', 'Khu A (tầng 1)', 'Khu C (tầng 2)'],
              rows: [
                ['Sáng', '08:30–10:00', 'Quét, lau sàn tầng 1 và bậc cửa; quét vỉa hè; dọn WC tầng 1', 'Quét, lau sàn tầng 2 và cầu thang; dọn WC tầng 2; lau bàn phòng làm việc'],
                ['Chiều', '15:00–16:30', 'Kiểm và dọn lại WC tầng 1; lau lối vào khi bẩn hoặc trời mưa; đổ rác khi đầy', 'Kiểm và dọn lại WC tầng 2; dọn bàn đóng gói sau khi đóng đơn online'],
                ['Tối', '22:00–22:30', 'Quét sàn tầng 1; dọn WC tầng 1; đổ rác tầng 1', 'Quét sàn tầng 2 và cầu thang; dọn WC tầng 2; dọn phòng làm việc; đổ rác tầng 2'],
              ],
            },
            {
              kind: 'bullets',
              items: [
                'Dọn trong giờ ca, lúc vắng khách; không dọn trong khung cao điểm trừ việc cần xử lý ngay. Người khu A chỉ rời quầy dọn WC khi tầng 1 không có khách, khoá ngăn kéo tiền trước khi rời. Đeo găng tay khi dọn WC và đổ rác. Không cần đến trước giờ ca để dọn.',
                'Không để hàng chắn lối thoát hiểm và cửa ra vào; tắt toàn bộ thiết bị điện khi đóng cửa; dùng thang hoặc ghế chắc chắn, không trèo lên kệ.',
                'Có cháy, chập điện: ngắt cầu dao tổng, đưa khách ra ngoài, gọi 114, báo chủ hộ. Không quay lại lấy tiền hoặc hàng. Bị tai nạn trong ca: sơ cứu, đưa đi cơ sở y tế, báo chủ hộ ngay.',
                'Cửa hàng không chấp nhận quấy rối tình dục từ bất kỳ ai. Bị quấy rối hoặc chứng kiến: báo trực tiếp chủ hộ; thông tin người báo được giữ bí mật và không bị trả đũa. Khách quấy rối: bạn được từ chối phục vụ và gọi quản lý.',
              ],
            },
          ],
        },
        {
          id: 'hoi-dap',
          title: 'Hỏi nhanh',
          blocks: [
            {
              kind: 'table',
              head: ['Tình huống', 'Làm gì'],
              rows: [
                ['Tới cửa hàng mà app báo "Ngoài khu vực cửa hàng"', 'Vào hẳn trong cửa hàng, bật Wi-Fi và GPS, chờ vài giây rồi thử lại. Vẫn không được thì báo trưởng ca hoặc quản lý ngay, trước giờ ca.'],
                ['Quên chấm công', 'Báo quản lý ngay trong ngày để tạo yêu cầu điều chỉnh.'],
                ['Sắp đến muộn', 'Báo trên app trước giờ ca (nhắn quản lý, hoặc đăng "Làm hộ một phần · Đầu ca"). Muộn trên 30 phút mà không báo trước bị 6 điểm.'],
                ['Ốm, không đi làm được', 'Báo quản lý trên app càng sớm càng tốt, đăng ca lên chợ tìm người làm hộ và giữ giấy của cơ sở y tế.'],
                ['Không thấy ca vừa đổi trong lịch', 'Kiểm tra trạng thái ở Tiện ích → "Đổi ca"; ca chỉ đổi khi quản lý đã duyệt.'],
                ['Phiếu lương hoặc điểm trừ có vẻ sai', 'Khiếu nại trên app trong 3 ngày làm việc (mục 13).'],
                ['Mất điện thoại hoặc lộ mật khẩu', 'Báo quản lý ngay; đăng nhập web và đăng xuất các thiết bị khác ở Tài khoản → "Thiết bị đang đăng nhập".'],
              ],
            },
          ],
        },
      ],
    },
  ],
};
