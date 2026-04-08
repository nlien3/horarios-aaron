"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";

import { includesNormalizedText } from "@/lib/utils";

export type CommissionComboboxOption = {
  id: string;
  label: string;
};

type CommissionComboboxProps = {
  options: CommissionComboboxOption[];
  value: string;
  onChange: (commissionId: string) => void;
  label: string;
  placeholder: string;
  emptyMessage: string;
  inputClassName: string;
};

export function filterCommissionOptions(
  options: CommissionComboboxOption[],
  query: string
): CommissionComboboxOption[] {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return options;
  }

  return options.filter((option) => includesNormalizedText(option.label, trimmedQuery));
}

export function CommissionCombobox({
  options,
  value,
  onChange,
  label,
  placeholder,
  emptyMessage,
  inputClassName
}: CommissionComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((option) => option.id === value);
  const filteredOptions = filterCommissionOptions(options, searchTerm);
  const activeOption = filteredOptions[activeIndex];
  const inputValue = isOpen ? searchTerm : selectedOption?.label ?? "";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setActiveIndex(0);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchTerm]);

  function openMenu() {
    setIsOpen(true);
    setSearchTerm("");
    setActiveIndex(0);
  }

  function closeMenu() {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(0);
  }

  function selectOption(optionId: string) {
    onChange(optionId);
    closeMenu();
  }

  function clearSelection() {
    onChange("");
    closeMenu();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }

      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }

      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && activeOption) {
      event.preventDefault();
      selectOption(activeOption.id);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          containerRef.current?.contains(event.relatedTarget)
        ) {
          return;
        }

        closeMenu();
      }}
    >
      <label className="block text-sm font-medium" htmlFor={inputId}>
        {label}
      </label>

      <div className="relative">
        <input
          aria-activedescendant={
            isOpen && activeOption ? `${listboxId}-${activeOption.id}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`${inputClassName} pr-28`.trim()}
          id={inputId}
          onChange={(event) => {
            if (!isOpen) {
              setIsOpen(true);
            }

            setSearchTerm(event.target.value);
          }}
          onFocus={() => {
            if (!isOpen) {
              openMenu();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={inputValue}
        />

        {selectedOption ? (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition hover:bg-[var(--bg-soft)]"
            onClick={clearSelection}
            type="button"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[1.2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] shadow-[0_24px_50px_rgba(76,54,24,0.16)]">
          <div
            aria-label={`${label} opciones`}
            className="max-h-64 overflow-y-auto py-2"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.id === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-[rgba(181,84,47,0.12)] text-[var(--accent-deep)]"
                        : "text-[var(--ink)] hover:bg-white/80"
                    }`.trim()}
                    id={`${listboxId}-${option.id}`}
                    key={option.id}
                    onClick={() => selectOption(option.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Actual
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-4 text-sm text-[var(--muted)]">{emptyMessage}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
