import type { PlannerState } from "@/lib/types";

export function createSeedState(): PlannerState {
  return {
    careers: [
      { id: "career-analista", name: "Analista de Sistemas" },
      { id: "career-datos", name: "Tecnicatura en Datos" }
    ],
    subjects: [
      {
        id: "subject-programacion-1",
        careerId: "career-analista",
        yearNumber: 1,
        name: "Programacion I",
        code: "ASI-101"
      },
      {
        id: "subject-algebra",
        careerId: "career-analista",
        yearNumber: 1,
        name: "Algebra",
        code: "ASI-102"
      },
      {
        id: "subject-arquitectura",
        careerId: "career-analista",
        yearNumber: 1,
        name: "Arquitectura de Computadoras",
        code: "ASI-103"
      },
      {
        id: "subject-estadistica",
        careerId: "career-datos",
        yearNumber: 1,
        name: "Estadistica Aplicada",
        code: "DAT-101"
      }
    ],
    teachers: [
      { id: "teacher-vega", name: "Lic. Vega" },
      { id: "teacher-soto", name: "Prof. Soto" },
      { id: "teacher-rios", name: "Ing. Rios" }
    ],
    commissions: [
      {
        id: "commission-asi-1a",
        careerId: "career-analista",
        yearNumber: 1,
        label: "1A"
      },
      {
        id: "commission-asi-1b",
        careerId: "career-analista",
        yearNumber: 1,
        label: "1B"
      },
      {
        id: "commission-dat-1a",
        careerId: "career-datos",
        yearNumber: 1,
        label: "1A"
      }
    ],
    scheduleEntries: [
      {
        id: "entry-1",
        commissionId: "commission-asi-1a",
        subjectId: "subject-programacion-1",
        teacherId: "teacher-vega",
        dayOfWeek: "monday",
        startTime: "08:00",
        endTime: "10:00"
      },
      {
        id: "entry-2",
        commissionId: "commission-asi-1a",
        subjectId: "subject-algebra",
        teacherId: "teacher-soto",
        dayOfWeek: "wednesday",
        startTime: "09:00",
        endTime: "11:00"
      },
      {
        id: "entry-3",
        commissionId: "commission-asi-1b",
        subjectId: "subject-programacion-1",
        teacherId: "teacher-rios",
        dayOfWeek: "tuesday",
        startTime: "18:00",
        endTime: "20:00"
      },
      {
        id: "entry-4",
        commissionId: "commission-dat-1a",
        subjectId: "subject-estadistica",
        teacherId: "teacher-soto",
        dayOfWeek: "thursday",
        startTime: "19:00",
        endTime: "21:00"
      }
    ],
    pendingScheduleEntries: []
  };
}
