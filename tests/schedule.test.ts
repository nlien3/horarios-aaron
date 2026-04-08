import { describe, expect, it } from "vitest";

import {
  createPlacedPendingScheduleEntryDraft,
  createMovedScheduleEntryDraft,
  detectScheduleConflicts,
  getPendingScheduleEntriesForCommission,
  getPendingScheduleEntriesForSubject,
  getPendingScheduleEntriesForTeacher,
  getSubjectSchedule,
  listPendingSubjectsForCommission
} from "@/lib/schedule";
import { UNASSIGNED_TEACHER_ID } from "@/lib/types";
import { createSeedState } from "@/lib/seeds";

describe("schedule helpers", () => {
  it("detects one combined conflict when the commission and teacher overlap", () => {
    const state = createSeedState();

    const conflicts = detectScheduleConflicts(
      {
        commissionId: "commission-asi-1a",
        subjectId: "subject-algebra",
        teacherId: "teacher-vega",
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "10:30"
      },
      state
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      existingEntry: {
        id: "entry-1"
      },
      scopes: {
        commission: true,
        teacher: true
      }
    });
    expect(conflicts[0].message).toContain("La comision ya tiene otra clase");
    expect(conflicts[0].message).toContain("el profesor figura ocupado");
  });

  it("does not treat touching time ranges as overlap", () => {
    const state = createSeedState();

    const conflicts = detectScheduleConflicts(
      {
        commissionId: "commission-asi-1a",
        subjectId: "subject-algebra",
        teacherId: "teacher-vega",
        dayOfWeek: "monday",
        startTime: "10:00",
        endTime: "11:00"
      },
      state
    );

    expect(conflicts).toHaveLength(0);
  });

  it("lists only subjects that still have no blocks in a commission", () => {
    const state = createSeedState();

    const pending = listPendingSubjectsForCommission(state, "commission-asi-1a");

    expect(pending.map((subject) => subject.id)).toEqual(["subject-arquitectura"]);
  });

  it("lists pending blocks for a commission", () => {
    const state = createSeedState();

    state.pendingScheduleEntries.push({
      id: "pending-1",
      commissionId: "commission-asi-1a",
      subjectId: "subject-arquitectura",
      teacherId: "teacher-vega",
      durationMinutes: 120
    });

    const pendingEntries = getPendingScheduleEntriesForCommission(state, "commission-asi-1a");

    expect(pendingEntries.map((entry) => entry.id)).toEqual(["pending-1"]);
  });

  it("lists pending blocks for a teacher, including the virtual unassigned teacher", () => {
    const state = createSeedState();

    state.pendingScheduleEntries.push(
      {
        id: "pending-1",
        commissionId: "commission-asi-1a",
        subjectId: "subject-arquitectura",
        teacherId: "teacher-vega",
        durationMinutes: 120
      },
      {
        id: "pending-2",
        commissionId: "commission-asi-1b",
        subjectId: "subject-programacion-1",
        teacherId: UNASSIGNED_TEACHER_ID,
        durationMinutes: 90
      }
    );

    expect(getPendingScheduleEntriesForTeacher(state, "teacher-vega").map((entry) => entry.id)).toEqual([
      "pending-1"
    ]);
    expect(
      getPendingScheduleEntriesForTeacher(state, UNASSIGNED_TEACHER_ID).map((entry) => entry.id)
    ).toEqual(["pending-2"]);
  });

  it("lists blocks and pending items for a subject across commissions", () => {
    const state = createSeedState();

    state.pendingScheduleEntries.push({
      id: "pending-1",
      commissionId: "commission-asi-1a",
      subjectId: "subject-programacion-1",
      teacherId: "teacher-vega",
      durationMinutes: 120
    });

    expect(getSubjectSchedule(state, "subject-programacion-1").map((entry) => entry.id)).toEqual([
      "entry-1",
      "entry-3"
    ]);
    expect(
      getPendingScheduleEntriesForSubject(state, "subject-programacion-1").map((entry) => entry.id)
    ).toEqual(["pending-1"]);
  });

  it("creates a moved draft preserving the original duration", () => {
    const state = createSeedState();
    const entry = state.scheduleEntries.find((item) => item.id === "entry-1");

    expect(entry).toBeDefined();

    const movedDraft = createMovedScheduleEntryDraft(entry!, "thursday", 11 * 60 + 31);

    expect(movedDraft).toMatchObject({
      commissionId: "commission-asi-1a",
      subjectId: "subject-programacion-1",
      teacherId: "teacher-vega",
      dayOfWeek: "thursday",
      startTime: "11:31",
      endTime: "13:31"
    });
  });

  it("creates a placed draft from a pending block preserving its duration", () => {
    const movedDraft = createPlacedPendingScheduleEntryDraft(
      {
        id: "pending-1",
        commissionId: "commission-asi-1a",
        subjectId: "subject-arquitectura",
        teacherId: "teacher-vega",
        durationMinutes: 105
      },
      "friday",
      10 * 60 + 15
    );

    expect(movedDraft).toMatchObject({
      commissionId: "commission-asi-1a",
      subjectId: "subject-arquitectura",
      teacherId: "teacher-vega",
      dayOfWeek: "friday",
      startTime: "10:15",
      endTime: "12:00"
    });
  });

  it("keeps conflict detection when a pending block is converted into a placed draft", () => {
    const state = createSeedState();
    const placedDraft = createPlacedPendingScheduleEntryDraft(
      {
        id: "pending-1",
        commissionId: "commission-asi-1a",
        subjectId: "subject-arquitectura",
        teacherId: "teacher-vega",
        durationMinutes: 120
      },
      "monday",
      8 * 60
    );

    const conflicts = detectScheduleConflicts(placedDraft, state);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.scopes).toEqual({
      commission: true,
      teacher: true
    });
  });
});
