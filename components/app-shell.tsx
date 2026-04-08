"use client";

import React from "react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode
} from "react";

import { CommissionCombobox } from "@/components/commission-combobox";
import { ScheduleBoard } from "@/components/schedule-board";
import { ScheduleGrid } from "@/components/schedule-grid";
import { TeacherCombobox } from "@/components/teacher-combobox";
import {
  createPlacedPendingScheduleEntryDraft,
  createMovedScheduleEntryDraft,
  getCommissionSubjects,
  getCommissionSchedule,
  getCommissionTitle,
  getPendingScheduleEntriesForCommission,
  getPendingScheduleEntriesForSubject,
  getPendingScheduleEntriesForTeacher,
  getSubjectSchedule,
  getTeacherSchedule,
  listPendingSubjectsForCommission
} from "@/lib/schedule";
import { usePlannerState } from "@/lib/use-planner-state";
import {
  DAY_LABELS,
  DAY_OPTIONS,
  UNASSIGNED_TEACHER_ID,
  UNASSIGNED_TEACHER_LABEL,
  type Career,
  type CareerDraft,
  type Commission,
  type CommissionDraft,
  type DayOfWeek,
  type MutationResult,
  type PendingScheduleEntryDraft,
  type PlannerState,
  type ScheduleConflict,
  type ScheduleEntry,
  type ScheduleEntryDraft,
  type ScheduleMutationResult,
  type Subject,
  type SubjectDraft,
  type Teacher,
  type TeacherDraft
} from "@/lib/types";

const TABS = [
  { id: "catalogs", label: "Catalogos", description: "Carreras, asignaturas y profesores" },
  { id: "commissions", label: "Comisiones", description: "Paralelos por carrera y año" },
  { id: "schedule", label: "Horarios", description: "Carga manual y vista semanal" }
] as const;

type TabId = (typeof TABS)[number]["id"];

type ScheduleFormState = {
  careerId: string;
  yearNumber: number;
  commissionId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

type PendingConflictState = {
  draft: ScheduleEntryDraft;
  editingId?: string;
  pendingEntryId?: string;
  conflicts: ScheduleConflict[];
  source: "form" | "move" | "modal" | "pending";
};

type QuickEditState = {
  entryId: string;
  draft: ScheduleEntryDraft;
};

type PanelProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

type EntityRowProps = {
  title: string;
  subtitle: string;
  meta?: string;
  onEdit: () => void;
  onDelete: () => void;
};

type MessageListProps = {
  tone: "error" | "warning" | "success";
  title: string;
  messages: string[];
  actions?: ReactNode;
};

type CatalogTabProps = {
  state: PlannerState;
  careersById: Map<string, Career>;
  onSaveCareer: (draft: CareerDraft, editingId?: string) => MutationResult;
  onSaveTeacher: (draft: TeacherDraft, editingId?: string) => MutationResult;
  onSaveSubject: (draft: SubjectDraft, editingId?: string) => MutationResult;
  onDeleteCareer: (careerId: string) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onDeleteSubject: (subjectId: string) => void;
};

type CommissionTabProps = {
  state: PlannerState;
  careersById: Map<string, Career>;
  onSaveCommission: (draft: CommissionDraft, editingId?: string) => MutationResult;
  onDeleteCommission: (commissionId: string) => void;
};

type ScheduleTabProps = {
  state: PlannerState;
  careersById: Map<string, Career>;
  subjectsById: Map<string, Subject>;
  teachersById: Map<string, Teacher>;
  commissionsById: Map<string, Commission>;
  careerNamesByCommissionId: Map<string, string>;
  onSaveScheduleEntry: (
    draft: ScheduleEntryDraft,
    options?: { editingId?: string; confirmConflicts?: boolean }
  ) => ScheduleMutationResult;
  onSavePendingScheduleEntry: (
    draft: PendingScheduleEntryDraft,
    editingId?: string
  ) => MutationResult;
  onDeleteScheduleEntry: (entryId: string) => void;
  onDeletePendingScheduleEntry: (entryId: string) => void;
};

const INPUT_CLASS =
  "mt-2 w-full rounded-[1rem] border border-[var(--stroke)] bg-white/80 px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[rgba(181,84,47,0.55)] focus:ring-2 focus:ring-[rgba(181,84,47,0.15)]";
const BUTTON_PRIMARY =
  "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(123,51,32,0.2)] transition hover:bg-[var(--accent-deep)]";
const BUTTON_SECONDARY =
  "rounded-full border border-[var(--stroke)] bg-white/75 px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-white";
const BUTTON_DANGER =
  "rounded-full border border-[rgba(123,51,32,0.24)] bg-[rgba(123,51,32,0.06)] px-4 py-2 text-sm font-semibold text-[var(--accent-deep)] transition hover:bg-[rgba(123,51,32,0.12)]";
const ICON_BUTTON =
  "rounded-full border border-[var(--stroke)] bg-white/75 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] transition hover:bg-white";

function buildTeacherOptions(teachers: Teacher[]): Teacher[] {
  return [...teachers, { id: UNASSIGNED_TEACHER_ID, name: UNASSIGNED_TEACHER_LABEL }];
}

function hasTeacherOption(teachers: Teacher[], teacherId: string): boolean {
  return teacherId === UNASSIGNED_TEACHER_ID || teachers.some((teacher) => teacher.id === teacherId);
}

function getYearsForCareer(state: PlannerState, careerId: string): number[] {
  const yearSet = new Set<number>();

  state.subjects.forEach((subject) => {
    if (subject.careerId === careerId) {
      yearSet.add(subject.yearNumber);
    }
  });

  state.commissions.forEach((commission) => {
    if (commission.careerId === careerId) {
      yearSet.add(commission.yearNumber);
    }
  });

  return [...yearSet].sort((left, right) => left - right);
}

function getCommissionsForSelection(
  state: PlannerState,
  careerId: string,
  yearNumber: number
): Commission[] {
  return state.commissions.filter(
    (commission) =>
      commission.careerId === careerId && commission.yearNumber === yearNumber
  );
}

function getSubjectsForSelection(
  state: PlannerState,
  careerId: string,
  yearNumber: number
): Subject[] {
  return state.subjects.filter(
    (subject) => subject.careerId === careerId && subject.yearNumber === yearNumber
  );
}

function buildScheduleFormState(
  state: PlannerState,
  current?: Partial<ScheduleFormState>
): ScheduleFormState {
  const availableCareerId =
    current?.careerId && state.careers.some((career) => career.id === current.careerId)
      ? current.careerId
      : state.careers[0]?.id ?? "";
  const availableYears = getYearsForCareer(state, availableCareerId);
  const yearNumber =
    current?.yearNumber && availableYears.includes(current.yearNumber)
      ? current.yearNumber
      : availableYears[0] ?? 1;
  const commissionOptions = getCommissionsForSelection(state, availableCareerId, yearNumber);
  const subjectOptions = getSubjectsForSelection(state, availableCareerId, yearNumber);
  const commissionId =
    current?.commissionId &&
    commissionOptions.some((commission) => commission.id === current.commissionId)
      ? current.commissionId
      : commissionOptions[0]?.id ?? "";
  const subjectId =
    current?.subjectId && subjectOptions.some((subject) => subject.id === current.subjectId)
      ? current.subjectId
      : subjectOptions[0]?.id ?? "";
  const teacherId =
    current?.teacherId && hasTeacherOption(state.teachers, current.teacherId)
      ? current.teacherId
      : state.teachers[0]?.id ?? UNASSIGNED_TEACHER_ID;
  const dayOfWeek =
    current?.dayOfWeek && DAY_OPTIONS.includes(current.dayOfWeek)
      ? current.dayOfWeek
      : "monday";

  return {
    careerId: availableCareerId,
    yearNumber,
    commissionId,
    subjectId,
    teacherId,
    dayOfWeek,
    startTime: current?.startTime ?? "08:00",
    endTime: current?.endTime ?? "10:00"
  };
}

function describeConflict(
  conflict: ScheduleConflict,
  subjectsById: Map<string, Subject>,
  teachersById: Map<string, Teacher>,
  commissionsById: Map<string, Commission>,
  careerNamesByCommissionId: Map<string, string>
): string {
  const subject = subjectsById.get(conflict.existingEntry.subjectId);
  const teacher = teachersById.get(conflict.existingEntry.teacherId);
  const commission = commissionsById.get(conflict.existingEntry.commissionId);
  const careerName =
    careerNamesByCommissionId.get(conflict.existingEntry.commissionId) ?? "Carrera";

  return `${conflict.message} ${subject?.name ?? "Asignatura"} · ${
    DAY_LABELS[conflict.existingEntry.dayOfWeek]
  } ${conflict.existingEntry.startTime}-${conflict.existingEntry.endTime} · ${
    teacher?.name ?? "Profesor"
  } · ${careerName} ${commission?.yearNumber ?? ""}${commission ? " año" : ""} ${
    commission?.label ?? ""
  }`;
}

function Panel({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = ""
}: PanelProps) {
  return (
    <section className={`glass-panel rounded-[2rem] p-6 ${className}`.trim()}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {eyebrow}
          </div>
          <h2 className="display-font mt-2 text-2xl font-semibold">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function MessageList({ tone, title, messages, actions }: MessageListProps) {
  const toneClasses =
    tone === "error"
      ? "border-[rgba(168,62,50,0.2)] bg-[rgba(168,62,50,0.08)] text-[rgb(124,40,31)]"
      : tone === "warning"
        ? "border-[rgba(181,84,47,0.2)] bg-[rgba(181,84,47,0.08)] text-[rgb(123,69,27)]"
        : "border-[rgba(31,122,81,0.18)] bg-[rgba(31,122,81,0.08)] text-[rgb(19,94,62)]";

  return (
    <div className={`mt-4 rounded-[1.2rem] border px-4 py-4 ${toneClasses}`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <ul className="mt-2 space-y-1 text-sm">
            {messages.map((message) => (
              <li key={message}>- {message}</li>
            ))}
          </ul>
        </div>
        {actions}
      </div>
    </div>
  );
}

function EntityRow({ title, subtitle, meta, onEdit, onDelete }: EntityRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1.2rem] border border-[var(--stroke)] bg-white/70 px-4 py-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-sm text-[var(--muted)]">{subtitle}</div>
        {meta ? <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{meta}</div> : null}
      </div>
      <div className="flex gap-2">
        <button className={ICON_BUTTON} type="button" onClick={onEdit}>
          Editar
        </button>
        <button className={ICON_BUTTON} type="button" onClick={onDelete}>
          Borrar
        </button>
      </div>
    </div>
  );
}

function CatalogTab({
  state,
  careersById,
  onSaveCareer,
  onSaveTeacher,
  onSaveSubject,
  onDeleteCareer,
  onDeleteTeacher,
  onDeleteSubject
}: CatalogTabProps) {
  const [careerDraft, setCareerDraft] = useState<CareerDraft>({ name: "" });
  const [teacherDraft, setTeacherDraft] = useState<TeacherDraft>({ name: "" });
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft>({
    careerId: state.careers[0]?.id ?? "",
    yearNumber: 1,
    name: "",
    code: ""
  });
  const [editingCareerId, setEditingCareerId] = useState<string>();
  const [editingTeacherId, setEditingTeacherId] = useState<string>();
  const [editingSubjectId, setEditingSubjectId] = useState<string>();
  const [careerErrors, setCareerErrors] = useState<string[]>([]);
  const [teacherErrors, setTeacherErrors] = useState<string[]>([]);
  const [subjectErrors, setSubjectErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!subjectDraft.careerId && state.careers[0]) {
      setSubjectDraft((current) => ({ ...current, careerId: state.careers[0]!.id }));
    }
  }, [state.careers, subjectDraft.careerId]);

  function handleCareerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSaveCareer(careerDraft, editingCareerId);

    if (!result.ok) {
      setCareerErrors(result.errors);
      return;
    }

    setCareerDraft({ name: "" });
    setEditingCareerId(undefined);
    setCareerErrors([]);
  }

  function handleTeacherSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSaveTeacher(teacherDraft, editingTeacherId);

    if (!result.ok) {
      setTeacherErrors(result.errors);
      return;
    }

    setTeacherDraft({ name: "" });
    setEditingTeacherId(undefined);
    setTeacherErrors([]);
  }

  function handleSubjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSaveSubject(subjectDraft, editingSubjectId);

    if (!result.ok) {
      setSubjectErrors(result.errors);
      return;
    }

    setSubjectDraft({
      careerId: subjectDraft.careerId || state.careers[0]?.id || "",
      yearNumber: subjectDraft.yearNumber,
      name: "",
      code: ""
    });
    setEditingSubjectId(undefined);
    setSubjectErrors([]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-6">
        <Panel
          eyebrow="Catalogo"
          title="Carreras"
          description="Cada carrera agrupa materias por año y luego se ramifica en varias comisiones."
        >
          <form className="space-y-4" onSubmit={handleCareerSubmit}>
            <label className="block text-sm font-medium">
              Nombre
              <input
                className={INPUT_CLASS}
                value={careerDraft.name}
                onChange={(event) =>
                  setCareerDraft({
                    name: event.target.value
                  })
                }
                placeholder="Ej. Analista de Sistemas"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button className={BUTTON_PRIMARY} type="submit">
                {editingCareerId ? "Guardar carrera" : "Agregar carrera"}
              </button>
              {editingCareerId ? (
                <button
                  className={BUTTON_SECONDARY}
                  type="button"
                  onClick={() => {
                    setCareerDraft({ name: "" });
                    setEditingCareerId(undefined);
                    setCareerErrors([]);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {careerErrors.length > 0 ? (
            <MessageList tone="error" title="No se pudo guardar la carrera" messages={careerErrors} />
          ) : null}

          <div className="mt-6 space-y-3">
            {state.careers.length > 0 ? (
              state.careers.map((career) => {
                const subjectCount = state.subjects.filter(
                  (subject) => subject.careerId === career.id
                ).length;
                const commissionCount = state.commissions.filter(
                  (commission) => commission.careerId === career.id
                ).length;

                return (
                  <EntityRow
                    key={career.id}
                    title={career.name}
                    subtitle={`${subjectCount} asignaturas · ${commissionCount} comisiones`}
                    meta="Se elimina en cascada con sus comisiones y horarios"
                    onEdit={() => {
                      setCareerDraft({ name: career.name });
                      setEditingCareerId(career.id);
                      setCareerErrors([]);
                    }}
                    onDelete={() => onDeleteCareer(career.id)}
                  />
                );
              })
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
                Crea al menos una carrera para empezar a cargar materias y comisiones.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Catalogo"
          title="Profesores"
          description="Un profesor puede aparecer en varias carreras o comisiones y el sistema advierte superposiciones."
        >
          <form className="space-y-4" onSubmit={handleTeacherSubmit}>
            <label className="block text-sm font-medium">
              Nombre
              <input
                className={INPUT_CLASS}
                value={teacherDraft.name}
                onChange={(event) =>
                  setTeacherDraft({
                    name: event.target.value
                  })
                }
                placeholder="Ej. Lic. Vega"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button className={BUTTON_PRIMARY} type="submit">
                {editingTeacherId ? "Guardar profesor" : "Agregar profesor"}
              </button>
              {editingTeacherId ? (
                <button
                  className={BUTTON_SECONDARY}
                  type="button"
                  onClick={() => {
                    setTeacherDraft({ name: "" });
                    setEditingTeacherId(undefined);
                    setTeacherErrors([]);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {teacherErrors.length > 0 ? (
            <MessageList tone="error" title="No se pudo guardar el profesor" messages={teacherErrors} />
          ) : null}

          <div className="mt-6 space-y-3">
            {state.teachers.length > 0 ? (
              state.teachers.map((teacher) => {
                const loadCount = state.scheduleEntries.filter(
                  (entry) => entry.teacherId === teacher.id
                ).length;

                return (
                  <EntityRow
                    key={teacher.id}
                    title={teacher.name}
                    subtitle={`${loadCount} bloques asignados`}
                    meta="Al borrar, tambien se quitan sus bloques horarios"
                    onEdit={() => {
                      setTeacherDraft({ name: teacher.name });
                      setEditingTeacherId(teacher.id);
                      setTeacherErrors([]);
                    }}
                    onDelete={() => onDeleteTeacher(teacher.id)}
                  />
                );
              })
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
                Carga algunos profesores para vincularlos a los bloques del horario.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Catalogo"
        title="Asignaturas"
        description="Cada asignatura queda atada a una carrera y un año. Luego se puede usar en varias comisiones de ese mismo año."
      >
        <form className="space-y-4" onSubmit={handleSubjectSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Carrera
              <select
                className={INPUT_CLASS}
                value={subjectDraft.careerId}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    careerId: event.target.value
                  }))
                }
              >
                <option value="">Selecciona una carrera</option>
                {state.careers.map((career) => (
                  <option key={career.id} value={career.id}>
                    {career.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Año
              <input
                className={INPUT_CLASS}
                type="number"
                min={1}
                value={subjectDraft.yearNumber}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    yearNumber: Number(event.target.value) || 1
                  }))
                }
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="block text-sm font-medium">
              Nombre
              <input
                className={INPUT_CLASS}
                value={subjectDraft.name}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                placeholder="Ej. Programacion I"
              />
            </label>

            <label className="block text-sm font-medium">
              Codigo
              <input
                className={INPUT_CLASS}
                value={subjectDraft.code ?? ""}
                onChange={(event) =>
                  setSubjectDraft((current) => ({
                    ...current,
                    code: event.target.value
                  }))
                }
                placeholder="ASI-101"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className={BUTTON_PRIMARY} type="submit">
              {editingSubjectId ? "Guardar asignatura" : "Agregar asignatura"}
            </button>
            {editingSubjectId ? (
              <button
                className={BUTTON_SECONDARY}
                type="button"
                onClick={() => {
                  setSubjectDraft({
                    careerId: state.careers[0]?.id ?? "",
                    yearNumber: 1,
                    name: "",
                    code: ""
                  });
                  setEditingSubjectId(undefined);
                  setSubjectErrors([]);
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {subjectErrors.length > 0 ? (
          <MessageList
            tone="error"
            title="No se pudo guardar la asignatura"
            messages={subjectErrors}
          />
        ) : null}

        <div className="mt-6 space-y-3">
          {state.subjects.length > 0 ? (
            state.subjects.map((subject) => {
              const blockCount = state.scheduleEntries.filter(
                (entry) => entry.subjectId === subject.id
              ).length;

              return (
                <EntityRow
                  key={subject.id}
                  title={subject.name}
                  subtitle={`${
                    careersById.get(subject.careerId)?.name ?? "Carrera"
                  } · ${subject.yearNumber} año`}
                  meta={`${subject.code ? `${subject.code} · ` : ""}${blockCount} bloques cargados`}
                  onEdit={() => {
                    setSubjectDraft({
                      careerId: subject.careerId,
                      yearNumber: subject.yearNumber,
                      name: subject.name,
                      code: subject.code ?? ""
                    });
                    setEditingSubjectId(subject.id);
                    setSubjectErrors([]);
                  }}
                  onDelete={() => onDeleteSubject(subject.id)}
                />
              );
            })
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
              Todavia no hay asignaturas. Este bloque se alimenta del catalogo y luego aparece en la carga de horarios.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function CommissionTab({
  state,
  careersById,
  onSaveCommission,
  onDeleteCommission
}: CommissionTabProps) {
  const [commissionDraft, setCommissionDraft] = useState<CommissionDraft>({
    careerId: state.careers[0]?.id ?? "",
    yearNumber: 1,
    label: ""
  });
  const [editingCommissionId, setEditingCommissionId] = useState<string>();
  const [commissionErrors, setCommissionErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!commissionDraft.careerId && state.careers[0]) {
      setCommissionDraft((current) => ({ ...current, careerId: state.careers[0]!.id }));
    }
  }, [commissionDraft.careerId, state.careers]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = onSaveCommission(commissionDraft, editingCommissionId);

    if (!result.ok) {
      setCommissionErrors(result.errors);
      return;
    }

    setCommissionDraft({
      careerId: commissionDraft.careerId || state.careers[0]?.id || "",
      yearNumber: commissionDraft.yearNumber,
      label: ""
    });
    setEditingCommissionId(undefined);
    setCommissionErrors([]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Panel
        eyebrow="Comisiones"
        title="Paralelos por carrera"
        description="Modela las comisiones desde el principio para reflejar que un mismo año puede tener profesores y horarios distintos."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Carrera
            <select
              className={INPUT_CLASS}
              value={commissionDraft.careerId}
              onChange={(event) =>
                setCommissionDraft((current) => ({
                  ...current,
                  careerId: event.target.value
                }))
              }
            >
              <option value="">Selecciona una carrera</option>
              {state.careers.map((career) => (
                <option key={career.id} value={career.id}>
                  {career.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Año
              <input
                className={INPUT_CLASS}
                type="number"
                min={1}
                value={commissionDraft.yearNumber}
                onChange={(event) =>
                  setCommissionDraft((current) => ({
                    ...current,
                    yearNumber: Number(event.target.value) || 1
                  }))
                }
              />
            </label>

            <label className="block text-sm font-medium">
              Etiqueta
              <input
                className={INPUT_CLASS}
                value={commissionDraft.label}
                onChange={(event) =>
                  setCommissionDraft((current) => ({
                    ...current,
                    label: event.target.value
                  }))
                }
                placeholder="1A"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className={BUTTON_PRIMARY} type="submit">
              {editingCommissionId ? "Guardar comision" : "Agregar comision"}
            </button>
            {editingCommissionId ? (
              <button
                className={BUTTON_SECONDARY}
                type="button"
                onClick={() => {
                  setCommissionDraft({
                    careerId: state.careers[0]?.id ?? "",
                    yearNumber: 1,
                    label: ""
                  });
                  setEditingCommissionId(undefined);
                  setCommissionErrors([]);
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {commissionErrors.length > 0 ? (
          <MessageList
            tone="error"
            title="No se pudo guardar la comision"
            messages={commissionErrors}
          />
        ) : null}
      </Panel>

      <Panel
        eyebrow="Comisiones"
        title="Mapa de comisiones"
        description="Desde aca puedes revisar cuantas materias pendientes tiene cada comision y cuantos bloques ya se cargaron."
      >
        <div className="space-y-3">
          {state.commissions.length > 0 ? (
            state.commissions.map((commission) => {
              const pendingSubjects = listPendingSubjectsForCommission(state, commission.id);
              const scheduledBlocks = getCommissionSchedule(state, commission.id);

              return (
                <EntityRow
                  key={commission.id}
                  title={`${careersById.get(commission.careerId)?.name ?? "Carrera"} · ${
                    commission.yearNumber
                  } año · Comision ${commission.label}`}
                  subtitle={`${scheduledBlocks.length} bloques cargados · ${pendingSubjects.length} materias pendientes`}
                  meta="Una comision representa un paralelo real del mismo año"
                  onEdit={() => {
                    setCommissionDraft({
                      careerId: commission.careerId,
                      yearNumber: commission.yearNumber,
                      label: commission.label
                    });
                    setEditingCommissionId(commission.id);
                    setCommissionErrors([]);
                  }}
                  onDelete={() => onDeleteCommission(commission.id)}
                />
              );
            })
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
              Todavia no hay comisiones. Crea al menos una para empezar a dibujar horarios.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ScheduleTab({
  state,
  careersById,
  subjectsById,
  teachersById,
  commissionsById,
  careerNamesByCommissionId,
  onSaveScheduleEntry,
  onSavePendingScheduleEntry,
  onDeleteScheduleEntry,
  onDeletePendingScheduleEntry
}: ScheduleTabProps) {
  const [formState, setFormState] = useState<ScheduleFormState>(() =>
    buildScheduleFormState(state)
  );
  const [editingEntryId, setEditingEntryId] = useState<string>();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formSuccessMessages, setFormSuccessMessages] = useState<string[]>([]);
  const [moveErrors, setMoveErrors] = useState<string[]>([]);
  const [modalErrors, setModalErrors] = useState<string[]>([]);
  const [pendingConflicts, setPendingConflicts] = useState<PendingConflictState | null>(null);
  const [viewMode, setViewMode] = useState<"commission" | "teacher" | "subject" | "board">(
    "commission"
  );
  const [viewerCommissionId, setViewerCommissionId] = useState<string>(
    state.commissions[0]?.id ?? ""
  );
  const [viewerTeacherId, setViewerTeacherId] = useState<string>(
    state.teachers[0]?.id ?? UNASSIGNED_TEACHER_ID
  );
  const [viewerSubjectId, setViewerSubjectId] = useState<string>(state.subjects[0]?.id ?? "");
  const [quickEditState, setQuickEditState] = useState<QuickEditState | null>(null);
  const teacherOptions = buildTeacherOptions(state.teachers);

  useEffect(() => {
    setFormState((current) => buildScheduleFormState(state, current));

    if (
      viewerCommissionId &&
      !state.commissions.some((commission) => commission.id === viewerCommissionId)
    ) {
      setViewerCommissionId(state.commissions[0]?.id ?? "");
    }

    if (viewerTeacherId && !hasTeacherOption(state.teachers, viewerTeacherId)) {
      setViewerTeacherId(state.teachers[0]?.id ?? UNASSIGNED_TEACHER_ID);
    }

    if (viewerSubjectId && !state.subjects.some((subject) => subject.id === viewerSubjectId)) {
      setViewerSubjectId(state.subjects[0]?.id ?? "");
    }
  }, [state, viewerCommissionId, viewerTeacherId, viewerSubjectId]);

  const availableYears = getYearsForCareer(state, formState.careerId);
  const commissionOptions = getCommissionsForSelection(
    state,
    formState.careerId,
    formState.yearNumber
  );
  const subjectOptions = getSubjectsForSelection(state, formState.careerId, formState.yearNumber);
  const visibleCommission = commissionsById.get(viewerCommissionId);
  const visibleCommissionOptions = state.commissions.map((commission) => ({
    id: commission.id,
    label: getCommissionTitle(
      commission,
      careersById.get(commission.careerId)?.name ?? "Carrera"
    )
  }));
  const visibleSubjectOptions = state.subjects.map((subject) => ({
    id: subject.id,
    label: `${subject.name} · ${careersById.get(subject.careerId)?.name ?? "Carrera"} · ${
      subject.yearNumber
    } año`
  }));
  const pendingSubjects = formState.commissionId
    ? listPendingSubjectsForCommission(state, formState.commissionId)
    : [];
  const visiblePendingEntries = visibleCommission
    ? getPendingScheduleEntriesForCommission(state, visibleCommission.id)
    : [];
  const visibleTeacherPendingEntries = viewerTeacherId
    ? getPendingScheduleEntriesForTeacher(state, viewerTeacherId)
    : [];
  const visibleSubjectPendingEntries = viewerSubjectId
    ? getPendingScheduleEntriesForSubject(state, viewerSubjectId)
    : [];
  const commissionSchedule = visibleCommission
    ? getCommissionSchedule(state, visibleCommission.id)
    : [];
  const teacherSchedule = viewerTeacherId ? getTeacherSchedule(state, viewerTeacherId) : [];
  const subjectSchedule = viewerSubjectId ? getSubjectSchedule(state, viewerSubjectId) : [];
  const deferredVisibleEntries = useDeferredValue(
    viewMode === "commission"
      ? commissionSchedule
      : viewMode === "teacher"
        ? teacherSchedule
        : viewMode === "subject"
          ? subjectSchedule
        : state.scheduleEntries
  );
  const deferredVisiblePendingEntries = useDeferredValue(
    viewMode === "commission"
      ? visiblePendingEntries
      : viewMode === "teacher"
        ? visibleTeacherPendingEntries
        : viewMode === "subject"
          ? visibleSubjectPendingEntries
        : []
  );

  function updateCareer(careerId: string) {
    const years = getYearsForCareer(state, careerId);
    const nextYear = years[0] ?? 1;

    setFormState((current) =>
      buildScheduleFormState(state, {
        ...current,
        careerId,
        yearNumber: nextYear
      })
    );
    setPendingConflicts(null);
    setFormErrors([]);
    setFormSuccessMessages([]);
    setModalErrors([]);
  }

  function updateYear(yearNumber: number) {
    setFormState((current) =>
      buildScheduleFormState(state, {
        ...current,
        yearNumber
      })
    );
    setPendingConflicts(null);
    setFormErrors([]);
    setFormSuccessMessages([]);
  }

  function resetScheduleForm() {
    setFormState((current) =>
      buildScheduleFormState(state, {
        careerId: current.careerId,
        yearNumber: current.yearNumber,
        teacherId: current.teacherId
      })
    );
    setEditingEntryId(undefined);
    setPendingConflicts(null);
    setFormErrors([]);
    setFormSuccessMessages([]);
    setMoveErrors([]);
    setModalErrors([]);
  }

  function getCurrentPendingDurationMinutes(): number {
    const startSegments = formState.startTime.split(":");
    const endSegments = formState.endTime.split(":");
    const startMinutes =
      Number(startSegments[0] ?? "0") * 60 + Number(startSegments[1] ?? "0");
    const endMinutes = Number(endSegments[0] ?? "0") * 60 + Number(endSegments[1] ?? "0");

    return endMinutes - startMinutes;
  }

  function commitScheduleDraft(
    draft: ScheduleEntryDraft,
    options: {
      source: "form" | "move" | "modal" | "pending";
      editingId?: string;
      pendingEntryId?: string;
      confirmConflicts?: boolean;
    }
  ) {
    const result = onSaveScheduleEntry(draft, {
      editingId: options.editingId,
      confirmConflicts: options.confirmConflicts
    });

    if (!result.ok) {
      setFormSuccessMessages([]);
      if (options.source === "form") {
        setFormErrors(result.errors);
      } else if (options.source === "move" || options.source === "pending") {
        setMoveErrors(result.errors);
      } else {
        setModalErrors(result.errors);
      }

      if (result.conflicts.length > 0) {
        setPendingConflicts({
          draft,
          editingId: options.editingId,
          pendingEntryId: options.pendingEntryId,
          conflicts: result.conflicts,
          source: options.source
        });
      } else {
        setPendingConflicts(null);
      }

      return false;
    }

    setPendingConflicts(null);
    setMoveErrors([]);
    setModalErrors([]);

    if (options.source === "form") {
      resetScheduleForm();
    } else if (options.source === "move") {
      setFormErrors([]);
    } else if (options.source === "pending") {
      setFormErrors([]);

      if (options.pendingEntryId) {
        onDeletePendingScheduleEntry(options.pendingEntryId);
      }
    } else {
      setQuickEditState(null);
    }

    return true;
  }

  function submitPendingEntry() {
    const durationMinutes = getCurrentPendingDurationMinutes();
    const result = onSavePendingScheduleEntry({
      commissionId: formState.commissionId,
      subjectId: formState.subjectId,
      teacherId: formState.teacherId,
      durationMinutes
    });

    if (!result.ok) {
      setFormErrors(result.errors);
      setFormSuccessMessages([]);
      return;
    }

    setViewerCommissionId(formState.commissionId);
    setViewerTeacherId(formState.teacherId);
    resetScheduleForm();
    setFormSuccessMessages([
      "El bloque quedo pendiente para ubicarlo despues desde la grilla."
    ]);
  }

  function submitSchedule(confirmConflicts = false) {
    setFormSuccessMessages([]);
    const draft: ScheduleEntryDraft = {
      commissionId: formState.commissionId,
      subjectId: formState.subjectId,
      teacherId: formState.teacherId,
      dayOfWeek: formState.dayOfWeek,
      startTime: formState.startTime,
      endTime: formState.endTime
    };

    commitScheduleDraft(draft, {
      source: "form",
      editingId: editingEntryId,
      confirmConflicts
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSchedule(false);
  }

  function handleEditEntry(entry: ScheduleEntry) {
    const commission = commissionsById.get(entry.commissionId);

    setFormState(
      buildScheduleFormState(state, {
        careerId: commission?.careerId,
        yearNumber: commission?.yearNumber,
        commissionId: entry.commissionId,
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime
      })
    );
    setEditingEntryId(entry.id);
    setPendingConflicts(null);
    setFormErrors([]);
    setFormSuccessMessages([]);
    setMoveErrors([]);
    setModalErrors([]);
  }

  function handleMoveEntryFromGrid(
    entryId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) {
    const entry = state.scheduleEntries.find((item) => item.id === entryId);

    if (!entry) {
      return;
    }

    const movedDraft = createMovedScheduleEntryDraft(entry, nextDay, nextStartMinutes);

    commitScheduleDraft(movedDraft, {
      source: "move",
      editingId: entry.id
    });
  }

  function handleMoveEntryFromBoard(
    entryId: string,
    nextCommissionId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) {
    const entry = state.scheduleEntries.find((item) => item.id === entryId);

    if (!entry) {
      return;
    }

    const movedDraft = {
      ...createMovedScheduleEntryDraft(entry, nextDay, nextStartMinutes),
      commissionId: nextCommissionId
    };

    commitScheduleDraft(movedDraft, {
      source: "move",
      editingId: entry.id
    });
  }

  function handlePlacePendingEntryFromGrid(
    pendingEntryId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) {
    const entry = state.pendingScheduleEntries.find((item) => item.id === pendingEntryId);

    if (!entry) {
      return;
    }

    const placedDraft = createPlacedPendingScheduleEntryDraft(entry, nextDay, nextStartMinutes);

    commitScheduleDraft(placedDraft, {
      source: "pending",
      pendingEntryId: entry.id
    });
  }

  function handlePlacePendingEntryFromBoard(
    pendingEntryId: string,
    nextCommissionId: string,
    nextDay: DayOfWeek,
    nextStartMinutes: number
  ) {
    const entry = state.pendingScheduleEntries.find((item) => item.id === pendingEntryId);

    if (!entry) {
      return;
    }

    const placedDraft = {
      ...createPlacedPendingScheduleEntryDraft(entry, nextDay, nextStartMinutes),
      commissionId: nextCommissionId
    };

    commitScheduleDraft(placedDraft, {
      source: "pending",
      pendingEntryId: entry.id
    });
  }

  function confirmPendingConflict() {
    if (!pendingConflicts) {
      return;
    }

    commitScheduleDraft(pendingConflicts.draft, {
      source: pendingConflicts.source,
      editingId: pendingConflicts.editingId,
      pendingEntryId: pendingConflicts.pendingEntryId,
      confirmConflicts: true
    });
  }

  function openQuickEdit(entry: ScheduleEntry) {
    setQuickEditState({
      entryId: entry.id,
      draft: {
        commissionId: entry.commissionId,
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime
      }
    });
    setPendingConflicts((current) => (current?.source === "modal" ? null : current));
    setModalErrors([]);
  }

  function closeQuickEdit() {
    setQuickEditState(null);
    setModalErrors([]);
    setPendingConflicts((current) => (current?.source === "modal" ? null : current));
  }

  function submitQuickEdit(confirmConflicts = false) {
    if (!quickEditState) {
      return;
    }

    commitScheduleDraft(quickEditState.draft, {
      source: "modal",
      editingId: quickEditState.entryId,
      confirmConflicts
    });
  }

  const commissionTitle = visibleCommission
    ? getCommissionTitle(
        visibleCommission,
        careersById.get(visibleCommission.careerId)?.name ?? "Carrera"
      )
    : "Selecciona una comision";
  const commissionSubtitle = visibleCommission
    ? "Bloques agrupados por dia y hora para esta comision."
    : "Elige una comision para ver su agenda semanal.";
  const teacherTitle = viewerTeacherId
    ? teachersById.get(viewerTeacherId)?.name ?? "Profesor"
    : "Selecciona un profesor";
  const teacherSubtitle = viewerTeacherId
    ? "Vista transversal del profesor para detectar cruces entre comisiones."
    : "Elige un profesor para ver su agenda semanal.";
  const subjectTitle = viewerSubjectId
    ? subjectsById.get(viewerSubjectId)?.name ?? "Materia"
    : "Selecciona una materia";
  const subjectSubtitle = viewerSubjectId
    ? "Vista transversal de la materia para revisar en que comisiones y horarios aparece."
    : "Elige una materia para ver sus bloques en la semana.";
  const moveNotice =
    pendingConflicts?.source === "move" || pendingConflicts?.source === "pending" ? (
      <MessageList
        tone="warning"
        title={
          pendingConflicts.source === "pending"
            ? "Hay superposiciones al ubicar el pendiente"
            : "Hay superposiciones en el movimiento"
        }
        messages={pendingConflicts.conflicts.map((conflict) =>
          describeConflict(
            conflict,
            subjectsById,
            teachersById,
            commissionsById,
            careerNamesByCommissionId
          )
        )}
        actions={
          <button className={BUTTON_PRIMARY} type="button" onClick={confirmPendingConflict}>
            {pendingConflicts.source === "pending" ? "Agregar igual" : "Mover igual"}
          </button>
        }
      />
    ) : moveErrors.length > 0 ? (
      <MessageList
        tone="error"
        title="No se pudo mover el bloque"
        messages={moveErrors}
      />
    ) : null;
  const quickEditEntry = quickEditState
    ? state.scheduleEntries.find((entry) => entry.id === quickEditState.entryId)
    : undefined;
  const quickEditCommission = quickEditState
    ? commissionsById.get(quickEditState.draft.commissionId)
    : undefined;
  const quickEditSubjectOptions =
    quickEditState && quickEditCommission
      ? getCommissionSubjects(state, quickEditCommission.id)
      : [];
  const modalConflictNotice =
    pendingConflicts?.source === "modal" ? (
      <MessageList
        tone="warning"
        title="Hay superposiciones en esta edicion"
        messages={pendingConflicts.conflicts.map((conflict) =>
          describeConflict(
            conflict,
            subjectsById,
            teachersById,
            commissionsById,
            careerNamesByCommissionId
          )
        )}
        actions={
          <button className={BUTTON_PRIMARY} type="button" onClick={() => submitQuickEdit(true)}>
            Guardar igual
          </button>
        }
      />
    ) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <Panel
          eyebrow="Horarios"
          title={editingEntryId ? "Editar bloque semanal" : "Nuevo bloque semanal"}
          description="Carga manual por carrera, año y comision. Si hay un cruce, el sistema avisa y puedes guardar igual."
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Carrera
                <select
                  className={INPUT_CLASS}
                  value={formState.careerId}
                  onChange={(event) => updateCareer(event.target.value)}
                >
                  <option value="">Selecciona una carrera</option>
                  {state.careers.map((career) => (
                    <option key={career.id} value={career.id}>
                      {career.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Año
                <select
                  className={INPUT_CLASS}
                  value={formState.yearNumber}
                  onChange={(event) => updateYear(Number(event.target.value))}
                >
                  {availableYears.length > 0 ? (
                    availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year} año
                      </option>
                    ))
                  ) : (
                    <option value={1}>Sin años disponibles</option>
                  )}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Comision
                <select
                  className={INPUT_CLASS}
                  value={formState.commissionId}
                  onChange={(event) =>
                    setFormState((current) =>
                      buildScheduleFormState(state, {
                        ...current,
                        commissionId: event.target.value
                      })
                    )
                  }
                >
                  <option value="">Selecciona una comision</option>
                  {commissionOptions.map((commission) => (
                    <option key={commission.id} value={commission.id}>
                      {commission.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Asignatura
                <select
                  className={INPUT_CLASS}
                  value={formState.subjectId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      subjectId: event.target.value
                    }))
                  }
                >
                  <option value="">Selecciona una asignatura</option>
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium">
              Profesor
              <select
                className={INPUT_CLASS}
                value={formState.teacherId}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    teacherId: event.target.value
                  }))
                }
              >
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium">
                Dia
                <select
                  className={INPUT_CLASS}
                  value={formState.dayOfWeek}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      dayOfWeek: event.target.value as DayOfWeek
                    }))
                  }
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {DAY_LABELS[day]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Desde
                <input
                  className={INPUT_CLASS}
                  max="22:00"
                  min="08:00"
                  step={60}
                  type="time"
                  value={formState.startTime}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      startTime: event.target.value
                    }))
                  }
                />
              </label>

              <label className="block text-sm font-medium">
                Hasta
                <input
                  className={INPUT_CLASS}
                  max="22:00"
                  min="08:00"
                  step={60}
                  type="time"
                  value={formState.endTime}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      endTime: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            {!editingEntryId ? (
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Si no sabes el dia y la hora todavia, puedes dejar este bloque como pendiente.
                Se usara la duracion actual del tramo para ubicarlo luego con drag and drop.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button className={BUTTON_PRIMARY} type="submit">
                {editingEntryId ? "Guardar bloque" : "Agregar bloque"}
              </button>
              {!editingEntryId ? (
                <button
                  className={BUTTON_SECONDARY}
                  type="button"
                  onClick={submitPendingEntry}
                >
                  Dejar pendiente
                </button>
              ) : null}
              {(editingEntryId || pendingConflicts?.source === "form") ? (
                <button className={BUTTON_SECONDARY} type="button" onClick={resetScheduleForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          {formErrors.length > 0 ? (
            <MessageList tone="error" title="No se pudo guardar el bloque" messages={formErrors} />
          ) : null}

          {formSuccessMessages.length > 0 ? (
            <MessageList
              tone="success"
              title="Bloque pendiente guardado"
              messages={formSuccessMessages}
            />
          ) : null}

          {pendingConflicts?.source === "form" ? (
            <MessageList
              tone="warning"
              title="Hay superposiciones detectadas"
              messages={pendingConflicts.conflicts.map((conflict) =>
                describeConflict(
                  conflict,
                  subjectsById,
                  teachersById,
                  commissionsById,
                  careerNamesByCommissionId
                )
              )}
              actions={
                <button
                  className={BUTTON_PRIMARY}
                  type="button"
                  onClick={confirmPendingConflict}
                >
                  Guardar igual
                </button>
              }
            />
          ) : null}

          <div className="mt-6 rounded-[1.2rem] border border-[var(--stroke)] bg-white/62 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Materias pendientes de la comision
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingSubjects.length > 0 ? (
                pendingSubjects.map((subject) => (
                  <span
                    key={subject.id}
                    className="rounded-full border border-[rgba(31,122,81,0.18)] bg-[rgba(31,122,81,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(19,94,62)]"
                  >
                    {subject.name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--muted)]">
                  Todas las materias de esta comision ya tienen al menos un bloque cargado.
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {commissionSchedule.length > 0 ? (
              commissionSchedule.map((entry) => {
                const subject = subjectsById.get(entry.subjectId);
                const teacher = teachersById.get(entry.teacherId);

                return (
                  <EntityRow
                    key={entry.id}
                    title={`${subject?.name ?? "Asignatura"} · ${DAY_LABELS[entry.dayOfWeek]}`}
                    subtitle={`${entry.startTime}-${entry.endTime} · ${teacher?.name ?? "Profesor"}`}
                    meta="Lista rapida de bloques de la comision seleccionada"
                    onEdit={() => handleEditEntry(entry)}
                    onDelete={() => onDeleteScheduleEntry(entry.id)}
                  />
                );
              })
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--stroke)] px-4 py-6 text-sm text-[var(--muted)]">
                Esta comision todavia no tiene bloques cargados.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel
          className="relative z-30"
          eyebrow="Consulta"
          title="Vistas de horario"
          description="Alterna entre la agenda de una comision, la agenda de un profesor y el tablero general."
        >
          <div className="flex flex-wrap gap-3">
            <button
              className={viewMode === "commission" ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              type="button"
              onClick={() => {
                setViewMode("commission");
                setPendingConflicts((current) => (current?.source === "move" ? null : current));
                setMoveErrors([]);
              }}
            >
              Por comision
            </button>
            <button
              className={viewMode === "teacher" ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              type="button"
              onClick={() => {
                setViewMode("teacher");
                setPendingConflicts((current) => (current?.source === "move" ? null : current));
                setMoveErrors([]);
              }}
            >
              Por profesor
            </button>
            <button
              className={viewMode === "subject" ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              type="button"
              onClick={() => {
                setViewMode("subject");
                setPendingConflicts((current) => (current?.source === "move" ? null : current));
                setMoveErrors([]);
              }}
            >
              Por materia
            </button>
            <button
              className={viewMode === "board" ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              type="button"
              onClick={() => {
                setViewMode("board");
                setPendingConflicts((current) => (current?.source === "move" ? null : current));
                setMoveErrors([]);
              }}
            >
              Tablero general
            </button>
          </div>

          {viewMode === "teacher" ? (
            <div className="mt-4 max-w-md">
              <TeacherCombobox
                emptyMessage="No hay profesores que coincidan con la busqueda."
                inputClassName={INPUT_CLASS}
                label="Profesor visible"
                onChange={setViewerTeacherId}
                placeholder="Busca un profesor por nombre"
                teachers={teacherOptions}
                value={viewerTeacherId}
              />
            </div>
          ) : viewMode === "subject" ? (
            <div className="mt-4 max-w-2xl">
              <CommissionCombobox
                emptyMessage="No hay materias que coincidan con la busqueda."
                inputClassName={INPUT_CLASS}
                label="Materia visible"
                onChange={setViewerSubjectId}
                options={visibleSubjectOptions}
                placeholder="Busca una materia por nombre, carrera o año"
                value={viewerSubjectId}
              />
            </div>
          ) : viewMode === "commission" ? (
            <div className="mt-4 max-w-2xl">
              <CommissionCombobox
                emptyMessage="No hay comisiones que coincidan con la busqueda."
                inputClassName={INPUT_CLASS}
                label="Comision visible"
                onChange={(commissionId) => {
                  setViewerCommissionId(commissionId);
                  setPendingConflicts((current) =>
                    current?.source === "move" ? null : current
                  );
                  setMoveErrors([]);
                }}
                options={visibleCommissionOptions}
                placeholder="Busca una comision por carrera, año o etiqueta"
                value={viewerCommissionId}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-[1.2rem] border border-[var(--stroke)] bg-white/62 px-4 py-4 text-sm text-[var(--muted)]">
              Vista global de todas las comisiones. Usa el zoom del tablero para agrandar o
              achicar el contenido y arrastra bloques entre filas para moverlos de comision.
            </div>
          )}
        </Panel>

        {moveNotice ? <div className="sticky top-4 z-40">{moveNotice}</div> : null}

        {viewMode === "board" ? (
          <ScheduleBoard
            careersById={careersById}
            commissions={state.commissions}
            entries={deferredVisibleEntries}
            onDeletePendingEntry={onDeletePendingScheduleEntry}
            onMoveEntry={handleMoveEntryFromBoard}
            onPlacePendingEntry={handlePlacePendingEntryFromBoard}
            onEditEntry={openQuickEdit}
            pendingEntries={state.pendingScheduleEntries}
            subjectsById={subjectsById}
            teachersById={teachersById}
          />
        ) : (
          <ScheduleGrid
            entries={deferredVisibleEntries}
            commissionsById={commissionsById}
            subjectsById={subjectsById}
            teachersById={teachersById}
            careerNamesByCommissionId={careerNamesByCommissionId}
            mode={viewMode}
            onEditEntry={openQuickEdit}
            onDeletePendingEntry={onDeletePendingScheduleEntry}
            onMoveEntry={viewMode === "commission" ? handleMoveEntryFromGrid : undefined}
            onPlacePendingEntry={
              viewMode === "commission" ? handlePlacePendingEntryFromGrid : undefined
            }
            pendingEntries={deferredVisiblePendingEntries}
            title={
              viewMode === "commission"
                ? commissionTitle
                : viewMode === "teacher"
                  ? teacherTitle
                  : subjectTitle
            }
            subtitle={
              viewMode === "commission"
                ? commissionSubtitle
                : viewMode === "teacher"
                  ? teacherSubtitle
                  : subjectSubtitle
            }
          />
        )}
      </div>

      {quickEditState && quickEditEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(36,23,13,0.24)] p-6">
          <div
            aria-modal="true"
            className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Edicion rapida
                </div>
                <h3 className="display-font mt-2 text-2xl font-semibold">
                  Editar bloque desde la grilla
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {subjectsById.get(quickEditEntry.subjectId)?.name ?? "Asignatura"} ·{" "}
                  {careerNamesByCommissionId.get(quickEditEntry.commissionId) ?? "Carrera"} ·{" "}
                  Comision {quickEditCommission?.label ?? ""}
                </p>
              </div>
              <button className={BUTTON_SECONDARY} onClick={closeQuickEdit} type="button">
                Cerrar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Asignatura
                <select
                  className={INPUT_CLASS}
                  value={quickEditState.draft.subjectId}
                  onChange={(event) =>
                    setQuickEditState((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              subjectId: event.target.value
                            }
                          }
                        : current
                    )
                  }
                >
                  {quickEditSubjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Profesor
                <select
                  className={INPUT_CLASS}
                  value={quickEditState.draft.teacherId}
                  onChange={(event) =>
                    setQuickEditState((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              teacherId: event.target.value
                            }
                          }
                        : current
                    )
                  }
                >
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium">
                Dia
                <select
                  className={INPUT_CLASS}
                  value={quickEditState.draft.dayOfWeek}
                  onChange={(event) =>
                    setQuickEditState((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              dayOfWeek: event.target.value as DayOfWeek
                            }
                          }
                        : current
                    )
                  }
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>
                      {DAY_LABELS[day]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Desde
                <input
                  className={INPUT_CLASS}
                  max="22:00"
                  min="08:00"
                  step={60}
                  type="time"
                  value={quickEditState.draft.startTime}
                  onChange={(event) =>
                    setQuickEditState((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              startTime: event.target.value
                            }
                          }
                        : current
                    )
                  }
                />
              </label>

              <label className="block text-sm font-medium">
                Hasta
                <input
                  className={INPUT_CLASS}
                  max="22:00"
                  min="08:00"
                  step={60}
                  type="time"
                  value={quickEditState.draft.endTime}
                  onChange={(event) =>
                    setQuickEditState((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              endTime: event.target.value
                            }
                          }
                        : current
                    )
                  }
                />
              </label>
            </div>

            {modalErrors.length > 0 ? (
              <MessageList
                tone="error"
                title="No se pudo guardar esta edicion"
                messages={modalErrors}
              />
            ) : null}

            {modalConflictNotice}

            <div className="mt-6 flex flex-wrap gap-3">
              <button className={BUTTON_PRIMARY} onClick={() => submitQuickEdit(false)} type="button">
                Guardar cambios
              </button>
              <button className={BUTTON_SECONDARY} onClick={closeQuickEdit} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const {
    state,
    hydrated,
    upsertCareer,
    upsertTeacher,
    upsertSubject,
    upsertCommission,
    upsertScheduleEntry,
    upsertPendingScheduleEntry,
    deleteCareer,
    deleteTeacher,
    deleteSubject,
    deleteCommission,
    deleteScheduleEntry,
    deletePendingScheduleEntry,
    resetToSeedData
  } = usePlannerState();
  const [activeTab, setActiveTab] = useState<TabId>("catalogs");

  const careersById = new Map(state.careers.map((career) => [career.id, career]));
  const subjectsById = new Map(state.subjects.map((subject) => [subject.id, subject]));
  const teachersById = new Map(
    buildTeacherOptions(state.teachers).map((teacher) => [teacher.id, teacher])
  );
  const commissionsById = new Map(
    state.commissions.map((commission) => [commission.id, commission])
  );
  const careerNamesByCommissionId = new Map(
    state.commissions.map((commission) => [
      commission.id,
      careersById.get(commission.careerId)?.name ?? "Carrera"
    ])
  );
  const shellWidthClass = activeTab === "schedule" ? "max-w-none" : "max-w-[1600px]";

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className={`mx-auto space-y-6 ${shellWidthClass}`.trim()}>
        <section className="glass-panel rounded-[2.5rem] px-8 py-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
                ASC Horarios MVP
              </div>
              <h1 className="display-font mt-3 text-4xl font-semibold lg:text-5xl">
                Estructura rapida para carreras, comisiones y profesores.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                Esta primera version funciona completa en el navegador: carga catalogos,
                arma comisiones, detecta cruces y deja lista la base para una futura
                generacion automatica de horarios.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[var(--stroke)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                {hydrated ? "Guardado local activo" : "Sincronizando datos"}
              </div>
              <button
                className={BUTTON_DANGER}
                type="button"
                onClick={() => {
                  if (window.confirm("Esto reemplaza los datos locales por el demo inicial.")) {
                    resetToSeedData();
                  }
                }}
              >
                Restaurar demo
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.6rem] border border-[var(--stroke)] bg-white/75 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Carreras
              </div>
              <div className="display-font mt-2 text-4xl font-semibold">
                {state.careers.length}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--stroke)] bg-white/75 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Comisiones
              </div>
              <div className="display-font mt-2 text-4xl font-semibold">
                {state.commissions.length}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--stroke)] bg-white/75 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Profesores
              </div>
              <div className="display-font mt-2 text-4xl font-semibold">
                {state.teachers.length}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--stroke)] bg-white/75 px-5 py-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Bloques
              </div>
              <div className="display-font mt-2 text-4xl font-semibold">
                {state.scheduleEntries.length}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? BUTTON_PRIMARY : BUTTON_SECONDARY}
              type="button"
              onClick={() => {
                startTransition(() => {
                  setActiveTab(tab.id);
                });
              }}
            >
              {tab.label}
            </button>
          ))}
        </section>

        <div className="text-sm text-[var(--muted)]">
          {TABS.find((tab) => tab.id === activeTab)?.description}
        </div>

        {activeTab === "catalogs" ? (
          <CatalogTab
            state={state}
            careersById={careersById}
            onSaveCareer={upsertCareer}
            onSaveTeacher={upsertTeacher}
            onSaveSubject={upsertSubject}
            onDeleteCareer={deleteCareer}
            onDeleteTeacher={deleteTeacher}
            onDeleteSubject={deleteSubject}
          />
        ) : null}

        {activeTab === "commissions" ? (
          <CommissionTab
            state={state}
            careersById={careersById}
            onSaveCommission={upsertCommission}
            onDeleteCommission={deleteCommission}
          />
        ) : null}

        {activeTab === "schedule" ? (
          <ScheduleTab
            state={state}
            careersById={careersById}
            subjectsById={subjectsById}
            teachersById={teachersById}
            commissionsById={commissionsById}
            careerNamesByCommissionId={careerNamesByCommissionId}
            onSaveScheduleEntry={upsertScheduleEntry}
            onSavePendingScheduleEntry={upsertPendingScheduleEntry}
            onDeleteScheduleEntry={deleteScheduleEntry}
            onDeletePendingScheduleEntry={deletePendingScheduleEntry}
          />
        ) : null}
      </div>
    </main>
  );
}
