import ExcelJS from "exceljs"

type Response = {
  id: string

  createdAt: string

  q1: string

  q2: string

  q3: string

  q4: string

  q5: string

  q5Other: string

  q6: string

  q7: string

  q8: string
}

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8"

  number: string

  title: string

  options?: string[]
}

function formatDate(value: string, includeTime = true) {
  return new Date(value).toLocaleString("es-PE", {
    dateStyle: "medium",

    ...(includeTime ? { timeStyle: "short" as const } : {}),
  })
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } }

  row.fill = {
    type: "pattern",

    pattern: "solid",

    fgColor: { argb: "FF3A302B" },
  }

  row.alignment = { vertical: "middle", wrapText: true }
}

export async function exportSurveyToExcel(
  responses: Response[],

  questions: Question[],
) {
  if (!responses || responses.length === 0) {
    alert("No hay respuestas registradas para exportar.")

    return
  }

  try {
    const workbook = new ExcelJS.Workbook()

    workbook.creator = "UMARU Hotel"

    workbook.created = new Date()

    const rawSheet = workbook.addWorksheet("Respuestas Detalladas")

    const rawHeaders = [
      "N°",

      "ID de Registro",

      "Fecha y Hora",

      ...questions.map((question) => `P${question.number}. ${question.title}`),

      "Motivo indicado (P5: Otro)",
    ]

    rawSheet.addRow(rawHeaders)

    styleHeader(rawSheet.getRow(1))

    rawSheet.views = [{ state: "frozen", ySplit: 1 }]

    rawSheet.addRows(
      responses.map((response, index) => [
        index + 1,

        response.id,

        formatDate(response.createdAt),

        ...questions.map(
          (question) => response[question.id] || "Sin responder",
        ),

        response.q5Other || "",
      ]),
    )

    rawSheet.columns = rawHeaders.map((_, index) => ({
      width: index === 0 ? 5 : index === 1 ? 38 : index === 2 ? 22 : 36,
    }))

    rawSheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true }
    })

    styleHeader(rawSheet.getRow(1))

    const statsSheet = workbook.addWorksheet("Cuadros Estadísticos")

    const statsRows: (string | number)[][] = [
      ["UMARU HOTEL - REPORTE EJECUTIVO Y ESTADÍSTICAS DE ENCUESTA"],

      ["Fecha de generación:", new Date().toLocaleString("es-PE")],

      ["Total de participantes:", responses.length],

      [],
    ]

    questions.forEach((question) => {
      if (!question.options) return

      statsRows.push([`PREGUNTA ${question.number}: ${question.title}`])

      statsRows.push([
        "Opción de Respuesta",

        "N° de Respuestas",

        "Porcentaje (%)",

        "Barra Visual",
      ])

      question.options.forEach((option) => {
        const count = responses.filter(
          (response) => response[question.id] === option,
        ).length

        const percentage = (count / responses.length) * 100

        const barLength = Math.round(percentage / 5)

        const bar =
          "█".repeat(barLength) + "░".repeat(Math.max(0, 20 - barLength))

        statsRows.push([option, count, `${percentage.toFixed(1)}%`, bar])
      })

      statsRows.push(["Total encuestados:", responses.length, "100.0%", ""])

      statsRows.push([])
    })

    statsSheet.addRows(statsRows)

    statsSheet.columns = [
      { width: 45 },

      { width: 18 },

      { width: 16 },

      { width: 25 },
    ]

    statsSheet.getRow(1).font = { bold: true, size: 14 }

    statsSheet.eachRow((row) => {
      if (
        typeof row.getCell(1).value === "string" &&
        row.getCell(1).value.startsWith("PREGUNTA ")
      ) {
        row.font = { bold: true, color: { argb: "FF8A5230" } }
      }

      if (row.getCell(1).value === "Opción de Respuesta") {
        styleHeader(row)
      }
    })

    const openQuestions = questions.filter((question) => !question.options)

    const commentsSheet = workbook.addWorksheet("Propuestas de Clientes")

    commentsSheet.addRows([
      ["RESPUESTAS ABIERTAS DE LOS CLIENTES"],

      [
        `Total de respuestas abiertas: ${responses.reduce(
          (count, response) =>
            count +
            openQuestions.filter((question) => response[question.id].trim())
              .length,

          0,
        )}`,
      ],

      [],

      [
        "N°",

        "Fecha",

        "Pregunta",

        "Respuesta del Cliente",

        "Frecuencia de Visita",
      ],

      ...responses.flatMap((response) =>
        openQuestions.flatMap((question) => {
          const answer = response[question.id].trim()

          return answer
            ? [
                [
                  response.id,

                  formatDate(response.createdAt, false),

                  `P${question.number}. ${question.title}`,

                  answer,

                  response.q1 || "-",
                ],
              ]
            : []
        }),
      ),
    ])

    styleHeader(commentsSheet.getRow(4))

    commentsSheet.views = [{ state: "frozen", ySplit: 4 }]

    commentsSheet.columns = [
      { width: 38 },

      { width: 14 },

      { width: 60 },

      { width: 60 },

      { width: 24 },
    ]

    commentsSheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true }
    })

    styleHeader(commentsSheet.getRow(4))

    const buffer = await workbook.xlsx.writeBuffer()

    const blob = new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")

    link.href = url

    link.download = `Reporte_Encuestas_UMARU_${new Date()

      .toISOString()

      .slice(0, 10)}.xlsx`

    link.click()

    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    console.error("No se pudo generar el archivo de Excel:", error)

    alert("No se pudo generar el archivo de Excel. Intenta de nuevo.")
  }
}
