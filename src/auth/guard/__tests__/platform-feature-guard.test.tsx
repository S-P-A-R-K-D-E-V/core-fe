import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PLATFORM_FEATURES } from 'src/auth/platform-features';

// ----------------------------------------------------------------------
// Trang chấm công khi chủ cửa hàng tắt tự chấm công trên web với người này: báo dùng app thay vì hiện màn chấm công
// (API sẽ trả 403). Chưa nạp /users/me thì chờ.
// ----------------------------------------------------------------------

let mockUser: Record<string, any> | null = null;
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));
vi.mock('src/assets/illustrations', () => ({ ForbiddenIllustration: () => null }));

// Imported after the mocks above.
import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';

function renderWith(user: Record<string, any> | null) {
  mockUser = user;
  return render(
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.selfCheckIn} label="Chấm công">
      <p>màn chấm công</p>
    </PlatformFeatureGuard>
  );
}

describe('PlatformFeatureGuard', () => {
  it('chưa nạp /users/me → chưa hiện gì', () => {
    const { container } = renderWith({ roles: ['Staff'] });
    expect(container).toBeEmptyDOMElement();
  });

  it('bị tắt trên web → báo dùng app, không hiện màn chấm công', () => {
    renderWith({ roles: ['Staff'], enabledFeatures: [], blockedFeatures: [PLATFORM_FEATURES.selfCheckIn] });

    expect(screen.getByText('Chấm công trên web đã tắt')).toBeInTheDocument();
    expect(screen.queryByText('màn chấm công')).not.toBeInTheDocument();
  });

  it('không bị tắt → vào bình thường', () => {
    renderWith({ roles: ['Staff'], enabledFeatures: [], blockedFeatures: [] });
    expect(screen.getByText('màn chấm công')).toBeInTheDocument();
  });
});
