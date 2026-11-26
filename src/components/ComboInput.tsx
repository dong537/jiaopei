"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useRef, useState } from "react";

/** Editable institution name with styled suggestions; accepts institutions outside the directory. */
export function ComboInput({ id, name, options, placeholder, required }: {
  id: string; name: string; options: string[]; placeholder?: string; required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const filtered = options.filter(option => option.includes(value.trim())).slice(0, 8);
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => { setValue(""); setOpen(false); setActive(-1); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  function choose(option: string) { setValue(option); setOpen(false); setActive(-1); ref.current?.focus(); }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <input ref={ref} id={id} name={name} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} value={value} required={required} autoComplete="off" placeholder={placeholder}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setValue(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={e => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive(i => Math.max(0, Math.min(filtered.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))); }
            if (e.key === "Enter" && open && active >= 0 && filtered[active]) { e.preventDefault(); choose(filtered[active]); }
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
          }}
          className="h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" collisionPadding={12} onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onInteractOutside={e => { if (e.target === ref.current) e.preventDefault(); }} className="z-50 max-h-[min(320px,var(--radix-popover-content-available-height))] overflow-y-auto w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <div id={listId} role="listbox" aria-label="机构名称建议">
            {filtered.map((option, index) => <button id={`${listId}-${index}`} key={option} type="button" role="option" aria-selected={active === index} onMouseDown={e => e.preventDefault()} onClick={() => choose(option)} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-brand-soft hover:text-brand ${active === index ? "bg-brand-soft text-brand" : "text-ink-2"}`}>{option}</button>)}
            {!filtered.length && <p className="px-3 py-3 text-sm text-subtle">未找到匹配机构，可直接使用已输入的名称。</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
