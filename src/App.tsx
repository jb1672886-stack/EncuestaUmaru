import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { logoBase64 } from "./lib/logoBase64"
import floresImage from "./imports/flores.png"
import { supabase } from "./lib/supabase"
import { exportSurveyToExcel } from "./lib/exportExcel"
import QRCode from "qrcode"

type View = "survey" | "las-flores" | "admin-login" | "results" | "las-flores-results" | "thanks" | "las-flores-thanks"

type LasFloresAnswers = {
  serverName: string
  dishConsumed: string
  visitType: string
  visitFrequency: string
  attentionRating: string
  dishesRating: string
  ambienceRating: string
  recommendationRating: string
  suggestion: string
}

type LasFloresResponse = LasFloresAnswers & {
  id: string
  createdAt: string
}

type LasFloresDatabaseResponse = {
  id: string
  created_at: string
  server_name: string
  dish_consumed: string
  visit_type: string
  visit_frequency: string | null
  attention_rating: number
  dishes_rating: number
  ambience_rating: number
  recommendation_rating: number
  suggestion: string
}

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

type DatabaseResponse = Omit<Response, "createdAt" | "q5Other"> & {
  created_at: string
  q5_other?: string
}

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8"
  number: string
  title: string
  hint?: string
  options?: string[]
  maxLength?: number
}

const questions: Question[] = [
  {
    id: "q1",
    number: "01",
    title: "¿Con qué frecuencia visitas UMARU?",
    options: ["Primera vez", "Mensual", "Cada 2–3 meses", "Casi nunca"],
  },
  {
    id: "q2",
    number: "02",
    title: "¿Qué te gustaría encontrar con mayor frecuencia en nuestra carta?",
    options: [
      "Carnes y parrillas",
      "Comida tradicional",
      "Platos de autor",
      "Pastas y opciones italianas",
      "Opciones ligeras",
    ],
  },
  {
    id: "q3",
    number: "03",
    title: "Menciona 2 platos que te motivarían a venir a UMARU esta semana.",
    hint: "Respuesta abierta breve",
    maxLength: 180,
  },
  {
    id: "q4",
    number: "04",
    title: "¿Qué valoras más al elegir un restaurante?",
    options: ["Sabor", "Porción", "Atención", "Ambiente", "Presentación"],
  },
  {
    id: "q5",
    number: "05",
    title:
      "¿Cuál es el principal motivo por el que no visitas UMARU más seguido?",
    options: [
      "La carta",
      "Ubicación",
      "Horarios",
      "Experiencia anterior",
      "Otro",
    ],
  },
  {
    id: "q6",
    number: "06",
    title: "¿Con quién visitarías UMARU?",
    options: ["Pareja", "Familia", "Amigos", "Trabajo", "Solo(a)"],
  },
  {
    id: "q7",
    number: "07",
    title: "¿Qué tipo de música prefieres escuchar durante tu visita a UMARU?",
    options: [
      "Música Ayacuchana",
      "Música criolla",
      "Música latinoamericana",
      "Pop y Rock clásico",
      "Música clásica e instrumental",
    ],
  },
  {
    id: "q8",
    number: "08",
    title:
      "¿Te gustaría encontrar en la carta de UMARU una mayor presencia de platos inspirados en la gastronomía típica ayacuchana?",
    options: ["Sí", "Tal vez", "No"],
  },
]

type QuestionId = Question["id"]

function normalizeStoredResponse(value: unknown): Response {
  const stored = value as Partial<Record<QuestionId, string | string[]>> & {
    id?: string
    createdAt?: string
    q5Other?: string
    q5_other?: string
  }
  const answer = (id: QuestionId) => {
    const value = stored[id]
    return Array.isArray(value) ? value.join(", ") : value || ""
  }

  return {
    id: stored.id || crypto.randomUUID(),
    createdAt: stored.createdAt || new Date().toISOString(),
    q1: answer("q1"),
    q2: answer("q2"),
    q3: answer("q3"),
    q4: answer("q4"),
    q5: answer("q5"),
    q5Other: stored.q5Other || stored.q5_other || "",
    q6: answer("q6"),
    q7: answer("q7"),
    q8: answer("q8"),
  }
}

const storageKey = "umaru-survey-responses"
// Client-side hashes are only a visual gate, not a security boundary.
const adminPhraseHashes = {
  umaru: "e5838af3b02cbd6e99138299279a6bfff41b76cdac5aca6f2909a6005a4dba3b",
  "las-flores":
    "77eba5ba5060486d88cd4a5738b1c54f6b375c3d90cd7af9be706ab8308f95eb",
}

function mapDatabaseResponse(response: DatabaseResponse): Response {
  return normalizeStoredResponse({
    ...response,
    createdAt: response.created_at,
    q5Other: response.q5_other || "",
  })
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "arrow" | "chart" | "check" | "chevron" | "close" | "lock" | "refresh" | "survey" | "trash"
  className?: string
}) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    chart: (
      <>
        <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
        <path d="M3 7.5 9 3l6 6 6-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    refresh: (
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
    ),
    survey: (
      <>
        <path d="M9 5h10M9 12h10M9 19h10" />
        <path d="m3 5 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <path d="M10 11v6m4-6v6" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Header({
  view,
  onNavigate,
  onAdminOpen,
}: {
  view: View
  onNavigate: (view: View) => void
  onAdminOpen: () => void
}) {
  const [clickCount, setClickCount] = useState(0)
  const isLasFlores =
    view === "las-flores" ||
    view === "las-flores-thanks" ||
    view === "las-flores-results"
  const isLasFloresResults = view === "las-flores-results"
  const isAdminView =
    view === "results" || isLasFloresResults || view === "admin-login"

  const handleLogoClick = () => {
    if (isAdminView) {
      onNavigate(isLasFlores ? "las-flores" : "survey")
      return
    }

    const nextCount = clickCount + 1
    if (nextCount >= 3) {
      setClickCount(0)
      onAdminOpen()
    } else {
      setClickCount(nextCount)
      setTimeout(() => setClickCount(0), 1000)
    }
  }

  return (
    <header className="border-b border-[#ded8ce] bg-[#f7f4ee]/95 backdrop-blur">
      <div className="mx-auto flex h-[86px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <button
          className="flex items-center gap-3 text-left cursor-pointer"
          onClick={handleLogoClick}
          aria-label="Ir al inicio"
        >
          {isLasFlores ? (
            <img
              src={floresImage}
              alt="Las Flores"
              className="h-14 w-[140px] object-contain"
            />
          ) : (
            <img
              src={logoBase64}
              alt="Umaru Hotel"
              className="h-14 w-auto max-h-14 max-w-[130px] object-contain mix-blend-multiply"
            />
          )}
          <span className="hidden border-l border-[#cfc6b8] pl-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#765e50] sm:block">
            {isLasFlores ? (
              <>Encuesta de satisfacción</>
            ) : (
              <>
                Nueva propuesta
                <br />
                gastronómica
              </>
            )}
          </span>
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdminView ? (
            <button
              onClick={() => onNavigate(isLasFlores ? "las-flores" : "survey")}
              aria-label="Volver a la encuesta"
              className="group flex items-center gap-2 rounded-full border border-[#c8bfb1] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#463b35] transition hover:border-[#98592f] hover:bg-white"
            >
              <Icon name="survey" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function Survey({
  onSubmit,
}: {
  onSubmit: (
    response: Omit<Response, "id" | "createdAt">,
  ) => Promise<void> | void
}) {
  const [answers, setAnswers] = useState({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q5Other: "",
    q6: "",
    q7: "",
    q8: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  function setSingle(id: QuestionId, value: string) {
    setAnswers((current) => ({
      ...current,
      [id]: value,
      ...(id === "q5" && value !== "Otro" ? { q5Other: "" } : {}),
    }))
    setError("")
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (questions.some((question) => !answers[question.id].trim())) {
      setError("Completa todas las preguntas para enviar tu opinión.")
      return
    }
    if (answers.q5 === "Otro" && !answers.q5Other.trim()) {
      setError("Cuéntanos cuál es el motivo al seleccionar “Otro”.")
      return
    }
    try {
      setIsSubmitting(true)
      await onSubmit(answers)
    } catch {
      setError(
        "Hubo un error al enviar tu respuesta. Por favor intenta de nuevo.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden border-b border-[#ded8ce] bg-[#f7f4ee]">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="relative mx-auto max-w-4xl px-5 py-14 text-center sm:px-8 sm:py-20">
          <h1 className="font-display text-5xl leading-[0.98] tracking-[-0.04em] text-[#342b27] sm:text-7xl lg:text-[84px]">
            Tu opinión
            <br />
            <span className="italic text-[#a76134]">transforma</span> UMARU
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#6e625c] sm:text-lg">
            Ayúdanos a crear una experiencia que realmente quieras repetir. Solo
            te tomará unos minutos.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#ded5c8] bg-white/80 px-5 py-2.5 text-xs font-medium text-[#766a63] shadow-xs sm:text-sm">
              <Icon name="lock" className="h-4 w-4 shrink-0 text-[#a36135]" />
              <span>Tu respuesta es completamente anónima y confidencial.</span>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={submit}
        className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="space-y-5">
          {questions.map((question) => (
            <fieldset
              key={question.id}
              className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9"
            >
              <legend className="sr-only">{question.title}</legend>
              <div className="mb-7 flex gap-4 sm:gap-6">
                <span className="font-display text-2xl italic text-[#b87545]">
                  {question.number}
                </span>
                <div>
                  <h2 className="text-lg font-semibold leading-7 text-[#382f2b] sm:text-xl">
                    {question.title}
                  </h2>
                  {question.hint && (
                    <p className="mt-1 text-sm font-medium text-[#9a5d35]">
                      {question.hint}
                    </p>
                  )}
                </div>
              </div>
              {question.options ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {question.options.map((option) => {
                      const isChecked = answers[question.id] === option
                      return (
                        <label
                          key={option}
                          className={`option-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 text-sm leading-5 transition ${
                            isChecked
                              ? "border-[#a86438] bg-[#fbf4ed] text-[#4a3326]"
                              : "border-[#e0dbd3] bg-[#fcfbf9] text-[#615750] hover:border-[#bda78f]"
                          }`}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name={question.id}
                            checked={isChecked}
                            onChange={() => setSingle(question.id, option)}
                          />
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              isChecked
                                ? "border-[#a86438] bg-[#a86438] text-white"
                                : "border-[#b9b0a6] bg-white"
                            }`}
                          >
                            {isChecked && (
                              <Icon name="check" className="h-3.5 w-3.5" />
                            )}
                          </span>
                          {option}
                        </label>
                      )
                    })}
                  </div>
                  {question.id === "q5" && answers.q5 === "Otro" && (
                    <label className="mt-5 block text-sm font-semibold text-[#51433c]">
                      ¿Cuál es el motivo?
                      <input
                        type="text"
                        value={answers.q5Other}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            q5Other: event.target.value,
                          }))
                        }
                        required
                        maxLength={180}
                        placeholder="Escribe brevemente el motivo..."
                        className="mt-2 w-full rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-4 py-3 text-sm font-normal text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
                      />
                    </label>
                  )}
                </>
              ) : (
                <textarea
                  value={answers[question.id]}
                  onChange={(event) =>
                    setSingle(question.id, event.target.value)
                  }
                  required
                  maxLength={question.maxLength}
                  rows={3}
                  placeholder="Escribe aquí tu respuesta..."
                  className="w-full resize-y rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] p-4 text-sm leading-6 text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
                />
              )}
            </fieldset>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-[#deb59c] bg-[#fff5ed] px-5 py-4 text-sm font-medium text-[#87451e]"
          >
            {error}
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#b87443] px-10 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-[#b87443]/20 transition hover:bg-[#c98553] hover:shadow-lg hover:shadow-[#b87443]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? "Enviando respuesta..." : "Enviar opinión"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </main>
  )
}

function Results({
  responses,
  onRefresh,
  onClear,
  isRefreshing,
  lastUpdated,
}: {
  responses: Response[]
  onRefresh?: () => void
  onClear?: () => void
  isRefreshing?: boolean
  lastUpdated?: Date
}) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const total = responses.length
  const today = new Date().toDateString()
  const todayCount = responses.filter(
    (response) => new Date(response.createdAt).toDateString() === today,
  ).length

  const resultGroups = useMemo(
    () =>
      questions
        .filter(
          (question): question is Question & { options: string[] } =>
            question.options !== undefined,
        )
        .map((question) => ({
          ...question,
          counts: question.options.map((option) => ({
            option,
            count: responses.filter((response) => {
              const answer = response[question.id]
              return answer === option
            }).length,
          })),
        })),
    [responses],
  )

  return (
    <main className="min-h-[calc(100vh-86px)] bg-[#f1eee8]">
      <section className="border-b border-[#d8d1c7] bg-[#3a302b] text-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d6a37d]">
            <span className="h-px w-8 bg-[#d6a37d]" />
            Panel del encuestador
          </div>
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <h1 className="font-display text-4xl sm:text-6xl">
                Resultados de la encuesta
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#cfc5bf] sm:text-base">
                Conteo consolidado y en tiempo real de todas las respuestas
                anónimas recibidas.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex items-center gap-2 rounded-full bg-[#27201c] px-3.5 py-1.5 text-xs font-semibold text-[#c8bfb8]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#70a67a] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#70a67a]" />
                </span>
                <span>En vivo · Autoactualización activa</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {lastUpdated && (
                  <span className="text-xs text-[#a3978f]">
                    Actualizado: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 rounded-full border border-[#5d4f46] bg-[#433731] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#eedfd5] transition hover:border-[#aa693d] hover:bg-[#52443d] disabled:opacity-50"
                  >
                    <Icon
                      name="refresh"
                      className={`h-3.5 w-3.5 ${
                        isRefreshing ? "animate-spin text-[#d6a37d]" : ""
                      }`}
                    />
                    {isRefreshing ? "Actualizando..." : "Actualizar ahora"}
                  </button>
                )}
                {onClear && total > 0 && (
                  <button
                    onClick={onClear}
                    className="flex items-center gap-2 rounded-full border border-[#7a3b30] bg-[#45231c] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#f4bab0] transition hover:border-[#a84d3e] hover:bg-[#572b22]"
                    title="Eliminar todas las respuestas de prueba"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5 text-[#f4bab0]" />
                    <span>Vaciar datos</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Export Section */}
      {total > 0 && (
        <section className="border-b border-[#d8d1c7] bg-[#f7f4ee]">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <div className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8">
              <h2 className="mb-1 text-lg font-bold text-[#3a302b]">
                Exportar datos a Excel
              </h2>
              <p className="mb-6 text-sm text-[#83776f]">
                Descarga un reporte completo con respuestas detalladas, cuadros
                estadísticos y propuestas de clientes.
              </p>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                {/* Export all */}
                <button
                  onClick={() => exportSurveyToExcel(responses, questions)}
                  className="flex items-center gap-2 rounded-xl bg-[#3a302b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#51433c]"
                >
                  <Icon name="download" className="h-4 w-4" />
                  Exportar todo
                </button>

                {/* Divider */}
                <div className="hidden h-10 w-px bg-[#ddd6cd] sm:block" />

                {/* Date range */}
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#51433c]">
                    Desde
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-3 py-2.5 text-sm text-[#463b35] outline-none transition focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#51433c]">
                    Hasta
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-3 py-2.5 text-sm text-[#463b35] outline-none transition focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
                    />
                  </label>
                  <button
                    onClick={() => {
                      if (!dateFrom && !dateTo) {
                        alert("Selecciona al menos una fecha para filtrar.")
                        return
                      }
                      const filtered = responses.filter((r) => {
                        const d = new Date(r.createdAt)
                          .toISOString()
                          .slice(0, 10)
                        if (dateFrom && d < dateFrom) return false
                        if (dateTo && d > dateTo) return false
                        return true
                      })
                      if (filtered.length === 0) {
                        alert(
                          "No hay respuestas en el rango de fechas seleccionado.",
                        )
                        return
                      }
                      exportSurveyToExcel(filtered, questions)
                    }}
                    disabled={!dateFrom && !dateTo}
                    className="flex items-center gap-2 rounded-xl border border-[#b87545] bg-[#f5e9df] px-5 py-2.5 text-sm font-bold text-[#8a5230] transition hover:bg-[#eedcc9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name="download" className="h-4 w-4" />
                    Exportar por fechas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#ddd6cd] bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#887b73]">
              Total de respuestas
            </p>
            <p className="mt-3 font-display text-5xl text-[#3a302b]">{total}</p>
          </div>
          <div className="rounded-2xl border border-[#ddd6cd] bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#887b73]">
              Recibidas hoy
            </p>
            <p className="mt-3 font-display text-5xl text-[#a66337]">
              {todayCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#ddd6cd] bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#887b73]">
              Preguntas
            </p>
            <p className="mt-3 font-display text-5xl text-[#3a302b]">
              {questions.length}
            </p>
          </div>
        </div>

        {total === 0 && (
          <div className="mb-8 rounded-2xl border border-dashed border-[#c9bfb3] bg-white/60 px-6 py-8 text-center">
            <p className="font-semibold text-[#4b403a]">
              Aún no hay respuestas registradas.
            </p>
            <p className="mt-1 text-sm text-[#83776f]">
              Completa la encuesta para ver el conteo reflejado aquí.
            </p>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {resultGroups.map((question) => {
            const optionTotal = question.counts.reduce(
              (sum, item) => sum + item.count,
              0,
            )
            const leadingOption = question.counts.reduce(
              (leader, item) => (item.count > leader.count ? item : leader),
              question.counts[0],
            )
            const leadingPercentage = total
              ? Math.round((leadingOption.count / total) * 100)
              : 0
            return (
              <section
                key={question.id}
                className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8"
              >
                <div className="mb-7 flex gap-4">
                  <span className="font-display text-xl italic text-[#b87545]">
                    {question.number}
                  </span>
                  <div>
                    <h2 className="font-semibold leading-6 text-[#403630]">
                      {question.title}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-[#958a83]">
                      {optionTotal} {optionTotal === 1 ? "voto" : "votos"}
                    </p>
                  </div>
                </div>
                <div className="mb-7 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-[#e8e2da] bg-[#faf8f5] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#91857d]">
                      Votos
                    </p>
                    <p className="mt-1 font-display text-2xl text-[#3f342e]">
                      {optionTotal}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-[#eadbce] bg-[#fbf4ed] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a6c4c]">
                      Opción más votada
                    </p>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[#594438]">
                        {total ? leadingOption.option : "Sin respuestas"}
                      </p>
                      <p className="shrink-0 font-display text-xl text-[#a66337]">
                        {leadingPercentage}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  {question.counts.map(({ option, count }) => {
                    const percentage = total
                      ? Math.round((count / total) * 100)
                      : 0
                    return (
                      <div key={option}>
                        <div className="mb-2 flex items-end justify-between gap-4 text-sm">
                          <span className="text-[#625750]">{option}</span>
                          <span className="shrink-0 font-bold text-[#4a3c34]">
                            {count}{" "}
                            <span className="font-normal text-[#9a8e86]">
                              ({percentage}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#eeeae4]">
                          <div
                            className="h-full rounded-full bg-[#b67040] transition-all duration-700"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {question.id === "q5" && (
                  <div className="mt-7 border-t border-[#e8e2da] pt-5">
                    <h3 className="mb-3 text-sm font-semibold text-[#51433c]">
                      Motivos indicados en “Otro”
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {responses.filter((response) => response.q5Other.trim())
                        .length ? (
                        responses
                          .filter((response) => response.q5Other.trim())
                          .map((response) => (
                            <p
                              key={response.id}
                              className="rounded-lg bg-[#faf8f5] px-4 py-3 text-sm text-[#665a53]"
                            >
                              {response.q5Other}
                            </p>
                          ))
                      ) : (
                        <p className="text-sm text-[#90857e]">
                          Aún no hay motivos escritos.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )
          })}

          {questions
            .filter((question) => !question.options)
            .map((question) => {
              const openResponses = responses
                .filter((response) => response[question.id].trim())
                .slice()
                .reverse()
              return (
                <section
                  key={question.id}
                  className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8 lg:col-span-2"
                >
                  <div className="mb-6 flex items-start gap-4">
                    <span className="font-display text-xl italic text-[#b87545]">
                      {question.number}
                    </span>
                    <div>
                      <h2 className="font-semibold text-[#403630]">
                        {question.title}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-[#958a83]">
                        {openResponses.length} respuestas abiertas
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {openResponses.length ? (
                      openResponses.map((response) => (
                        <blockquote
                          key={response.id}
                          className="rounded-xl border border-[#e2ddd6] bg-[#faf8f5] p-5 text-sm leading-6 text-[#665a53]"
                        >
                          “{response[question.id]}”
                        </blockquote>
                      ))
                    ) : (
                      <p className="text-sm text-[#90857e]">
                        Aún no hay respuestas escritas.
                      </p>
                    )}
                  </div>
                </section>
              )
            })}
        </div>
      </div>
    </main>
  )
}

const visitTypeOptions = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "frecuente", label: "Frecuente" },
]

const visitFrequencyOptions = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "feriados", label: "Feriados" },
  { value: "ocasional", label: "Fechas especiales" },
]

const ratingQuestions: {
  key: "attentionRating" | "dishesRating" | "ambienceRating" | "recommendationRating"
  number: string
  title: string
}[] = [
  { key: "attentionRating", number: "04", title: "Atención" },
  { key: "dishesRating", number: "05", title: "Platillos" },
  { key: "ambienceRating", number: "06", title: "Ambiente" },
  { key: "recommendationRating", number: "07", title: "¿Nos recomendaría?" },
]

function LasFloresSurvey({
  onSubmit,
}: {
  onSubmit: (answers: LasFloresAnswers) => Promise<void> | void
}) {
  const [answers, setAnswers] = useState<LasFloresAnswers>({
    serverName: "",
    dishConsumed: "",
    visitType: "",
    visitFrequency: "",
    attentionRating: "",
    dishesRating: "",
    ambienceRating: "",
    recommendationRating: "",
    suggestion: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  function updateAnswer(key: keyof LasFloresAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
      ...(key === "visitType" && value === "si" ? { visitFrequency: "" } : {}),
    }))
    setError("")
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const requiredAnswers = [
      answers.serverName,
      answers.dishConsumed,
      answers.visitType,
      ...(answers.visitType === "si" ? [] : [answers.visitFrequency]),
      answers.attentionRating,
      answers.dishesRating,
      answers.ambienceRating,
      answers.recommendationRating,
    ]
    if (requiredAnswers.some((answer) => !answer.trim())) {
      setError("Completa todos los campos obligatorios para enviar tu opinión.")
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(answers)
    } catch {
      setError("No se pudo guardar tu respuesta. Por favor, intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderOptions(
    key: "visitType" | "visitFrequency",
    options: { value: string label: string }[],
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isChecked = answers[key] === option.value
          return (
            <label
              key={option.value}
              className={`option-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 text-sm transition ${
                isChecked
                  ? "border-[#a86438] bg-[#fbf4ed] text-[#4a3326]"
                  : "border-[#e0dbd3] bg-[#fcfbf9] text-[#615750] hover:border-[#bda78f]"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={key}
                value={option.value}
                checked={isChecked}
                onChange={() => updateAnswer(key, option.value)}
              />
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isChecked
                    ? "border-[#a86438] bg-[#a86438] text-white"
                    : "border-[#b9b0a6] bg-white"
                }`}
              >
                {isChecked && <Icon name="check" className="h-3.5 w-3.5" />}
              </span>
              {option.label}
            </label>
          )
        })}
      </div>
    )
  }

  return (
    <main>
      <section className="relative overflow-hidden border-b border-[#ded8ce] bg-[#f7f4ee]">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="relative mx-auto max-w-4xl px-5 py-14 text-center sm:px-8 sm:py-20">
          <img
            src={floresImage}
            alt="Las Flores"
            className="mx-auto mb-6 h-auto w-56 object-contain sm:w-64"
          />
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#a76134]">
            Las Flores
          </p>
          <h1 className="font-display text-5xl leading-[0.98] tracking-[-0.04em] text-[#342b27] sm:text-7xl lg:text-[84px]">
            Encuesta de
            <br />
            <span className="italic text-[#a76134]">satisfacción</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#6e625c] sm:text-lg">
            Tu experiencia nos ayuda a ofrecerte un mejor servicio. Gracias por
            compartir tu opinión.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#ded5c8] bg-white/80 px-5 py-2.5 text-xs font-medium text-[#766a63] shadow-xs sm:text-sm">
              <Icon name="lock" className="h-4 w-4 shrink-0 text-[#a36135]" />
              <span>Tu respuesta es confidencial.</span>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={submit}
        className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20"
      >
        <div className="space-y-5">
          <fieldset className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9">
            <legend className="sr-only">Datos de tu visita</legend>
            <p className="mb-7 text-xs font-bold uppercase tracking-[0.16em] text-[#a76134]">
              Las Flores · {new Date().toLocaleDateString("es-PE")}
            </p>
            <label className="mb-6 block text-lg font-semibold text-[#382f2b]">
              <span className="mb-3 flex gap-4">
                <span className="font-display text-2xl italic text-[#b87545]">
                  01
                </span>
                <span>Nombre del mozo o moza</span>
              </span>
              <input
                type="text"
                value={answers.serverName}
                onChange={(event) =>
                  updateAnswer("serverName", event.target.value)
                }
                required
                maxLength={120}
                placeholder="Escribe el nombre"
                className="w-full rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-4 py-3 text-sm font-normal text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
              />
            </label>
            <label className="block text-lg font-semibold text-[#382f2b]">
              <span className="mb-3 flex gap-4">
                <span className="font-display text-2xl italic text-[#b87545]">
                  02
                </span>
                <span>Plato que consumió</span>
              </span>
              <input
                type="text"
                value={answers.dishConsumed}
                onChange={(event) =>
                  updateAnswer("dishConsumed", event.target.value)
                }
                required
                maxLength={180}
                placeholder="Escribe el nombre del plato"
                className="w-full rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-4 py-3 text-sm font-normal text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
              />
            </label>
          </fieldset>

          <fieldset className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9">
            <legend className="sr-only">¿Es su primera visita?</legend>
            <div className="mb-7 flex gap-4">
              <span className="font-display text-2xl italic text-[#b87545]">
                03
              </span>
              <h2 className="text-lg font-semibold leading-7 text-[#382f2b] sm:text-xl">
                ¿Es su primera visita?
              </h2>
            </div>
            {renderOptions("visitType", visitTypeOptions)}
            {answers.visitType !== "" && answers.visitType !== "si" && (
              <>
                <h3 className="mb-4 mt-8 text-base font-semibold text-[#382f2b]">
                  Frecuencia de visita
                </h3>
                {renderOptions("visitFrequency", visitFrequencyOptions)}
              </>
            )}
          </fieldset>

          <fieldset className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9">
            <legend className="sr-only">Califica tu experiencia</legend>
            <p className="mb-7 rounded-xl bg-[#faf8f5] px-4 py-3 text-sm font-medium text-[#6e625c]">
              Califica del 1 al 5: 1 = Pésimo · 3 = Bueno · 5 = Muy bueno
            </p>
            <div className="space-y-7">
              {ratingQuestions.map((question) => (
                <div key={question.key}>
                  <h2 className="mb-3 flex gap-4 text-base font-semibold text-[#382f2b]">
                    <span className="font-display text-xl italic text-[#b87545]">
                      {question.number}
                    </span>
                    {question.title}
                  </h2>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => {
                      const isChecked = answers[question.key] === String(rating)
                      return (
                        <label
                          key={rating}
                          className={`option-card flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition ${
                            isChecked
                              ? "border-[#a86438] bg-[#fbf4ed] text-[#4a3326]"
                              : "border-[#e0dbd3] bg-[#fcfbf9] text-[#615750] hover:border-[#bda78f]"
                          }`}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name={question.key}
                            value={rating}
                            checked={isChecked}
                            onChange={() =>
                              updateAnswer(question.key, String(rating))
                            }
                          />
                          <span className="font-bold">{rating}</span>
                          <span className="text-[10px] text-[#887b73]">
                            {rating === 1
                              ? "Pésimo"
                              : rating === 3
                                ? "Bueno"
                                : rating === 5
                                  ? "Muy bueno"
                                  : ""}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9">
            <legend className="sr-only">Sugerencia</legend>
            <label className="block text-lg font-semibold text-[#382f2b]">
              <span className="mb-3 block">Sugerencia</span>
              <textarea
                value={answers.suggestion}
                onChange={(event) =>
                  updateAnswer("suggestion", event.target.value)
                }
                maxLength={1000}
                rows={4}
                placeholder="Cuéntanos qué podríamos mejorar (opcional)"
                className="w-full resize-y rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] p-4 text-sm font-normal leading-6 text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
              />
            </label>
          </fieldset>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-[#deb59c] bg-[#fff5ed] px-5 py-4 text-sm font-medium text-[#87451e]"
          >
            {error}
          </p>
        )}

        <div className="mt-10 flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#b87443] px-10 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-[#b87443]/20 transition hover:bg-[#c98553] hover:shadow-lg hover:shadow-[#b87443]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? "Enviando respuesta..." : "Enviar opinión"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </main>
  )
}

function LasFloresResults({
  responses,
  onRefresh,
  onClear,
  isRefreshing,
  lastUpdated,
  loadError,
}: {
  responses: LasFloresResponse[]
  onRefresh: () => void
  onClear: () => void
  isRefreshing: boolean
  lastUpdated: Date
  loadError: string
}) {
  const [qrImage, setQrImage] = useState("")
  const [qrError, setQrError] = useState("")
  const surveyUrl = `${window.location.origin}${window.location.pathname}#las-flores`
  const total = responses.length
  const today = new Date().toDateString()
  const todayCount = responses.filter(
    (response) => new Date(response.createdAt).toDateString() === today,
  ).length
  const ratingFields = [
    { label: "Atención", field: "attentionRating", number: "04" },
    { label: "Platillos", field: "dishesRating", number: "05" },
    { label: "Ambiente", field: "ambienceRating", number: "06" },
    {
      label: "¿Nos recomendaría?",
      field: "recommendationRating",
      number: "07",
    },
  ] as const
  const visitTypeOptions = [
    { label: "Sí, primera visita", value: "si" },
    { label: "No", value: "no" },
    { label: "Frecuente", value: "frecuente" },
  ]
  const visitFrequencyOptions = [
    { label: "Semanal", value: "semanal" },
    { label: "Mensual", value: "mensual" },
    { label: "Feriados", value: "feriados" },
    { label: "Fechas especiales", value: "ocasional" },
  ]

  useEffect(() => {
    let active = true
    setQrError("")
    QRCode.toDataURL(surveyUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280,
      color: {
        dark: "#302824",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (active) setQrImage(dataUrl)
      })
      .catch((error: unknown) => {
        console.error("No se pudo generar el código QR de Las Flores:", error)
        if (active) {
          setQrImage("")
          setQrError("No se pudo generar el código QR. Recarga el panel.")
        }
      })

    return () => {
      active = false
    }
  }, [surveyUrl])

  function getTextDistribution(values: string[]) {
    const grouped = new Map<string, { label: string count: number }>()
    values.forEach((value) => {
      const label = value.trim() || "Sin respuesta"
      const key = label.toLocaleLowerCase("es")
      const item = grouped.get(key)
      if (item) {
        item.count += 1
      } else {
        grouped.set(key, { label, count: 1 })
      }
    })
    return [...grouped.values()].sort((left, right) => right.count - left.count)
  }

  const ratingTotal = responses.reduce(
    (sum, response) =>
      sum +
      ratingFields.reduce(
        (fieldSum, { field }) => fieldSum + Number(response[field]),
        0,
      ),
    0,
  )
  const averageRating = total ? (ratingTotal / (total * 4)).toFixed(1) : "—"

  function renderDistribution(
    title: string,
    rows: { label: string count: number }[],
    number?: string,
  ) {
    const leadingOption = rows.reduce(
      (leader, item) => (item.count > leader.count ? item : leader),
      rows[0] || { label: "Sin respuestas", count: 0 },
    )
    const leadingPercentage = total
      ? Math.round((leadingOption.count / total) * 100)
      : 0

    return (
      <section
        key={title}
        className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8"
      >
        <div className="mb-7 flex gap-4">
          {number && (
            <span className="font-display text-xl italic text-[#b87545]">
              {number}
            </span>
          )}
          <div>
            <h2 className="font-semibold leading-6 text-[#403630]">{title}</h2>
            <p className="mt-1 text-xs font-medium text-[#958a83]">
              {total} {total === 1 ? "respuesta" : "respuestas"}
            </p>
          </div>
        </div>
        <div className="mb-7 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#e8e2da] bg-[#faf8f5] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#91857d]">
              Respuestas
            </p>
            <p className="mt-1 font-display text-2xl text-[#3f342e]">{total}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-[#eadbce] bg-[#fbf4ed] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a6c4c]">
              Respuesta más frecuente
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="truncate text-xs font-semibold text-[#594438]">
                {total ? leadingOption.label : "Sin respuestas"}
              </p>
              <p className="shrink-0 font-display text-xl text-[#a66337]">
                {leadingPercentage}%
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          {rows.map(({ label, count }) => {
            const percentage = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={label}>
                <div className="mb-2 flex items-end justify-between gap-4 text-sm">
                  <span className="text-[#625750]">{label}</span>
                  <span className="shrink-0 font-bold text-[#4a3c34]">
                    {count}{" "}
                    <span className="font-normal text-[#9a8e86]">
                      ({percentage}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eeeae4]">
                  <div
                    className="h-full rounded-full bg-[#b67040] transition-all duration-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <main className="min-h-[calc(100vh-86px)] bg-[#f1eee8]">
      <section className="border-b border-[#d8d1c7] bg-[#3a302b] text-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d6a37d]">
            <span className="h-px w-8 bg-[#d6a37d]" />
            Panel del encuestador · Las Flores
          </div>
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <div className="mb-6 inline-flex rounded-2xl bg-white px-5 py-3">
                <img
                  src={floresImage}
                  alt="Las Flores"
                  className="h-auto w-48 object-contain"
                />
              </div>
              <h1 className="font-display text-4xl sm:text-6xl">
                Resultados de satisfacción
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#cfc5bf] sm:text-base">
                Respuestas de Las Flores, separadas del panel de UMARU.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex items-center gap-2 rounded-full bg-[#27201c] px-3.5 py-1.5 text-xs font-semibold text-[#c8bfb8]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#70a67a] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#70a67a]" />
                </span>
                <span>Actualización automática activa</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-[#a3978f]">
                  Actualizado: {lastUpdated.toLocaleTimeString()}
                </span>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 rounded-full border border-[#5d4f46] bg-[#433731] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#eedfd5] transition hover:border-[#aa693d] hover:bg-[#52443d] disabled:opacity-50"
                >
                  <Icon
                    name="refresh"
                    className={`h-3.5 w-3.5 ${
                      isRefreshing ? "animate-spin text-[#d6a37d]" : ""
                    }`}
                  />
                  {isRefreshing ? "Actualizando..." : "Actualizar ahora"}
                </button>
                {total > 0 && (
                  <button
                    onClick={onClear}
                    className="flex items-center gap-2 rounded-full border border-[#7a3b30] bg-[#45231c] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#f4bab0] transition hover:border-[#a84d3e] hover:bg-[#572b22]"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                    Vaciar datos
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {loadError && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-[#deb59c] bg-[#fff5ed] px-5 py-4 text-sm font-medium text-[#87451e]"
          >
            {loadError}
          </p>
        )}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total de respuestas",
              value: String(total),
              color: "text-[#3a302b]",
            },
            {
              label: "Recibidas hoy",
              value: String(todayCount),
              color: "text-[#a66337]",
            },
            {
              label: "Promedio general",
              value: `${averageRating}/5`,
              color: "text-[#3a302b]",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-[#ddd6cd] bg-white p-6"
            >
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#887b73]">
                {metric.label}
              </p>
              <p className={`mt-3 font-display text-5xl ${metric.color}`}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-8 flex flex-col items-center gap-6 rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:flex-row sm:p-8">
          <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-xl border border-[#e8e2da] bg-white p-3">
            {qrImage ? (
              <img
                src={qrImage}
                alt="Código QR para abrir la encuesta de Las Flores"
                className="h-full w-full"
              />
            ) : (
              <span className="text-center text-sm text-[#83776f]">
                {qrError || "Generando código QR..."}
              </span>
            )}
          </div>
          <div className="w-full">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#a66337]">
              Comparte la encuesta
            </p>
            <h2 className="mt-2 font-display text-3xl text-[#3a302b]">
              Encuesta Las Flores
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#83776f]">
              Escanea este código para abrir la encuesta. El QR usa
              automáticamente la dirección de este sitio, también cuando esté
              desplegado en Vercel.
            </p>
            <p className="mt-3 break-all rounded-lg bg-[#faf8f5] px-3 py-2 text-xs text-[#665a53]">
              {surveyUrl}
            </p>
            {qrImage && (
              <a
                href={qrImage}
                download="encuesta-las-flores-qr.png"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3a302b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#51433c]"
              >
                Descargar QR en PNG
              </a>
            )}
          </div>
        </section>

        {total === 0 ? (
          <div className="mb-8 rounded-2xl border border-dashed border-[#c9bfb3] bg-white/60 px-6 py-8 text-center">
            <p className="font-semibold text-[#4b403a]">
              Aún no hay respuestas de Las Flores.
            </p>
            <p className="mt-1 text-sm text-[#83776f]">
              Las nuevas encuestas aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 grid gap-5 lg:grid-cols-2">
              {renderDistribution(
                "Nombre del mozo o moza",
                getTextDistribution(
                  responses.map((response) => response.serverName),
                ),
                "01",
              )}
              {renderDistribution(
                "Plato que consumió",
                getTextDistribution(
                  responses.map((response) => response.dishConsumed),
                ),
                "02",
              )}
              {renderDistribution(
                "¿Es su primera visita?",
                visitTypeOptions.map(({ label, value }) => ({
                  label,
                  count: responses.filter(
                    (response) => response.visitType === value,
                  ).length,
                })),
                "03",
              )}
              {renderDistribution(
                "Frecuencia de visita",
                visitFrequencyOptions.map(({ label, value }) => ({
                  label,
                  count: responses.filter(
                    (response) => response.visitFrequency === value,
                  ).length,
                })),
                "04",
              )}
              {ratingFields.map(({ label, field, number }) =>
                renderDistribution(
                  label,
                  [1, 2, 3, 4, 5].map((rating) => ({
                    label: `${rating}${
                      rating === 1
                        ? " · Pésimo"
                        : rating === 3
                          ? " · Bueno"
                          : rating === 5
                            ? " · Muy bueno"
                            : ""
                    }`,
                    count: responses.filter(
                      (response) => Number(response[field]) === rating,
                    ).length,
                  })),
                  number,
                ),
              )}
              {renderDistribution(
                "Sugerencias",
                getTextDistribution(
                  responses.map((response) => response.suggestion),
                ),
              )}
            </div>

            <section className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8">
              <h2 className="mb-5 font-semibold text-[#403630]">
                Respuestas y sugerencias
              </h2>
              <div className="space-y-4">
                {responses
                  .slice()
                  .reverse()
                  .map((response) => (
                    <article
                      key={response.id}
                      className="rounded-xl border border-[#e8e2da] bg-[#faf8f5] p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-[#887b73]">
                        <span>
                          {new Date(response.createdAt).toLocaleString("es-PE")}
                        </span>
                        <span>
                          Mozo(a): {response.serverName || "Sin indicar"} ·
                          Plato: {response.dishConsumed || "Sin indicar"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[#51433c]">
                        Visita: {response.visitType} · Frecuencia:{" "}
                        {response.visitFrequency || "No aplica"} · Atención:{" "}
                        {response.attentionRating}/5 · Platillos:{" "}
                        {response.dishesRating}/5 · Ambiente:{" "}
                        {response.ambienceRating}/5 · Recomendación:{" "}
                        {response.recommendationRating}/5
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#665a53]">
                        Sugerencia: {response.suggestion || "Sin sugerencia"}
                      </p>
                    </article>
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function ThankYou({ restaurant = "UMARU" }: { restaurant?: string }) {
  return (
    <main className="flex min-h-[calc(100vh-94px)] items-center justify-center bg-[#f1eee8] px-5 py-16">
      <div className="w-full max-w-2xl rounded-3xl border border-[#ddd5ca] bg-white px-7 py-14 text-center shadow-[0_20px_80px_rgba(61,45,35,0.08)] sm:px-16">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f5e9df] text-[#a56236]">
          <Icon name="check" className="h-8 w-8" />
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#a56236]">
          Respuesta registrada
        </p>
        <h1 className="mt-4 font-display text-4xl text-[#392f2a] sm:text-6xl">
          Gracias por ayudarnos a mejorar.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#786b64]">
          Tu opinión ya forma parte de la experiencia de {restaurant}. La
          respuesta se guardó de forma anónima.
        </p>
        <div className="mt-9 inline-flex items-center justify-center rounded-full border border-[#d8d0c4] bg-[#f8f5ef] px-7 py-3.5 text-sm font-medium text-[#786b64] shadow-xs">
          Encuesta finalizada con éxito. Ya puedes cerrar esta pestaña.
        </div>
      </div>
    </main>
  )
}

function AdminLogin({
  onSuccess,
}: {
  onSuccess: (restaurant: "umaru" | "las-flores") => void
}) {
  const [phrase, setPhrase] = useState("")
  const [restaurant, setRestaurant] = useState<"umaru" | "las-flores">("umaru")
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(phrase),
      )
      const phraseHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")

      if (phraseHash !== adminPhraseHashes[restaurant]) {
        setError("La contraseña no es válida para el panel seleccionado.")
        return
      }

      onSuccess(restaurant)
    } catch (error) {
      console.error("No se pudo validar la contraseña del panel:", error)
      setError("No se pudo validar la contraseña. Intenta de nuevo.")
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-86px)] items-center justify-center bg-[#f1eee8] px-5 py-16">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-[#ddd5ca] bg-white px-7 py-10 shadow-[0_20px_80px_rgba(61,45,35,0.08)] sm:px-10"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5e9df] text-[#a56236]">
          <Icon name="lock" className="h-7 w-7" />
        </div>
        <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#a56236]">
          Acceso administrador
        </p>
        <h1 className="mt-3 text-center font-display text-4xl text-[#392f2a]">
          Ingresar contraseña
        </h1>
        <fieldset className="mt-7">
          <legend className="mb-3 block text-sm font-semibold text-[#51433c]">
            Elige el panel
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["umaru", "UMARU"],
              ["las-flores", "Las Flores"],
            ] as const).map(([value, label]) => {
              const isSelected = restaurant === value
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                    isSelected
                      ? "border-[#a86438] bg-[#fbf4ed] text-[#4a3326]"
                      : "border-[#e0dbd3] bg-[#fcfbf9] text-[#615750] hover:border-[#bda78f]"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="admin-restaurant"
                    value={value}
                    checked={isSelected}
                    onChange={() => {
                      setRestaurant(value)
                      setError("")
                    }}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </fieldset>
        <label className="mt-8 block text-sm font-semibold text-[#51433c]">
          Contraseña
          <input
            type="password"
            value={phrase}
            onChange={(event) => {
              setPhrase(event.target.value)
              setError("")
            }}
            required
            autoComplete="off"
            placeholder="Escribe tu contraseña"
            className="mt-2 w-full rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] px-4 py-3 text-sm text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
          />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-[#87451e]">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#3a302b] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#51433c]"
        >
          Entrar al panel
          <Icon name="arrow" />
        </button>
      </form>
    </main>
  )
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash.toLowerCase() : ""
    const search =
      typeof window !== "undefined" ? window.location.search.toLowerCase() : ""
    if (hash === "#las-flores-admin" || hash === "#las-flores-admin-login") {
      return "admin-login"
    }
    if (
      hash === "#admin" ||
      hash === "#admin-login" ||
      search.includes("admin")
    ) {
      return "admin-login"
    }
    if (hash === "#results") return "results"
    if (hash === "#las-flores-results") return "las-flores-results"
    if (hash === "#las-flores") return "las-flores"
    if (hash === "#las-flores-thanks") return "las-flores-thanks"
    if (hash === "#thanks") return "thanks"

    try {
      const saved = sessionStorage.getItem("umaru-active-view") as View | null
      if (
        saved &&
        [
          "survey",
          "las-flores",
          "admin-login",
          "results",
          "las-flores-results",
          "thanks",
          "las-flores-thanks",
        ].includes(saved)
      ) {
        return saved
      }
    } catch {}

    return "survey"
  })
  const [adminOrigin, setAdminOrigin] = useState<"survey" | "las-flores">(() =>
    typeof window !== "undefined" &&
    (window.location.hash === "#las-flores-admin" ||
      window.location.hash === "#las-flores-admin-login")
      ? "las-flores"
      : "survey",
  )
  const [responses, setResponses] = useState<Response[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]")
      return Array.isArray(stored) ? stored.map(normalizeStoredResponse) : []
    } catch {
      return []
    }
  })
  const [lasFloresResponses, setLasFloresResponses] =
    useState<LasFloresResponse[]>(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("las-flores-survey-responses") || "[]",
        )
        return Array.isArray(stored)
          ? stored.map((response) => ({
              ...response,
              createdAt: response.createdAt || new Date().toISOString(),
            }))
          : []
      } catch {
        return []
      }
    })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isLasFloresRefreshing, setIsLasFloresRefreshing] = useState(false)
  const [lasFloresLoadError, setLasFloresLoadError] = useState("")

  useEffect(() => {
    document.title =
      view === "las-flores" ||
      view === "las-flores-thanks" ||
      view === "las-flores-results"
        ? "Encuesta de Satisfacción · Las Flores"
        : "Encuesta de Satisfacción · UMARU Hotel"
  }, [view])

  const fetchResponses = useCallback(async (showLoading = false) => {
    if (!supabase) return
    if (showLoading) setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .order("created_at", { ascending: true })

      if (!error && data) {
        setResponses((data as DatabaseResponse[]).map(mapDatabaseResponse))
        setLastUpdated(new Date())
      } else if (error) {
        console.error(
          "No se pudieron cargar las respuestas de Supabase:",
          error,
        )
      }
    } catch (err) {
      console.error("Error al sincronizar respuestas:", err)
    } finally {
      if (showLoading) setIsRefreshing(false)
    }
  }, [])

  const fetchLasFloresResponses = useCallback(async (showLoading = false) => {
    if (!supabase) return
    if (showLoading) setIsLasFloresRefreshing(true)
    try {
      const { data, error } = await supabase
        .from("las_flores_responses")
        .select("*")
        .order("created_at", { ascending: true })

      if (error) {
        console.error(
          "No se pudieron cargar las respuestas de Las Flores:",
          error,
        )
        setLasFloresLoadError(
          "No se pudieron cargar las respuestas de Las Flores. Ejecuta el script actualizado de supabase.sql en Supabase y vuelve a intentarlo.",
        )
        return
      }

      if (data) {
        setLasFloresLoadError("")
        const mapped = (data as LasFloresDatabaseResponse[]).map(
          (response) => ({
            id: response.id,
            createdAt: response.created_at,
            serverName: response.server_name,
            dishConsumed: response.dish_consumed,
            visitType: response.visit_type,
            visitFrequency: response.visit_frequency || "",
            attentionRating: String(response.attention_rating),
            dishesRating: String(response.dishes_rating),
            ambienceRating: String(response.ambience_rating),
            recommendationRating: String(response.recommendation_rating),
            suggestion: response.suggestion || "",
          }),
        )
        setLasFloresResponses(mapped)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("Error al sincronizar respuestas de Las Flores:", error)
      setLasFloresLoadError(
        "Ocurrió un error al consultar las respuestas de Las Flores. Intenta actualizar el panel.",
      )
    } finally {
      if (showLoading) setIsLasFloresRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (view === "las-flores-results") {
      fetchLasFloresResponses()
    } else if (view === "results") {
      fetchResponses()
    }
  }, [fetchLasFloresResponses, fetchResponses, view])

  useEffect(() => {
    if (!supabase || (view !== "results" && view !== "las-flores-results")) {
      return
    }

    let active = true

    const isLasFloresPanel = view === "las-flores-results"
    const table = isLasFloresPanel ? "las_flores_responses" : "survey_responses"
    const channel = supabase
      .channel(`${table}_live`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (!active) return
        if (isLasFloresPanel) {
          fetchLasFloresResponses()
        } else {
          fetchResponses()
        }
      })
      .subscribe()

    const pollInterval = setInterval(() => {
      if (!active) return
      if (isLasFloresPanel) {
        fetchLasFloresResponses()
      } else {
        fetchResponses()
      }
    }, 4000)

    return () => {
      active = false
      if (pollInterval) clearInterval(pollInterval)
      void supabase.removeChannel(channel)
    }
  }, [fetchLasFloresResponses, fetchResponses, view])

  function navigate(nextView: View) {
    try {
      sessionStorage.setItem("umaru-active-view", nextView)
    } catch {}

    if (nextView === "results") {
      window.location.hash = "results"
    } else if (nextView === "las-flores-results") {
      window.location.hash = "las-flores-results"
    } else if (nextView === "thanks") {
      window.location.hash = "thanks"
    } else if (nextView === "las-flores") {
      window.location.hash = "las-flores"
    } else if (nextView === "las-flores-thanks") {
      window.location.hash = "las-flores-thanks"
    } else if (nextView === "admin-login") {
      window.location.hash = "admin"
    } else if (nextView === "survey") {
      if (window.location.hash) {
        history.pushState(null, "", window.location.pathname)
      }
    }

    setView(nextView)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveResponse(answer: Omit<Response, "id" | "createdAt">) {
    const { q5Other, ...databaseAnswer } = answer
    if (supabase) {
      const { data, error } = await supabase
        .from("survey_responses")
        .insert({ ...databaseAnswer, q5_other: q5Other })
        .select()
        .single()

      if (!error && data) {
        const response = mapDatabaseResponse(data as DatabaseResponse)
        const next = [...responses, response]
        setResponses(next)
        localStorage.setItem(storageKey, JSON.stringify(next))
        navigate("thanks")
        return
      }

      console.error("No se pudo guardar la respuesta en Supabase:", error)
    }

    const response: Response = {
      ...answer,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const next = [...responses, response]
    setResponses(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    navigate("thanks")
  }

  async function saveLasFloresResponse(answer: LasFloresAnswers) {
    if (supabase) {
      const { error } = await supabase.from("las_flores_responses").insert({
        server_name: answer.serverName.trim(),
        dish_consumed: answer.dishConsumed.trim(),
        visit_type: answer.visitType,
        visit_frequency: answer.visitType === "si" ? null : answer.visitFrequency,
        attention_rating: Number(answer.attentionRating),
        dishes_rating: Number(answer.dishesRating),
        ambience_rating: Number(answer.ambienceRating),
        recommendation_rating: Number(answer.recommendationRating),
        suggestion: answer.suggestion.trim(),
      })

      if (error) {
        console.error("No se pudo guardar la respuesta de Las Flores:", error)
        throw new Error(error.message)
      }
    } else {
      const storageKey = "las-flores-survey-responses"
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]")
      const responses = Array.isArray(stored) ? stored : []
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          ...responses,
          {
            ...answer,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
        ]),
      )
    }

    navigate("las-flores-thanks")
  }

  // Check hash or URL search parameters for admin access (e.g. #admin)
  useEffect(() => {
    function checkAdminHash() {
      const hash = window.location.hash.toLowerCase()
      const search = window.location.search.toLowerCase()
      if (hash === "#las-flores-admin" || hash === "#las-flores-admin-login") {
        setView("admin-login")
        setAdminOrigin("las-flores")
        try {
          sessionStorage.setItem("umaru-active-view", "admin-login")
        } catch {}
      } else if (
        hash === "#admin" ||
        hash === "#admin-login" ||
        search.includes("admin")
      ) {
        setView("admin-login")
        setAdminOrigin("survey")
        try {
          sessionStorage.setItem("umaru-active-view", "admin-login")
        } catch {}
      } else if (hash === "#results") {
        setView("results")
        try {
          sessionStorage.setItem("umaru-active-view", "results")
        } catch {}
      } else if (hash === "#las-flores-results") {
        setView("las-flores-results")
        try {
          sessionStorage.setItem("umaru-active-view", "las-flores-results")
        } catch {}
      } else if (hash === "#las-flores") {
        setView("las-flores")
        try {
          sessionStorage.setItem("umaru-active-view", "las-flores")
        } catch {}
      } else if (hash === "#las-flores-thanks") {
        setView("las-flores-thanks")
        try {
          sessionStorage.setItem("umaru-active-view", "las-flores-thanks")
        } catch {}
      } else if (hash === "#thanks") {
        setView("thanks")
        try {
          sessionStorage.setItem("umaru-active-view", "thanks")
        } catch {}
      } else if (
        hash === "#admin" ||
        hash === "#admin-login" ||
        hash === "#results" ||
        hash === "#las-flores-results" ||
        hash === "#las-flores" ||
        hash === "#las-flores-thanks"
      ) {
        setView("survey")
        try {
          sessionStorage.setItem("umaru-active-view", "survey")
        } catch {}
      }
    }
    checkAdminHash()
    window.addEventListener("hashchange", checkAdminHash)
    return () => window.removeEventListener("hashchange", checkAdminHash)
  }, [])

  async function handleClearResponses() {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar todas las respuestas registradas? Esta acción limpiará la base de datos y dejará la encuesta lista para los clientes reales.",
      )
    ) {
      return
    }
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("survey_responses")
          .delete()
          .not("id", "is", null)
          .select()

        if (error) {
          console.error("Error al eliminar respuestas en Supabase:", error)
          alert("Error al eliminar en la base de datos: " + error.message)
          return
        }

        if (responses.length > 0 && (!data || data.length === 0)) {
          alert(
            "Nota: Para que se eliminen en Supabase, debes ejecutar el script de políticas de eliminación (DELETE policy) en el SQL Editor de tu panel de Supabase. Revisa el archivo supabase.sql.",
          )
        }
      }
      localStorage.removeItem(storageKey)
      setResponses([])
      await fetchResponses(true)
    } catch (err) {
      console.error("Error al eliminar respuestas:", err)
      localStorage.removeItem(storageKey)
      setResponses([])
    }
  }

  async function handleClearLasFloresResponses() {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar todas las respuestas de Las Flores?",
      )
    ) {
      return
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from("las_flores_responses")
          .delete()
          .not("id", "is", null)

        if (error) {
          console.error(
            "Error al eliminar respuestas de Las Flores en Supabase:",
            error,
          )
          alert("Error al eliminar en la base de datos: " + error.message)
          return
        }
      }
      localStorage.removeItem("las-flores-survey-responses")
      setLasFloresResponses([])
      await fetchLasFloresResponses(true)
    } catch (error) {
      console.error("Error al eliminar respuestas de Las Flores:", error)
      alert("No se pudieron eliminar las respuestas de Las Flores.")
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#3a302b]">
      <Header
        view={view}
        onNavigate={(nextView) => {
          if (view === "admin-login" && nextView === "survey") {
            navigate(adminOrigin)
            return
          }
          navigate(nextView)
        }}
        onAdminOpen={() => {
          setAdminOrigin(
            view === "las-flores" ||
              view === "las-flores-thanks" ||
              view === "las-flores-results"
              ? "las-flores"
              : "survey",
          )
          navigate("admin-login")
        }}
      />
      {view === "survey" && <Survey onSubmit={saveResponse} />}
      {view === "las-flores" && (
        <LasFloresSurvey onSubmit={saveLasFloresResponse} />
      )}
      {view === "admin-login" && (
        <AdminLogin
          onSuccess={(restaurant) =>
            navigate(
              restaurant === "las-flores" ? "las-flores-results" : "results",
            )
          }
        />
      )}
      {view === "results" && (
        <Results
          responses={responses}
          onRefresh={() => fetchResponses(true)}
          onClear={handleClearResponses}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />
      )}
      {view === "las-flores-results" && (
        <LasFloresResults
          responses={lasFloresResponses}
          onRefresh={() => fetchLasFloresResponses(true)}
          onClear={handleClearLasFloresResponses}
          isRefreshing={isLasFloresRefreshing}
          lastUpdated={lastUpdated}
          loadError={lasFloresLoadError}
        />
      )}
      {view === "thanks" && <ThankYou />}
      {view === "las-flores-thanks" && <ThankYou restaurant="Las Flores" />}
      <footer className="border-t border-[#4b403a] bg-[#302824] px-5 py-6 text-center text-xs tracking-wide text-[#a99d96]">
        <span>
          {view === "las-flores" ||
          view === "las-flores-thanks" ||
          view === "las-flores-results"
            ? "LAS FLORES"
            : "UMARU HOTEL"}
        </span>
        <button
          onClick={() => {
            setAdminOrigin(
              view === "las-flores" ||
                view === "las-flores-thanks" ||
                view === "las-flores-results"
                ? "las-flores"
                : "survey",
            )
            navigate("admin-login")
          }}
          className="mx-2 inline-block cursor-default select-none text-[#a99d96] opacity-70 transition hover:opacity-100"
          aria-label="Acceso administrativo"
          title=""
        >
          ·
        </button>
        <span>Ayacucho, Perú · Encuesta anónima</span>
      </footer>
    </div>
  )
}
