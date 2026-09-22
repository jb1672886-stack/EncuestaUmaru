import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { logoBase64 } from "./lib/logoBase64";
import { supabase } from "./lib/supabase";

type View = "survey" | "admin-login" | "results" | "thanks";

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

type DatabaseResponse = Omit<Response, "createdAt"> & {
  created_at: string;
};

type Question = {
  id: "q1" | "q2" | "q3" | "q4" | "q5";
  number: string;
  title: string;
  hint?: string;
  options: string[];
  multiple?: boolean;
};

const questions: Question[] = [
  {
    id: "q1",
    number: "01",
    title: "¿Con qué frecuencia visitas UMARU?",
    options: [
      "Es mi primera vez",
      "Una vez al mes o más",
      "Cada 2-3 meses",
      "Ocasionalmente",
    ],
  },
  {
    id: "q2",
    number: "02",
    title:
      "¿Qué tipo de propuesta te gustaría encontrar con mayor frecuencia en nuestra carta?",
    options: [
      "Carnes y parrillas",
      "Comida tradicional ayacuchana / peruana",
      "Pastas y cocina italiana",
      "Opciones ligeras y saludables",
      "Una combinación de varias propuestas",
    ],
  },
  {
    id: "q3",
    number: "03",
    title: "Al elegir un restaurante, ¿qué es lo más importante para ti?",
    hint: "Elige hasta 2 opciones",
    multiple: true,
    options: [
      "Sabor y calidad",
      "Precio",
      "Buena porción",
      "Atención",
      "Ambiente y experiencia",
      "Presentación de los platos",
    ],
  },
  {
    id: "q4",
    number: "04",
    title:
      "¿Cuánto pagarías normalmente por un buen plato principal en UMARU?",
    options: ["S/ 20-29", "S/ 30-39", "S/ 40-49", "S/ 50 a más"],
  },
  {
    id: "q5",
    number: "05",
    title: "¿Qué te motivaría más a volver a UMARU?",
    options: [
      "Una nueva carta y nuevos platos",
      "Promociones o combos",
      "Cortesías y beneficios",
      "Experiencias especiales",
      "Programa de cliente frecuente",
    ],
  },
];

const storageKey = "umaru-survey-responses";
const adminPhrase = "HotelUmaru2026";

function mapDatabaseResponse(response: DatabaseResponse): Response {
  return {
    ...response,
    createdAt: response.created_at,
  };
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "arrow" | "chart" | "check" | "chevron" | "close" | "lock" | "refresh" | "survey" | "trash";
  className?: string;
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
  };

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
  );
}

function Header({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (view: View) => void;
}) {
  const [clickCount, setClickCount] = useState(0);

  const handleLogoClick = () => {
    if (view === "results" || view === "admin-login") {
      onNavigate("survey");
      return;
    }

    const nextCount = clickCount + 1;
    if (nextCount >= 3) {
      setClickCount(0);
      onNavigate("admin-login");
    } else {
      setClickCount(nextCount);
      setTimeout(() => setClickCount(0), 1000);
    }
  };

  return (
    <header className="border-b border-[#ded8ce] bg-[#f7f4ee]/95 backdrop-blur">
      <div className="mx-auto flex h-[86px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <button
          className="flex items-center gap-3 text-left cursor-pointer"
          onClick={handleLogoClick}
          aria-label="Ir al inicio"
        >
          <img
            src={logoBase64}
            alt="Umaru Hotel"
            className="h-14 w-auto max-h-14 max-w-[130px] object-contain mix-blend-multiply"
          />
          <span className="hidden border-l border-[#cfc6b8] pl-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#765e50] sm:block">
            Nueva propuesta
            <br />
            gastronómica
          </span>
        </button>
        {view === "results" || view === "admin-login" ? (
          <button
            onClick={() => onNavigate("survey")}
            aria-label="Volver a la encuesta"
            className="group flex items-center gap-2 rounded-full border border-[#c8bfb1] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#463b35] transition hover:border-[#98592f] hover:bg-white"
          >
            <Icon name="survey" />
            <span className="hidden sm:inline">Volver</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Survey({
  onSubmit,
}: {
  onSubmit: (response: Omit<Response, "id" | "createdAt">) => Promise<void> | void;
}) {
  const [answers, setAnswers] = useState({
    q1: "",
    q2: "",
    q3: [] as string[],
    q4: "",
    q5: "",
    q6: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setSingle(id: Question["id"], value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setError("");
  }

  function toggleMultiple(value: string) {
    setAnswers((current) => {
      const selected = current.q3.includes(value);
      if (!selected && current.q3.length >= 2) return current;
      return {
        ...current,
        q3: selected
          ? current.q3.filter((item) => item !== value)
          : [...current.q3, value],
      };
    });
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !answers.q1 ||
      !answers.q2 ||
      !answers.q3.length ||
      !answers.q4 ||
      !answers.q5
    ) {
      setError("Completa las preguntas de selección para enviar tu opinión.");
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(answers);
    } catch {
      setError("Hubo un error al enviar tu respuesta. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
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
            Ayúdanos a crear una experiencia que realmente quieras
            repetir. Solo te tomará unos minutos.
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
                      {question.hint} · {answers.q3.length}/2 seleccionadas
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {question.options.map((option) => {
                  const isChecked = question.multiple
                    ? answers.q3.includes(option)
                    : answers[question.id] === option;
                  const disabled =
                    question.multiple &&
                    !isChecked &&
                    answers.q3.length >= 2;
                  return (
                    <label
                      key={option}
                      className={`option-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-4 text-sm leading-5 transition ${
                        isChecked
                          ? "border-[#a86438] bg-[#fbf4ed] text-[#4a3326]"
                          : "border-[#e0dbd3] bg-[#fcfbf9] text-[#615750] hover:border-[#bda78f]"
                      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                    >
                      <input
                        className="sr-only"
                        type={question.multiple ? "checkbox" : "radio"}
                        name={question.id}
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() =>
                          question.multiple
                            ? toggleMultiple(option)
                            : setSingle(question.id, option)
                        }
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                          question.multiple ? "rounded" : "rounded-full"
                        } ${
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
                  );
                })}
              </div>
            </fieldset>
          ))}

          <section className="question-card rounded-2xl border border-[#ded8ce] bg-white p-6 sm:p-9">
            <div className="mb-6 flex gap-4 sm:gap-6">
              <span className="font-display text-2xl italic text-[#b87545]">
                06
              </span>
              <div>
                <h2 className="text-lg font-semibold leading-7 text-[#382f2b] sm:text-xl">
                  Si pudieras incorporar un plato a la nueva carta de UMARU,
                  ¿cuál sería?
                </h2>
                <p className="mt-1 text-sm text-[#83766e]">
                  Cuéntanos qué tendría que tener para que quieras venir a
                  probarlo.
                </p>
              </div>
            </div>
            <textarea
              value={answers.q6}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  q6: event.target.value,
                }))
              }
              maxLength={500}
              rows={5}
              placeholder="Escribe aquí tu propuesta..."
              className="w-full resize-none rounded-xl border border-[#ddd6ce] bg-[#fcfbf9] p-4 text-sm leading-6 text-[#463b35] outline-none transition placeholder:text-[#aaa099] focus:border-[#aa693d] focus:ring-2 focus:ring-[#aa693d]/10"
            />
            <p className="mt-2 text-right text-xs text-[#9a918b]">
              {answers.q6.length}/500
            </p>
          </section>
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
  );
}

function Results({
  responses,
  onRefresh,
  onClear,
  isRefreshing,
  lastUpdated,
}: {
  responses: Response[];
  onRefresh?: () => void;
  onClear?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}) {
  const total = responses.length;
  const today = new Date().toDateString();
  const todayCount = responses.filter(
    (response) => new Date(response.createdAt).toDateString() === today,
  ).length;

  const resultGroups = useMemo(
    () =>
      questions.map((question) => ({
        ...question,
        counts: question.options.map((option) => ({
          option,
          count: responses.filter((response) => {
            const answer = response[question.id];
            return Array.isArray(answer)
              ? answer.includes(option)
              : answer === option;
          }).length,
        })),
      })),
    [responses],
  );

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
                Conteo consolidado y en tiempo real de todas las respuestas anónimas recibidas.
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
                      className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#d6a37d]" : ""}`}
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
            <p className="mt-3 font-display text-5xl text-[#3a302b]">6</p>
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
            );
            const leadingOption = question.counts.reduce(
              (leader, item) => (item.count > leader.count ? item : leader),
              question.counts[0],
            );
            const leadingPercentage = total
              ? Math.round((leadingOption.count / total) * 100)
              : 0;
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
                      {question.multiple && " · Selección múltiple"}
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
                      : 0;
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
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="rounded-2xl border border-[#ddd6cd] bg-white p-6 sm:p-8 lg:col-span-2">
            <div className="mb-6 flex items-start gap-4">
              <span className="font-display text-xl italic text-[#b87545]">
                06
              </span>
              <div>
                <h2 className="font-semibold text-[#403630]">
                  Propuestas de nuevos platos
                </h2>
                <p className="mt-1 text-xs font-medium text-[#958a83]">
                  Respuestas abiertas más recientes
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {responses.filter((response) => response.q6.trim()).length ? (
                responses
                  .filter((response) => response.q6.trim())
                  .slice()
                  .reverse()
                  .map((response) => (
                    <blockquote
                      key={response.id}
                      className="rounded-xl border border-[#e2ddd6] bg-[#faf8f5] p-5 text-sm leading-6 text-[#665a53]"
                    >
                      “{response.q6}”
                    </blockquote>
                  ))
              ) : (
                <p className="text-sm text-[#90857e]">
                  Aún no hay propuestas escritas.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ThankYou() {
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
          Tu opinión ya forma parte de la nueva experiencia UMARU. La respuesta
          se guardó de forma anónima.
        </p>
        <div className="mt-9 inline-flex items-center justify-center rounded-full border border-[#d8d0c4] bg-[#f8f5ef] px-7 py-3.5 text-sm font-medium text-[#786b64] shadow-xs">
          Encuesta finalizada con éxito. Ya puedes cerrar esta pestaña.
        </div>
      </div>
    </main>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (phrase !== adminPhrase) {
      setError("La frase de acceso no es válida.");
      return;
    }
    onSuccess();
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
          Ingresa la frase de acceso
        </h1>
        <label className="mt-8 block text-sm font-semibold text-[#51433c]">
          Frase de acceso
          <input
            type="password"
            value={phrase}
            onChange={(event) => {
              setPhrase(event.target.value);
              setError("");
            }}
            required
            autoComplete="off"
            placeholder="Escribe la frase"
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
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.toLowerCase() : "";
    const search = typeof window !== "undefined" ? window.location.search.toLowerCase() : "";
    if (hash === "#admin" || hash === "#admin-login" || search.includes("admin")) {
      return "admin-login";
    }
    if (hash === "#results") return "results";
    if (hash === "#thanks") return "thanks";

    try {
      const saved = sessionStorage.getItem("umaru-active-view") as View | null;
      if (saved && ["survey", "admin-login", "results", "thanks"].includes(saved)) {
        return saved;
      }
    } catch {}

    return "survey";
  });
  const [responses, setResponses] = useState<Response[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchResponses = useCallback(async (showLoading = false) => {
    if (!supabase) return;
    if (showLoading) setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        setResponses((data as DatabaseResponse[]).map(mapDatabaseResponse));
        setLastUpdated(new Date());
      } else if (error) {
        console.error("No se pudieron cargar las respuestas de Supabase:", error);
      }
    } catch (err) {
      console.error("Error al sincronizar respuestas:", err);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  }, []);

  // Fetch immediately on mount and when changing view (e.g. entering results)
  useEffect(() => {
    fetchResponses();
  }, [fetchResponses, view]);

  // Realtime subscription + auto-polling every 4 seconds when inside admin results
  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const channel = supabase
      .channel("survey_responses_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "survey_responses" },
        () => {
          if (active) {
            fetchResponses();
          }
        }
      )
      .subscribe();

    // Auto-polling interval for guaranteed live updates
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (view === "results") {
      pollInterval = setInterval(() => {
        if (active) {
          fetchResponses();
        }
      }, 4000);
    }

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      void supabase.removeChannel(channel);
    };
  }, [fetchResponses, view]);

  function navigate(nextView: View) {
    try {
      sessionStorage.setItem("umaru-active-view", nextView);
    } catch {}

    if (nextView === "results") {
      window.location.hash = "results";
    } else if (nextView === "thanks") {
      window.location.hash = "thanks";
    } else if (nextView === "admin-login") {
      window.location.hash = "admin";
    } else if (nextView === "survey") {
      if (window.location.hash) {
        history.pushState(null, "", window.location.pathname);
      }
    }

    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveResponse(answer: Omit<Response, "id" | "createdAt">) {
    if (supabase) {
      const { data, error } = await supabase
        .from("survey_responses")
        .insert(answer)
        .select()
        .single();

      if (!error && data) {
        const response = mapDatabaseResponse(data as DatabaseResponse);
        const next = [...responses, response];
        setResponses(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        navigate("thanks");
        return;
      }

      console.error("No se pudo guardar la respuesta en Supabase:", error);
    }

    const response: Response = {
      ...answer,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const next = [...responses, response];
    setResponses(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    navigate("thanks");
  }

  // Check hash or URL search parameters for admin access (e.g. #admin)
  useEffect(() => {
    function checkAdminHash() {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === "#admin" || hash === "#admin-login" || search.includes("admin")) {
        setView("admin-login");
        try {
          sessionStorage.setItem("umaru-active-view", "admin-login");
        } catch {}
      } else if (hash === "#results") {
        setView("results");
        try {
          sessionStorage.setItem("umaru-active-view", "results");
        } catch {}
      } else if (hash === "#thanks") {
        setView("thanks");
        try {
          sessionStorage.setItem("umaru-active-view", "thanks");
        } catch {}
      }
    }
    checkAdminHash();
    window.addEventListener("hashchange", checkAdminHash);
    return () => window.removeEventListener("hashchange", checkAdminHash);
  }, []);

  async function handleClearResponses() {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar todas las respuestas registradas? Esta acción limpiará la base de datos y dejará la encuesta lista para los clientes reales."
      )
    ) {
      return;
    }
    try {
      if (supabase) {
        await supabase
          .from("survey_responses")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }
      localStorage.removeItem(storageKey);
      setResponses([]);
    } catch (err) {
      console.error("Error al eliminar respuestas:", err);
      localStorage.removeItem(storageKey);
      setResponses([]);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#3a302b]">
      <Header view={view} onNavigate={navigate} />
      {view === "survey" && <Survey onSubmit={saveResponse} />}
      {view === "admin-login" && <AdminLogin onSuccess={() => navigate("results")} />}
      {view === "results" && (
        <Results
          responses={responses}
          onRefresh={() => fetchResponses(true)}
          onClear={handleClearResponses}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />
      )}
      {view === "thanks" && <ThankYou />}
      <footer className="border-t border-[#4b403a] bg-[#302824] px-5 py-6 text-center text-xs tracking-wide text-[#a99d96]">
        <span>UMARU HOTEL</span>
        <button
          onClick={() => navigate("admin-login")}
          className="mx-2 inline-block cursor-default select-none text-[#a99d96] opacity-70 transition hover:opacity-100"
          aria-label="Acceso administrativo"
          title=""
        >
          ·
        </button>
        <span>Ayacucho, Perú · Encuesta anónima</span>
      </footer>
    </div>
  );
}
