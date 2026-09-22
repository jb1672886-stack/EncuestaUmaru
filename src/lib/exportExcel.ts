import * as XLSX from "xlsx";

type Response = {
  id: string;
  createdAt: string;
  q1: string;
  q2: string;
  q3: string[];
  q4: string;
  q5: string;
  q6: string;
};

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5";
  number: string;
  title: string;
  hint?: string;
  options: string[];
  multiple?: boolean;
};

export function exportSurveyToExcel(responses: Response[], questions: Question[]) {
  if (!responses || responses.length === 0) {
    alert("No hay respuestas registradas para exportar.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // ==========================================
  // SHEET 1: RESPUESTAS DETALLADAS (RAW DATA)
  // ==========================================
  const rawDataHeaders = [
    "N°",
    "ID de Registro",
    "Fecha y Hora",
    "P1. Frecuencia de Visita",
    "P2. Propuesta Gastronómica Deseada",
    "P3. Factores Más Importantes",
    "P4. Disposición de Pago (Plato Principal)",
    "P5. Motivación para Volver",
    "P6. Sugerencia / Propuesta Escrita",
  ];

  const rawDataRows = responses.map((r, index) => {
    const dateFormatted = new Date(r.createdAt).toLocaleString("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    return [
      index + 1,
      r.id,
      dateFormatted,
      r.q1 || "Sin responder",
      r.q2 || "Sin responder",
      Array.isArray(r.q3) ? r.q3.join(", ") : r.q3 || "Sin responder",
      r.q4 || "Sin responder",
      r.q5 || "Sin responder",
      r.q6 ? r.q6.trim() : "(Sin sugerencia)",
    ];
  });

  const wsRaw = XLSX.utils.aoa_to_sheet([rawDataHeaders, ...rawDataRows]);

  // Adjust column widths for Sheet 1
  wsRaw["!cols"] = [
    { wch: 5 },  // N°
    { wch: 38 }, // ID
    { wch: 22 }, // Fecha
    { wch: 28 }, // P1
    { wch: 38 }, // P2
    { wch: 35 }, // P3
    { wch: 24 }, // P4
    { wch: 35 }, // P5
    { wch: 50 }, // P6
  ];

  XLSX.utils.book_append_sheet(wb, wsRaw, "Respuestas Detalladas");

  // ==========================================
  // SHEET 2: CUADROS ESTADÍSTICOS Y RESUMEN
  // ==========================================
  const statsRows: (string | number)[][] = [];

  statsRows.push(["UMARU HOTEL - REPORTE EJECUTIVO Y ESTADÍSTICAS DE ENCUESTA"]);
  statsRows.push(["Fecha de generación:", new Date().toLocaleString("es-PE")]);
  statsRows.push(["Total de participantes:", responses.length]);
  statsRows.push([]); // blank

  questions.forEach((q) => {
    statsRows.push([`PREGUNTA ${q.number}: ${q.title}`]);
    statsRows.push(["Opción de Respuesta", "N° de Respuestas", "Porcentaje (%)", "Barra Visual"]);

    const counts = q.options.map((opt) => {
      const count = responses.filter((r) => {
        const val = r[q.id];
        return Array.isArray(val) ? val.includes(opt) : val === opt;
      }).length;
      return { opt, count };
    });

    const totalVotes = q.multiple
      ? counts.reduce((acc, c) => acc + c.count, 0)
      : responses.length;

    counts.forEach(({ opt, count }) => {
      const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
      const barLength = Math.round(pct / 5);
      const bar = "█".repeat(barLength) + "░".repeat(Math.max(0, 20 - barLength));

      statsRows.push([opt, count, `${pct.toFixed(1)}%`, bar]);
    });

    if (q.multiple) {
      statsRows.push(["Total de selecciones:", totalVotes, "100.0%", ""]);
    } else {
      statsRows.push(["Total encuestados:", responses.length, "100.0%", ""]);
    }

    statsRows.push([]); // blank separator
  });

  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  wsStats["!cols"] = [
    { wch: 45 }, // Opción / Pregunta
    { wch: 18 }, // Nº Respuestas
    { wch: 16 }, // %
    { wch: 25 }, // Barra
  ];

  XLSX.utils.book_append_sheet(wb, wsStats, "Cuadros Estadísticos");

  // ==========================================
  // SHEET 3: PROPUESTAS Y COMENTARIOS
  // ==========================================
  const commentsHeaders = [
    "N°",
    "Fecha",
    "Propuesta / Comentario del Cliente",
    "Frecuencia de Visita",
    "Propuesta Deseada",
    "Rango de Precio",
  ];

  const commentsWithFeedback = responses.filter((r) => r.q6 && r.q6.trim().length > 0);

  const commentsRows = commentsWithFeedback.map((r, index) => [
    index + 1,
    new Date(r.createdAt).toLocaleDateString("es-PE"),
    r.q6.trim(),
    r.q1 || "-",
    r.q2 || "-",
    r.q4 || "-",
  ]);

  const wsComments = XLSX.utils.aoa_to_sheet([
    ["SUGERENCIAS Y PROPUESTAS ESCRITAS POR LOS CLIENTES"],
    [`Total con comentarios escritos: ${commentsWithFeedback.length} de ${responses.length} encuestados`],
    [],
    commentsHeaders,
    ...commentsRows,
  ]);

  wsComments["!cols"] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 60 },
    { wch: 24 },
    { wch: 32 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, wsComments, "Propuestas de Clientes");

  // ==========================================
  // GENERATE DOWNLOAD
  // ==========================================
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Reporte_Encuestas_UMARU_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
