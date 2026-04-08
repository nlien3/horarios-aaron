import React, { useRef, useState, type DragEvent, type ReactNode } from "react";

import {
  createPlacedPendingScheduleEntryDraft,
  createMovedScheduleEntryDraft,
  getScheduleEntryDurationMinutes
} from "@/lib/schedule";
import { clampMinutes, roundMinutesToStep, timeToMinutes } from "@/lib/time";
import {
  DAY_LABELS,
  DAY_OPTIONS,
  type Commission,
  type DayOfWeek,
  type PendingScheduleEntry,
  type ScheduleEntry,
  type Subject,
  type Teacher
} from "@/lib/types";

type ScheduleGridProps = {
  entries: ScheduleEntry[];
  commissionsById: Map<string, Commission>;
  subjectsById: Map<string, Subject>;
  teachersById: Map<string, Teacher>;
  careerNamesByCommissionId: Map<string, string>;
  mode: "commission" | "teacher" | "subject";
  title: string;
  subtitle: string;
  notice?: ReactNode;
  pendingEntries?: PendingScheduleEntry[];
  onMoveEntry?: (entryId: string, nextDay: DayOfWeek, nextStartMinutes: number) => void;
  onPlacePendingEntry?: (
    pendingEntryId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) => void;
  onDeletePendingEntry?: (pendingEntryId: string) => void;
  onEditEntry?: (entry: ScheduleEntry) => void;
};

const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 22 * 60;
const HOUR_ROW_HEIGHT = 72;
const DRAG_SNAP_MINUTES = 15;

function floorToHour(value: number): number {
  return Math.floor(value / 60) * 60;
}

function ceilToHour(value: number): number {
  return Math.ceil(value / 60) * 60;
}

function formatHour(value: number): string {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

type DragState =
  | {
      kind: "scheduled";
      entryId: string;
      offsetMinutes: number;
    }
  | {
      kind: "pending";
      pendingEntryId: string;
      offsetMinutes: number;
    };

function formatDurationLabel(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function ScheduleGrid({
  entries,
  commissionsById,
  subjectsById,
  teachersById,
  careerNamesByCommissionId,
  mode,
  title,
  subtitle,
  notice,
  pendingEntries = [],
  onMoveEntry,
  onPlacePendingEntry,
  onDeletePendingEntry,
  onEditEntry
}: ScheduleGridProps) {
  const [hoveredDay, setHoveredDay] = useState<DayOfWeek | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const canMoveEntries = mode === "commission" && Boolean(onMoveEntry);
  const canPlacePendingEntries = mode === "commission" && Boolean(onPlacePendingEntry);
  const showPendingSection = true;
  const pendingTitle =
    mode === "teacher"
      ? "Pendientes del profesor visible"
      : mode === "subject"
        ? "Pendientes de la materia visible"
        : "Bloques pendientes";
  const pendingDescription =
    mode === "teacher"
      ? "Estos bloques todavia no tienen dia ni horario, pero ya quedaron asignados a este profesor."
      : mode === "subject"
        ? "Estos bloques todavia no tienen dia ni horario, pero ya quedaron cargados para esta materia."
        : "Guarda bloques sin dia ni horario y luego arrastralos a la grilla para ubicarlos.";
  const emptyPendingLabel =
    mode === "teacher"
      ? "No hay bloques pendientes para este profesor."
      : mode === "subject"
        ? "No hay bloques pendientes para esta materia."
        : "No hay bloques pendientes para esta comision.";

  if (entries.length === 0 && (!showPendingSection || pendingEntries.length === 0)) {
    return (
      <section className="glass-panel rounded-[2rem] p-6">
        <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Vista semanal
        </div>
        <h3 className="display-font text-2xl font-semibold">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
        {notice ? <div className="mt-4">{notice}</div> : null}
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-[var(--stroke)] bg-white/50 p-8 text-center text-sm text-[var(--muted)]">
          No hay bloques cargados para esta vista todavia.
        </div>
      </section>
    );
  }

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const pendingById = new Map(pendingEntries.map((entry) => [entry.id, entry]));
  const startMinutes = DEFAULT_START_MINUTES;
  const endMinutes = DEFAULT_END_MINUTES;
  const totalHeight = ((endMinutes - startMinutes) / 60) * HOUR_ROW_HEIGHT;
  const hourMarks = Array.from(
    { length: (endMinutes - startMinutes) / 60 + 1 },
    (_, index) => startMinutes + index * 60
  );

  function handleDragStart(event: DragEvent<HTMLElement>, entry: ScheduleEntry) {
    if (!canMoveEntries) {
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - targetRect.top;
    const durationMinutes = getScheduleEntryDurationMinutes(entry);
    const rawOffsetMinutes = (relativeY / HOUR_ROW_HEIGHT) * 60;
    const offsetMinutes = clampMinutes(
      roundMinutesToStep(rawOffsetMinutes, DRAG_SNAP_MINUTES),
      0,
      durationMinutes
    );

    dragStateRef.current = {
      kind: "scheduled",
      entryId: entry.id,
      offsetMinutes
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  }

  function handlePendingDragStart(
    event: DragEvent<HTMLElement>,
    entry: PendingScheduleEntry
  ) {
    if (!canPlacePendingEntries) {
      return;
    }

    dragStateRef.current = {
      kind: "pending",
      pendingEntryId: entry.id,
      offsetMinutes: 0
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  }

  function handleDayDrop(event: DragEvent<HTMLDivElement>, day: DayOfWeek) {
    if (!dragStateRef.current) {
      return;
    }

    event.preventDefault();

    const columnRect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - columnRect.top;
    const rawStartMinutes =
      startMinutes + (relativeY / HOUR_ROW_HEIGHT) * 60 - dragStateRef.current.offsetMinutes;

    if (dragStateRef.current.kind === "scheduled") {
      if (!canMoveEntries || !onMoveEntry) {
        dragStateRef.current = null;
        setHoveredDay(null);
        return;
      }

      const draggedEntry = entryById.get(dragStateRef.current.entryId);

      if (!draggedEntry) {
        dragStateRef.current = null;
        setHoveredDay(null);
        return;
      }

      const durationMinutes = getScheduleEntryDurationMinutes(draggedEntry);
      const roundedStartMinutes = roundMinutesToStep(rawStartMinutes, DRAG_SNAP_MINUTES);
      const maxVisibleStartMinutes = Math.max(startMinutes, endMinutes - durationMinutes);
      const clampedStartMinutes = clampMinutes(
        roundedStartMinutes,
        startMinutes,
        maxVisibleStartMinutes
      );
      const movedDraft = createMovedScheduleEntryDraft(draggedEntry, day, clampedStartMinutes);

      dragStateRef.current = null;
      setHoveredDay(null);

      if (
        movedDraft.dayOfWeek === draggedEntry.dayOfWeek &&
        movedDraft.startTime === draggedEntry.startTime &&
        movedDraft.endTime === draggedEntry.endTime
      ) {
        return;
      }

      onMoveEntry(draggedEntry.id, day, timeToMinutes(movedDraft.startTime));
      return;
    }

    if (!canPlacePendingEntries || !onPlacePendingEntry) {
      dragStateRef.current = null;
      setHoveredDay(null);
      return;
    }

    const draggedPendingEntry = pendingById.get(dragStateRef.current.pendingEntryId);

    if (!draggedPendingEntry) {
      dragStateRef.current = null;
      setHoveredDay(null);
      return;
    }

    const roundedStartMinutes = roundMinutesToStep(rawStartMinutes, DRAG_SNAP_MINUTES);
    const maxVisibleStartMinutes = Math.max(
      startMinutes,
      endMinutes - draggedPendingEntry.durationMinutes
    );
    const clampedStartMinutes = clampMinutes(
      roundedStartMinutes,
      startMinutes,
      maxVisibleStartMinutes
    );
    const placedDraft = createPlacedPendingScheduleEntryDraft(
      draggedPendingEntry,
      day,
      clampedStartMinutes
    );

    dragStateRef.current = null;
    setHoveredDay(null);

    onPlacePendingEntry(draggedPendingEntry.id, day, timeToMinutes(placedDraft.startTime));
  }

  return (
    <section className="glass-panel rounded-[2rem] p-6">
      <div className="mb-4 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        Vista semanal
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="display-font text-2xl font-semibold">{title}</h3>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">{subtitle}</p>
          {canMoveEntries || canPlacePendingEntries ? (
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Arrastra bloques dentro de la grilla con precision de 15 minutos. Para ajustes por
              minuto usa editar.
            </p>
          ) : null}
        </div>
        <div className="rounded-full border border-[var(--stroke)] bg-[var(--panel-strong)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {entries.length} bloques
        </div>
      </div>

      {notice ? <div className="mb-5">{notice}</div> : null}

      {showPendingSection ? (
        <div className="mb-5 rounded-[1.5rem] border border-[var(--stroke)] bg-white/62 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                {pendingTitle}
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {pendingDescription}
              </p>
            </div>
            <div className="rounded-full border border-[var(--stroke)] bg-[var(--panel-strong)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {pendingEntries.length} pendientes
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {pendingEntries.length > 0 ? (
              pendingEntries.map((entry) => {
                const subject = subjectsById.get(entry.subjectId);
                const teacher = teachersById.get(entry.teacherId);
                const commission = commissionsById.get(entry.commissionId);
                const commissionMeta =
                  mode === "teacher" || mode === "subject"
                    ? `${careerNamesByCommissionId.get(entry.commissionId) ?? "Carrera"} · ${
                        commission?.yearNumber ?? ""
                      } año · ${commission?.label ?? ""}`
                    : null;

                return (
                  <article
                    className={`relative w-full max-w-[20rem] rounded-[1.2rem] border border-dashed border-[rgba(181,84,47,0.3)] bg-[rgba(255,248,242,0.94)] px-4 py-4 shadow-[0_12px_28px_rgba(123,51,32,0.08)] ${
                      canPlacePendingEntries ? "cursor-grab active:cursor-grabbing" : ""
                    }`.trim()}
                    data-testid={`pending-entry-${entry.id}`}
                    draggable={canPlacePendingEntries}
                    key={entry.id}
                    onDragEnd={() => {
                      dragStateRef.current = null;
                      setHoveredDay(null);
                    }}
                    onDragStart={(event) => handlePendingDragStart(event, entry)}
                  >
                    {onDeletePendingEntry ? (
                      <button
                        aria-label={`Eliminar pendiente ${subject?.name ?? "bloque"}`}
                        className="absolute right-3 top-3 rounded-full border border-[var(--stroke)] bg-white/90 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition hover:bg-white"
                        draggable={false}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeletePendingEntry(entry.id);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        Borrar
                      </button>
                    ) : null}
                    <div
                      aria-label={`Arrastrar pendiente ${subject?.name ?? "bloque"}`}
                      className="pr-20"
                    >
                      <div className="text-sm font-semibold leading-tight text-[var(--accent-deep)]">
                        {subject?.name ?? "Asignatura"}
                      </div>
                      <div className="mt-2 text-xs leading-relaxed text-[var(--ink)]">
                        {teacher?.name ?? "Profesor"}
                      </div>
                      {commissionMeta ? (
                        <div className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                          {commissionMeta}
                        </div>
                      ) : null}
                      <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Duracion {formatDurationLabel(entry.durationMinutes)}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
                {emptyPendingLabel}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[1080px] gap-3"
          style={{ gridTemplateColumns: `88px repeat(${DAY_OPTIONS.length}, minmax(0, 1fr))` }}
        >
          <div />
          {DAY_OPTIONS.map((day) => (
            <div
              key={day}
              className="rounded-[1.25rem] border border-[var(--stroke)] bg-white/70 px-4 py-3 text-center text-sm font-semibold"
            >
              {DAY_LABELS[day]}
            </div>
          ))}

          <div className="relative">
            <div style={{ height: totalHeight }}>
              {hourMarks.slice(0, -1).map((hour) => {
                const top = ((hour - startMinutes) / 60) * HOUR_ROW_HEIGHT;

                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 -translate-y-3 pr-1 text-right text-xs font-medium text-[var(--muted)]"
                    style={{ top }}
                  >
                    {formatHour(hour)}
                  </div>
                );
              })}
            </div>
          </div>

          {DAY_OPTIONS.map((day) => {
            const dayEntries = entries.filter((entry) => entry.dayOfWeek === day);

            return (
              <div
                key={day}
                className={`relative overflow-hidden rounded-[1.5rem] border bg-white/82 transition ${
                  hoveredDay === day
                    ? "border-[rgba(181,84,47,0.45)] ring-2 ring-[rgba(181,84,47,0.12)]"
                    : "border-[var(--stroke)]"
                }`.trim()}
                data-testid={`day-column-${day}`}
                onDragLeave={() => {
                  if (hoveredDay === day) {
                    setHoveredDay(null);
                  }
                }}
                onDragOver={(event) => {
                  if (!canMoveEntries && !canPlacePendingEntries) {
                    return;
                  }

                  event.preventDefault();
                  setHoveredDay(day);
                }}
                onDrop={(event) => handleDayDrop(event, day)}
                style={{ height: totalHeight }}
              >
                {hourMarks.map((hour) => {
                  const top = ((hour - startMinutes) / 60) * HOUR_ROW_HEIGHT;

                  return (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-[rgba(53,38,17,0.08)]"
                      style={{ top }}
                    />
                  );
                })}

                {dayEntries.map((entry) => {
                  const subject = subjectsById.get(entry.subjectId);
                  const teacher = teachersById.get(entry.teacherId);
                  const commission = commissionsById.get(entry.commissionId);
                  const commissionTitle = `${careerNamesByCommissionId.get(entry.commissionId) ?? "Carrera"} · ${
                    commission?.yearNumber ?? ""
                  } año · ${commission?.label ?? ""}`;
                  const top =
                    ((timeToMinutes(entry.startTime) - startMinutes) / 60) * HOUR_ROW_HEIGHT;
                  const height =
                    ((timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)) / 60) *
                    HOUR_ROW_HEIGHT;
                  const entryTitle =
                    mode === "subject"
                      ? commissionTitle
                      : subject?.name ?? "Asignatura";
                  const entryMeta =
                    mode === "commission"
                      ? teacher?.name ?? "Profesor"
                      : mode === "teacher"
                        ? commissionTitle
                        : teacher?.name ?? "Profesor";

                  return (
                    <article
                      className={`absolute left-2 right-2 overflow-hidden rounded-[1.1rem] border border-[rgba(181,84,47,0.25)] bg-[linear-gradient(180deg,rgba(255,233,214,0.96),rgba(255,246,238,0.95))] px-3 py-2 shadow-[0_18px_38px_rgba(123,51,32,0.12)] ${
                        canMoveEntries ? "cursor-grab active:cursor-grabbing" : ""
                      }`.trim()}
                      data-testid={`schedule-entry-${entry.id}`}
                      draggable={canMoveEntries}
                      key={entry.id}
                      onDragEnd={() => {
                        dragStateRef.current = null;
                        setHoveredDay(null);
                      }}
                      onDragStart={(event) => handleDragStart(event, entry)}
                      style={{ top: top + 4, height: Math.max(height - 8, 48) }}
                    >
                      {onEditEntry ? (
                        <button
                          aria-label={`Editar ${subject?.name ?? "bloque"}`}
                          className="absolute right-2 top-2 z-10 rounded-full border border-[rgba(123,51,32,0.18)] bg-white/88 px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)] shadow-sm transition hover:bg-white"
                          draggable={false}
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditEntry(entry);
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                          title={`Editar ${subject?.name ?? "bloque"}`}
                          type="button"
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                      ) : null}
                      <div className="text-sm font-semibold leading-tight text-[var(--accent-deep)]">
                        {entryTitle}
                      </div>
                      <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                        {entry.startTime} - {entry.endTime}
                      </div>
                      <div className="mt-2 text-xs leading-relaxed text-[var(--ink)]">
                        {entryMeta}
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
