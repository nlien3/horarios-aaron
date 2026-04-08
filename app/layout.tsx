import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ASC Horarios MVP",
  description: "MVP de horarios academicos con carreras, asignaturas, comisiones y profesores."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
