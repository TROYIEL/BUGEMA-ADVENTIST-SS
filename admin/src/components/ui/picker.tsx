"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "./cn";
import { CONTROL } from "./field";

/**
 * A list to choose one thing from, in place of a native <select>.
 *
 * Two things the native control gets wrong for our forms: on some desktops
 * its popup opens on mousedown and the mouseup of the same click lands on
 * whatever option is under the pointer, so a slightly moving click "chooses"
 * something the user never picked; and it cannot show a thumbnail or wrap a
 * long label. This one opens on click and chooses on a second click, shows a
 * picture and a second line per option, and follows the WAI-ARIA select-only
 * combobox pattern: the trigger keeps focus, arrows move a highlight, Enter
 * chooses, Escape closes, typing jumps to a match.
 *
 * It posts its value through a hidden input, so it drops into any form. Use a
 * native <select> where the page must work without JavaScript.
 */

export type PickerOption = {
  value: string;
  label: string;
  /** Second line, smaller. */
  description?: string | null;
  /** Options with the same group are listed under that heading. */
  group?: string;
  disabled?: boolean;
  /** Image URL for a thumbnail beside the label. */
  image?: string | null;
};

export function Picker({
  id,
  name,
  options,
  value,
  defaultValue = "",
  onChange,
  placeholder = "Choose…",
  emptyLabel,
  disabled = false,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  id: string;
  name: string;
  options: PickerOption[];
  /** Controlled value; omit to let the picker hold its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** When set, an option with an empty value is offered with this label. */
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Accepted from Field's render props; a hidden input cannot enforce it. */
  required?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [internal, setInternal] = useState(defaultValue);
  const selected = value ?? internal;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typeahead = useRef({ text: "", at: 0 });

  const all: PickerOption[] = emptyLabel !== undefined
    ? [{ value: "", label: emptyLabel }, ...options]
    : options;
  const current = all.find((option) => option.value === selected) ?? null;

  function choose(option: PickerOption) {
    if (option.disabled) return;
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
  }

  function openList() {
    if (disabled) return;
    const index = all.findIndex((option) => option.value === selected);
    setActive(index === -1 ? all.findIndex((option) => !option.disabled) : index);
    setOpen(true);
  }

  function move(step: number) {
    if (all.length === 0) return;
    let next = active;
    for (let tries = 0; tries < all.length; tries++) {
      next = (next + step + all.length) % all.length;
      if (!all[next]?.disabled) break;
    }
    setActive(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else move(-1);
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(all.findIndex((option) => !option.disabled));
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(all.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) openList();
        else if (all[active]) choose(all[active]);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // Type to jump: letters typed within a second accumulate.
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
        const now = Date.now();
        const text = (now - typeahead.current.at < 1000 ? typeahead.current.text : "") + event.key.toLowerCase();
        typeahead.current = { text, at: now };
        const index = all.findIndex(
          (option) => !option.disabled && option.label.toLowerCase().startsWith(text),
        );
        if (index !== -1) {
          if (open) setActive(index);
          else choose(all[index]!);
        }
      }
    }
  }

  // Close when the pointer goes elsewhere.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option in view as the arrows move it.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selected} />

      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(CONTROL, "flex items-center gap-3 text-left")}
      >
        {current?.image ? <Thumb src={current.image} /> : null}
        <span className={cn("min-w-0 flex-1 truncate", !current && "text-ink-500")}>
          {current ? current.label : placeholder}
        </span>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 shrink-0 text-ink-500">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-card border border-line-strong bg-surface-raised py-1 shadow-raised"
        >
          {all.map((option, index) => {
            // A group heading sits above the first option of each group.
            const heading = option.group && option.group !== all[index - 1]?.group ? option.group : null;
            const isActive = index === active;
            const isSelected = option.value === selected;
            return (
              <Row key={`${option.value}-${index}`} heading={heading}>
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  data-index={index}
                  onMouseMove={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2 text-[0.9375rem]",
                    isActive && "bg-navy-50",
                    isSelected && "font-semibold text-navy-900",
                    option.disabled && "cursor-not-allowed text-ink-400",
                  )}
                >
                  {option.image ? <Thumb src={option.image} /> : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="break-words">{option.label}</span>
                    {option.description ? (
                      <span className="break-words text-xs font-normal text-ink-500">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 shrink-0 text-navy-800">
                      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </li>
              </Row>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** A group heading is a presentational row before the first option of the group. */
function Row({ heading, children }: { heading: string | null; children: ReactNode }) {
  if (!heading) return <>{children}</>;
  return (
    <>
      <li role="presentation" className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">
        {heading}
      </li>
      {children}
    </>
  );
}

function Thumb({ src }: { src: string }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-surface-sunken">
      <Image src={src} alt="" fill sizes="2.5rem" className="object-cover" />
    </span>
  );
}
