import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Trash2, Paperclip, X } from "lucide-react";
import axios from "axios";
import clsx from "clsx";

const API = "http://127.0.0.1:8000/api/items/";

/**
 * BudgetTableDemo.jsx – рабочая версия с поддержкой материалов
 * ──────────────────────────────────────────────────────────────
 * • Отображает плановые начисления (Н) и оплаты (О) помесячно.
 * • Значок скрепки у работы показывает количество прикреплённых файлов.
 * • В диалоге можно редактировать работу, загружать/удалять файлы, управлять планом и фактом.
 */

// ──────────── Константы ────────────
const monthKeys = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];
const quarters = ["I кв.", "II кв.", "III кв.", "IV кв."];


// ──────────── Вспомогательные функции ────────────

const objToRows = (plan, fact = {}) =>
  Object.entries(plan).map(([m, a]) => ({
    month: m,
    amount: String(a),
    checked: m in fact,
    actual: m in fact ? String(fact[m]) : "",
  }));

const arrToPlan = (rows) =>
  rows.reduce((acc, r) => {
    if (r.month && r.amount !== "") acc[r.month] = Number(r.amount);
    return acc;
  }, {});

const arrToFact = (rows) =>
  rows.reduce((acc, r) => {
    if (r.checked && r.month && r.actual !== "") acc[r.month] = Number(r.actual);
    return acc;
  }, {});

// ──────────── Компонент ────────────
const BudgetTableDemo = () => {
  // table state
  const [data, setData] = useState([]);

  // переключатель "детально / только итоги"
  const [showDetails, setShowDetails] = useState(true);

  const [mode, setMode] = useState("both"); // "plan" | "fact" | "both"
  // отображать начисления, оплаты или оба
  const [flowMode, setFlowMode] = useState("both"); // "acc" | "pay" | "both"
  const showAccruals = flowMode === "acc" || flowMode === "both";
  const showPayments = flowMode === "pay" || flowMode === "both";
  // выбранные статьи для отображения (id)
  const [selectedArticles, setSelectedArticles] = useState([]);

  // фильтры года и ответственного
  const [yearFilter, setYearFilter] = useState("all");
  const [respFilter, setRespFilter] = useState("all");
  // статья, в которую добавляется новая работа
  const [newWorkArticleId, setNewWorkArticleId] = useState(null);
  // sidebar hamburger
  const [settingsOpen, setSettingsOpen] = useState(false);
  // флажки поквартального отображения (I, II, III, IV)
  // true → показывать квартал (и соответствующие месяцы) в таблице
  const [showQuarterTotals, setShowQuarterTotals] = useState([true, true, true, true]);

  // какие месяцы показывать в таблице согласно выбранным кварталам
  const visibleMonths = monthKeys.filter(
    (_, idx) => showQuarterTotals[Math.floor(idx / 3)]
  );

  // суммарный бюджет по выбранным фильтрам
  const globalTotals = useMemo(() => {
    let plan = 0;
    let fact = 0;

    data.forEach((article) => {
      if (!selectedArticles.includes(article.id)) return;

      article.works.forEach((w) => {
        if (
          (yearFilter !== "all" && String(w.year) !== yearFilter) ||
          (respFilter !== "all" && w.responsible !== respFilter)
        ) {
          return;
        }

        Object.entries(w.accruals || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) plan += v;
        });
        Object.entries(w.payments || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) plan += v;
        });
        Object.entries(w.actual_accruals || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) fact += v;
        });
        Object.entries(w.actual_payments || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) fact += v;
        });
      });
    });

    return { plan, fact };
  }, [data, selectedArticles, yearFilter, respFilter, visibleMonths]);

  // для отображения активных фильтров (кроме статей)
  const activeFilterChips = useMemo(() => {
    const chips = [];

    // план/факт режим
    if (mode !== "both") chips.push(mode === "plan" ? "Только план" : "Только факт");

    // начисления/оплаты режим
    if (flowMode !== "both")
      chips.push(flowMode === "acc" ? "Только начисления" : "Только оплаты");

    // год
    if (yearFilter !== "all") chips.push(`Год: ${yearFilter}`);

    // ответственный
    if (respFilter !== "all") chips.push(`Ответственный: ${respFilter}`);

    // кварталы
    if (!showQuarterTotals.every(Boolean)) {
      const enabled = quarters
        .filter((_, idx) => showQuarterTotals[idx])
        .join(", ");
      chips.push(`Кварталы: ${enabled}`);
    }

    return chips;
  }, [mode, flowMode, yearFilter, respFilter, showQuarterTotals]);

  const allYears = Array.from(
    new Set(data.flatMap((a) => a.works.map((w) => w.year)))
  ).sort();

  const allResponsibles = Array.from(
    new Set(
      data.flatMap((a) => a.works.map((w) => w.responsible).filter(Boolean))
    )
  ).sort();

  // вывод значения с учётом флагов План/Факт и Н/О
  const renderCell = (planAcc = 0, planPay = 0, factAcc = 0, factPay = 0) => {
    const showPlan = mode === "plan" || mode === "both";
    const showFact = mode === "fact" || mode === "both";

    // collect values according to flowMode
    const planVals = [];
    const factVals = [];

    if (showPlan) {
      if (showAccruals && planAcc) planVals.push(planAcc);
      if (showPayments && planPay) planVals.push(planPay);
    }
    if (showFact) {
      if (showAccruals && factAcc) factVals.push(factAcc);
      if (showPayments && factPay) factVals.push(factPay);
    }

    // Build main line (numbers separated by /)
    const mainNums = [...planVals, ...factVals]
      .map((n) => n.toLocaleString("ru-RU"))
      .join(" / ");

    // Percentage only in both‑mode and when plan total > 0
    let percentLine = null;
    if (mode === "both") {
      const planSum = planVals.reduce((s, v) => s + v, 0);
      const factSum = factVals.reduce((s, v) => s + v, 0);
      if (planSum > 0) {
        const pct = ((factSum / planSum) * 100).toFixed(0);
        percentLine = `${pct}%`;
      }
    }

    if (!mainNums) return "";

    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{mainNums}</span>
        {percentLine && (
          <span className="text-xs text-gray-500">{percentLine}</span>
        )}
      </div>
    );
  };

  // формат для итоговых ячеек без текстовых префиксов
  const formatTotalLines = (acc, pay, fAcc = 0, fPay = 0) => {
    const showPlan = mode === "plan" || mode === "both";
    const showFact = mode === "fact" || mode === "both";

    const planVals = [];
    const factVals = [];

    if (showPlan) {
      if (showPayments && pay) planVals.push(pay);
      if (showAccruals && acc) planVals.push(acc);
    }
    if (showFact) {
      if (showPayments && fPay) factVals.push(fPay);
      if (showAccruals && fAcc) factVals.push(fAcc);
    }

    const mainNums = [...planVals, ...factVals]
      .map((n) => n.toLocaleString("ru-RU"))
      .join(" / ");

    let percentLine = null;
    if (mode === "both") {
      const planSum = planVals.reduce((s, v) => s + v, 0);
      const factSum = factVals.reduce((s, v) => s + v, 0);
      if (planSum > 0) {
        percentLine = `${((factSum / planSum) * 100).toFixed(0)}%`;
      }
    }

    return percentLine ? `${mainNums}\n${percentLine}` : mainNums;
  };

  // при монтировании тянем данные с бэкенда
  useEffect(() => {
    axios.get(API).then(({ data }) => {
      setData(data);
      setSelectedArticles(data.map((it) => it.id));  // выбрать все по умолчанию
      if (data.length) setNewWorkArticleId(data[0].id);
    });
  }, []);
  // переключение выбора статьи
  const toggleArticle = (id) => {
    setSelectedArticles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null); // { articleIdx, workIdx }

  // form fields
  const [workName, setWorkName] = useState("");
  const [justification, setJustification] = useState("");
  const [comment, setComment] = useState("");
  const [materials, setMaterials] = useState([]); // [{ name }]
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [responsible, setResponsible] = useState("");
  // статья, к которой относится работа в диалоге
  const [workArticleId, setWorkArticleId] = useState(null);
  const [accrualRows, setAccrualRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);

  // ──────────── Helpers ────────────
  const addRow = (setter) =>
    setter((prev) => [...prev, { month: "", amount: "", checked: false, actual: "" }]);
  const delRow = (setter, idx) => setter((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (setter, idx, key, value) =>
    setter((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      if (key === "checked" && !value) next[idx].actual = "";
      return next;
    });

  // file handlers
  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files).map((f) => ({ name: f.name }));
    setMaterials((prev) => [...prev, ...files]);
    e.target.value = ""; // reset input
  };
  const removeMaterial = (idx) => setMaterials((prev) => prev.filter((_, i) => i !== idx));

  // open dialog
  const openDialog = (articleIdx, workIdx = null) => {
    setSelected({ articleIdx, workIdx });

    if (workIdx === null) {
      // new work
      setWorkName("");
      setJustification("");
      setComment("");
      setYear(currentYear);
      setWorkArticleId(data[articleIdx].id);
      setResponsible("");
      setMaterials([]);
      setAccrualRows([{ month: "", amount: "", checked: false, actual: "" }]);
      setPaymentRows([{ month: "", amount: "", checked: false, actual: "" }]);
    } else {
      const article = data[articleIdx];
      const w = article.works[workIdx];
      setWorkName(w.name);
      setJustification(w.justification || "");
      setComment(w.comment || "");
      setYear(w.year || currentYear);
      setResponsible(w.responsible || "");
      setWorkArticleId(article.id);
      setMaterials(w.materials || []);
      setAccrualRows(objToRows(w.accruals, w.actual_accruals));
      setPaymentRows(objToRows(w.payments, w.actual_payments))
    }

    setDialogOpen(true);
  };

  // save
  const handleSave = async () => {
    const { articleIdx, workIdx } = selected;
    const article = data[articleIdx];

    const payload = {
      id: workIdx === null ? undefined : article.works[workIdx].id,
      item: workArticleId, // backend needs parent article id
      name: workName || "Работа",
      accruals: arrToPlan(accrualRows),
      payments: arrToPlan(paymentRows),
      actual_accruals: arrToFact(accrualRows),
      actual_payments: arrToFact(paymentRows),
      justification,
      comment,
      year,
      responsible,
      materials,
    };

    try {
      let response;
      if (workIdx === null) {
        response = await axios.post("http://127.0.0.1:8000/api/works/", payload);
      } else {
        response = await axios.put(
          `http://127.0.0.1:8000/api/works/${payload.id}/`,
          payload
        );
      }

      // use data returned from backend to keep ids in sync
      const savedWork = response.data;

      setData((prev) => {
        const clone = structuredClone(prev);
        if (workIdx === null) {
          const targetIdx = clone.findIndex((a) => a.id === workArticleId);
          if (targetIdx >= 0) {
            clone[targetIdx].works.push(savedWork);
          }
        } else {
          clone[articleIdx].works[workIdx] = savedWork;
        }
        return clone;
      });

      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить работу. Проверьте данные и повторите.");
    }
  };

  // суммирование по статье: месяцы и кварталы (отдельно Н и О, план и факт)
  const calcTotals = (article) => {
    const monthTotals = {};
    const quarterTotals = Array.from({ length: 4 }, () => ({
      acc: 0,
      pay: 0,
      fAcc: 0,
      fPay: 0,
    }));

    visibleMonths.forEach((m, idx) => {
      let acc = 0;
      let pay = 0;
      let fAcc = 0;
      let fPay = 0;
      article.works.forEach((w) => {
        const a = w.accruals || {};
        const p = w.payments || {};
        const fa = w.actual_accruals || {};
        const fp = w.actual_payments || {};

        acc += a[m] || 0;
        pay += p[m] || 0;
        fAcc += fa[m] || 0;
        fPay += fp[m] || 0;
      });
      monthTotals[m] = { acc, pay, fAcc, fPay };

      const qIdx = Math.floor(monthKeys.indexOf(m) / 3);
      quarterTotals[qIdx].acc += acc;
      quarterTotals[qIdx].pay += pay;
      quarterTotals[qIdx].fAcc += fAcc;
      quarterTotals[qIdx].fPay += fPay;
    });

    return { monthTotals, quarterTotals };
  };

  // ──────────── Render ────────────
  return (
    <div className="flex h-full w-full">
      {/* hamburger button */}
      <button
        type="button"
        className="absolute top-3 left-3 z-40 p-2 rounded border bg-white shadow-sm"
        onClick={() => setSettingsOpen(true)}
      >
        <span className="sr-only">Открыть меню</span>
        {/* simple icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* drawer */}
      {settingsOpen && (
        <div className="fixed inset-y-0 left-0 w-64 bg-gray-50 border-r shadow-lg z-50 flex flex-col p-4 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Настройки</h2>
            <button
              className="p-1"
              onClick={() => setSettingsOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* --- existing sidebar content moved here --- */}
          <h3 className="font-semibold mb-3">Статьи</h3>
          <div className="space-y-2 text-sm mb-4">
            {data.map((art) => (
              <label key={art.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedArticles.includes(art.id)}
                  onChange={() => toggleArticle(art.id)}
                />
                {art.name}
              </label>
            ))}
          </div>

          {/* Year filter */}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1">Год</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full border rounded text-sm p-1"
            >
              <option value="all">Все</option>
              {allYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Responsible filter */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-1">Ответственный</label>
            <select
              value={respFilter}
              onChange={(e) => setRespFilter(e.target.value)}
              className="w-full border rounded text-sm p-1"
            >
              <option value="all">Все</option>
              {allResponsibles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Quarter toggles */}
          <div>
            <span className="text-sm">Кварталы:</span>
            {quarters.map((q, idx) => (
              <label key={q} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showQuarterTotals[idx]}
                  onChange={(e) => {
                    const next = [...showQuarterTotals];
                    next[idx] = e.target.checked;
                    setShowQuarterTotals(next);
                  }}
                />
                {q}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* main content */}
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Бюджет — демо</h1>
        {/* summary card */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="bg-white border rounded shadow-sm p-4 flex items-center gap-6">
            <div>
              <div className="text-sm text-gray-500">План</div>
              <div className="text-xl font-semibold text-blue-600">
                {globalTotals.plan.toLocaleString("ru-RU")} ₽
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Факт</div>
              <div className="text-xl font-semibold text-emerald-600">
                {globalTotals.fact.toLocaleString("ru-RU")} ₽
              </div>
            </div>
            {(() => {
              const pct = globalTotals.plan
                ? Math.min(
                    100,
                    (globalTotals.fact / globalTotals.plan) * 100
                  ).toFixed(0)
                : "0";
              return (
                <div className="relative w-48 h-3 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  ></div>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700">
                    {pct}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* кнопка "Новая работа" создаёт работу в выбранной статье */}
          <div className="flex items-center gap-2">
            <Select
              value={newWorkArticleId ? String(newWorkArticleId) : ""}
              onValueChange={(val) => setNewWorkArticleId(Number(val))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Выберите статью" />
              </SelectTrigger>
              <SelectContent>
                {data
                  .filter((a) => selectedArticles.includes(a.id))
                  .map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button
              variant="default"
              disabled={!newWorkArticleId}
              onClick={() => {
                const idx = data.findIndex((a) => a.id === newWorkArticleId);
                if (idx >= 0) openDialog(idx);
              }}
            >
              + Новая работа
            </Button>
          </div>
        </div>
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((txt, idx) => (
              <span
                key={idx}
                className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs"
              >
                {txt}
              </span>
            ))}
          </div>
        )}

      <Button
        variant="secondary"
        size="sm"
        className="mb-4"
        onClick={() => setShowDetails((p) => !p)}
      >
        {showDetails ? "Скрыть работы (только итоги)" : "Показать работы детально"}
      </Button>

      <div className="mb-4 flex items-center gap-4">
        <div className="inline-flex rounded overflow-hidden border">
          {["acc", "pay", "both"].map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(
                "px-2 py-1 text-sm",
                flowMode === m ? "bg-sky-600 text-white" : "bg-white hover:bg-sky-50"
              )}
              onClick={() => setFlowMode(m)}
            >
              {m === "acc" ? "Начисления" : m === "pay" ? "Оплаты" : "Нач.+Опл."}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded overflow-hidden border">
          {["plan", "fact", "both"].map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(
                "px-2 py-1 text-sm",
                mode === m ? "bg-sky-600 text-white" : "bg-white hover:bg-sky-50"
              )}
              onClick={() => setMode(m)}
            >
              {m === "plan" ? "План" : m === "fact" ? "Факт" : "План+Факт"}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- TABLE ---------- */}
      <div className="overflow-x-auto">
      <table className="min-w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th rowSpan={2} className="border p-2 bg-gray-100">
              Статья
            </th>
            <th rowSpan={2} className="border p-2 bg-gray-100">
              Работа
            </th>
            {quarters.map((q, i) =>
              showQuarterTotals[i] ? (
                <th key={q} colSpan={3} className="border p-2">
                  {q}
                </th>
              ) : null
            )}
          </tr>
          <tr className="bg-gray-50 text-center">
            {visibleMonths.map((m) => (
              <th key={m} className="border p-2">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data
            .filter(
              (a) =>
                selectedArticles.includes(a.id) &&
                a.works.some(
                  (w) =>
                    (yearFilter === "all" || String(w.year) === yearFilter) &&
                    (respFilter === "all" || w.responsible === respFilter)
                )
            )
            .map((article, aIdx) => {
            const filteredWorks = article.works.filter(
              (w) =>
                (yearFilter === "all" || String(w.year) === yearFilter) &&
                (respFilter === "all" || w.responsible === respFilter)
            );
            const { monthTotals, quarterTotals } = calcTotals({
              ...article,
              works: filteredWorks,
            });

            return (
              <React.Fragment key={`${article.name}-${aIdx}`}>
                {showDetails &&
                  article.works
                    .filter(
                      (w) =>
                        (yearFilter === "all" || String(w.year) === yearFilter) &&
                        (respFilter === "all" || w.responsible === respFilter)
                    )
                    .map((work, wIdx) => (
                    <tr
                      key={work.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDialog(aIdx, wIdx)}
                    >
                      {wIdx === 0 && (
                        <td
                          rowSpan={filteredWorks.length + 1}
                          className="border p-2 font-semibold bg-gray-100 align-top"
                        >
                          {article.name}
                        </td>
                      )}
                      <td className="border p-2 bg-white">
                        <div className="flex items-center gap-1">
                          {work.name}
                          {work.materials?.length > 0 && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <Paperclip className="w-3 h-3 mr-0.5" />
                              {work.materials.length}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {work.year} · {work.responsible || "—"}
                        </div>
                      </td>
                      {visibleMonths.map((m) => (
                        <td key={m} className="border p-2 text-right">
                          {renderCell(
                            (work.accruals || {})[m],
                            (work.payments || {})[m],
                            (work.actual_accruals || {})[m],
                            (work.actual_payments || {})[m]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                {/* итоговая строка по статье */}
                <tr key={`totals-${article.name}`}>
                  {!showDetails && (
                    <td className="border p-2 font-semibold bg-teal-50">
                      {article.name}
                    </td>
                  )}
                  <td className="border p-2 bg-teal-50 text-center font-medium">
                    Итого
                  </td>
                  {visibleMonths.map((m) => (
                    <td
                      key={m}
                      className="border p-2 bg-teal-50 font-medium text-center whitespace-pre-line"
                    >
                      {formatTotalLines(
                        monthTotals[m].acc,
                        monthTotals[m].pay,
                        monthTotals[m].fAcc,
                        monthTotals[m].fPay
                      )}
                    </td>
                  ))}
                </tr>

                {/* строка по кварталам */}
                {showQuarterTotals.some(Boolean) && (
                  <tr key={`qtotals-${article.name}`}>
                    {/* placeholder for sticky "Статья" column */}
                    <td className="border p-2 bg-emerald-50" />
                    {/* label cell for row */}
                    <td className="border p-2 bg-emerald-50 font-medium">
                      Квартальный итог
                    </td>
                    {/* only output cells for visible quarters */}
                    {quarterTotals.map((qt, qIdx) =>
                      showQuarterTotals[qIdx] ? (
                        <td
                          key={qIdx}
                          colSpan={3}
                          className="border p-2 bg-emerald-50 font-medium text-center whitespace-pre-line"
                        >
                          {formatTotalLines(qt.acc, qt.pay, qt.fAcc, qt.fPay)}
                        </td>
                      ) : null
                    )}
                  </tr>
                )}

                {/* кнопка добавить работу (если показывают детали) */}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* ---------- DIALOG ---------- */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>
                {selected?.workIdx === null ? "Новая работа" : "Редактирование работы"}
              </DialogTitle>
              <DialogDescription>
                Введите параметры работы, прикрепите материалы и укажите план/факт.
              </DialogDescription>
            </DialogHeader>

            {/* Dialog body */}
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Article select */}
              <div>
                <label className="block text-sm mb-1 font-medium">Статья</label>
                <Select
                  value={workArticleId ? String(workArticleId) : ""}
                  onValueChange={(v) => setWorkArticleId(Number(v))}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="Выберите статью" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm mb-1 font-medium">Название работы</label>
                <Input
                  value={workName}
                  onChange={(e) => setWorkName(e.target.value)}
                  placeholder="Введите название"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm mb-1 font-medium">Год</label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[year - 1, year, year + 1, year + 2].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Responsible */}
              <div>
                <label className="block text-sm mb-1 font-medium">
                  Ответственный (ФИО)
                </label>
                <Input
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Введите ФИО"
                />
              </div>

              {/* Justification */}
              <div>
                <label className="block text-sm mb-1 font-medium">Обоснование</label>
                <textarea
                  rows={2}
                  className="w-full border rounded p-2 text-sm"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Почему необходима работа"
                ></textarea>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm mb-1 font-medium">Комментарий</label>
                <textarea
                  rows={2}
                  className="w-full border rounded p-2 text-sm"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Дополнительные сведения"
                ></textarea>
              </div>

              {/* Materials */}
              <section>
                <h3 className="font-semibold mb-2 flex items-center">
                  <Paperclip className="w-4 h-4 mr-1" /> Материалы
                </h3>
                {materials.length > 0 && (
                  <ul className="list-disc pl-5 mb-2 space-y-1 text-sm">
                    {materials.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        {f.name}
                        <Button size="icon" variant="ghost" onClick={() => removeMaterial(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Input type="file" multiple onChange={handleFileAdd} className="cursor-pointer" />
              </section>

              {/* ACCRUALS */}
              <section>
                <h3 className="font-semibold mb-2">Начисления (план / факт)</h3>
                {accrualRows.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 mb-2">
                    <Select
                      value={row.month}
                      onValueChange={(val) => updateRow(setAccrualRows, idx, "month", val)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Мес." />
                      </SelectTrigger>
                      <SelectContent>
                        {monthKeys.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="План"
                      className="w-28"
                      value={row.amount}
                      onChange={(e) => updateRow(setAccrualRows, idx, "amount", e.target.value)}
                    />
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={row.checked}
                        onChange={(e) => updateRow(setAccrualRows, idx, "checked", e.target.checked)}
                      />
                      Факт
                    </label>
                    {row.checked && (
                      <Input
                        type="number"
                        placeholder="Факт"
                        className="w-28"
                        value={row.actual}
                        onChange={(e) => updateRow(setAccrualRows, idx, "actual", e.target.value)}
                      />
                    )}
                    <Button size="icon" variant="ghost" onClick={() => delRow(setAccrualRows, idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => addRow(setAccrualRows)}>
                  <Plus className="w-4 h-4 mr-1" /> Добавить строку
                </Button>
              </section>

              {/* PAYMENTS */}
              <section>
                <h3 className="font-semibold mb-2">Оплаты (план / факт)</h3>
                {paymentRows.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 mb-2">
                    <Select
                      value={row.month}
                      onValueChange={(val) => updateRow(setPaymentRows, idx, "month", val)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Мес." />
                      </SelectTrigger>
                      <SelectContent>
                        {monthKeys.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="План"
                      className="w-28"
                      value={row.amount}
                      onChange={(e) => updateRow(setPaymentRows, idx, "amount", e.target.value)}
                    />
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={row.checked}
                        onChange={(e) => updateRow(setPaymentRows, idx, "checked", e.target.checked)}
                      />
                      Факт
                    </label>
                    {row.checked && (
                      <Input
                        type="number"
                        placeholder="Факт"
                        className="w-28"
                        value={row.actual}
                        onChange={(e) => updateRow(setPaymentRows, idx, "actual", e.target.value)}
                      />
                    )}
                    <Button size="icon" variant="ghost" onClick={() => delRow(setPaymentRows, idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => addRow(setPaymentRows)}>
                  <Plus className="w-4 h-4 mr-1" /> Добавить строку
                </Button>
              </section>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={handleSave}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
};

export default BudgetTableDemo;