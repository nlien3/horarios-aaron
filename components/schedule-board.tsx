"use client";

import React, { useRef, useState, type DragEvent } from "react";

import { getScheduleEntryDurationMinutes } from "@/lib/schedule";
import { clampMinutes, roundMinutesToStep, timeToMinutes } from "@/lib/time";
import {
  DAY_LABELS,
  DAY_OPTIONS,
  type Career,
  type Commission,
  type DayOfWeek,
  type PendingScheduleEntry,
  type ScheduleEntry,
  type Subject,
  type Teacher
} from "@/lib/types";

type ScheduleBoardProps = {
  commissions: Commission[];
  entries: ScheduleEntry[];
  careersById: Map<string, Career>;
  subjectsById: Map<string, Subject>;
  teachersById: Map<string, Teacher>;
  pendingEntries?: PendingScheduleEntry[];
  onMoveEntry?: (
    entryId: string,
    nextCommissionId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) => void;
  onPlacePendingEntry?: (
    pendingEntryId: string,
    nextCommissionId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) => void;
  onDeletePendingEntry?: (pendingEntryId: string) => void;
  onEditEntry?: (entry: ScheduleEntry) => void;
};

const BOARD_START_MINUTES = 8 * 60;
const BOARD_END_MINUTES = 22 * 60;
const TOTAL_DAY_MINUTES = BOARD_END_MINUTES - BOARD_START_MINUTES;
const HOURS_PER_DAY = TOTAL_DAY_MINUTES / 60;
const BASE_HOUR_WIDTH = 88;
const BASE_ROW_HEIGHT = 112;
const LEFT_COLUMN_WIDTH = 280;
const MIN_ZOOM = 80;
const MAX_ZOOM = 160;
const ZOOM_STEP = 10;
const DRAG_SNAP_MINUTES = 15;

type BoardDragState =
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

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);
}

function formatHour(value: number): string {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function compareEntries(left: ScheduleEntry, right: ScheduleEntry): number {
  const dayDifference =
    DAY_OPTIONS.indexOf(left.dayOfWeek) - DAY_OPTIONS.indexOf(right.dayOfWeek);

  if (dayDifference !== 0) {
    return dayDifference;
  }

  const startDifference = timeToMinutes(left.startTime) - timeToMinutes(right.startTime);

  if (startDifference !== 0) {
    return startDifference;
  }

  return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
}

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

export function ScheduleBoard({
  commissions,
  entries,
  careersById,
  subjectsById,
  teachersById,
  pendingEntries = [],
  onMoveEntry,
  onPlacePendingEntry,
  onDeletePendingEntry,
  onEditEntry
}: ScheduleBoardProps) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [hoveredTarget, setHoveredTarget] = useState<{
    commissionId: string;
    dayIndex: number;
  } | null>(null);
  const dragStateRef = useRef<BoardDragState | null>(null);

  if (commissions.length === 0) {
    return (
      <section className="glass-panel rounded-[2rem] p-6">
        <div className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Tablero general
        </div>
        <h3 className="display-font text-2xl font-semibold">Todas las comisiones</h3>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Crea al menos una comision para ver el tablero consolidado.
        </p>
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-[var(--stroke)] bg-white/50 p-8 text-center text-sm text-[var(--muted)]">
          No hay comisiones cargadas todavia.
        </div>
      </section>
    );
  }

  const zoomScale = zoomPercent / 100;
  const hourWidth = BASE_HOUR_WIDTH * zoomScale;
  const rowHeight = Math.max(BASE_ROW_HEIGHT * zoomScale, 88);
  const dayWidth = HOURS_PER_DAY * hourWidth;
  const timelineWidth = dayWidth * DAY_OPTIONS.length;
  const hourLabels = Array.from({ length: HOURS_PER_DAY }, (_, index) =>
    BOARD_START_MINUTES + index * 60
  );
  const hourLineCount = HOURS_PER_DAY * DAY_OPTIONS.length - 1;
  const totalBoardMinutes = DAY_OPTIONS.length * TOTAL_DAY_MINUTES;
  const canMoveEntries = Boolean(onMoveEntry);
  const canPlacePendingEntries = Boolean(onPlacePendingEntry);

  const entriesByCommission = new Map<string, ScheduleEntry[]>();
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const commissionsById = new Map(commissions.map((commission) => [commission.id, commission]));
  const pendingById = new Map(pendingEntries.map((entry) => [entry.id, entry]));

  commissions.forEach((commission) => {
    entriesByCommission.set(commission.id, []);
  });

  entries.forEach((entry) => {
    const targetEntries = entriesByCommission.get(entry.commissionId);

    if (targetEntries) {
      targetEntries.push(entry);
    }
  });

  entriesByCommission.forEach((commissionEntries) => {
    commissionEntries.sort(compareEntries);
  });

  function clearDragState() {
    dragStateRef.current = null;
    setHoveredTarget(null);
  }

  function getRelativeBoardMinutes(clientX: number, rect: DOMRect): number {
    const rawMinutes = ((clientX - rect.left) / hourWidth) * 60;

    return Number.isFinite(rawMinutes) ? rawMinutes : 0;
  }

  function getDayIndexFromClientX(clientX: number, rect: DOMRect): number {
    const rawMinutes = getRelativeBoardMinutes(clientX, rect);
    const safeMinutes = clampMinutes(rawMinutes, 0, totalBoardMinutes - 1);

    return clampMinutes(
      Math.floor(safeMinutes / TOTAL_DAY_MINUTES),
      0,
      DAY_OPTIONS.length - 1
    );
  }

  function getDropTarget(
    clientX: number,
    rect: DOMRect,
    offsetMinutes: number,
    durationMinutes: number
  ): { dayOfWeek: DayOfWeek; startMinutes: number; dayIndex: number } {
    const dayIndex = getDayIndexFromClientX(clientX, rect);
    const rawMinutes = getRelativeBoardMinutes(clientX, rect);
    const dayRelativeMinutes =
      rawMinutes - dayIndex * TOTAL_DAY_MINUTES - offsetMinutes;
    const roundedStartMinutes = roundMinutesToStep(dayRelativeMinutes, DRAG_SNAP_MINUTES);
    const maxVisibleStartMinutes = Math.max(0, TOTAL_DAY_MINUTES - durationMinutes);
    const clampedStartMinutes = clampMinutes(
      roundedStartMinutes,
      0,
      maxVisibleStartMinutes
    );

    return {
      dayOfWeek: DAY_OPTIONS[dayIndex],
      startMinutes: BOARD_START_MINUTES + clampedStartMinutes,
      dayIndex
    };
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, entry: ScheduleEntry) {
    if (!canMoveEntries) {
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - targetRect.left;
    const durationMinutes = getScheduleEntryDurationMinutes(entry);
    const rawOffsetMinutes = (relativeX / hourWidth) * 60;
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

  function handleRowDragOver(event: DragEvent<HTMLDivElement>, commissionId: string) {
    if ((!canMoveEntries && !canPlacePendingEntries) || !dragStateRef.current) {
      return;
    }

    event.preventDefault();

    setHoveredTarget({
      commissionId,
      dayIndex: getDayIndexFromClientX(event.clientX, event.currentTarget.getBoundingClientRect())
    });
  }

  function handleRowDrop(event: DragEvent<HTMLDivElement>, commissionId: string) {
    if (!dragStateRef.current) {
      return;
    }

    event.preventDefault();

    if (dragStateRef.current.kind === "scheduled") {
      const draggedEntry = entryById.get(dragStateRef.current.entryId);

      if (!canMoveEntries || !onMoveEntry || !draggedEntry) {
        clearDragState();
        return;
      }

      const target = getDropTarget(
        event.clientX,
        event.currentTarget.getBoundingClientRect(),
        dragStateRef.current.offsetMinutes,
        getScheduleEntryDurationMinutes(draggedEntry)
      );

      clearDragState();

      if (
        commissionId === draggedEntry.commissionId &&
        target.dayOfWeek === draggedEntry.dayOfWeek &&
        target.startMinutes === timeToMinutes(draggedEntry.startTime)
      ) {
        return;
      }

      onMoveEntry(draggedEntry.id, commissionId, target.dayOfWeek, target.startMinutes);
      return;
    }

    const draggedPendingEntry = pendingById.get(dragStateRef.current.pendingEntryId);

    if (!canPlacePendingEntries || !onPlacePendingEntry || !draggedPendingEntry) {
      clearDragState();
      return;
    }

    const target = getDropTarget(
      event.clientX,
      event.currentTarget.getBoundingClientRect(),
      dragStateRef.current.offsetMinutes,
      draggedPendingEntry.durationMinutes
    );

    clearDragState();

    onPlacePendingEntry(
      draggedPendingEntry.id,
      commissionId,
      target.dayOfWeek,
      target.startMinutes
    );
  }

  return (
    <section className="glass-panel rounded-[2rem] p-6">
      <div className="mb-4 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        Tablero general
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="display-font text-2xl font-semibold">Todas las comisiones</h3>
          <p className="mt-2 max-w-4xl text-sm text-[var(--muted)]">
            Cruza todas las comisiones en un solo tablero. Usa zoom para priorizar
            legibilidad, arrastra bloques entre filas para cambiarlos de comision o
            entre horarios para reubicarlos, y haz click en cualquier bloque para editarlo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[var(--stroke)] bg-[var(--panel-strong)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {commissions.length} comisiones · {entries.length} bloques · {pendingEntries.length} pendientes
          </div>
          <button
            aria-label="Zoom -"
            className="rounded-full border border-[var(--stroke)] bg-white/75 px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
            onClick={() => setZoomPercent((current) => clampZoom(current - ZOOM_STEP))}
            type="button"
          >
            -
          </button>
          <label className="flex items-center gap-3 rounded-full border border-[var(--stroke)] bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            <span>Zoom</span>
            <input
              aria-label="Zoom del tablero"
              className="w-28 accent-[var(--accent)]"
              max={MAX_ZOOM}
              min={MIN_ZOOM}
              onChange={(event) => setZoomPercent(clampZoom(Number(event.target.value)))}
              step={ZOOM_STEP}
              type="range"
              value={zoomPercent}
            />
            <span className="min-w-[3rem] text-right text-[var(--accent-deep)]">
              {zoomPercent}%
            </span>
          </label>
          <button
            aria-label="Zoom +"
            className="rounded-full border border-[var(--stroke)] bg-white/75 px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
            onClick={() => setZoomPercent((current) => clampZoom(current + ZOOM_STEP))}
            type="button"
          >
            +
          </button>
          <button
            className="rounded-full border border-[var(--stroke)] bg-white/75 px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
            onClick={() => setZoomPercent(100)}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-[1.5rem] border border-[var(--stroke)] bg-white/62 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Pendientes del tablero
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Los bloques sin dia ni horario tambien aparecen aca. Arrastralos al tablero para ubicarlos.
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
              const careerName = commission
                ? careersById.get(commission.careerId)?.name ?? "Carrera"
                : "Carrera";

              return (
                <article
                  className={`relative w-full max-w-[20rem] rounded-[1.2rem] border border-dashed border-[rgba(181,84,47,0.3)] bg-[rgba(255,248,242,0.94)] px-4 py-4 shadow-[0_12px_28px_rgba(123,51,32,0.08)] ${
                    canPlacePendingEntries ? "cursor-grab active:cursor-grabbing" : ""
                  }`.trim()}
                  data-testid={`board-pending-entry-${entry.id}`}
                  draggable={canPlacePendingEntries}
                  key={entry.id}
                  onDragEnd={clearDragState}
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

                  <div className="pr-20">
                    <div className="text-sm font-semibold leading-tight text-[var(--accent-deep)]">
                      {subject?.name ?? "Asignatura"}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-[var(--ink)]">
                      {teacher?.name ?? "Profesor"}
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                      {careerName} · {commission?.yearNumber ?? ""} año · {commission?.label ?? ""}
                    </div>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Duracion {formatDurationLabel(entry.durationMinutes)}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
              No hay bloques pendientes en este momento.
            </div>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded-[1.6rem] border border-[var(--stroke)] bg-[rgba(255,250,245,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <div className="min-w-full w-max">
          <div className="sticky top-0 z-30 bg-[rgba(250,244,237,0.96)] backdrop-blur">
            <div className="flex border-b border-[var(--stroke)]">
              <div
                className="sticky left-0 z-40 flex shrink-0 items-center border-r border-[var(--stroke)] bg-[rgba(250,244,237,0.98)] px-5 py-3"
                style={{ width: LEFT_COLUMN_WIDTH }}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Comisiones
                </div>
              </div>

              <div className="flex shrink-0">
                {DAY_OPTIONS.map((day, index) => (
                  <div
                    className={`flex items-center justify-center border-r border-[var(--stroke)] px-4 py-3 text-sm font-semibold ${
                      index % 2 === 0 ? "bg-white/72" : "bg-[rgba(245,236,227,0.88)]"
                    }`.trim()}
                    key={day}
                    style={{ width: dayWidth }}
                  >
                    {DAY_LABELS[day]}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-b border-[var(--stroke)]">
              <div
                className="sticky left-0 z-40 flex shrink-0 items-center border-r border-[var(--stroke)] bg-[rgba(250,244,237,0.98)] px-5 py-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]"
                style={{ width: LEFT_COLUMN_WIDTH }}
              >
                08:00 a 22:00
              </div>

              <div className="flex shrink-0">
                {DAY_OPTIONS.map((day) => (
                  <div className="flex" key={`${day}-hours`}>
                    {hourLabels.map((hour) => (
                      <div
                        className="border-r border-[rgba(53,38,17,0.08)] px-2 py-2 text-center text-xs font-medium text-[var(--muted)]"
                        key={`${day}-${hour}`}
                        style={{ width: hourWidth }}
                      >
                        {formatHour(hour)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            {commissions.map((commission) => {
              const commissionEntries = entriesByCommission.get(commission.id) ?? [];
              const careerName = careersById.get(commission.careerId)?.name ?? "Carrera";

              return (
                <div
                  className="flex border-b border-[var(--stroke)] last:border-b-0"
                  data-testid={`board-row-${commission.id}`}
                  key={commission.id}
                >
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center border-r border-[var(--stroke)] bg-[rgba(250,244,237,0.98)] px-5 py-4"
                    style={{ width: LEFT_COLUMN_WIDTH, height: rowHeight }}
                  >
                    <div>
                      <div className="text-sm font-semibold leading-tight text-[var(--accent-deep)]">
                        {careerName}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        {commission.yearNumber} año · {commission.label}
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative shrink-0"
                    data-testid={`board-timeline-${commission.id}`}
                    onDragOver={(event) => handleRowDragOver(event, commission.id)}
                    onDrop={(event) => handleRowDrop(event, commission.id)}
                    style={{ width: timelineWidth, height: rowHeight }}
                  >
                    {DAY_OPTIONS.map((day, index) => (
                      <div
                        className={`absolute bottom-0 top-0 ${
                          index % 2 === 0 ? "bg-white/72" : "bg-[rgba(245,236,227,0.88)]"
                        }`.trim()}
                        key={`${commission.id}-${day}-background`}
                        style={{ left: index * dayWidth, width: dayWidth }}
                      />
                    ))}

                    {hoveredTarget?.commissionId === commission.id ? (
                      <div
                        className="pointer-events-none absolute bottom-0 top-0 z-10 border-2 border-[rgba(181,84,47,0.32)] bg-[rgba(181,84,47,0.08)]"
                        style={{
                          left: hoveredTarget.dayIndex * dayWidth,
                          width: dayWidth
                        }}
                      />
                    ) : null}

                    {Array.from({ length: hourLineCount }, (_, index) => {
                      const left = (index + 1) * hourWidth;
                      const isDayBoundary = (index + 1) % HOURS_PER_DAY === 0;

                      return (
                        <div
                          className={`absolute bottom-0 top-0 ${
                            isDayBoundary
                              ? "w-[2px] bg-[rgba(123,51,32,0.16)]"
                              : "w-px bg-[rgba(53,38,17,0.08)]"
                          }`.trim()}
                          key={`${commission.id}-hour-line-${index}`}
                          style={{ left }}
                        />
                      );
                    })}

                    {commissionEntries.map((entry) => {
                      const subject = subjectsById.get(entry.subjectId);
                      const teacher = teachersById.get(entry.teacherId);
                      const dayIndex = DAY_OPTIONS.indexOf(entry.dayOfWeek);
                      const startMinutes = timeToMinutes(entry.startTime);
                      const endMinutes = timeToMinutes(entry.endTime);
                      const left =
                        dayIndex * dayWidth + (startMinutes - BOARD_START_MINUTES) * (hourWidth / 60);
                      const width = (endMinutes - startMinutes) * (hourWidth / 60);

                      return (
                        <button
                          aria-label={`Editar bloque ${subject?.name ?? "Asignatura"} ${entry.startTime}-${entry.endTime}`}
                          className={`absolute overflow-hidden rounded-[1.1rem] border border-[rgba(181,84,47,0.25)] bg-[linear-gradient(180deg,rgba(255,233,214,0.97),rgba(255,246,238,0.96))] px-3 py-2 text-left shadow-[0_18px_38px_rgba(123,51,32,0.12)] transition hover:-translate-y-px hover:border-[rgba(181,84,47,0.4)] hover:shadow-[0_18px_42px_rgba(123,51,32,0.18)] ${
                            canMoveEntries ? "cursor-grab active:cursor-grabbing" : ""
                          }`.trim()}
                          data-testid={`board-entry-${entry.id}`}
                          draggable={canMoveEntries}
                          key={entry.id}
                          onDragEnd={clearDragState}
                          onDragStart={(event) => handleDragStart(event, entry)}
                          onClick={() => onEditEntry?.(entry)}
                          style={{
                            left: left + 6,
                            top: 8,
                            width: Math.max(width - 12, 36),
                            height: Math.max(rowHeight - 16, 72)
                          }}
                          title={`${subject?.name ?? "Asignatura"} · ${teacher?.name ?? "Profesor"}`}
                          type="button"
                        >
                          <div className="text-sm font-semibold leading-tight text-[var(--accent-deep)]">
                            {subject?.name ?? "Asignatura"}
                          </div>
                          <div className="mt-2 text-xs leading-snug text-[var(--ink)]">
                            {teacher?.name ?? "Profesor"}
                          </div>
                          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            {entry.startTime} - {entry.endTime}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
