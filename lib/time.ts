const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeValue(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  const match = value.match(TIME_PATTERN);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function compareTimes(left: string, right: string): number {
  return timeToMinutes(left) - timeToMinutes(right);
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundMinutesToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function minutesToTime(value: number): string {
  const clampedValue = clampMinutes(value, 0, 23 * 60 + 59);
  const hours = String(Math.floor(clampedValue / 60)).padStart(2, "0");
  const minutes = String(clampedValue % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}
