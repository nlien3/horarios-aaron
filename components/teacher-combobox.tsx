"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";

import type { Teacher } from "@/lib/types";
import { includesNormalizedText } from "@/lib/utils";

type TeacherComboboxProps = {
  teachers: Teacher[];
  value: string;
  onChange: (teacherId: string) => void;
  label: string;
  placeholder: string;
  emptyMessage: string;
  inputClassName: string;
};

export function filterTeachersByQuery(teachers: Teacher[], query: string): Teacher[] {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return teachers;
  }

  return teachers.filter((teacher) => includesNormalizedText(teacher.name, trimmedQuery));
}

export function TeacherCombobox({
  teachers,
  value,
  onChange,
  label,
  placeholder,
  emptyMessage,
  inputClassName
}: TeacherComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedTeacher = teachers.find((teacher) => teacher.id === value);
  const filteredTeachers = filterTeachersByQuery(teachers, searchTerm);
  const activeTeacher = filteredTeachers[activeIndex];
  const inputValue = isOpen ? searchTerm : selectedTeacher?.name ?? "";

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

  function selectTeacher(teacherId: string) {
    onChange(teacherId);
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

      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredTeachers.length - 1, 0)));
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

    if (event.key === "Enter" && isOpen && activeTeacher) {
      event.preventDefault();
      selectTeacher(activeTeacher.id);
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
          ref={inputRef}
          aria-activedescendant={
            isOpen && activeTeacher ? `${listboxId}-${activeTeacher.id}` : undefined
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

        {selectedTeacher ? (
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
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map((teacher, index) => {
                const isSelected = teacher.id === value;
                const isActive = index === activeIndex;

                return (
                  <button
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-[rgba(181,84,47,0.12)] text-[var(--accent-deep)]"
                        : "text-[var(--ink)] hover:bg-white/80"
                    }`.trim()}
                    id={`${listboxId}-${teacher.id}`}
                    key={teacher.id}
                    onClick={() => selectTeacher(teacher.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <span>{teacher.name}</span>
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
