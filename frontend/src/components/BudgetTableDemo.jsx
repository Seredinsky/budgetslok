import React, { useState, useEffect } from "react";
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

  // флажки отображения Н и О
  const [showAccruals, setShowAccruals] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  // выбранные статьи для отображения (id)
  const [selectedArticles, setSelectedArticles] = useState([]);
  // флажки поквартального отображения (I, II, III, IV)
  // true → показывать квартал (и соответствующие месяцы) в таблице
  const [showQuarterTotals, setShowQuarterTotals] = useState([true, true, true, true]);

  // какие месяцы показывать в таблице согласно выбранным кварталам
  const visibleMonths = monthKeys.filter(
    (_, idx) => showQuarterTotals[Math.floor(idx / 3)]
  );

  // формат ячеек с учётом флажков
  const renderCell = (acc, pay) => {
    const accVal = showAccruals ? acc : undefined;
    const payVal = showPayments ? pay : undefined;
    if (!accVal && !payVal) return "";
    return [
      accVal ? `Н: ${accVal}` : null,
      payVal ? `О: ${payVal}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
  };

  // формат для итоговых ячеек «Оплата / Начисление» в две строки
  const formatTotalLines = (acc, pay) => {
    const lines = [];
    if (pay !== undefined && pay !== 0 && showPayments) {
      lines.push(`Оплата: ${pay.toLocaleString("ru-RU")} руб`);
    }
    if (acc !== undefined && acc !== 0 && showAccruals) {
      lines.push(`Начисление: ${acc.toLocaleString("ru-RU")} руб`);
    }
    return lines.join("\n");
  };

  // при монтировании тянем данные с бэкенда
  useEffect(() => {
    axios.get(API).then(({ data }) => {
      setData(data);
      setSelectedArticles(data.map((it) => it.id));  // выбрать все по умолчанию
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
      setMaterials([]);
      setAccrualRows([{ month: "", amount: "", checked: false, actual: "" }]);
      setPaymentRows([{ month: "", amount: "", checked: false, actual: "" }]);
    } else {
      const w = data[articleIdx].works[workIdx];
      setWorkName(w.name);
      setJustification(w.justification || "");
      setComment(w.comment || "");
      setMaterials(w.materials || []);
      setAccrualRows(objToRows(w.accruals, w.actualAccruals));
      setPaymentRows(objToRows(w.payments, w.actualPayments));
    }

    setDialogOpen(true);
  };

  // save
  const handleSave = async () => {
    const { articleIdx, workIdx } = selected;
    const article = data[articleIdx];

    const payload = {
      id: workIdx === null ? undefined : article.works[workIdx].id,
      item: article.id, // backend needs parent article id
      name: workName || "Работа",
      accruals: arrToPlan(accrualRows),
      payments: arrToPlan(paymentRows),
      actualAccruals: arrToFact(accrualRows),
      actualPayments: arrToFact(paymentRows),
      justification,
      comment,
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
          clone[articleIdx].works.push(savedWork);
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

  // суммирование по статье: месяцы и кварталы (отдельно Н и О)
  const calcTotals = (article) => {
    const monthTotals = {};
    const quarterTotals = [
      { acc: 0, pay: 0 },
      { acc: 0, pay: 0 },
      { acc: 0, pay: 0 },
      { acc: 0, pay: 0 },
    ];

    monthKeys.forEach((m, idx) => {
      let acc = 0;
      let pay = 0;
      article.works.forEach((w) => {
        acc += w.accruals[m] || 0;
        pay += w.payments[m] || 0;
      });
      monthTotals[m] = { acc, pay };

      const qIdx = Math.floor(idx / 3);
      quarterTotals[qIdx].acc += acc;
      quarterTotals[qIdx].pay += pay;
    });

    return { monthTotals, quarterTotals };
  };

  // ──────────── Render ────────────
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* sidebar */}
      <aside className="w-44 bg-gray-50 border-r p-3 flex-shrink-0 overflow-auto max-h-screen">
        <h2 className="font-semibold mb-3">Статьи</h2>
        <div className="space-y-2 text-sm">
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
      </aside>

      {/* main content */}
      <div className="flex-1 p-4 overflow-auto">
        <h1 className="text-2xl font-bold mb-4">Бюджет — демо</h1>

      <Button
        variant="secondary"
        size="sm"
        className="mb-4"
        onClick={() => setShowDetails((p) => !p)}
      >
        {showDetails ? "Скрыть работы (только итоги)" : "Показать работы детально"}
      </Button>

      <div className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showAccruals}
            onChange={(e) => setShowAccruals(e.target.checked)}
          />
          Начисления
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showPayments}
            onChange={(e) => setShowPayments(e.target.checked)}
          />
          Оплаты
        </label>
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

      {/* ---------- TABLE ---------- */}
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th rowSpan={2} className="border p-2">Статья</th>
            <th rowSpan={2} className="border p-2">Работа</th>
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
              <th key={m} className="border p-2 w-20">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data
            .filter((a) => selectedArticles.includes(a.id))
            .map((article, aIdx) => {
            const { monthTotals, quarterTotals } = calcTotals(article);

            return (
              <React.Fragment key={`${article.name}-${aIdx}`}>
                {showDetails &&
                  article.works.map((work, wIdx) => (
                    <tr
                      key={work.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDialog(aIdx, wIdx)}
                    >
                      {wIdx === 0 && (
                        <td
                          rowSpan={article.works.length + 1}
                          className="border p-2 font-semibold bg-gray-100 align-top"
                        >
                          {article.name}
                        </td>
                      )}
                      <td className="border p-2 bg-white flex items-center gap-1">
                        {work.name}
                        {work.materials?.length > 0 && (
                          <span className="inline-flex items-center text-xs text-gray-500">
                            <Paperclip className="w-3 h-3 mr-0.5" />
                            {work.materials.length}
                          </span>
                        )}
                      </td>
                      {visibleMonths.map((m) => (
                        <td key={m} className="border p-2 text-right">
                          {renderCell(work.accruals[m], work.payments[m])}
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
                      {formatTotalLines(monthTotals[m].acc, monthTotals[m].pay)}
                    </td>
                  ))}
                </tr>

                {/* строка по кварталам */}
                {showQuarterTotals.some(Boolean) && (
                  <tr key={`qtotals-${article.name}`}>
                    <td className="border p-2 bg-emerald-50" />
                    <td className="border p-2 bg-emerald-50 font-medium">
                      Квартальный итог
                    </td>
                    {quarterTotals.map((qt, qIdx) => (
                      <td
                        key={qIdx}
                        colSpan={3}
                        className="border p-2 bg-emerald-50 font-medium text-center whitespace-pre-line"
                      >
                        {showQuarterTotals[qIdx] ? formatTotalLines(qt.acc, qt.pay) : ""}
                      </td>
                    ))}
                  </tr>
                )}

                {/* кнопка добавить работу (если показывают детали) */}
                {showDetails && (
                  <tr key={`add-${article.name}`}>
                    {article.works.length === 0 && (
                      <td className="border p-2 font-semibold bg-gray-100 align-top">
                        {article.name}
                      </td>
                    )}
                    <td
                      colSpan={
                        article.works.length === 0
                          ? visibleMonths.length + 1          // Статья + Работа + months (название ячейка присутствует)
                          : visibleMonths.length + 2          // Работа + months, но учесть скрытую «Статья» колонку
                      }
                      className="border p-2 bg-gray-50 text-center"
                    >
                      <Button
                        variant="outline"
                        onClick={() => openDialog(aIdx)}
                      >
                        + Добавить работу
                      </Button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* ---------- DIALOG ---------- */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
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
              {/* Name */}
              <div>
                <label className="block text-sm mb-1 font-medium">Название работы</label>
                <Input
                  value={workName}
                  onChange={(e) => setWorkName(e.target.value)}
                  placeholder="Введите название"
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