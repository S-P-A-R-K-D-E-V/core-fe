import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ----------------------------------------------------------------------
// Trang của tính năng theo gói: cửa hàng chưa bật thì báo chưa bật, không dựng trang (khỏi gọi API bị 403).
// ----------------------------------------------------------------------

vi.mock('src/assets/illustrations', () => ({ ForbiddenIllustration: () => null }));
let user: any = null;
vi.mock('../../hooks', () => ({ useAuthContext: () => ({ user }) }));

// Imported after the mocks above.
import FeatureGuard from '../feature-guard';

function renderGuard() {
  return render(
    <FeatureGuard feature="store.camera">
      <p>Nội dung camera</p>
    </FeatureGuard>
  );
}

describe('FeatureGuard', () => {
  it('renders the page when the store has the feature', () => {
    user = { enabledFeatures: ['workforce.attendance', 'store.camera'] };
    renderGuard();
    expect(screen.getByText('Nội dung camera')).toBeTruthy();
  });

  it('says the feature is not enabled for other stores', () => {
    user = { enabledFeatures: ['workforce.attendance'] };
    renderGuard();
    expect(screen.queryByText('Nội dung camera')).toBeNull();
    expect(screen.getByText('Tính năng chưa được bật')).toBeTruthy();
  });

  it('waits for the user features before deciding', () => {
    user = { role: 'Admin' };
    const { container } = renderGuard();
    expect(container.textContent).toBe('');
  });
});
