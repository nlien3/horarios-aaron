"use client";

import { useEffect, useState } from "react";

import { detectScheduleConflicts } from "@/lib/schedule";
import { createSeedState } from "@/lib/seeds";
import { loadPlannerState, savePlannerState } from "@/lib/storage";
import {
  validateCareerDraft,
  validateCommissionDraft,
  validatePendingScheduleEntryDraft,
  validateScheduleEntryDraft,
  validateSubjectDraft,
  validateTeacherDraft
} from "@/lib/validation";
import { createId, sortByLabel } from "@/lib/utils";
import { DAY_OPTIONS, UNASSIGNED_TEACHER_ID } from "@/lib/types";
import type {
  Career,
  CareerDraft,
  Commission,
  CommissionDraft,
  MutationResult,
  PendingScheduleEntry,
  PendingScheduleEntryDraft,
  PlannerState,
  ScheduleEntry,
  ScheduleEntryDraft,
  ScheduleMutationResult,
  Subject,
  SubjectDraft,
  Teacher,
  TeacherDraft
} from "@/lib/types";

function replaceOrAppend<T extends { id: string }>(items: T[], candidate: T): T[] {
  const index = items.findIndex((item) => item.id === candidate.id);

  if (index === -1) {
    return [...items, candidate];
  }

  return items.map((item) => (item.id === candidate.id ? candidate : item));
}

function normalizeCareerDraft(draft: CareerDraft): CareerDraft {
  return {
    name: draft.name.trim()
  };
}

function normalizeTeacherDraft(draft: TeacherDraft): TeacherDraft {
  return {
    name: draft.name.trim()
  };
}

function normalizeSubjectDraft(draft: SubjectDraft): SubjectDraft {
  return {
    careerId: draft.careerId,
    yearNumber: draft.yearNumber,
    name: draft.name.trim(),
    code: draft.code?.trim() || undefined
  };
}

function normalizeCommissionDraft(draft: CommissionDraft): CommissionDraft {
  return {
    careerId: draft.careerId,
    yearNumber: draft.yearNumber,
    label: draft.label.trim().toUpperCase()
  };
}

function normalizeScheduleDraft(draft: ScheduleEntryDraft): ScheduleEntryDraft {
  return {
    ...draft,
    startTime: draft.startTime,
    endTime: draft.endTime
  };
}

function normalizePendingScheduleDraft(
  draft: PendingScheduleEntryDraft
): PendingScheduleEntryDraft {
  return {
    ...draft,
    durationMinutes: Math.round(draft.durationMinutes)
  };
}

function hasKnownTeacherId(state: PlannerState, teacherId: string): boolean {
  return teacherId === UNASSIGNED_TEACHER_ID || state.teachers.some((item) => item.id === teacherId);
}

function successResult(): MutationResult {
  return {
    ok: true,
    errors: []
  };
}

function failureResult(errors: string[]): MutationResult {
  return {
    ok: false,
    errors
  };
}

function scheduleFailure(errors: string[], conflicts: ScheduleMutationResult["conflicts"] = []) {
  return {
    ok: false,
    errors,
    conflicts
  };
}

function scheduleSuccess(): ScheduleMutationResult {
  return {
    ok: true,
    errors: [],
    conflicts: []
  };
}

export function usePlannerState() {
  const [state, setState] = useState<PlannerState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadPlannerState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    savePlannerState(state);
  }, [state, hydrated]);

  function upsertCareer(draft: CareerDraft, editingId?: string): MutationResult {
    const normalizedDraft = normalizeCareerDraft(draft);
    const errors = validateCareerDraft(normalizedDraft);

    if (errors.length > 0) {
      return failureResult(errors);
    }

    const candidate: Career = {
      id: editingId ?? createId("career"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      careers: sortByLabel(replaceOrAppend(previousState.careers, candidate), (career) => career.name)
    }));

    return successResult();
  }

  function upsertTeacher(draft: TeacherDraft, editingId?: string): MutationResult {
    const normalizedDraft = normalizeTeacherDraft(draft);
    const errors = validateTeacherDraft(normalizedDraft);

    if (errors.length > 0) {
      return failureResult(errors);
    }

    const candidate: Teacher = {
      id: editingId ?? createId("teacher"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      teachers: sortByLabel(
        replaceOrAppend(previousState.teachers, candidate),
        (teacher) => teacher.name
      )
    }));

    return successResult();
  }

  function upsertSubject(draft: SubjectDraft, editingId?: string): MutationResult {
    const normalizedDraft = normalizeSubjectDraft(draft);
    const errors = validateSubjectDraft(normalizedDraft);

    if (!state.careers.some((career) => career.id === normalizedDraft.careerId)) {
      errors.push("La carrera seleccionada no existe.");
    }

    if (errors.length > 0) {
      return failureResult(errors);
    }

    const candidate: Subject = {
      id: editingId ?? createId("subject"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      subjects: [...replaceOrAppend(previousState.subjects, candidate)].sort((left, right) => {
        const leftCareer = previousState.careers.find((career) => career.id === left.careerId)?.name ?? "";
        const rightCareer =
          previousState.careers.find((career) => career.id === right.careerId)?.name ?? "";

        return (
          leftCareer.localeCompare(rightCareer, "es") ||
          left.yearNumber - right.yearNumber ||
          left.name.localeCompare(right.name, "es")
        );
      })
    }));

    return successResult();
  }

  function upsertCommission(draft: CommissionDraft, editingId?: string): MutationResult {
    const normalizedDraft = normalizeCommissionDraft(draft);
    const errors = validateCommissionDraft(normalizedDraft);

    if (!state.careers.some((career) => career.id === normalizedDraft.careerId)) {
      errors.push("La carrera seleccionada no existe.");
    }

    const duplicate = state.commissions.find(
      (commission) =>
        commission.id !== editingId &&
        commission.careerId === normalizedDraft.careerId &&
        commission.yearNumber === normalizedDraft.yearNumber &&
        commission.label.toLowerCase() === normalizedDraft.label.toLowerCase()
    );

    if (duplicate) {
      errors.push("Ya existe una comision con ese nombre en el mismo años.");
    }

    if (errors.length > 0) {
      return failureResult(errors);
    }

    const candidate: Commission = {
      id: editingId ?? createId("commission"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      commissions: [...replaceOrAppend(previousState.commissions, candidate)].sort(
        (left, right) => {
          const leftCareer =
            previousState.careers.find((career) => career.id === left.careerId)?.name ?? "";
          const rightCareer =
            previousState.careers.find((career) => career.id === right.careerId)?.name ?? "";

          return (
            leftCareer.localeCompare(rightCareer, "es") ||
            left.yearNumber - right.yearNumber ||
            left.label.localeCompare(right.label, "es")
          );
        }
      )
    }));

    return successResult();
  }

  function upsertScheduleEntry(
    draft: ScheduleEntryDraft,
    options?: { editingId?: string; confirmConflicts?: boolean }
  ): ScheduleMutationResult {
    const normalizedDraft = normalizeScheduleDraft(draft);
    const errors = validateScheduleEntryDraft(normalizedDraft);
    const commission = state.commissions.find(
      (item) => item.id === normalizedDraft.commissionId
    );
    const subject = state.subjects.find((item) => item.id === normalizedDraft.subjectId);

    if (!commission) {
      errors.push("La comision seleccionada no existe.");
    }

    if (!subject) {
      errors.push("La asignatura seleccionada no existe.");
    }

    if (!hasKnownTeacherId(state, normalizedDraft.teacherId)) {
      errors.push("El profesor seleccionado no existe.");
    }

    if (
      commission &&
      subject &&
      (commission.careerId !== subject.careerId ||
        commission.yearNumber !== subject.yearNumber)
    ) {
      errors.push("La asignatura debe pertenecer a la misma carrera y años de la comision.");
    }

    if (errors.length > 0) {
      return scheduleFailure(errors);
    }

    const conflicts = detectScheduleConflicts(normalizedDraft, state, options?.editingId);

    if (conflicts.length > 0 && !options?.confirmConflicts) {
      return scheduleFailure(
        ["Hay conflictos de horario. Revisa la advertencia antes de confirmar."],
        conflicts
      );
    }

    const candidate: ScheduleEntry = {
      id: options?.editingId ?? createId("entry"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      scheduleEntries: replaceOrAppend(previousState.scheduleEntries, candidate).sort(
        (left, right) => {
          const dayDifference =
            DAY_OPTIONS.indexOf(left.dayOfWeek) - DAY_OPTIONS.indexOf(right.dayOfWeek);

          if (dayDifference !== 0) {
            return dayDifference;
          }

          return left.startTime.localeCompare(right.startTime, "es");
        }
      )
    }));

    return scheduleSuccess();
  }

  function upsertPendingScheduleEntry(
    draft: PendingScheduleEntryDraft,
    editingId?: string
  ): MutationResult {
    const normalizedDraft = normalizePendingScheduleDraft(draft);
    const errors = validatePendingScheduleEntryDraft(normalizedDraft);
    const commission = state.commissions.find((item) => item.id === normalizedDraft.commissionId);
    const subject = state.subjects.find((item) => item.id === normalizedDraft.subjectId);

    if (!commission) {
      errors.push("La comision seleccionada no existe.");
    }

    if (!subject) {
      errors.push("La asignatura seleccionada no existe.");
    }

    if (!hasKnownTeacherId(state, normalizedDraft.teacherId)) {
      errors.push("El profesor seleccionado no existe.");
    }

    if (
      commission &&
      subject &&
      (commission.careerId !== subject.careerId || commission.yearNumber !== subject.yearNumber)
    ) {
      errors.push("La asignatura debe pertenecer a la misma carrera y años de la comision.");
    }

    if (errors.length > 0) {
      return failureResult(errors);
    }

    const candidate: PendingScheduleEntry = {
      id: editingId ?? createId("pending"),
      ...normalizedDraft
    };

    setState((previousState) => ({
      ...previousState,
      pendingScheduleEntries: [
        ...replaceOrAppend(previousState.pendingScheduleEntries, candidate)
      ].sort((left, right) => {
        const leftCommission = previousState.commissions.find(
          (commission) => commission.id === left.commissionId
        );
        const rightCommission = previousState.commissions.find(
          (commission) => commission.id === right.commissionId
        );
        const leftCareer = previousState.careers.find(
          (career) => career.id === leftCommission?.careerId
        )?.name ?? "";
        const rightCareer = previousState.careers.find(
          (career) => career.id === rightCommission?.careerId
        )?.name ?? "";
        const leftSubject = previousState.subjects.find(
          (subject) => subject.id === left.subjectId
        )?.name ?? "";
        const rightSubject = previousState.subjects.find(
          (subject) => subject.id === right.subjectId
        )?.name ?? "";

        return (
          leftCareer.localeCompare(rightCareer, "es") ||
          (leftCommission?.yearNumber ?? 0) - (rightCommission?.yearNumber ?? 0) ||
          (leftCommission?.label ?? "").localeCompare(rightCommission?.label ?? "", "es") ||
          leftSubject.localeCompare(rightSubject, "es")
        );
      })
    }));

    return successResult();
  }

  function deleteCareer(careerId: string): void {
    setState((previousState) => {
      const removedSubjectIds = new Set(
        previousState.subjects
          .filter((subject) => subject.careerId === careerId)
          .map((subject) => subject.id)
      );
      const removedCommissionIds = new Set(
        previousState.commissions
          .filter((commission) => commission.careerId === careerId)
          .map((commission) => commission.id)
      );

      return {
        careers: previousState.careers.filter((career) => career.id !== careerId),
        subjects: previousState.subjects.filter((subject) => subject.careerId !== careerId),
        teachers: previousState.teachers,
        commissions: previousState.commissions.filter(
          (commission) => commission.careerId !== careerId
        ),
        scheduleEntries: previousState.scheduleEntries.filter(
          (entry) =>
            !removedSubjectIds.has(entry.subjectId) && !removedCommissionIds.has(entry.commissionId)
        ),
        pendingScheduleEntries: previousState.pendingScheduleEntries.filter(
          (entry) =>
            !removedSubjectIds.has(entry.subjectId) && !removedCommissionIds.has(entry.commissionId)
        )
      };
    });
  }

  function deleteTeacher(teacherId: string): void {
    setState((previousState) => ({
      ...previousState,
      teachers: previousState.teachers.filter((teacher) => teacher.id !== teacherId),
      pendingScheduleEntries: previousState.pendingScheduleEntries.filter(
        (entry) => entry.teacherId !== teacherId
      ),
      scheduleEntries: previousState.scheduleEntries.filter(
        (entry) => entry.teacherId !== teacherId
      )
    }));
  }

  function deleteSubject(subjectId: string): void {
    setState((previousState) => ({
      ...previousState,
      subjects: previousState.subjects.filter((subject) => subject.id !== subjectId),
      pendingScheduleEntries: previousState.pendingScheduleEntries.filter(
        (entry) => entry.subjectId !== subjectId
      ),
      scheduleEntries: previousState.scheduleEntries.filter((entry) => entry.subjectId !== subjectId)
    }));
  }

  function deleteCommission(commissionId: string): void {
    setState((previousState) => ({
      ...previousState,
      commissions: previousState.commissions.filter(
        (commission) => commission.id !== commissionId
      ),
      pendingScheduleEntries: previousState.pendingScheduleEntries.filter(
        (entry) => entry.commissionId !== commissionId
      ),
      scheduleEntries: previousState.scheduleEntries.filter(
        (entry) => entry.commissionId !== commissionId
      )
    }));
  }

  function deleteScheduleEntry(entryId: string): void {
    setState((previousState) => ({
      ...previousState,
      scheduleEntries: previousState.scheduleEntries.filter((entry) => entry.id !== entryId)
    }));
  }

  function deletePendingScheduleEntry(entryId: string): void {
    setState((previousState) => ({
      ...previousState,
      pendingScheduleEntries: previousState.pendingScheduleEntries.filter(
        (entry) => entry.id !== entryId
      )
    }));
  }

  function resetToSeedData(): void {
    setState(createSeedState());
  }

  return {
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
  };
}
