'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lookup } from '../lib/api';
import { Input } from './ui/input';

const visibleLimit = 10;

function languageKey(name: string) {
  return name.trim().normalize('NFC').toLowerCase();
}

export function findLanguage(languages: Lookup[], name: string) {
  const key = languageKey(name);
  return languages.find((language) => languageKey(language.name) === key ||
    (language.label && languageKey(language.label) === key));
}

function searchKey(name: string) {
  return languageKey(name).normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

type Props = {
  id: string;
  name?: string;
  languages: Lookup[];
  defaultValue?: string;
  value?: string;
  onChange?: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function LanguagePicker({ id, name, languages, defaultValue = '', value, onChange, placeholder, required, disabled }: Props) {
  const t = useTranslations('languagePicker');
  const [draft, setDraft] = useState(() => findLanguage(languages, defaultValue)?.label ?? defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = id + '-options';
  const text = value ?? draft;
  const selected = findLanguage(languages, text);
  const entries = useMemo(() => languages
    .map((language) => ({ language, key: searchKey(language.label ?? language.name), canonical: searchKey(language.name) }))
    .sort((a, b) => a.key.length - b.key.length), [languages]);
  const query = searchKey(text);
  const options = open
    ? [
      ...entries.filter((entry) => entry.key.startsWith(query)).slice(0, visibleLimit),
      ...entries.filter((entry) => (entry.key.includes(query) || entry.canonical.includes(query)) && !entry.key.startsWith(query)).slice(0, visibleLimit)
    ].slice(0, visibleLimit)
    : [];
  const expanded = options.length > 0;

  useEffect(() => {
    input.current?.setCustomValidity(text && !selected ? t('chooseMatch') : '');
  }, [selected, t, text]);

  function update(next: string) {
    if (value === undefined) setDraft(next);
    onChange?.(next);
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(language: Lookup) {
    update(language.label ?? language.name);
    close();
  }

  return (
    <div className="relative min-w-0">
      {name && <input type="hidden" name={name} value={selected?.id ?? ''} />}
      <Input
        id={id}
        ref={input}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder={placeholder ?? t('search')}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && options[active] ? listId + '-' + active : undefined}
        value={text}
        disabled={disabled}
        required={required}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (selected && (selected.label ?? selected.name) !== text) update(selected.label ?? selected.name);
          close();
        }}
        onChange={(event) => {
          update(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
          } else if (event.key === 'Enter' && expanded && options[active]) {
            event.preventDefault();
            choose(options[active].language);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            if (options.length === 0) return;
            const next = event.key === 'ArrowDown'
              ? Math.min(active + 1, options.length - 1)
              : active <= 0 ? options.length - 1 : active - 1;
            setActive(next);
            document.getElementById(listId + '-' + next)?.scrollIntoView({ block: 'nearest' });
          }
        }}
      />
      {expanded && (
        <ul id={listId} role="listbox" aria-label={t('suggestions')}
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-line bg-white shadow-md">
          {options.map(({ language }, index) => (
            <li key={language.id} id={listId + '-' + index} role="option" aria-selected={active === index}
              className={`flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm hover:bg-mint ${active === index ? 'bg-mint' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(language)}>
              <bdi>{language.label ?? language.name}</bdi>
            </li>
          ))}
        </ul>
      )}
      {open && query && !expanded && <p role="status" className="mt-1 text-sm text-quiet">{t('noResults')}</p>}
    </div>
  );
}
