import { createSeedState } from "@/lib/seeds";
import { normalizePlannerState } from "@/lib/validation";
import type { PlannerState } from "@/lib/types";

const STORAGE_KEY = "asc-horarios-mvp:v1";

export function loadPlannerState(): PlannerState {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return createSeedState();
  }

  try {
    const parsed = JSON.parse(storedValue);
    const normalized = normalizePlannerState(parsed);

    if (
      normalized.careers.length === 0 &&
      normalized.subjects.length === 0 &&
      normalized.teachers.length === 0 &&
      normalized.commissions.length === 0 &&
      normalized.scheduleEntries.length === 0 &&
      normalized.pendingScheduleEntries.length === 0
    ) {
      return createSeedState();
    }

    return normalized;
  } catch {
    return createSeedState();
  }
}

export function savePlannerState(state: PlannerState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
