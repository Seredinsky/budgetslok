import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

// ──────────── Демо‑данные ────────────
const initialData = [
  {
    item: "ИТ‑Инфраструктура",
    works: [
      {
        id: 1,
        name: "Апгрейд серверов",
        accruals: { Янв: 1200, Мар: 800 },
        payments: { Фев: 2000 },
        actualAccruals: {},
        actualPayments: {},
        justification: "Замена устаревших серверов",
        comment: "Поставщик Dell",
        materials: [],
      },
    ],
  },
  {
    item: "Маркетинг",
    works: [
      {
        id: 2,
        name: "Кампания A",
        accruals: { Май: 1000 },
        payments: { Июл: 1000 },
        actualAccruals: {},
        actualPayments: {},
        justification: "Летняя распродажа",
        comment: "Google Ads + SMM",
        materials: [{ name: "brief.pdf" }],
      },
    ],
  },
];

// ──────────── Вспомогательные функции ────────────
const formatCell = (acc, pay) => {
  if (!acc && !pay) return "";
  return [acc ? `Н: ${acc}` : null, pay ? `О: ${pay}` : null].filter(Boolean).join(" / ");
};

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
  const [data, setData] = useState(initialData);

  // при монтировании тянем данные с бэкенда
  useEffect(() => {
    axios.get(API).then(({ data }) => setData(data));
  }, []);

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
  const handleSave = () => {
    setData((prev) => {
      const clone = [...prev];
      const { articleIdx, workIdx } = selected;

      const payload = {
        id: workIdx === null ? Date.now() : clone[articleIdx].works[workIdx].id,
        name: workName || "Работа",
        accruals: arrToPlan(accrualRows),
        payments: arrToPlan(paymentRows),
        actualAccruals: arrToFact(accrualRows),
        actualPayments: arrToFact(paymentRows),
        justification,
        comment,
        materials,
      };
      if (workIdx === null) {
        // новая работа
        clone[articleIdx].works.push(payload);
        axios.post("http://127.0.0.1:8000/api/works/", payload);
      } else {
        // редактирование существующей
        clone[articleIdx].works[workIdx] = payload;
        axios.put(`http://127.0.0.1:8000/api/works/${payload.id}/`, payload);
      }
      return clone;
    });

    setDialogOpen(false);
  };

  // ──────────── Render ────────────
  return (
    <div className="p-4 overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Бюджет — демо</h1>

      {/* ---------- TABLE ---------- */}
      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th rowSpan={2} className="border p-2">Статья</th>
            <th rowSpan={2} className="border p-2">Работа</th>
            {quarters.map((q) => (
              <th key={q} colSpan={3} className="border p-2">
                {q}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 text-center">
            {monthKeys.map((m) => (
              <th key={m} className="border p-2 w-20">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((article, aIdx) => (
            <React.Fragment key={`${article.item}-${aIdx}`}>
              {article.works.map((work, wIdx) => (
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
                      {article.item}
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
                  {monthKeys.map((m) => (
                    <td key={m} className="border p-2 text-right">
                      {formatCell(work.accruals[m], work.payments[m])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr key={`add-${aIdx}`}>
                <td
                  colSpan={monthKeys.length + 1}
                  className="border p-2 bg-gray-50 text-center"
                >
                  <Button variant="outline" onClick={() => openDialog(aIdx)}>
                    + Добавить работу
                  </Button>
                </td>
              </tr>
            </React.Fragment>
          ))}
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
  );
};

export default BudgetTableDemo;