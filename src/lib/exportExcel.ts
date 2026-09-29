import * as XLSX from "xlsx";

type Response = {
  id: string;
  createdAt: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q5Other: string;
  q6: string;
  q7: string;
  q8: string;
};

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8";
  number: string;
  title: string;
  options?: string[];
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
    ...questions.map((question) => `P${question.number}. ${question.title}`),
    "Motivo indicado (P5: Otro)",
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
      ...questions.map((question) => r[question.id] || "Sin responder"),
      r.q5Other || "",
    ];
  });

  const wsRaw = XLSX.utils.aoa_to_sheet([rawDataHeaders, ...rawDataRows]);

  // Adjust column widths for Sheet 1
  wsRaw["!cols"] = [
    { wch: 5 },  // N°
    { wch: 38 }, // ID
    { wch: 22 }, // Fecha
    ...questions.map(() => ({ wch: 36 })),
    { wch: 36 },
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
    if (!q.options) return;
    statsRows.push([`PREGUNTA ${q.number}: ${q.title}`]);
    statsRows.push(["Opción de Respuesta", "N° de Respuestas", "Porcentaje (%)", "Barra Visual"]);

    const counts = q.options.map((opt) => {
      const count = responses.filter((r) => {
        return r[q.id] === opt;
      }).length;
      return { opt, count };
    });

    const totalVotes = responses.length;

    counts.forEach(({ opt, count }) => {
      const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
      const barLength = Math.round(pct / 5);
      const bar = "█".repeat(barLength) + "░".repeat(Math.max(0, 20 - barLength));

      statsRows.push([opt, count, `${pct.toFixed(1)}%`, bar]);
    });

    statsRows.push(["Total encuestados:", responses.length, "100.0%", ""]);

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
  // SHEET 3: OPEN-ENDED ANSWERS
  // ==========================================
  const openQuestions = questions.filter((question) => !question.options);
  const commentsHeaders = [
    "N°",
    "Fecha",
    "Pregunta",
    "Respuesta del Cliente",
    "Frecuencia de Visita",
  ];

  const commentsRows = responses.flatMap((response) =>
    openQuestions.flatMap((question) => {
      const answer = response[question.id].trim();
      return answer
        ? [[
            response.id,
            new Date(response.createdAt).toLocaleDateString("es-PE"),
            `P${question.number}. ${question.title}`,
            answer,
            response.q1 || "-",
          ]]
        : [];
    }),
  );

  const wsComments = XLSX.utils.aoa_to_sheet([
    ["RESPUESTAS ABIERTAS DE LOS CLIENTES"],
    [`Total de respuestas abiertas: ${commentsRows.length}`],
    [],
    commentsHeaders,
    ...commentsRows,
  ]);

  wsComments["!cols"] = [
    { wch: 38 },
    { wch: 14 },
    { wch: 60 },
    { wch: 60 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, wsComments, "Propuestas de Clientes");

  // ==========================================
  // GENERATE DOWNLOAD
  // ==========================================
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Reporte_Encuestas_UMARU_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
