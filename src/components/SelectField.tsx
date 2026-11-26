"use client";

import { useEffect, useRef, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

type Option = { value: string; label: string; disabled?: boolean };

/** Shared select with keyboard navigation, outside dismissal and a portal menu. */
export function SelectField({
  options, value, defaultValue, onValueChange, name, id, className = "", disabled,
  "aria-label": ariaLabel, size = "regular",
}: {
  options: Option[];
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  size?: "regular" | "compact" | "search";
}) {
  const initial = String(defaultValue ?? options[0]?.value ?? "");
  const [internal, setInternal] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const selected = value === undefined ? internal : String(value);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setInternal(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);

  return (
    <>
      {name && <input ref={input} type="hidden" name={name} value={selected} disabled={disabled} />}
      <Select.Root value={`option:${selected}`} disabled={disabled} onValueChange={(next) => {
        const decoded = next.slice(7);
        setInternal(decoded);
        onValueChange?.(decoded);
      }}>
        <Select.Trigger id={id} aria-label={ariaLabel} data-size={size} className={`select-trigger ${className}`}>
          <Select.Value />
          <Select.Icon><ChevronDownIcon className="size-4 shrink-0 text-subtle" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={6} collisionPadding={12} className="select-menu">
            <Select.ScrollUpButton className="flex h-6 items-center justify-center text-subtle"><ChevronUpIcon /></Select.ScrollUpButton>
            <Select.Viewport className="p-1.5">
              {options.map((option) => (
                <Select.Item key={option.value} value={`option:${option.value}`} disabled={option.disabled} className="select-option">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-3 text-brand"><CheckIcon /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex h-6 items-center justify-center text-subtle"><ChevronDownIcon /></Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
