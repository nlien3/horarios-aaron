import { clampMinutes, minutesToTime, timeToMinutes } from "@/lib/time";
import {
  DAY_OPTIONS,
  type DayOfWeek,
  type Commission,
  type PendingScheduleEntry,
  type PlannerState,
  type ScheduleConflict,
  type ScheduleEntry,
  type ScheduleEntryDraft,
  type Subject
} from "@/lib/types";

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

function buildConflictMessage(
  hasCommissionConflict: boolean,
  hasTeacherConflict: boolean
): string {
  if (hasCommissionConflict && hasTeacherConflict) {
    return "La comision ya tiene otra clase en ese horario y el profesor figura ocupado.";
  }

  if (hasCommissionConflict) {
    return "La comision ya tiene otra clase en ese horario.";
  }

  return "El profesor ya figura ocupado en ese horario.";
}

export function entriesOverlap(
  left: Pick<ScheduleEntry, "dayOfWeek" | "startTime" | "endTime">,
  right: Pick<ScheduleEntry, "dayOfWeek" | "startTime" | "endTime">
): boolean {
  if (left.dayOfWeek !== right.dayOfWeek) {
    return false;
  }

  return (
    timeToMinutes(left.startTime) < timeToMinutes(right.endTime) &&
    timeToMinutes(right.startTime) < timeToMinutes(left.endTime)
  );
}

export function getCommissionSchedule(
  state: PlannerState,
  commissionId: string
): ScheduleEntry[] {
  return state.scheduleEntries
    .filter((entry) => entry.commissionId === commissionId)
    .sort(compareEntries);
}

export function getTeacherSchedule(state: PlannerState, teacherId: string): ScheduleEntry[] {
  return state.scheduleEntries
    .filter((entry) => entry.teacherId === teacherId)
    .sort(compareEntries);
}

export function getSubjectSchedule(state: PlannerState, subjectId: string): ScheduleEntry[] {
  return state.scheduleEntries
    .filter((entry) => entry.subjectId === subjectId)
    .sort(compareEntries);
}

export function getCommissionSubjects(
  state: PlannerState,
  commissionId: string
): Subject[] {
  const commission = state.commissions.find((item) => item.id === commissionId);

  if (!commission) {
    return [];
  }

  return state.subjects
    .filter(
      (subject) =>
        subject.careerId === commission.careerId && subject.yearNumber === commission.yearNumber
    )
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function listPendingSubjectsForCommission(
  state: PlannerState,
  commissionId: string
): Subject[] {
  const assignedSubjectIds = new Set(
    state.scheduleEntries
      .filter((entry) => entry.commissionId === commissionId)
      .map((entry) => entry.subjectId)
  );

  return getCommissionSubjects(state, commissionId).filter(
    (subject) => !assignedSubjectIds.has(subject.id)
  );
}

export function getPendingScheduleEntriesForCommission(
  state: PlannerState,
  commissionId: string
): PendingScheduleEntry[] {
  return state.pendingScheduleEntries
    .filter((entry) => entry.commissionId === commissionId)
    .sort((left, right) => {
      const leftSubject = state.subjects.find((subject) => subject.id === left.subjectId)?.name ?? "";
      const rightSubject = state.subjects.find((subject) => subject.id === right.subjectId)?.name ?? "";

      return (
        leftSubject.localeCompare(rightSubject, "es") ||
        left.durationMinutes - right.durationMinutes
      );
    });
}

export function getPendingScheduleEntriesForTeacher(
  state: PlannerState,
  teacherId: string
): PendingScheduleEntry[] {
  return state.pendingScheduleEntries
    .filter((entry) => entry.teacherId === teacherId)
    .sort((left, right) => {
      const leftSubject = state.subjects.find((subject) => subject.id === left.subjectId)?.name ?? "";
      const rightSubject = state.subjects.find((subject) => subject.id === right.subjectId)?.name ?? "";

      return (
        leftSubject.localeCompare(rightSubject, "es") ||
        left.durationMinutes - right.durationMinutes
      );
    });
}

export function getPendingScheduleEntriesForSubject(
  state: PlannerState,
  subjectId: string
): PendingScheduleEntry[] {
  return state.pendingScheduleEntries
    .filter((entry) => entry.subjectId === subjectId)
    .sort((left, right) => {
      const leftCommission = state.commissions.find(
        (commission) => commission.id === left.commissionId
      );
      const rightCommission = state.commissions.find(
        (commission) => commission.id === right.commissionId
      );
      const leftCareer = state.careers.find(
        (career) => career.id === leftCommission?.careerId
      )?.name ?? "";
      const rightCareer = state.careers.find(
        (career) => career.id === rightCommission?.careerId
      )?.name ?? "";

      return (
        leftCareer.localeCompare(rightCareer, "es") ||
        (leftCommission?.yearNumber ?? 0) - (rightCommission?.yearNumber ?? 0) ||
        (leftCommission?.label ?? "").localeCompare(rightCommission?.label ?? "", "es") ||
        left.durationMinutes - right.durationMinutes
      );
    });
}

export function detectScheduleConflicts(
  draft: ScheduleEntryDraft,
  state: PlannerState,
  editingEntryId?: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const entry of state.scheduleEntries) {
    if (entry.id === editingEntryId) {
      continue;
    }

    if (!entriesOverlap(draft, entry)) {
      continue;
    }

    const hasCommissionConflict = entry.commissionId === draft.commissionId;
    const hasTeacherConflict = entry.teacherId === draft.teacherId;

    if (!hasCommissionConflict && !hasTeacherConflict) {
      continue;
    }

    conflicts.push({
      existingEntry: entry,
      scopes: {
        commission: hasCommissionConflict,
        teacher: hasTeacherConflict
      },
      message: buildConflictMessage(hasCommissionConflict, hasTeacherConflict)
    });
  }

  return conflicts;
}

export function getCommissionTitle(commission: Commission, careerName: string): string {
  return `${careerName} · ${commission.yearNumber} año · Comision ${commission.label}`;
}

export function getScheduleEntryDurationMinutes(entry: ScheduleEntry): number {
  return timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime);
}

export function createMovedScheduleEntryDraft(
  entry: ScheduleEntry,
  dayOfWeek: DayOfWeek,
  startMinutes: number
): ScheduleEntryDraft {
  const durationMinutes = getScheduleEntryDurationMinutes(entry);
  const safeStartMinutes = clampMinutes(startMinutes, 0, 24 * 60 - durationMinutes);

  return {
    commissionId: entry.commissionId,
    subjectId: entry.subjectId,
    teacherId: entry.teacherId,
    dayOfWeek,
    startTime: minutesToTime(safeStartMinutes),
    endTime: minutesToTime(safeStartMinutes + durationMinutes)
  };
}

export function createPlacedPendingScheduleEntryDraft(
  entry: PendingScheduleEntry,
  dayOfWeek: DayOfWeek,
  startMinutes: number
): ScheduleEntryDraft {
  const safeStartMinutes = clampMinutes(startMinutes, 0, 24 * 60 - entry.durationMinutes);

  return {
    commissionId: entry.commissionId,
    subjectId: entry.subjectId,
    teacherId: entry.teacherId,
    dayOfWeek,
    startTime: minutesToTime(safeStartMinutes),
    endTime: minutesToTime(safeStartMinutes + entry.durationMinutes)
  };
}
