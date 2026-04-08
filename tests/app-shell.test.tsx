import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("shows a conflict warning and allows saving anyway", async () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "09:00" }
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "10:30" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Agregar bloque" }));

    expect(
      await screen.findByText("Hay superposiciones detectadas")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar igual" }));

    expect(screen.queryByText("Hay superposiciones detectadas")).not.toBeInTheDocument();
    expect(screen.getByText("09:00-10:30 · Lic. Vega")).toBeInTheDocument();
  });

  it("lets the user search and pick a visible teacher from the combobox", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Por profesor" }));

    const teacherInput = screen.getByRole("combobox", { name: "Profesor visible" });

    fireEvent.focus(teacherInput);
    fireEvent.change(teacherInput, {
      target: { value: "soto" }
    });

    const teacherOptions = screen.getByRole("listbox", {
      name: "Profesor visible opciones"
    });

    expect(within(teacherOptions).getByRole("option", { name: "Prof. Soto" })).toBeInTheDocument();
    expect(
      within(teacherOptions).queryByRole("option", { name: "Lic. Vega" })
    ).not.toBeInTheDocument();

    fireEvent.keyDown(teacherInput, { key: "ArrowDown" });
    fireEvent.keyDown(teacherInput, { key: "Enter" });

    expect(screen.getByDisplayValue("Prof. Soto")).toBeInTheDocument();
    expect(screen.getByText("Estadistica Aplicada")).toBeInTheDocument();
  });

  it("lets the user search and pick a visible subject from the combobox", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Por materia" }));

    const subjectInput = screen.getByRole("combobox", { name: "Materia visible" });

    fireEvent.focus(subjectInput);
    fireEvent.change(subjectInput, {
      target: { value: "programacion" }
    });

    const subjectOptions = screen.getByRole("listbox", {
      name: "Materia visible opciones"
    });

    expect(
      within(subjectOptions).getByRole("option", { name: /Programacion I/i })
    ).toBeInTheDocument();
    expect(
      within(subjectOptions).queryByRole("option", { name: /Estadistica Aplicada/i })
    ).not.toBeInTheDocument();

    fireEvent.keyDown(subjectInput, { key: "ArrowDown" });
    fireEvent.keyDown(subjectInput, { key: "Enter" });

    expect(
      screen.getByRole("combobox", { name: "Materia visible" })
    ).toHaveDisplayValue(/Programacion I/i);
    expect(screen.getByText("Pendientes de la materia visible")).toBeInTheDocument();
    expect(screen.getByText(/Analista de Sistemas · 1 año · 1A/i)).toBeInTheDocument();
  });

  it("lets the user search and pick a visible commission from the combobox", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));

    const commissionInput = screen.getByRole("combobox", { name: "Comision visible" });

    fireEvent.focus(commissionInput);
    fireEvent.change(commissionInput, {
      target: { value: "datos" }
    });

    const commissionOptions = screen.getByRole("listbox", {
      name: "Comision visible opciones"
    });

    expect(
      within(commissionOptions).getByRole("option", { name: /Tecnicatura en Datos/i })
    ).toBeInTheDocument();
    expect(
      within(commissionOptions).queryByRole("option", { name: /Analista de Sistemas/i })
    ).not.toBeInTheDocument();

    fireEvent.keyDown(commissionInput, { key: "ArrowDown" });
    fireEvent.keyDown(commissionInput, { key: "Enter" });

    expect(screen.getByDisplayValue(/Tecnicatura en Datos/i)).toBeInTheDocument();
    expect(screen.getByText("Estadistica Aplicada")).toBeInTheDocument();
  });

  it("shows the board view with zoom controls and opens quick edit from a board block", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Tablero general" }));

    const boardRow = screen.getByTestId("board-row-commission-asi-1a");

    expect(within(boardRow).getByText("Analista de Sistemas")).toBeInTheDocument();
    expect(within(boardRow).getByText("1 año · 1A")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom del tablero")).toHaveValue("100");

    fireEvent.click(screen.getByRole("button", { name: "Zoom +" }));

    expect(screen.getByText("110%")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Editar bloque Programacion I 08:00-10:00/i })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar bloque desde la grilla")).toBeInTheDocument();
  });

  it("opens a quick edit dialog from a schedule block", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Programacion I" }));

    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Editar bloque desde la grilla")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Programacion I")).toBeInTheDocument();
  });

  it("lets the user save a pending block and shows it in the pending pool", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));

    fireEvent.change(screen.getByLabelText("Asignatura"), {
      target: { value: "subject-arquitectura" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Dejar pendiente" }));

    expect(screen.getByText("Bloque pendiente guardado")).toBeInTheDocument();
    expect(
      screen.getByText(/quedo pendiente para ubicarlo despues desde la grilla/i)
    ).toBeInTheDocument();

    const pendingCard = screen.getByTestId(/pending-entry-/);

    expect(within(pendingCard).getByText("Arquitectura de Computadoras")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Lic. Vega")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Duracion 2h")).toBeInTheDocument();
  });

  it("shows a teacher pending inside the teacher view", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.change(screen.getByLabelText("Asignatura"), {
      target: { value: "subject-arquitectura" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Dejar pendiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Por profesor" }));

    expect(screen.getByText("Pendientes del profesor visible")).toBeInTheDocument();

    const pendingCard = screen.getByTestId(/pending-entry-/);

    expect(within(pendingCard).getByText("Arquitectura de Computadoras")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Lic. Vega")).toBeInTheDocument();
  });

  it("shows pending blocks in the board view too", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.change(screen.getByLabelText("Asignatura"), {
      target: { value: "subject-arquitectura" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Dejar pendiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Tablero general" }));

    const pendingCard = screen.getByTestId(/board-pending-entry-/);

    expect(screen.getByText("Pendientes del tablero")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Arquitectura de Computadoras")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Lic. Vega")).toBeInTheDocument();
  });

  it("allows leaving a pending block without teacher and shows it under Sin profesor", () => {
    render(<AppShell />);

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    fireEvent.change(screen.getByLabelText("Asignatura"), {
      target: { value: "subject-arquitectura" }
    });
    fireEvent.change(screen.getByLabelText("Profesor"), {
      target: { value: "teacher-unassigned" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Dejar pendiente" }));

    let pendingCard = screen.getByTestId(/pending-entry-/);

    expect(within(pendingCard).getByText("Sin profesor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Por profesor" }));

    pendingCard = screen.getByTestId(/pending-entry-/);

    expect(
      screen.getByRole("combobox", { name: "Profesor visible" })
    ).toHaveDisplayValue("Sin profesor");
    expect(within(pendingCard).getByText("Arquitectura de Computadoras")).toBeInTheDocument();
    expect(within(pendingCard).getByText("Sin profesor")).toBeInTheDocument();
  });
});
