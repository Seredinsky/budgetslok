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
import { Plus, Trash2, Paperclip, X, CheckCircle, Repeat } from "lucide-react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api as axios } from "@/api/axios";

import clsx from "clsx";
import { useAuth } from "@/auth/AuthContext";

// URL бэкенда для скачивания файлов; задаётся через .env или по умолчанию localhost:8000
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "http://127.0.0.1:8000";

// утилита: извлечь красивое имя файла из URL (decodeURIComponent последнего сегмента)
const niceFileName = (url, fallback = "файл") => {
  if (!url) return fallback;
  try {
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return fallback;
  }
};

// утилита: извлечь число из записи с учетом amount/status
const getAmt = (v) => {
  if (v != null && typeof v === "object") {
    if ("amount" in v) return v.amount || 0;
    const keys = Object.keys(v);
    if (keys.length) return v[keys[0]] || 0;
    return 0;
  }
  return v || 0;
};

const API = "items/";
const MATERIALS_API = "materials/";
const REPORTS_API = MATERIALS_API;

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
  Object.entries(plan).map(([m, a]) => {
    const rec =
      a != null && typeof a === "object"
        ? {
            amount: getAmt(a),
            status:
              a.status ||
              Object.keys(a).find((k) => k !== "amount") ||
              "действ",
          }
        : { amount: a, status: "действ" };
    return {
      month: m,
      amount: String(rec.amount),
      status: rec.status,
      checked: Boolean(fact[m]),
      actual: String(
        fact[m] != null && typeof fact[m] === "object"
          ? fact[m].amount
          : fact[m] || ""
      ),
    };
  });

const arrToPlan = (rows) =>
  rows.reduce((acc, r) => {
    if (r.month && r.amount !== "") acc[r.month] = Number(r.amount);
    return acc;
  }, {});

const arrToFact = (rows) =>
  rows.reduce((acc, r) => {
    if (r.checked && r.month && r.actual !== "") {
      acc[r.month] = { amount: Number(r.actual), status: "действ" };
    }
    return acc;
  }, {});

// ──────────── Компонент ────────────
const primaryColorClass = 'bg-[rgb(237,28,36)]';
const BudgetTableDemo = () => {
  // table state
  // имя текущего месяца (по индексам в monthKeys)
  const currentMonthName = monthKeys[new Date().getMonth()];
  const { logout, user } = useAuth();          // выход
  const [users, setUsers] = useState([]);      // справочник
  const userName = (uid) => {
    const u = users.find((x) => String(x.id) === String(uid));
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.username || uid : uid;
  };

  const [data, setData] = useState([]);
  const [reserves, setReserves] = useState([]);   // квартальные резервы

  // какие статьи раскрыты (id)
  const [expandedArticles, setExpandedArticles] = useState([]);
  // переключатель "детально / только итоги" (удалено)

  // loading states for initial data fetch
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingReserves, setLoadingReserves] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [mode, setMode] = useState("both"); // "plan" | "fact" | "both"
  // отображать начисления, оплаты или оба
  const [flowMode, setFlowMode] = useState("acc"); // "acc" | "pay" | "both"
  const showAccruals = flowMode === "acc" || flowMode === "both";
  const showPayments = flowMode === "pay" || flowMode === "both";
  // выбранные статьи для отображения (id)
  const [selectedArticles, setSelectedArticles] = useState([]);

  // фильтры года и ответственного
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [respFilter, setRespFilter] = useState("all");
  // sidebar hamburger
  const [settingsOpen, setSettingsOpen] = useState(false);
  // флажки поквартального отображения (I, II, III, IV)
  // true → показывать квартал (и соответствующие месяцы) в таблице
  const [showQuarterTotals, setShowQuarterTotals] = useState([true, true, true, true]);

  // какие месяцы показывать в таблице согласно выбранным кварталам
  const visibleMonths = monthKeys.filter(
    (_, idx) => showQuarterTotals[Math.floor(idx / 3)]
  );

  // --- Sorting state for works ---
  const [sortByDate, setSortByDate] = useState(false);
  const [sortBySum, setSortBySum] = useState(null); // "asc" | "desc" | null

  // суммарный бюджет по выбранным фильтрам, раздельно для начислений и оплат
  const globalTotals = useMemo(() => {
    let planAcc = 0,
      planPay = 0,
      factAcc = 0,
      factPay = 0;

    data.forEach((article) => {
      if (!selectedArticles.includes(article.id)) return;

      article.works.forEach((w) => {
        // Skip works with feasibility === "red"
        if (w.feasibility === "red") return;
        // Apply 50% weight for yellow feasibility
        const factor = w.feasibility === "yellow" ? 0.5 : 1;
        if (
          (yearFilter !== "all" && String(w.year) !== yearFilter) ||
          (respFilter !== "all" && String(w.responsible) !== String(respFilter))
        ) {
          return;
        }

        Object.entries(w.accruals || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) planAcc += getAmt(v) * factor;
        });
        Object.entries(w.payments || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) planPay += getAmt(v) * factor;
        });
        Object.entries(w.actual_accruals || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) factAcc += getAmt(v);
        });
        Object.entries(w.actual_payments || {}).forEach(([m, v]) => {
          if (visibleMonths.includes(m)) factPay += getAmt(v);
        });
      });
    });

    // добавляем свободный резерв по выбранным кварталам
    reserves.forEach((r) => {
      if (
        selectedArticles.includes(r.item) &&
        (yearFilter === "all" || String(r.year) === yearFilter) &&
        showQuarterTotals[r.quarter - 1]
      ) {
        planAcc += r.balance_acc;
        planPay += r.balance_pay;
      }
    });

    return {
      acc: { plan: planAcc, fact: factAcc },
      pay: { plan: planPay, fact: factPay },
    };
  }, [data, selectedArticles, yearFilter, respFilter, visibleMonths, reserves, showQuarterTotals]);

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
    if (respFilter !== "all") chips.push(`Ответственный: ${userName(respFilter)}`);

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

  // список ответственных из справочника users
  const allResponsibles = users.map((u) => ({ id: u.id, name: userName(u.id) }));

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

    // decide color for percent line
    let pctColor = "text-gray-500";
    if (mode === "both" && percentLine) {
      const pctNum = Number(percentLine.replace("%", ""));
      if (factVals.reduce((s, v) => s + v, 0) === 0) {
        pctColor = "text-gray-500";
      } else if (pctNum === 100) {
        pctColor = "text-emerald-600";
      } else {
        pctColor = "text-yellow-600";
      }
    }

    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{mainNums}</span>
        {percentLine && (
          <span className={clsx("text-xs", pctColor)}>{percentLine}</span>
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

    // calculate percentage
    let percentLine = null;
    if (mode === "both") {
      const planSum = planVals.reduce((s, v) => s + v, 0);
      const factSum = factVals.reduce((s, v) => s + v, 0);
      if (planSum > 0) {
        percentLine = `${((factSum / planSum) * 100).toFixed(0)}%`;
      }
    }

    // choose color
    let pctColor = "text-gray-500";
    if (mode === "both" && percentLine) {
      const pctNum = Number(percentLine.replace("%", ""));
      if (factVals.reduce((s, v) => s + v, 0) === 0) {
        pctColor = "text-gray-500";
      } else if (pctNum === 100) {
        pctColor = "text-emerald-600";
      } else {
        pctColor = "text-yellow-600";
      }
    }

    if (!mainNums) return "";

    return (
      <div className="flex flex-col items-center leading-tight">
        <span>{mainNums}</span>
        {percentLine && (
          <span className={clsx("text-xs", pctColor)}>{percentLine}</span>
        )}
      </div>
    );
  };

  // при монтировании тянем данные с бэкенда
  useEffect(() => {
    setLoadingItems(true);
    setLoadingReserves(true);
    setLoadingUsers(true);

    axios.get(API)
      .then(({ data }) => {
        setData(data);
        setSelectedArticles(data.map((it) => it.id));
        setExpandedArticles([]);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingItems(false));

    axios.get("reserves/")
      .then(({ data }) => setReserves(data))
      .catch((err) => console.error(err))
      .finally(() => setLoadingReserves(false));

    axios.get("users/")
      .then(({ data }) => setUsers(data))
      .catch((err) => console.error(err))
      .finally(() => setLoadingUsers(false));
  }, []);
  
  // переключение раскрытия конкретной статьи
  const toggleArticleExpand = (id) => {
    setExpandedArticles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  // переключение выбора статьи
  const toggleArticle = (id) => {
    setSelectedArticles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  // dialog animation origin
  const [dialogOrigin, setDialogOrigin] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null); // { articleIdx, workIdx }

  // write-off reserve checkbox state
  const [useReserve, setUseReserve] = useState(false);
  // per-quarter write-off flags
  const [reserveChecks, setReserveChecks] = useState({});
  // per-month cancel/transfer flags for accruals and payments
  const [cancelAccrualChecks, setCancelAccrualChecks] = useState({});
  const [transferAccrualChecks, setTransferAccrualChecks] = useState({});
  const [cancelPaymentChecks, setCancelPaymentChecks] = useState({});
  const [transferPaymentChecks, setTransferPaymentChecks] = useState({});

  // form fields
  const [workName, setWorkName] = useState("");
  const [justification, setJustification] = useState("");
  const [comment, setComment] = useState("");
  // вложенные детали фактических оплат
  const [paymentDetails, setPaymentDetails] = useState([]);
  // флаги показа деталей оплат по строкам
  const [showPaymentDetailFlags, setShowPaymentDetailFlags] = useState([]);
  const toggleShowPaymentDetail = (idx) =>
    setShowPaymentDetailFlags(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  const updatePaymentDetail = (idx, key, value) =>
    setPaymentDetails(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
    // детали начислений
    const [accrualDetails, setAccrualDetails] = useState([]);
    const [showAccrualDetailFlags, setShowAccrualDetailFlags] = useState([]);
    const toggleShowAccrualDetail = (idx) =>
      setShowAccrualDetailFlags(prev => {
        const next = [...prev];
        next[idx] = !next[idx];
        return next;
      });
    const updateAccrualDetail = (idx, key, value) =>
      setAccrualDetails(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], [key]: value };
        return next;
      });
  const [materials, setMaterials] = useState([]); // [{ name }]
  const [year, setYear] = useState(currentYear);
  const [responsible, setResponsible] = useState("");
  // статья, к которой относится работа в диалоге
  const [workArticleId, setWorkArticleId] = useState(null);
  const [accrualRows, setAccrualRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [vatRate, setVatRate] = useState(0);
  // флаг автоматического расчета начислений на основе НДС
  const [autoCalc, setAutoCalc] = useState(false);
  const [feasibility, setFeasibility] = useState("green");
  const [certification, setCertification] = useState(false);
  const [workType, setWorkType] = useState("");
  const [productName, setProductName] = useState("");
  const [responsibleSlok, setResponsibleSlok] = useState("");
  const [responsibleDpm, setResponsibleDpm] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [certificationBody, setCertificationBody] = useState("");
 

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
  const handleFileAdd = async (e) => {
    const filesArr = Array.from(e.target.files);
    e.target.value = ""; // сбрасываем input

    if (!filesArr.length) return;

    // id работы: если новая, помечаем как "tmp"
    const workId =
      selected?.workIdx === null
        ? "tmp"
        : data[selected.articleIdx].works[selected.workIdx].id;

    try {
      const uploaded = await Promise.all(
        filesArr.map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          form.append("work", workId);
          const { data } = await axios.post(MATERIALS_API, form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return data; // { id, file, work, ... }
        })
      );
      setMaterials((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      alert("Не удалось загрузить файл(ы).");
    }
  };
  const removeMaterial = async (idx) => {
    setMaterials((prev) => {
      const target = prev[idx];
      // оптимистично убираем из списка
      const next = prev.filter((_, i) => i !== idx);

      // если файл уже сохранён на сервере (есть id и work != "tmp") — удаляем через API
      if (target?.id && target.work !== "tmp") {
        axios
          .delete(`${MATERIALS_API}${target.id}/`)
          .catch((err) => console.error("Не удалось удалить файл:", err));
      }

      return next;
    });
  };

  // report handlers
  const handleReportAdd = async (articleId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const form = new FormData();
    form.append("file", file);
    form.append("item", articleId);
    try {
      const { data: report } = await axios.post(REPORTS_API, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setData(prev => prev.map(a => a.id === articleId
        ? { ...a, reports: [...(a.reports || []), report] }
        : a
      ));
    } catch (err) {
      console.error(err);
      alert("Не удалось загрузить отчет.");
    }
  };
  const handleReportDelete = async (articleId, reportId) => {
    if (!window.confirm("Удалить отчет?")) return;
    try {
      await axios.delete(`${REPORTS_API}${reportId}/`);
      setData(prev => prev.map(a => a.id === articleId
        ? { ...a, reports: a.reports.filter(r => r.id !== reportId) }
        : a
      ));
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить отчет.");
    }
  };

  // open dialog
  const openDialog = (articleIdx, workIdx = null, e) => {
    if (e && e.clientX != null && e.clientY != null) {
      setDialogOrigin({ x: e.clientX, y: e.clientY });
    }
    setSelected({ articleIdx, workIdx });

    // prepare article and work for both new/edit modes
    let article = data[articleIdx];
    let w = null;

    if (workIdx === null) {
      // new work
      setWorkName("");
      setJustification("");
      setComment("");
      setYear(currentYear);
      setWorkArticleId(article.id);
      setResponsible(user?.id ? String(user.id) : "");
      setMaterials([]);
      // start with no rows; user will add via buttons
      setAccrualRows([]);
      setAccrualDetails([]);
      setShowAccrualDetailFlags([]);
      setPaymentRows([]);
      setPaymentDetails([]);
      setShowPaymentDetailFlags([]);
      setVatRate(0);
      setFeasibility("green");
      setCertification(false);
      setWorkType("");
      setProductName("");
      setResponsibleSlok("");
      setResponsibleDpm("");
      setCertificateNumber("");
      setCertificationBody("");
    } else {
      // editing existing work
      w = article.works[workIdx];
      setWorkName(w.name);
      setJustification(w.justification || "");
      setComment(w.comment || "");
      setYear(w.year || currentYear);
      setResponsible(w.responsible || "");
      setWorkArticleId(article.id);
      setMaterials(w.materials || []);
      setAccrualRows(objToRows(w.accruals, w.actual_accruals));
      setAccrualDetails(
        (w.accrual_details || []).map(d => ({
          id: d.id,
          month: d.month,
          amount: String(d.amount),
          closing_document: d.closing_document || "",
          comment: d.comment || "",
          comment_file: d.comment_file || null,
          cancel_reason: d.cancel_reason || "",
          transfer_reason: d.transfer_reason || "",
          // Причина корректировки начисления
          correction_reason: d.correction_reason || "",
          is_correction: d.is_correction || false,
          // — конец корректировки —
        }))
      );
      setShowAccrualDetailFlags((w.accrual_details || []).map(() => false));
      setPaymentRows(objToRows(w.payments, w.actual_payments));
      setPaymentDetails(
        (w.payment_details || []).map(d => ({
          id: d.id,
          month: d.month,
          amount: String(d.amount),
          creditor: d.creditor || "",
          contract: d.contract || "",
          pfm: d.pfm || "11000900",
          fp: d.fp || "",
          mvz: d.mvz || "",
          mm: d.mm || "",
          payment_document: d.payment_document || "",
          payment_close: d.payment_close || "",
          comment: d.comment || "",
          comment_file: d.comment_file || null,
          cancel_reason: d.cancel_reason || "",
          transfer_reason: d.transfer_reason || "",
          // Причина корректировки оплаты
          correction_reason: d.correction_reason || "",
          is_correction: d.is_correction || false,
          // — конец корректировки —
        }))
      );
      setShowPaymentDetailFlags((w.payment_details || []).map(() => false));
      setVatRate(w.vat_rate || 0);
      setFeasibility(w.feasibility || "green");
      setCertification(w.certification || false);
      setWorkType(w.work_type || "");
      setProductName(w.product_name || "");
      setResponsibleSlok(w.responsible_slok || "");
      setResponsibleDpm(w.responsible_dpm || "");
      setCertificateNumber(w.certificate_number || "");
      setCertificationBody(w.certification_body || "");
      // initialize separate cancel/transfer flags for accruals and payments
      const initCancelAcc = {};
      const initTransferAcc = {};
      objToRows(w.accruals, w.actual_accruals).forEach((r) => {
        initCancelAcc[r.month] = r.status === "отмена";
        initTransferAcc[r.month] = r.status === "перенос";
      });
      const initCancelPay = {};
      const initTransferPay = {};
      objToRows(w.payments, w.actual_payments).forEach((r) => {
        initCancelPay[r.month] = r.status === "отмена";
        initTransferPay[r.month] = r.status === "перенос";
      });
      setCancelAccrualChecks(initCancelAcc);
      setTransferAccrualChecks(initTransferAcc);
      setCancelPaymentChecks(initCancelPay);
      setTransferPaymentChecks(initTransferPay);
    }

    // initialize reserve toggle:
    if (workIdx === null) {
      setUseReserve(false);
    } else {
      // check if any quarter reserve exists for this article/year
      const any = quarters.some((_, qi) =>
        Boolean(findReserve(article.id, w.year, qi + 1))
      );
      setUseReserve(any);
    }
    // reset per-quarter flags to false
    const initChecks = {};
    quarters.forEach((_, i) => { initChecks[i] = false; });
    setReserveChecks(initChecks);

    if (workIdx === null) {
      // for new work, reset transfer and cancel checks
      const initTransfersAcc = {};
      const initTransfersPay = {};
      const initCancelsAcc = {};
      const initCancelsPay = {};
      visibleMonths.forEach((m) => {
        initTransfersAcc[m] = false;
        initTransfersPay[m] = false;
        initCancelsAcc[m] = false;
        initCancelsPay[m] = false;
      });
      setTransferAccrualChecks(initTransfersAcc);
      setTransferPaymentChecks(initTransfersPay);
      setCancelAccrualChecks(initCancelsAcc);
      setCancelPaymentChecks(initCancelsPay);
    }

    setDialogOpen(true);
  };

  // helper to build accrual/payment records with status
  const buildRecords = (rows, cancelMap, transferMap) =>
    rows.reduce((acc, r) => {
      if (!r.month) return acc;
      const status = cancelMap[r.month]
        ? "отмена"
        : transferMap[r.month]
        ? "перенос"
        : "действ";
      acc[r.month] = { amount: Number(r.amount), status };
      return acc;
    }, {});

  // save
  const handleSave = async () => {
    const { articleIdx, workIdx } = selected;
    const article = data[articleIdx];

    const payload = {
      id: workIdx === null ? undefined : article.works[workIdx].id,
      item: workArticleId, // backend needs parent article id
      name: workName || "Работа",
      accruals: buildRecords(accrualRows, cancelAccrualChecks, transferAccrualChecks),
      payments: buildRecords(paymentRows, cancelPaymentChecks, transferPaymentChecks),
      actual_accruals: arrToFact(
        accrualRows.filter((r) => !cancelAccrualChecks[r.month])
      ),
      actual_payments: arrToFact(
        paymentRows.filter((r) => !cancelPaymentChecks[r.month])
      ),
      justification,
      comment,
      certification,
      work_type: workType,
      product_name: productName,
      responsible_slok: responsibleSlok,
      responsible_dpm: responsibleDpm,
      certificate_number: certificateNumber,
      certification_body: certificationBody,
      year,
      responsible,
      vat_rate: vatRate,
      feasibility,
      materials,
      payment_details: paymentDetails.map((det, idx) => ({
        id: det.id,
        month: paymentRows[idx].month,
        amount: paymentRows[idx].checked
          ? Number(paymentRows[idx].actual)
          : Number(paymentRows[idx].amount),
        creditor: det.creditor,
        contract: det.contract,
        pfm: det.pfm,
        fp: det.fp,
        mvz: det.mvz,
        mm: det.mm,
        payment_document: det.payment_document,
        payment_close: det.payment_close,
        comment: det.comment,
        comment_file: det.comment_file,
        cancel_reason: det.cancel_reason,
        transfer_reason: det.transfer_reason,
        // Корректировка оплаты
        correction_reason: det.correction_reason,
        is_correction: det.is_correction,
        // — конец корректировки —
      })),
      accrual_details: accrualDetails.map((det, idx) => ({
        id: det.id,
        month: accrualRows[idx].month,
        amount: accrualRows[idx].checked
          ? Number(accrualRows[idx].actual)
          : Number(accrualRows[idx].amount),
        closing_document: det.closing_document,
        comment: det.comment,
        comment_file: det.comment_file,
        cancel_reason: det.cancel_reason,
        transfer_reason: det.transfer_reason,
        // Корректировка начисления
        correction_reason: det.correction_reason,
        is_correction: det.is_correction,
        // — конец корректировки —
      })),
    };

    try {
      let response;
      if (workIdx === null) {
        response = await axios.post("works/", payload);
      } else {
        response = await axios.put(
          `works/${payload.id}/`,
          payload
        );
      }

      // use data returned from backend to keep ids in sync
      const savedWork = response.data;
      // если работа была новой — привязываем загруженные файлы, у которых work=="tmp"
      if (workIdx === null && materials.some((m) => m.work === "tmp")) {
        await Promise.all(
          materials
            .filter((m) => m.work === "tmp")
            .map((m) =>
              axios.patch(`${MATERIALS_API}${m.id}/`, { work: savedWork.id })
            )
        );
      }

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

      // perform reserve write-offs for checked quarters
      if (useReserve) {
        await Promise.all(
          Object.entries(reserveChecks)
            .filter(([qIdx, checked]) => checked)
            .map(async ([qIdx]) => {
              const idx = Number(qIdx);
              const monthsQ = monthKeys.slice(idx * 3, idx * 3 + 3);
              const sumAcc = accrualRows.reduce(
                (sum, r) => (monthsQ.includes(r.month) ? sum + Number(r.amount || 0) : sum),
                0
              );
              const sumPay = paymentRows.reduce(
                (sum, r) => (monthsQ.includes(r.month) ? sum + Number(r.amount || 0) : sum),
                0
              );
              const reserve = findReserve(workArticleId, year, idx + 1);
              if (reserve) {
                await axios.post(
                  `reserves/${reserve.id}/write_off/`,
                  { acc: sumAcc, pay: sumPay }
                );
              }
            })
        );
        // refresh reserves
        const { data: fresh } = await axios.get("reserves/");
        setReserves(fresh);
      }


      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить работу. Проверьте данные и повторите.");
    }
  };

  // delete work handler
  const handleDelete = async () => {
    if (!selected || selected.workIdx === null) return;
    if (!window.confirm("Вы уверены, что хотите удалить эту работу?")) return;
    try {
      const { articleIdx, workIdx } = selected;
      const work = data[articleIdx].works[workIdx];
      await axios.delete(`works/${work.id}/`);
      // remove from state
      setData((prev) => {
        const clone = structuredClone(prev);
        clone[articleIdx].works.splice(workIdx, 1);
        return clone;
      });
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить работу.");
    }
  };

  // плавающая кнопка "Добавить работу"
  const handleAddWorkFab = () => {
    if (selectedArticles.length === 0) return;
    const firstId = selectedArticles[0];
    const idx = data.findIndex((a) => a.id === firstId);
    if (idx >= 0) openDialog(idx);
  };

  // вернуть true если работа содержит данные в выбранных visibleMonths и согласно flowMode
  const workHasVisibleData = (w) => {
    return visibleMonths.some((m) => {
      if (showAccruals && (w.accruals?.[m] || w.actual_accruals?.[m])) return true;
      if (showPayments && (w.payments?.[m] || w.actual_payments?.[m])) return true;
      return false;
    });
  };
   // вернуть резерв по статье, году и кварталу (1-4)
  const findReserve = (itemId, year, quarter) =>
   reserves.find(
    (r) =>
      r.item === itemId &&
      Number(r.year) === Number(year) &&
      Number(r.quarter) === Number(quarter)
  );
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
        if (w.feasibility === "red") return;
        // Apply 50% weight for yellow feasibility
        const factor = w.feasibility === "yellow" ? 0.5 : 1;
        const a = w.accruals || {};
        const p = w.payments || {};
        const fa = w.actual_accruals || {};
        const fp = w.actual_payments || {};

        // исключаем корректированные записи из расчётов
        const corrAcc = (w.accrual_details || []).some(d => d.month === m && d.is_correction);
        if (!corrAcc) {
          acc += getAmt(a[m]) * factor;
        }
        const corrPay = (w.payment_details || []).some(d => d.month === m && d.is_correction);
        if (!corrPay) {
          pay += getAmt(p[m]) * factor;
        }
        fAcc += getAmt(fa[m]);
        fPay += getAmt(fp[m]);
      });
      monthTotals[m] = { acc, pay, fAcc, fPay };

      const qIdx = Math.floor(monthKeys.indexOf(m) / 3);
      quarterTotals[qIdx].acc += acc;
      quarterTotals[qIdx].pay += pay;
      quarterTotals[qIdx].fAcc += fAcc;
      quarterTotals[qIdx].fPay += fPay;
    });
    // + свободный резерв
    quarterTotals.forEach((qt, qi) => {
      const res = findReserve(
        article.id,
        yearFilter === "all" ? currentYear : yearFilter,
        qi + 1
      );
      if (res) {
        qt.acc += res.balance_acc;
        qt.pay += res.balance_pay;
      }
    });
    return { monthTotals, quarterTotals };
  };

  // ──────────── Render ────────────
  const anyLoading = loadingItems || loadingReserves || loadingUsers;
  if (anyLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-transparent">
        <div className="relative w-16 h-16">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-4 border-solid border-t-[rgb(237,28,36)] border-r-transparent border-b-transparent border-l-transparent animate-spin"
          />
          {/* Inner ring */}
          <div
            className="absolute inset-2 rounded-full border-4 border-solid border-t-[rgb(237,28,36)] border-r-transparent border-b-transparent border-l-transparent animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '0.75s' }}
          />
        </div>
        <p className="mt-4 text-lg font-medium text-[rgb(237,28,36)]">Загрузка данных...</p>
        <ul className="mt-2 text-sm text-gray-500">
          {loadingItems && <li>Загружаем статьи...</li>}
          {loadingReserves && <li>Загружаем резервы...</li>}
          {loadingUsers && <li>Загружаем пользователей...</li>}
        </ul>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 overflow-auto">

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

          <details className="mb-4 border rounded">
            <summary className="cursor-pointer font-semibold text-lg w-full text-left px-2 py-1 bg-gray-100 border-b hover:bg-gray-200">
              Статьи
            </summary>
            {Array.from(new Set(data.map((a) => a.group.code))).map((code) => {
              const items = data
                .filter((a) => a.group.code === code)
                .sort((a, b) => a.position - b.position);
              const groupName = items[0]?.group.name;
              return (
                <div key={code} className="mb-4 w-full">
                  <h4 className="font-medium mb-1">{groupName}</h4>
                  <div className="space-y-2 text-sm text-left">
                    {items.map((art) => (
                      <label key={art.id} className="flex items-center gap-2 w-full">
                        <input
                          type="checkbox"
                          checked={selectedArticles.includes(art.id)}
                          onChange={() => toggleArticle(art.id)}
                        />
                        {art.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </details>

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
              {allResponsibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
      <div className="w-full px-4 py-4 relative">
        {/* hamburger button */}
        <button
          type="button"
          className="absolute top-4 left-4 z-40 p-2 rounded border bg-white shadow-sm"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="sr-only">Открыть меню</span>
          {/* simple icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="mb-4 relative flex justify-center items-center w-full pl-16 pr-20">
          <h1 className="text-2xl font-bold text-center">
            Бюджет Службы обеспечения качества
          </h1>
          <button
            onClick={logout}
            className="absolute right-0 border rounded px-3 py-1 text-sm bg-white hover:bg-gray-50"
          >
            {user ? (
              <>
                <span className="hidden lg:inline">
                  Выйти ({`${user.first_name} ${user.last_name}`.trim() || user.username})
                </span>
                <span className="inline lg:hidden">Выйти</span>
              </>
            ) : (
              <span>Выйти</span>
            )}
          </button>
        </div>
        {/* summary card */}
        <div className="mb-4 flex flex-wrap items-start gap-4">
          <div className="bg-white border rounded shadow-sm p-4 flex items-center gap-6">
            {/* block for Accruals */}
            {(flowMode === "acc" || flowMode === "both") && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">Начисления</span>
                <div className="flex items-end gap-2">
                  <span className="text-lg font-semibold text-[rgb(237,28,36)]">
                    {globalTotals.acc.plan.toLocaleString("ru-RU")}₽
                  </span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {globalTotals.acc.fact.toLocaleString("ru-RU")}₽
                  </span>
                </div>
                {(() => {
                  const { plan, fact } = globalTotals.acc;
                  const pct = plan ? Math.min(100, (fact / plan) * 100).toFixed(0) : "0";
                  return (
                    <div className="relative w-56 h-4 bg-gray-200 rounded overflow-hidden">
                      <div
                        className={clsx(
                          "h-full transition-all",
                          mode === "both"
                            ? fact === 0
                              ? "bg-gray-400"
                              : pct === "100"
                              ? "bg-emerald-500"
                              : "bg-yellow-400"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${pct}%` }}
                      ></div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700">
                        {pct}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* block for Payments */}
            {(flowMode === "pay" || flowMode === "both") && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">Оплаты</span>
                <div className="flex items-end gap-2">
                  <span className="text-lg font-semibold text-[rgb(237,28,36)]">
                    {globalTotals.pay.plan.toLocaleString("ru-RU")}₽
                  </span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {globalTotals.pay.fact.toLocaleString("ru-RU")}₽
                  </span>
                </div>
                {(() => {
                  const { plan, fact } = globalTotals.pay;
                  const pct = plan ? Math.min(100, (fact / plan) * 100).toFixed(0) : "0";
                  return (
                    <div className="relative w-56 h-4 bg-gray-200 rounded overflow-hidden">
                      <div
                        className={clsx(
                          "h-full transition-all",
                          mode === "both"
                            ? fact === 0
                              ? "bg-gray-400"
                              : pct === "100"
                              ? "bg-emerald-500"
                              : "bg-yellow-400"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${pct}%` }}
                      ></div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-700">
                        {pct}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* кнопка "Новая работа" создаёт работу в первую выбранную статью */}
          <Button
            className={clsx(primaryColorClass, "text-white")}
            disabled={selectedArticles.length === 0}
            onClick={() => {
              const firstId = selectedArticles[0];
              const idx = data.findIndex((a) => a.id === firstId);
              if (idx >= 0) openDialog(idx);
            }}
          >
            + Новая работа
          </Button>
        </div>


      <div className="sticky top-0 bg-white z-20 mb-4 flex flex-row flex-wrap items-center gap-2 sm:gap-4">
        <div className="inline-flex rounded overflow-hidden border">
          {["acc", "pay", "both"].map((m) => (
            <button
              key={m}
              type="button"
              className={clsx(
                "px-2 py-1 text-sm",
                flowMode === m
                  ? `${primaryColorClass} text-white`
                  : "bg-white hover:bg-[rgba(237,28,36,0.1)]"
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
                mode === m
                  ? `${primaryColorClass} text-white`
                  : "bg-white hover:bg-[rgba(237,28,36,0.1)]"
              )}
              onClick={() => setMode(m)}
            >
              {m === "plan" ? "План" : m === "fact" ? "Факт" : "План+Факт"}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded overflow-hidden border ml-2">
          <button
            type="button"
            className={clsx(
              "px-2 py-1 text-sm",
              sortByDate
                ? `${primaryColorClass} text-white`
                : "bg-white hover:bg-[rgba(237,28,36,0.1)]"
            )}
            onClick={() => setSortByDate(!sortByDate)}
          >
            {sortByDate ? "Сортировка по срокам" : "Сортировка по срокам"}
          </button>
        </div>
        <div className="inline-flex rounded overflow-hidden border ml-2">
          <span className="px-2 py-1 text-sm bg-gray-50 text-gray-700 flex items-center">
            Сумма
          </span>
          {[
            { value: "asc", icon: <ChevronUp className="w-4 h-4" />, label: "↑" },
            { value: "desc", icon: <ChevronDown className="w-4 h-4" />, label: "↓" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={clsx(
                "px-2 py-1 flex items-center justify-center",
                sortBySum === opt.value
                  ? `${primaryColorClass} text-white`
                  : "bg-white hover:bg-[rgba(237,28,36,0.1)]"
              )}
              onClick={() =>
                setSortBySum(sortBySum === opt.value ? null : opt.value)
              }
            >
              {opt.icon}
            </button>
          ))}
        </div>
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-auto">
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
      </div>

      {/* ---------- TABLE ---------- */}
      {data
        .filter(
          (a) =>
            selectedArticles.includes(a.id) &&
            a.works.some(
              (w) =>
                (yearFilter === "all" || String(w.year) === yearFilter) &&
                (respFilter === "all" || String(w.responsible) === String(respFilter))
            )
        )
        .sort((a, b) => a.position - b.position)
        .map((article, aIdx) => {
          // find index of this article in full data array
          const realArticleIdx = data.findIndex((a) => a.id === article.id);
          const allQuartersSelected = showQuarterTotals.every(Boolean);
          const filteredWorks = article.works.filter(
            (w) =>
              (yearFilter === "all" || String(w.year) === yearFilter) &&
              (respFilter === "all" || String(w.responsible) === String(respFilter)) &&
              (allQuartersSelected || workHasVisibleData(w))
          );
          // Determine work order by first month with data according to current mode and flowMode
          const getWorkDateOrder = (w) => {
            for (let i = 0; i < visibleMonths.length; i++) {
              const m = visibleMonths[i];
              const planAmt = (flowMode !== "pay" ? getAmt(w.accruals?.[m]) : 0)
                            + (flowMode !== "acc" ? getAmt(w.payments?.[m]) : 0);
              const factAmt = (flowMode !== "pay" ? getAmt(w.actual_accruals?.[m]) : 0)
                            + (flowMode !== "acc" ? getAmt(w.actual_payments?.[m]) : 0);
              const hasPlan = (mode !== "fact" && planAmt > 0);
              const hasFact = (mode !== "plan" && factAmt > 0);
              if ((mode === "both" && (hasPlan || hasFact)) ||
                  (mode === "plan" && hasPlan) ||
                  (mode === "fact" && hasFact)) {
                return i;
              }
            }
            return Infinity;
          };
          // Apply sorting if enabled
          let tempList = sortByDate
            ? [...filteredWorks].sort((a, b) => getWorkDateOrder(a) - getWorkDateOrder(b))
            : [...filteredWorks];
          if (sortBySum) {
            tempList.sort((a, b) => {
              const sumA = visibleMonths.reduce(
                (s, m) =>
                  s +
                  (getAmt(a.accruals?.[m]) || 0) +
                  (getAmt(a.payments?.[m]) || 0) +
                  (getAmt(a.actual_accruals?.[m]) || 0) +
                  (getAmt(a.actual_payments?.[m]) || 0),
                0
              );
              const sumB = visibleMonths.reduce(
                (s, m) =>
                  s +
                  (getAmt(b.accruals?.[m]) || 0) +
                  (getAmt(b.payments?.[m]) || 0) +
                  (getAmt(b.actual_accruals?.[m]) || 0) +
                  (getAmt(b.actual_payments?.[m]) || 0),
                0
              );
              return sortBySum === "asc" ? sumA - sumB : sumB - sumA;
            });
          }
          const worksList = tempList.filter(() => true);
          const { monthTotals, quarterTotals } = calcTotals({
            ...article,
            works: worksList,
          });
          const expanded = expandedArticles.includes(article.id);
          // calculate how many rows this article will render when expanded
          const baseRows = worksList.length; // one row per work
          const totalsRows = 1 + (showQuarterTotals.some(Boolean) ? 1 : 0); // 1 for "Итого", +1 for quarterly totals if enabled
          const expandedRowCount = baseRows + totalsRows;
          // aggregated sums for collapsed view
          const monthSumAcc = visibleMonths.reduce((s, m) => s + monthTotals[m].acc, 0);
          const monthSumPay = visibleMonths.reduce((s, m) => s + monthTotals[m].pay, 0);
          const monthSumFactAcc = visibleMonths.reduce((s, m) => s + monthTotals[m].fAcc, 0);
          const monthSumFactPay = visibleMonths.reduce((s, m) => s + monthTotals[m].fPay, 0);
          const quarterSumAcc = quarterTotals.reduce(
            (s, qt, qi) => (showQuarterTotals[qi] ? s + qt.acc : s),
            0
          );
          const quarterSumPay = quarterTotals.reduce(
            (s, qt, qi) => (showQuarterTotals[qi] ? s + qt.pay : s),
            0
          );
          const quarterSumFactAcc = quarterTotals.reduce(
            (s, qt, qi) => (showQuarterTotals[qi] ? s + qt.fAcc : s),
            0
          );
          const quarterSumFactPay = quarterTotals.reduce(
            (s, qt, qi) => (showQuarterTotals[qi] ? s + qt.fPay : s),
            0
          );
          return (
            <div key={article.id} className="mb-8">
              <h2 className="text-lg font-semibold mb-2">{article.name}</h2>
              <div className="overflow-x-auto w-full">
                <table className="w-full table-fixed border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th
                        rowSpan={2}
                        className="border p-2 bg-gray-100 w-48 max-w-[12rem] text-left sticky top-0 z-10"
                      >
                        Статья
                      </th>
                      <th
                        rowSpan={2}
                        className="border p-2 bg-gray-100 text-left sticky top-0 z-10 w-56 max-w-[14rem]"
                      >
                        Работа
                      </th>
                      {quarters.map((q, i) =>
                        showQuarterTotals[i] ? (
                          <th
                            key={q}
                            colSpan={3}
                            className="border p-2 text-center sticky top-0 z-10 bg-gray-100 hidden sm:table-cell"
                          >
                            {q}
                          </th>
                        ) : null
                      )}
                    </tr>
                    <tr className="bg-gray-50">
                      {visibleMonths.map((m) => (
                        <th
                          key={m}
                          className={clsx(
                            "border p-2 text-center sticky top-8 z-10 bg-gray-50 hidden sm:table-cell",
                            m === currentMonthName && "bg-yellow-100"
                          )}
                        >
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* collapse row for folded article: show article and totals */}
                    {!expanded && (
                      <>
                        {/* collapse row: only article header */}
                        <tr
                          key={`collapsed-${article.id}`}
                          className="cursor-pointer border-t-2 border-gray-300"
                          onClick={() => toggleArticleExpand(article.id)}
                        >
                          {/* Arrow + article name */}
                          <td
                            rowSpan={2 + (showQuarterTotals.some(Boolean) ? 1 : 0)}
                            className="border p-2 bg-gray-100 text-left font-semibold w-48 max-w-[12rem]"
                          >
                            <span className="mr-1">►</span>
                            {article.name}
                            <div className="mt-2 text-xs">
                              <span className="font-medium">Отчеты: </span>
                              {(article.reports || []).map(r => (
                                <span key={r.id} className="inline-flex items-center mr-1">
                                  <a
                                    href={r.file.startsWith("http") ? r.file : `${BACKEND_ORIGIN}${r.file}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-[10px] break-words block"
                                  >
                                    {niceFileName(r.file)}
                                  </a>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReportDelete(article.id, r.id);
                                    }}
                                    className="ml-1 text-red-500"
                                    title="Удалить отчет"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              <label
                                className="inline-flex items-center cursor-pointer text-red-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="file"
                                  accept="*"
                                  className="hidden"
                                  onChange={e => {
                                    e.stopPropagation();
                                    handleReportAdd(article.id, e);
                                  }}
                                />
                                <Plus className="w-3 h-3" />
                              </label>
                            </div>
                          </td>
                          {/* Blank filler for remaining columns */}
                          <td
                            colSpan={1 + visibleMonths.length}
                            className="border-0 p-0 m-0"
                          />
                        </tr>
                        {/* totals row */}
                        <tr key={`totals-${article.name}`} className="hidden sm:table-row">
                          {/* Removed rowSpan from this td */}
                          <td className="border p-2 text-left font-medium w-56 max-w-[14rem]">
                            Итог
                          </td>
                          {visibleMonths.map((m) => (
                            <td
                              key={m}
                              className="border p-2 font-medium text-center whitespace-pre-line"
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
                        {/* quarterly totals row */}
                        {showQuarterTotals.some(Boolean) && (
                          <tr key={`qtotals-${article.name}`} className="hidden sm:table-row">
                            {/* Removed rowSpan from this td */}
                            <td className="border p-2 font-medium w-56 max-w-[14rem]">
                              Квартальный итог
                            </td>
                            {quarterTotals.map((qt, qIdx) => {
                              if (!showQuarterTotals[qIdx]) return null;
                              const res = findReserve(
                                article.id,
                                yearFilter === "all" ? currentYear : yearFilter,
                                qIdx + 1
                              );
                              const reserveLine = res
                                ? `Резерв Н: ${res.balance_acc.toLocaleString("ru-RU")} / О: ${res.balance_pay.toLocaleString("ru-RU")}`
                                : null;
                              return (
                                <td
                                  key={qIdx}
                                  colSpan={3}
                                  className="border p-2 font-medium text-center whitespace-pre-line"
                                >
                                  {formatTotalLines(qt.acc, qt.pay, qt.fAcc, qt.fPay)}
                                  {reserveLine && (
                                    <div className="text-[10px] text-gray-500 mt-1">
                                      {reserveLine}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </>
                    )}
                    {expanded &&
                      worksList.map((work, wIdx) => {
                        // calculate overall plan vs fact for this work, ignoring перенос in plan
                        const planSum =
                          Object.entries(work.accruals || {}).reduce((sum, [m, v]) => {
                            const status = v?.status || 'действ';
                            return sum + (status === 'перенос' ? 0 : getAmt(v));
                          }, 0) +
                          Object.entries(work.payments || {}).reduce((sum, [m, v]) => {
                            const status = v?.status || 'действ';
                            return sum + (status === 'перенос' ? 0 : getAmt(v));
                          }, 0);

                        const factSum =
                          Object.values(work.actual_accruals || {}).reduce((sum, v) => sum + getAmt(v), 0) +
                          Object.values(work.actual_payments || {}).reduce((sum, v) => sum + getAmt(v), 0);
                        const completionPct = planSum > 0 ? Math.round((factSum / planSum) * 100) : null;
                        const isEconomyWork = planSum > 0 && factSum > 0 && factSum < planSum;
                        // determine if work has fact entries for all planned accruals/payments ignoring transfers
                        const hasAllFactAcc = Object.entries(work.accruals || {}).every(([m, v]) => {
                          const status = v?.status || "действ";
                          if (status === "перенос") return true;
                          const planned = getAmt(v);
                          return planned <= 0 || (work.actual_accruals && work.actual_accruals[m] != null);
                        });
                        const hasAllFactPay = Object.entries(work.payments || {}).every(([m, v]) => {
                          const status = v?.status || "действ";
                          if (status === "перенос") return true;
                          const planned = getAmt(v);
                          return planned <= 0 || (work.actual_payments && work.actual_payments[m] != null);
                        });
                        const hasAllFacts = hasAllFactAcc && hasAllFactPay;
                        return (
                      <tr
                        key={work.id}
                        className={clsx(
                          "cursor-pointer hover:bg-gray-50",
                          wIdx === 0 && "border-t-2 border-gray-300"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          const realWorkIdx = data[realArticleIdx].works.findIndex((w2) => w2.id === work.id);
                          openDialog(realArticleIdx, realWorkIdx, e);
                        }}
                      >
                            {wIdx === 0 && (
                              <td
                                rowSpan={expandedRowCount}
                                className="border p-2 font-semibold bg-gray-100 align-top w-48 max-w-[12rem] text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleArticleExpand(article.id);
                                }}
                              >
                                <span className="mr-1">{expanded ? "▼" : "►"}</span>
                                {article.name}
                                <div className="mt-2 text-xs">
                                <span className="font-medium">Отчеты: </span>
                                {(article.reports || []).map(r => (
                                  <span key={r.id} className="inline-flex items-center mr-1">
                                    <a
                                      href={r.file.startsWith("http") ? r.file : `${BACKEND_ORIGIN}${r.file}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline text-[10px] break-words block"
                                    >
                                      {niceFileName(r.file)}
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReportDelete(article.id, r.id);
                                      }}
                                      className="ml-1 text-red-500"
                                      title="Удалить отчет"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                <label
                                  className="inline-flex items-center cursor-pointer text-red-500"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="file"
                                    accept="*"
                                    className="hidden"
                                    onChange={e => {
                                      e.stopPropagation();
                                      handleReportAdd(article.id, e);
                                    }}
                                  />
                                  <Plus className="w-3 h-3" />
                                </label>
                                </div>
                              </td>
                            )}
                            <td className="border p-2 bg-white text-left w-56 max-w-[14rem] relative">
                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    "inline-block flex-none w-3 h-3 rounded-full",
                                    work.feasibility === "green"
                                      ? "bg-green-500"
                                      : work.feasibility === "yellow"
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  )}
                                />
                                <span className="whitespace-normal break-words">
                                  {work.name}
                                </span>
                              </div>
                              {work.materials?.length > 0 && (
                                <span className="absolute top-1 right-1 inline-flex items-center text-xs text-gray-500">
                                  <Paperclip className="w-3 h-3 mr-0.5" />
                                  {work.materials.length}
                                </span>
                              )}
                              <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                                <span>
                                  {work.year} · {userName(work.responsible)}
                                </span>
                                {hasAllFacts && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                              </div>
                            </td>
                            {visibleMonths.map((m) => {
                              const planAcc = getAmt((work.accruals || {})[m]);
                              const planPay = getAmt((work.payments || {})[m]);
                              const factAcc = getAmt((work.actual_accruals || {})[m]);
                              const factPay = getAmt((work.actual_payments || {})[m]);
                              // Apply 50% weight for yellow feasibility
                              const factor = work.feasibility === "yellow" ? 0.5 : 1;
                            // проверяем флаг корректировки по деталям
                            const corrAcc = work.accrual_details?.some(d => d.month === m && d.is_correction);
                            const corrPay = work.payment_details?.some(d => d.month === m && d.is_correction);
                            const statusAcc = work.accruals?.[m]?.status;
                            const statusPay = work.payments?.[m]?.status;
                            // Always show numbers regardless of correction
                            const dispPlanAcc = planAcc * factor;
                            const dispPlanPay = planPay * factor;
                              // economy detection using displayed plans
                              const dispPlanTotal = (showAccruals ? dispPlanAcc : 0) + (showPayments ? dispPlanPay : 0);
                              const factTotal = (showAccruals ? factAcc : 0) + (showPayments ? factPay : 0);
                              const isEconomy = factTotal > 0 && factTotal < dispPlanTotal;
                              const isOverlimit = dispPlanTotal > 0 && factTotal > dispPlanTotal;
                              // show tooltip only if any figure is non‑zero
                              const hasData = planAcc || planPay || factAcc || factPay;
                              const tooltipLines = hasData
                                ? [
                                    `Работа: ${work.name}`,
                                    `Месяц: ${m}`,
                                    `План начисл.: ${planAcc.toLocaleString("ru-RU")}`,
                                    `План оплат: ${planPay.toLocaleString("ru-RU")}`,
                                    `Факт начисл.: ${factAcc.toLocaleString("ru-RU")}`,
                                    `Факт оплат: ${factPay.toLocaleString("ru-RU")}`,
                                    work.justification ? `Обоснование: ${work.justification}` : null,
                                    work.responsible ? `Ответственный: ${userName(work.responsible)}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join("\n")
                                : null;
                              // statusText computation (new location)
                              // статусы: отмена, перенос или корректировка
                              const statusParts = [];
                              // accrual status
                              const stAcc = work.accruals?.[m]?.status;
                              if (showAccruals) {
                                if (stAcc === 'отмена') statusParts.push('Отмена');
                                else if (stAcc === 'перенос') statusParts.push('Перенос');
                                if (corrAcc) statusParts.push('Корр.');
                              }
                              // payments status
                              const stPay = work.payments?.[m]?.status;
                              if (showPayments) {
                                if (stPay === 'отмена') statusParts.push('Отмена');
                                else if (stPay === 'перенос') statusParts.push('Перенос');
                                if (corrPay) statusParts.push('Корр.');
                              }
                              const statusText = statusParts.join(", ");
                              return (
                                <td
                                  key={m}
                                  className={clsx(
                                    "border p-2 text-right hidden sm:table-cell",
                                    m === currentMonthName && "bg-yellow-50",
                                  )}
                                  {...(tooltipLines ? { title: tooltipLines } : {})}
                                >
                                  <div className={clsx("flex flex-col items-end leading-tight", statusText && "italic text-gray-500")}>
                                    {renderCell(dispPlanAcc, dispPlanPay, factAcc, factPay)}
                                    {statusText.includes('Корр.') ? (
                                      <span className="inline-block text-xs italic text-blue-600 bg-blue-100 px-1 rounded mt-1">
                                        {statusText}
                                      </span>
                                    ) : statusText ? (
                                      <span className="inline-block text-xs italic text-gray-500 bg-yellow-100 px-1 rounded mt-1">
                                        {statusText}
                                      </span>
                                    ) : null}
                                    {isEconomy && (
                                      <span className="inline-block text-xs italic text-gray-500 bg-green-100 px-1 rounded mt-1">
                                        Экономия
                                      </span>
                                    )}
                                    {isOverlimit && (
                                      <span className="inline-block text-xs italic text-gray-500 bg-red-100 px-1 rounded mt-1">
                                        Перелимит
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    {expanded && (
                      <>
                        {/* итоговая строка по статье */}
                        <tr key={`totals-${article.name}`} className="hidden sm:table-row border-t-2 border-gray-400">
                          <td className="border p-2 font-medium text-left w-56 max-w-[14rem]">
                            Итог
                          </td>
                          {visibleMonths.map((m) => (
                            <td
                              key={m}
                              className="border p-2 font-medium text-center whitespace-pre-line"
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
                          <tr key={`qtotals-${article.name}`} className="hidden sm:table-row border-t-2 border-gray-400">
                            <td className="border p-2 font-medium w-56 max-w-[14rem]">
                              Квартальный итог
                            </td>
                            {quarterTotals.map((qt, qIdx) => {
                              if (!showQuarterTotals[qIdx]) return null;
                              const res = findReserve(
                                article.id,
                                yearFilter === "all" ? currentYear : yearFilter,
                                qIdx + 1
                              );
                              const reserveLine = res
                                ? `Резерв Н: ${res.balance_acc.toLocaleString("ru-RU")} / О: ${res.balance_pay.toLocaleString("ru-RU")}`
                                : null;
                              return (
                                <th
                                  key={qIdx}
                                  colSpan={3}
                                  className="border p-2 font-medium text-center whitespace-pre-line hidden sm:table-cell"
                                >
                                  {formatTotalLines(qt.acc, qt.pay, qt.fAcc, qt.fPay)}
                                  {reserveLine && (
                                    <div className="text-[10px] text-gray-500 mt-1">{reserveLine}</div>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
          
            </div>
          );
        })}

      {/* ---------- DIALOG ---------- */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {/* Inline keyframes for Apple-style dialog open */}
          <style>{`
            @keyframes appleOpen {
              0% { opacity: 0; transform: scale(0.8); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <DialogContent
            forceMount
            size="md"
            className="px-4 py-4 overflow-x-hidden w-full max-w-[90vw] sm:max-w-[700px] transform"
            style={{ transformOrigin: `${dialogOrigin.x}px ${dialogOrigin.y}px` }}
          >
            <DialogHeader>
              <DialogTitle>
                {selected?.workIdx === null ? "Новая работа" : "Редактирование работы"}
              </DialogTitle>
              <DialogDescription>
                Введите параметры работы, прикрепите материалы и укажите план/факт.
              </DialogDescription>
            </DialogHeader>

            {/* Dialog body */}
            <div
              className="mt-2 space-y-3 max-h-[70vh] overflow-y-auto overflow-x-hidden pr-4"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              {/* Article select */}
              <div>
                <label className="block text-sm mb-1 font-medium">Статья</label>
                <Select
                  value={workArticleId ? String(workArticleId) : ""}
                  onValueChange={(v) => setWorkArticleId(Number(v))}
                >
                  <SelectTrigger className="w-full">
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
                <label className="block text-sm mb-1 font-medium">Ответственный</label>
                <Select
                  value={responsible ? String(responsible) : ""}
                  onValueChange={(v) => setResponsible(Number(v))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Выберите ответственного" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {userName(u.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Justification */}
              <div>
                <label className="block text-sm mb-1 font-medium">Обоснование</label>
                <textarea
                  rows={4}
                  className="w-full border rounded p-2 text-sm min-h-[6rem]"
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
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={certification}
                    onChange={e => setCertification(e.target.checked)}
                    className="mr-2"
                  />
                  Сертификация
                </label>
              </div>
              {certification && (
                <>
                  {/* Вид работы */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">Вид работы</label>
                    <Select value={workType} onValueChange={v => setWorkType(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите вид работы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ИК_СС_ТР_ТС">ИК СС ТР ТС</SelectItem>
                        <SelectItem value="ИК_СС_ГОСТ">ИК СС ГОСТ</SelectItem>
                        <SelectItem value="СС_ТР_ТС">СС ТР ТС</SelectItem>
                        <SelectItem value="ДС_ТР_ТС">ДС ТР ТС</SelectItem>
                        <SelectItem value="СС_ПБ">СС ПБ</SelectItem>
                        <SelectItem value="СС_ГОСТ">СС ГОСТ</SelectItem>
                        <SelectItem value="НОТИФИКАЦИЯ">Нотификация</SelectItem>
                        <SelectItem value="СГР">СГР</SelectItem>
                        <SelectItem value="МИНПРОМТОРГ">МИНПРОМТОРГ</SelectItem>
                        <SelectItem value="УТСИ">УТСИ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Наименование продукта */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">Наименование продукта</label>
                    <Input
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder="Введите наименование"
                    />
                  </div>
                  {/* Ответственный от СлОК */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">Ответственный от СлОК</label>
                    <Input
                      value={responsibleSlok}
                      onChange={e => setResponsibleSlok(e.target.value)}
                      placeholder="Введите имя"
                    />
                  </div>
                  {/* Ответственный от ДПМ */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">Ответственный от ДПМ</label>
                    <Input
                      value={responsibleDpm}
                      onChange={e => setResponsibleDpm(e.target.value)}
                      placeholder="Введите имя"
                    />
                  </div>
                  {/* № сертификата */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">№ сертификата (для ИК)</label>
                    <Input
                      value={certificateNumber}
                      onChange={e => setCertificateNumber(e.target.value)}
                      placeholder="Введите номер"
                    />
                  </div>
                  {/* Орган по сертификации */}
                  <div>
                    <label className="block text-sm mb-1 font-medium">Орган по сертификации</label>
                    <Input
                      value={certificationBody}
                      onChange={e => setCertificationBody(e.target.value)}
                      placeholder="Введите название"
                    />
                  </div>
                </>
              )}

              {/* Feasibility (traffic light) */}
              <div>
                <label className="block text-sm mb-1 font-medium">
                  Возможность реализации
                </label>
                <div className="flex items-center space-x-3 mb-4">
                  <button
                    type="button"
                    className={clsx(
                      "w-6 h-6 rounded-full border-2",
                      feasibility === "green" ? "bg-green-500 border-green-500" : "border-gray-300"
                    )}
                    onClick={() => setFeasibility("green")}
                  />
                  <button
                    type="button"
                    className={clsx(
                      "w-6 h-6 rounded-full border-2",
                      feasibility === "yellow" ? "bg-yellow-500 border-yellow-500" : "border-gray-300"
                    )}
                    onClick={() => setFeasibility("yellow")}
                  />
                  <button
                    type="button"
                    className={clsx(
                      "w-6 h-6 rounded-full border-2",
                      feasibility === "red" ? "bg-red-500 border-red-500" : "border-gray-300"
                    )}
                    onClick={() => setFeasibility("red")}
                  />
                </div>
              </div>
              {/* Materials */}
              <section>
                <h3 className="font-semibold mb-2 flex items-center">
                  <Paperclip className="w-4 h-4 mr-1" /> Материалы
                </h3>
                {/* helper to build file URL as absolute path on current origin */}
                {(() => {
                  const buildFileUrl = (path) => {
                    if (!path) return "#";
                    try {
                      const url = new URL(path, window.location.origin);
                      // Return only the path, query, and hash to ensure the same-origin HTTPS URL
                      return url.pathname + url.search + url.hash;
                    } catch {
                      // Fallback to a relative path
                      return path.startsWith("/") ? path : `/${path}`;
                    }
                  };
                  return (
                    <>
                      {materials.length > 0 && (
                        <ul className="list-disc pl-5 mb-2 space-y-1 text-sm">
                          {materials.map((f, idx) => {
                            const fileUrl = buildFileUrl(f.file);
                            return (
                              <li key={idx} className="mb-1 text-sm">
                                <div className="flex items-end gap-2">
                                  {f.file ? (
                                    <a
                                      href={fileUrl}
                                      download
                                      className="underline break-all flex-1"
                                    >
                                      {niceFileName(f.file, f.name)}
                                    </a>
                                  ) : (
                                    <span className="break-all flex-1">{f.name}</span>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removeMaterial(idx); }}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  );
                })()}
                <Input type="file" multiple onChange={handleFileAdd} className="cursor-pointer" />
              </section>
              {/* НДС */}
              <div className="mb-4">
                <label className="block text-sm mb-1 font-medium">НДС</label>
                <div className="flex items-center space-x-4">
                  <Select value={String(vatRate)} onValueChange={(v) => setVatRate(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={`${vatRate}%`} />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 20].map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={autoCalc}
                      onChange={e => setAutoCalc(e.target.checked)}
                      className="mr-2"
                    />
                    Авторасчет
                  </label>
                </div>
              </div>

              {/* PAYMENTS */}
              <section>
                <h3 className="font-semibold mb-2">Оплаты (план / факт)</h3>
                {paymentRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "flex flex-wrap items-center gap-2 mb-2",
                      (transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]) && "opacity-50"
                    )}
                  >
                    <Select
                      value={row.month}
                      onValueChange={(val) => updateRow(setPaymentRows, idx, "month", val)}
                      disabled={transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]}
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
                      onChange={(e) => {
                        const val = e.target.value;
                        updateRow(setPaymentRows, idx, "amount", val);
                        // только при авторасчете обновляем начисление
                        if (autoCalc) {
                          const net = vatRate
                            ? (Number(val) / (1 + vatRate / 100)).toFixed(2)
                            : val;
                          updateRow(setAccrualRows, idx, "amount", net);
                        }
                        updatePaymentDetail(idx, "amount", val);
                      }}
                      disabled={transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]}
                    />
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={row.checked}
                        onChange={(e) => updateRow(setPaymentRows, idx, "checked", e.target.checked)}
                        disabled={transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]}
                      />
                      Факт
                    </label>
                    {row.checked && (
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="Факт"
                          className="w-28"
                          value={row.actual}
                          onChange={e => updateRow(setPaymentRows, idx, "actual", e.target.value)}
                          disabled={transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]}
                        />
                        <div
                          onClick={e => { e.stopPropagation(); toggleShowPaymentDetail(idx); }}
                          className="cursor-pointer ml-2"
                        >
                          {showPaymentDetailFlags[idx] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        delRow(setPaymentRows, idx);
                        setPaymentDetails(prev => prev.filter((_, i) => i !== idx));
                      }}
                      disabled={transferPaymentChecks[row.month] || cancelPaymentChecks[row.month]}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={cancelPaymentChecks[row.month] ? "Восстановить" : "Отмена"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCancelPaymentChecks((prev) => ({
                          ...prev,
                          [row.month]: !prev[row.month],
                        }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={transferPaymentChecks[row.month] ? "Вернуть перенос" : "Перенос"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransferPaymentChecks((prev) => ({
                          ...prev,
                          [row.month]: !prev[row.month],
                        }));
                      }}
                    >
                      <Repeat className="w-4 h-4" />
                    </Button>
                    
                    {cancelPaymentChecks[row.month] && (
                      <textarea
                        className="w-full border rounded p-2 text-sm mt-1"
                        placeholder="Причина отмены оплаты"
                        value={paymentDetails[idx]?.cancel_reason || ""}
                        onChange={e => updatePaymentDetail(idx, 'cancel_reason', e.target.value)}
                      />
                    )}
                    {transferPaymentChecks[row.month] && (
                      <textarea
                        className="w-full border rounded p-2 text-sm mt-1"
                        placeholder="Причина переноса оплаты"
                        value={paymentDetails[idx]?.transfer_reason || ""}
                        onChange={e => updatePaymentDetail(idx, 'transfer_reason', e.target.value)}
                      />
                    )}
                    {(cancelPaymentChecks[row.month] || transferPaymentChecks[row.month]) && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={paymentDetails[idx]?.is_correction || false}
                          onChange={e => updatePaymentDetail(idx, 'is_correction', e.target.checked)}
                          className="mr-2"
                        />
                        Корректировка
                      </label>
                    )}
                    {cancelPaymentChecks[row.month] && (
                      <span className="italic text-gray-500 ml-2">Отмена</span>
                    )}
                    {transferPaymentChecks[row.month] && !cancelPaymentChecks[row.month] && (
                      <span className="italic text-gray-500 ml-2">Перенос</span>
                    )}
                    {row.checked && showPaymentDetailFlags[idx] && (
                      <div className="w-full bg-gray-50 p-4 rounded mb-4">
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Кредитор</label>
                          <Input
                            value={paymentDetails[idx]?.creditor || ""}
                            onChange={e => updatePaymentDetail(idx, 'creditor', e.target.value)}
                            placeholder="Кредитор"
                          />
                        </div>

                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Договор</label>
                          <Input
                            value={paymentDetails[idx]?.contract || ""}
                            onChange={e => updatePaymentDetail(idx, 'contract', e.target.value)}
                            placeholder="Договор"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">ПФМ</label>
                          <Input
                            value={paymentDetails[idx]?.pfm || ""}
                            onChange={e => updatePaymentDetail(idx, 'pfm', e.target.value)}
                            placeholder="ПФМ"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">ФП</label>
                          <Input
                            value={paymentDetails[idx]?.fp || ""}
                            onChange={e => updatePaymentDetail(idx, 'fp', e.target.value)}
                            placeholder="ФП"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">МВЗ</label>
                          <Input
                            value={paymentDetails[idx]?.mvz || ""}
                            onChange={e => updatePaymentDetail(idx, 'mvz', e.target.value)}
                            placeholder="МВЗ"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">ММ</label>
                          <Input
                            value={paymentDetails[idx]?.mm || ""}
                            onChange={e => updatePaymentDetail(idx, 'mm', e.target.value)}
                            placeholder="ММ"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Документ на оплату</label>
                          <Input
                            value={paymentDetails[idx]?.payment_document || ""}
                            onChange={e => updatePaymentDetail(idx, 'payment_document', e.target.value)}
                            placeholder="Документ на оплату"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Закрытие оплаты</label>
                          <Input
                            value={paymentDetails[idx]?.payment_close || ""}
                            onChange={e => updatePaymentDetail(idx, 'payment_close', e.target.value)}
                            placeholder="Закрытие оплаты"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Комментарий</label>
                          <Input
                            value={paymentDetails[idx]?.comment || ""}
                            onChange={e => updatePaymentDetail(idx, 'comment', e.target.value)}
                            placeholder="Комментарий"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Файл комментария</label>
                          <Input
                            type="file"
                            onChange={e => updatePaymentDetail(idx, 'comment_file', e.target.files[0])}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    addRow(setPaymentRows);
                    setPaymentDetails(prev => [
                      ...prev,
                      {
                        month: "",
                        amount: "",
                        creditor: "",
                        contract: "",
                        pfm: "11000900",
                        fp: String(workArticleId),
                        mvz: "",
                        mm: "",
                        payment_document: "",
                        payment_close: "",
                        comment: "",
                        comment_file: null,
                        // Инициализация полей корректировки
                        correction_reason: "",
                        is_correction: false,
                      }
                    ]);
                    setShowPaymentDetailFlags(prev => [...prev, false]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Добавить строку
                </Button>
              </section>
              {/* ACCRUALS */}
              <section>
                <h3 className="font-semibold mb-2">Начисления (план / факт)</h3>
                {accrualRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "flex flex-wrap items-center gap-2 mb-2",
                      (transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]) && "opacity-50"
                    )}
                  >
                    <Select
                      value={row.month}
                      onValueChange={(val) => updateRow(setAccrualRows, idx, "month", val)}
                      disabled={transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]}
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
                      onChange={(e) => {
                        const val = e.target.value;
                        updateRow(setAccrualRows, idx, "amount", val);
                        // update gross payment amount (including VAT)
                        const gross = vatRate
                          ? (Number(val) * (1 + vatRate / 100)).toFixed(2)
                          : val;
                        //updateRow(setPaymentRows, idx, "amount", gross);
                        updateAccrualDetail(idx, "amount", val);
                      }}
                      disabled={transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]}
                    />
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={row.checked}
                        onChange={(e) => updateRow(setAccrualRows, idx, "checked", e.target.checked)}
                        disabled={transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]}
                      />
                      Факт
                    </label>
                    {row.checked && (
                      <div className="flex items-center">
                        <Input
                          type="number"
                          placeholder="Факт"
                          className="w-28"
                          value={row.actual}
                          onChange={e => updateRow(setAccrualRows, idx, "actual", e.target.value)}
                          disabled={transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]}
                        />
                        <div
                          onClick={e => { e.stopPropagation(); toggleShowAccrualDetail(idx); }}
                          className="cursor-pointer ml-2"
                        >
                          {showAccrualDetailFlags[idx] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        delRow(setAccrualRows, idx);
                        setAccrualDetails(prev => prev.filter((_, i) => i !== idx));
                      }}
                      disabled={transferAccrualChecks[row.month] || cancelAccrualChecks[row.month]}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={cancelAccrualChecks[row.month] ? "Восстановить" : "Отмена"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCancelAccrualChecks((prev) => ({
                          ...prev,
                          [row.month]: !prev[row.month],
                        }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={transferAccrualChecks[row.month] ? "Вернуть перенос" : "Перенос"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransferAccrualChecks((prev) => ({
                          ...prev,
                          [row.month]: !prev[row.month],
                        }));
                      }}
                    >
                      <Repeat className="w-4 h-4" />
                    </Button>
                    {cancelAccrualChecks[row.month] && (
                      <textarea
                        className="w-full border rounded p-2 text-sm mt-1"
                        placeholder="Причина отмены начисления"
                        value={accrualDetails[idx]?.cancel_reason || ""}
                        onChange={e => updateAccrualDetail(idx, 'cancel_reason', e.target.value)}
                      />
                    )}
                    {transferAccrualChecks[row.month] && (
                      <textarea
                        className="w-full border rounded p-2 text-sm mt-1"
                        placeholder="Причина переноса начисления"
                        value={accrualDetails[idx]?.transfer_reason || ""}
                        onChange={e => updateAccrualDetail(idx, 'transfer_reason', e.target.value)}
                      />
                    )}
                    {(cancelAccrualChecks[row.month] || transferAccrualChecks[row.month]) && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={accrualDetails[idx]?.is_correction || false}
                          onChange={e => updateAccrualDetail(idx, 'is_correction', e.target.checked)}
                          className="mr-2"
                        />
                        Корректировка
                      </label>
                    )}
                    {cancelAccrualChecks[row.month] && (
                      <span className="italic text-gray-500 ml-2">Отмена</span>
                    )}
                    {transferAccrualChecks[row.month] && !cancelAccrualChecks[row.month] && (
                      <span className="italic text-gray-500 ml-2">Перенос</span>
                    )}
                    {row.checked && showAccrualDetailFlags[idx] && (
                      <div className="w-full bg-gray-50 p-4 rounded mb-4">
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Документ закрытия</label>
                          <Input
                            value={accrualDetails[idx]?.closing_document || ""}
                            onChange={e => updateAccrualDetail(idx, 'closing_document', e.target.value)}
                            placeholder="Документ закрытия"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Комментарий</label>
                          <textarea
                            className="w-full border rounded p-2 text-sm"
                            value={accrualDetails[idx]?.comment || ""}
                            onChange={e => updateAccrualDetail(idx, 'comment', e.target.value)}
                            placeholder="Комментарий"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-1">Файл комментария</label>
                          <Input
                            type="file"
                            onChange={e => updateAccrualDetail(idx, 'comment_file', e.target.files[0])}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    addRow(setAccrualRows);
                    setAccrualDetails(prev => [
                      ...prev,
                      {
                        month: "",
                        amount: "",
                        closing_document: "",
                        comment: "",
                        comment_file: null,
                        // Инициализация полей корректировки
                        correction_reason: "",
                        is_correction: false,
                      }
                    ]);
                    setShowAccrualDetailFlags(prev => [...prev, false]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Добавить строку
                </Button>
              </section>
              {/* Toggle reserve write-off */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  id="useReserve"
                  type="checkbox"
                  checked={useReserve}
                  onChange={(e) => setUseReserve(e.target.checked)}
                />
                <label htmlFor="useReserve" className="text-sm">
                  Списать из резерва
                </label>
              </div>
              {useReserve && (
                <section className="mb-4">
                  <h3 className="font-semibold mb-2">Списать из резерва</h3>
                  {quarters.map((label, idx) => {
                    const monthsQ = monthKeys.slice(idx * 3, idx * 3 + 3);
                    const sumAcc = accrualRows.reduce(
                      (sum, r) => (monthsQ.includes(r.month) ? sum + Number(r.amount || 0) : sum),
                      0
                    );
                    const sumPay = paymentRows.reduce(
                      (sum, r) => (monthsQ.includes(r.month) ? sum + Number(r.amount || 0) : sum),
                      0
                    );
                    const reserve = findReserve(workArticleId, year, idx + 1);
                    if (!reserve || (sumAcc === 0 && sumPay === 0)) return null;
                    return (
                      <label key={idx} className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={!!reserveChecks[idx]}
                          onChange={(e) =>
                            setReserveChecks((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-sm">
                          {label} — План Н: {sumAcc.toLocaleString("ru-RU")}₽, О: {sumPay.toLocaleString("ru-RU")}₽
                        </span>
                      </label>
                    );
                  })}
                </section>
              )}
            </div>
            <DialogFooter className="mt-1 py-0 space-x-0">
              {selected?.workIdx !== null && (
                <Button variant="destructive" onClick={handleDelete}>
                  Удалить работу
                </Button>
              )}
              <Button onClick={handleSave}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* floating add‑work FAB */}
      <Button
        className={clsx(
          "fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 p-0 shadow-lg text-white",
          primaryColorClass,
          "hover:bg-[rgba(237,28,36,0.8)]"
        )}
        onClick={handleAddWorkFab}
        title="Новая работа"
      >
        <Plus className="w-7 h-7" />
      </Button>
      </div>
    </div>
  );
};

export default BudgetTableDemo;