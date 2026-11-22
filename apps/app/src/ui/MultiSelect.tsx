// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { isComposing } from './composing';
import { cx } from './cx';
import { fieldBoxClass, fieldFocusWithinClass } from './Field';
import { Icon } from './Icon';
import { MenuEmpty, MenuGroup, MenuOption, MenuPanel, MenuSearch } from './listbox/MenuPanel';
import { filterOptions, firstEnabled, groupOptions, isPrintable, navigateIndex } from './listbox/options';
import { useFieldLabelId } from './listbox/useFieldLabelId';
import { usePopover } from './listbox/usePopover';
import { useTypeahead } from './listbox/useTypeahead';
import type { SelectOption } from './Select';

export interface MultiSelectProps<V extends string = string> {
  options: SelectOption<V>[];
  value: V[];
  onChange: (next: V[]) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  maxChips?: number;
  selectAll?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

export function MultiSelect<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  searchable = options.length > 8,
  searchPlaceholder,
  maxChips = 3,
  selectAll = true,
  id,
  name,
  disabled,
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
}: MultiSelectProps<V>) {
  const { t } = useTranslation('shell');
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(() => groupOptions(options).flatMap((g) => g.options), [options]);
  const groups = useMemo(() => groupOptions(filterOptions(ordered, query)), [ordered, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const selectedSet = useMemo(() => new Set<string>(value), [value]);
  const selectedOptions = ordered.filter((o) => selectedSet.has(o.value));
  const chips = selectedOptions.slice(0, maxChips);
  const overflow = selectedOptions.length - chips.length;
  const searchLabel = searchPlaceholder ?? t('search');

  const { pos, listMax } = usePopover(wrapperRef, popRef, open, [flat.length, selectedOptions.length], () =>
    setOpen(false),
  );
  const typeahead = useTypeahead(flat, setActive);
  const fieldLabelId = useFieldLabelId(triggerRef, open && !ariaLabelledBy && !ariaLabel, baseId);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    if (disabled) return;
    const sel = ordered.findIndex((o) => selectedSet.has(o.value) && !o.disabled);
    setQuery('');
    setActive(sel >= 0 ? sel : firstEnabled(ordered, 0, 1));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }

  function toggle(o: SelectOption<V> | undefined) {
    if (!o || o.disabled) return;
    onChange(selectedSet.has(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value]);
  }

  function remove(v: V) {
    onChange(value.filter((x) => x !== v));
  }

  function addAllFiltered() {
    const added = flat.filter((o) => !o.disabled && !selectedSet.has(o.value)).map((o) => o.value);
    if (added.length > 0) onChange([...value, ...added]);
  }

  function clearAll() {
    if (value.length > 0) onChange([]);
  }

  function onOpenKeyDown(e: KeyboardEvent) {
    const next = navigateIndex(e.key, flat, active);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
      return;
    }
    if (selectAll && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && (!searchable || query === '')) {
      e.preventDefault();
      addAllFiltered();
      return;
    }
    switch (e.key) {
      case 'Enter':
        if (isComposing(e)) return;
        e.preventDefault();
        toggle(flat[active]);
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case 'Tab':
        close(searchable);
        return;
      case ' ':
        if (searchable) return;
        e.preventDefault();
        toggle(flat[active]);
        return;
    }
    if (!searchable && isPrintable(e)) {
      e.preventDefault();
      typeahead(e.key, active);
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (open) {
      if (!searchable) onOpenKeyDown(e);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      if (e.key === 'Enter' && isComposing(e)) return;
      e.preventDefault();
      openList();
    } else if (e.key === 'Backspace') {
      const last = value[value.length - 1];
      if (last !== undefined) {
        e.preventDefault();
        remove(last);
      }
    } else if (!searchable && isPrintable(e)) {
      e.preventDefault();
      openList();
      typeahead(e.key, -1);
    }
  }

  const optionId = (v: string) => `${baseId}-opt-${v}`;
  const activeOption = flat[active];
  const activeId = activeOption ? optionId(activeOption.value) : undefined;
  let index = -1;

  return (
    <div className={cx('relative', className)}>
      <div
        ref={wrapperRef}
        data-disabled={disabled || undefined}
        data-invalid={ariaInvalid || undefined}
        onMouseDown={(e) => {
          if (disabled || e.target === triggerRef.current) return;
          e.preventDefault();
          triggerRef.current?.focus();
        }}
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else openList();
        }}
        className={cx(
          fieldBoxClass,
          fieldFocusWithinClass,
          'flex min-h-10 cursor-pointer flex-nowrap items-center gap-1 overflow-hidden py-1 pl-1.5 pr-2.5',
        )}
      >
        {chips.map((o) => (
          <span
            key={o.value}
            className="inline-flex h-7 min-w-0 max-w-[10rem] items-center gap-0.5 rounded-md bg-surface-3 pl-2 pr-0.5 text-[13px] font-medium text-ink"
          >
            <span className="truncate">{o.label}</span>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('multi.remove', { label: o.label })}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                remove(o.value);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-line hover:text-ink disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Icon name="close" size={12} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-surface-3 px-2 text-[13px] font-semibold text-ink-soft">
            {t('multi.more', { count: overflow })}
          </span>
        )}
        <button
          ref={triggerRef}
          id={baseId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && !searchable ? activeId : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-required={required || undefined}
          disabled={disabled}
          onKeyDown={onTriggerKeyDown}
          onKeyUp={(e) => {
            if (e.key === ' ') e.preventDefault();
          }}
          className="flex h-8 min-w-8 flex-1 items-center gap-2 bg-transparent pl-1.5 text-left focus:outline-none disabled:cursor-not-allowed"
        >
          <span className="min-w-0 flex-1 truncate text-ink-muted">
            {selectedOptions.length === 0 && (placeholder ?? t('select.placeholder'))}
          </span>
          <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
        </button>
      </div>
      {name !== undefined && value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      {open && (
        <MenuPanel
          ref={popRef}
          pos={pos}
          onMouseDown={(e) => {
            if (e.target !== searchRef.current) e.preventDefault();
          }}
        >
          {searchable && (
            <MenuSearch
              ref={searchRef}
              label={searchLabel}
              listId={listId}
              activeId={activeId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(firstEnabled(filterOptions(ordered, e.target.value), 0, 1));
              }}
              onKeyDown={onOpenKeyDown}
            />
          )}
          <div className="mb-1 flex items-center justify-between gap-3 border-b border-line px-2.5 pb-1.5 pt-0.5">
            <span className="text-[13px] text-ink-muted">
              {t('multi.count', { count: selectedOptions.length, total: options.length })}
            </span>
            <span className="flex items-center gap-3">
              {selectAll && (
                <Button variant="link" onClick={addAllFiltered}>
                  {t('multi.selectAll')}
                </Button>
              )}
              <Button variant="link" onClick={clearAll}>
                {t('multi.clear')}
              </Button>
            </span>
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : fieldLabelId)}
            style={{ maxHeight: listMax }}
            className="overflow-y-auto"
          >
            {flat.length === 0 && <MenuEmpty>{t('noMatches')}</MenuEmpty>}
            {groups.map((g) => {
              const rows = g.options.map((o) => {
                index += 1;
                const i = index;
                return (
                  <MenuOption
                    key={o.value}
                    id={optionId(o.value)}
                    multi
                    active={i === active}
                    selected={selectedSet.has(o.value)}
                    disabled={o.disabled}
                    onHover={() => setActive(i)}
                    onPick={() => toggle(o)}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 truncate">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-xs font-normal text-ink-muted">{o.hint}</span>}
                    </span>
                  </MenuOption>
                );
              });
              return g.name ? (
                <MenuGroup key={g.name} label={g.name}>
                  {rows}
                </MenuGroup>
              ) : (
                rows
              );
            })}
          </div>
        </MenuPanel>
      )}
    </div>
  );
}
