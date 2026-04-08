import { compareTimes, isValidTimeValue } from "@/lib/time";
import {
  DAY_OPTIONS,
  UNASSIGNED_TEACHER_ID,
  type Career,
  type CareerDraft,
  type Commission,
  type CommissionDraft,
  type PendingScheduleEntry,
  type PendingScheduleEntryDraft,
  type PlannerState,
  type ScheduleEntry,
  type ScheduleEntryDraft,
  type Subject,
  type SubjectDraft,
  type Teacher,
  type TeacherDraft
} from "@/lib/types";

const EMPTY_STATE: PlannerState = {
  careers: [],
  subjects: [],
  teachers: [],
  commissions: [],
  scheduleEntries: [],
  pendingScheduleEntries: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isVirtualTeacherId(value: string): boolean {
  return value === UNASSIGNED_TEACHER_ID;
}

export function validateCareerDraft(draft: CareerDraft): string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push("La carrera necesita un nombre.");
  }

  return errors;
}

export function validateTeacherDraft(draft: TeacherDraft): string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push("El profesor necesita un nombre.");
  }

  return errors;
}

export function validateSubjectDraft(draft: SubjectDraft): string[] {
  const errors: string[] = [];

  if (!draft.careerId.trim()) {
    errors.push("La asignatura necesita una carrera.");
  }

  if (!isPositiveInteger(draft.yearNumber)) {
    errors.push("El años de la asignatura debe ser mayor a cero.");
  }

  if (!draft.name.trim()) {
    errors.push("La asignatura necesita un nombre.");
  }

  return errors;
}

export function validateCommissionDraft(draft: CommissionDraft): string[] {
  const errors: string[] = [];

  if (!draft.careerId.trim()) {
    errors.push("La comision necesita una carrera.");
  }

  if (!isPositiveInteger(draft.yearNumber)) {
    errors.push("El años de la comision debe ser mayor a cero.");
  }

  if (!draft.label.trim()) {
    errors.push("La comision necesita una etiqueta.");
  }

  return errors;
}

export function validateScheduleEntryDraft(draft: ScheduleEntryDraft): string[] {
  const errors: string[] = [];

  if (!draft.commissionId.trim()) {
    errors.push("La entrada necesita una comision.");
  }

  if (!draft.subjectId.trim()) {
    errors.push("La entrada necesita una asignatura.");
  }

  if (!draft.teacherId.trim()) {
    errors.push("La entrada necesita un profesor.");
  }

  if (!DAY_OPTIONS.includes(draft.dayOfWeek)) {
    errors.push("El dia seleccionado no es valido.");
  }

  if (!isValidTimeValue(draft.startTime)) {
    errors.push("La hora de inicio no es valida.");
  }

  if (!isValidTimeValue(draft.endTime)) {
    errors.push("La hora de fin no es valida.");
  }

  if (
    isValidTimeValue(draft.startTime) &&
    isValidTimeValue(draft.endTime) &&
    compareTimes(draft.startTime, draft.endTime) >= 0
  ) {
    errors.push("La hora de fin debe ser posterior a la de inicio.");
  }

  return errors;
}

export function validatePendingScheduleEntryDraft(draft: PendingScheduleEntryDraft): string[] {
  const errors: string[] = [];

  if (!draft.commissionId.trim()) {
    errors.push("La entrada pendiente necesita una comision.");
  }

  if (!draft.subjectId.trim()) {
    errors.push("La entrada pendiente necesita una asignatura.");
  }

  if (!draft.teacherId.trim()) {
    errors.push("La entrada pendiente necesita un profesor.");
  }

  if (!isPositiveInteger(draft.durationMinutes)) {
    errors.push("La duracion del bloque pendiente debe ser mayor a cero.");
  }

  return errors;
}

function isCareer(value: unknown): value is Career {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    validateCareerDraft({ name: value.name }).length === 0
  );
}

function isTeacher(value: unknown): value is Teacher {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    validateTeacherDraft({ name: value.name }).length === 0
  );
}

function isSubject(value: unknown): value is Subject {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.careerId) &&
    isPositiveInteger(value.yearNumber) &&
    isNonEmptyString(value.name) &&
    (value.code === undefined || typeof value.code === "string") &&
    validateSubjectDraft({
      careerId: value.careerId,
      yearNumber: value.yearNumber,
      name: value.name,
      code: typeof value.code === "string" ? value.code : undefined
    }).length === 0
  );
}

function isCommission(value: unknown): value is Commission {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.careerId) &&
    isPositiveInteger(value.yearNumber) &&
    isNonEmptyString(value.label) &&
    validateCommissionDraft({
      careerId: value.careerId,
      yearNumber: value.yearNumber,
      label: value.label
    }).length === 0
  );
}

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.commissionId) &&
    isNonEmptyString(value.subjectId) &&
    isNonEmptyString(value.teacherId) &&
    typeof value.dayOfWeek === "string" &&
    DAY_OPTIONS.includes(value.dayOfWeek as (typeof DAY_OPTIONS)[number]) &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    validateScheduleEntryDraft({
      commissionId: value.commissionId,
      subjectId: value.subjectId,
      teacherId: value.teacherId,
      dayOfWeek: value.dayOfWeek as (typeof DAY_OPTIONS)[number],
      startTime: value.startTime,
      endTime: value.endTime
    }).length === 0
  );
}

function isPendingScheduleEntry(value: unknown): value is PendingScheduleEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.commissionId) &&
    isNonEmptyString(value.subjectId) &&
    isNonEmptyString(value.teacherId) &&
    isPositiveInteger(value.durationMinutes) &&
    validatePendingScheduleEntryDraft({
      commissionId: value.commissionId,
      subjectId: value.subjectId,
      teacherId: value.teacherId,
      durationMinutes: value.durationMinutes
    }).length === 0
  );
}

export function normalizePlannerState(input: unknown): PlannerState {
  if (!isRecord(input)) {
    return EMPTY_STATE;
  }

  const careers = Array.isArray(input.careers) ? input.careers.filter(isCareer) : [];
  const teachers = Array.isArray(input.teachers) ? input.teachers.filter(isTeacher) : [];
  const rawSubjects = Array.isArray(input.subjects) ? input.subjects.filter(isSubject) : [];
  const rawCommissions = Array.isArray(input.commissions)
    ? input.commissions.filter(isCommission)
    : [];
  const rawScheduleEntries = Array.isArray(input.scheduleEntries)
    ? input.scheduleEntries.filter(isScheduleEntry)
    : [];
  const rawPendingScheduleEntries = Array.isArray(input.pendingScheduleEntries)
    ? input.pendingScheduleEntries.filter(isPendingScheduleEntry)
    : [];

  const careerIds = new Set(careers.map((career) => career.id));
  const teacherIds = new Set([...teachers.map((teacher) => teacher.id), UNASSIGNED_TEACHER_ID]);

  const subjects = rawSubjects.filter((subject) => careerIds.has(subject.careerId));
  const commissions = rawCommissions.filter((commission) =>
    careerIds.has(commission.careerId)
  );

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const commissionById = new Map(commissions.map((commission) => [commission.id, commission]));

  const scheduleEntries = rawScheduleEntries.filter((entry) => {
    if (!teacherIds.has(entry.teacherId) && !isVirtualTeacherId(entry.teacherId)) {
      return false;
    }

    const commission = commissionById.get(entry.commissionId);
    const subject = subjectById.get(entry.subjectId);

    if (!commission || !subject) {
      return false;
    }

    return (
      commission.careerId === subject.careerId &&
      commission.yearNumber === subject.yearNumber
    );
  });

  const pendingScheduleEntries = rawPendingScheduleEntries.filter((entry) => {
    if (!teacherIds.has(entry.teacherId) && !isVirtualTeacherId(entry.teacherId)) {
      return false;
    }

    const commission = commissionById.get(entry.commissionId);
    const subject = subjectById.get(entry.subjectId);

    if (!commission || !subject) {
      return false;
    }

    return (
      commission.careerId === subject.careerId &&
      commission.yearNumber === subject.yearNumber
    );
  });

  return {
    careers,
    subjects,
    teachers,
    commissions,
    scheduleEntries,
    pendingScheduleEntries
  };
}
