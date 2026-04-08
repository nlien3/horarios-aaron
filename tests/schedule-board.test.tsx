import React from "react";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleBoard } from "@/components/schedule-board";
import { createSeedState } from "@/lib/seeds";

const HOUR_WIDTH = 88;
const DAY_WIDTH = 14 * HOUR_WIDTH;
const TOTAL_BOARD_WIDTH = DAY_WIDTH * 5;

function mockRect(element: Element, dimensions: { left?: number; top?: number; width: number; height: number }) {
  const left = dimensions.left ?? 0;
  const top = dimensions.top ?? 0;
  const width = dimensions.width;
  const height = dimensions.height;

  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({})
    })
  });
}

function createBoardProps() {
  const state = createSeedState();
  state.pendingScheduleEntries.push({
    id: "pending-1",
    commissionId: "commission-asi-1a",
    subjectId: "subject-arquitectura",
    teacherId: "teacher-vega",
    durationMinutes: 120
  });

  return {
    commissions: state.commissions,
    entries: state.scheduleEntries,
    pendingEntries: state.pendingScheduleEntries,
    careersById: new Map(state.careers.map((career) => [career.id, career])),
    subjectsById: new Map(state.subjects.map((subject) => [subject.id, subject])),
    teachersById: new Map(state.teachers.map((teacher) => [teacher.id, teacher]))
  };
}

function dispatchDragEvent(
  element: Element,
  type: "dragStart" | "dragOver" | "drop",
  clientX: number,
  dataTransfer: DataTransfer
) {
  const event = createEvent[type](element);

  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: clientX
  });
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: dataTransfer
  });

  fireEvent(element, event);
}

describe("ScheduleBoard", () => {
  it("moves a block inside its commission row with 15 minute snapping", () => {
    const onMoveEntry = vi.fn();
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn()
    } as unknown as DataTransfer;

    render(<ScheduleBoard {...createBoardProps()} onMoveEntry={onMoveEntry} />);

    const block = screen.getByTestId("board-entry-entry-1");
    const timeline = screen.getByTestId("board-timeline-commission-asi-1a");

    mockRect(block, { width: 176, height: 80 });
    mockRect(timeline, { width: TOTAL_BOARD_WIDTH, height: 112 });

    dispatchDragEvent(block, "dragStart", 0, dataTransfer);
    dispatchDragEvent(timeline, "dragOver", DAY_WIDTH + 2 * HOUR_WIDTH, dataTransfer);
    dispatchDragEvent(timeline, "drop", DAY_WIDTH + 2 * HOUR_WIDTH, dataTransfer);

    expect(onMoveEntry).toHaveBeenCalledWith(
      "entry-1",
      "commission-asi-1a",
      "tuesday",
      10 * 60
    );
  });

  it("allows moving a block to a different commission row", () => {
    const onMoveEntry = vi.fn();
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn()
    } as unknown as DataTransfer;

    render(<ScheduleBoard {...createBoardProps()} onMoveEntry={onMoveEntry} />);

    const block = screen.getByTestId("board-entry-entry-1");
    const otherTimeline = screen.getByTestId("board-timeline-commission-asi-1b");

    mockRect(block, { width: 176, height: 80 });
    mockRect(otherTimeline, { width: TOTAL_BOARD_WIDTH, height: 112 });

    dispatchDragEvent(block, "dragStart", 0, dataTransfer);
    dispatchDragEvent(otherTimeline, "dragOver", DAY_WIDTH + 2 * HOUR_WIDTH, dataTransfer);
    dispatchDragEvent(otherTimeline, "drop", DAY_WIDTH + 2 * HOUR_WIDTH, dataTransfer);

    expect(onMoveEntry).toHaveBeenCalledWith(
      "entry-1",
      "commission-asi-1b",
      "tuesday",
      10 * 60
    );
  });

  it("shows pending cards and lets the user place one from the board", () => {
    const onPlacePendingEntry = vi.fn();
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn()
    } as unknown as DataTransfer;

    render(<ScheduleBoard {...createBoardProps()} onPlacePendingEntry={onPlacePendingEntry} />);

    const pendingCard = screen.getByTestId("board-pending-entry-pending-1");
    const timeline = screen.getByTestId("board-timeline-commission-asi-1b");

    expect(screen.getByText("Pendientes del tablero")).toBeInTheDocument();
    expect(screen.getByText("Arquitectura de Computadoras")).toBeInTheDocument();

    mockRect(timeline, { width: TOTAL_BOARD_WIDTH, height: 112 });

    dispatchDragEvent(pendingCard, "dragStart", 0, dataTransfer);
    dispatchDragEvent(timeline, "dragOver", DAY_WIDTH + HOUR_WIDTH, dataTransfer);
    dispatchDragEvent(timeline, "drop", DAY_WIDTH + HOUR_WIDTH, dataTransfer);

    expect(onPlacePendingEntry).toHaveBeenCalledWith(
      "pending-1",
      "commission-asi-1b",
      "tuesday",
      9 * 60
    );
  });
});
