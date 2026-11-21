import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <span className={cx('relative block', className)}>
      <select
        ref={ref}
        className="h-10 w-full appearance-none rounded-lg border border-line-strong bg-white pl-3 pr-9 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50"
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
});
