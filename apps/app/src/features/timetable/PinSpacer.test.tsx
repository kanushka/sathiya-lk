// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PinSpacer } from './PinPanel';

describe('PinSpacer', () => {
  it('reserves room under the page for the phone pin bar while pinning', () => {
    const { container } = render(<PinSpacer active />);
    expect(container.firstElementChild).toHaveClass('h-[calc(9rem+env(safe-area-inset-bottom))]', 'md:hidden');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing when not pinning', () => {
    const { container } = render(<PinSpacer active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
