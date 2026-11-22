// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandPreview } from './BrandPreview';

describe('BrandPreview', () => {
  it('shows no placeholder badge without a logo', () => {
    render(<BrandPreview name="Royal College" nameSi="" primary="#0E6B6A" second="#D9A441" logoUrl={null} />);
    expect(screen.getByText('Royal College')).toBeInTheDocument();
    expect(screen.queryByTestId('school-logo')).toBeNull();
    expect(screen.getByTestId('brand-preview').querySelector('[aria-hidden="true"]')).toBeNull();
  });
  it('shows the logo when one is chosen', () => {
    render(<BrandPreview name="Royal College" nameSi="" primary="#0E6B6A" second="#D9A441" logoUrl="blob:logo" />);
    expect(screen.getByTestId('school-logo')).toHaveAttribute('src', 'blob:logo');
  });
});
