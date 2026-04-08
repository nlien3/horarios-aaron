export const DAY_OPTIONS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday"
] as const;

export const UNASSIGNED_TEACHER_ID = "teacher-unassigned";
export const UNASSIGNED_TEACHER_LABEL = "Sin profesor";

export type DayOfWeek = (typeof DAY_OPTIONS)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miercoles",
  thursday: "Jueves",
  friday: "Viernes"
};

export type Career = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  careerId: string;
  yearNumber: number;
  name: string;
  code?: string;
};

export type Teacher = {
  id: string;
  name: string;
};

export type Commission = {
  id: string;
  careerId: string;
  yearNumber: number;
  label: string;
};

export type ScheduleEntry = {
  id: string;
  commissionId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type PendingScheduleEntry = {
  id: string;
  commissionId: string;
  subjectId: string;
  teacherId: string;
  durationMinutes: number;
};

export type PlannerState = {
  careers: Career[];
  subjects: Subject[];
  teachers: Teacher[];
  commissions: Commission[];
  scheduleEntries: ScheduleEntry[];
  pendingScheduleEntries: PendingScheduleEntry[];
};

export type CareerDraft = Omit<Career, "id">;
export type SubjectDraft = Omit<Subject, "id">;
export type TeacherDraft = Omit<Teacher, "id">;
export type CommissionDraft = Omit<Commission, "id">;
export type ScheduleEntryDraft = Omit<ScheduleEntry, "id">;
export type PendingScheduleEntryDraft = Omit<PendingScheduleEntry, "id">;

export type ScheduleConflict = {
  existingEntry: ScheduleEntry;
  scopes: {
    commission: boolean;
    teacher: boolean;
  };
  message: string;
};

export type MutationResult = {
  ok: boolean;
  errors: string[];
};

export type ScheduleMutationResult = MutationResult & {
  conflicts: ScheduleConflict[];
};
