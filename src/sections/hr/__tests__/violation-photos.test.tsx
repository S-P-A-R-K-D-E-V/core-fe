import { render, screen } from '@testing-library/react';

import { ViolationPhotoThumbs } from '../violation-photos';

describe('Ảnh minh chứng vi phạm', () => {
  it('hiện ảnh còn hạn qua /media và đếm ảnh đã tự xoá', () => {
    render(
      <ViolationPhotoThumbs
        photos={[
          { id: '1', url: 'hr-violations/u/202611/a.jpg?exp=1&sig=x', source: 'Camera', expiresAt: '2027-02-14T03:00:00Z', deleted: false },
          { id: '2', url: null, source: 'Library', expiresAt: '2026-08-01T03:00:00Z', deleted: true },
        ]}
      />
    );

    const img = screen.getByAltText('Ảnh minh chứng') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('/media/hr-violations/u/202611/a.jpg?exp=1&sig=x');
    expect(screen.getByText('Ảnh đã tự xoá sau 90 ngày (1 ảnh)')).toBeInTheDocument();
  });

  it('không có ảnh thì không vẽ gì', () => {
    const { container } = render(<ViolationPhotoThumbs photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
