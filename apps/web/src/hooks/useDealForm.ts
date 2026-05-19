"use client";

import { useCallback, useState } from "react";
import { fetchDealTemplates } from "@/lib/deal-templates";
import {
  mediatorPctFieldKey,
  type Deal,
  type DealAmtRow,
  type DealParticipantRow,
  type DealStatus,
  type DealTemplate,
  type DealWorker,
} from "@/lib/deals";
import type { ClientListItem } from "@/lib/clients";

type MediatorRow = { id: string; defaultPct?: number | string | null };
type OlxRow = { id: string; defaultPct?: number | string | null };

export function useDealForm(options: {
  templates: DealTemplate[];
  setTemplates: (list: DealTemplate[]) => void;
  mediators: MediatorRow[];
  setMediators: (list: MediatorRow[]) => void;
  olxList: OlxRow[];
  setOlxList: (list: OlxRow[]) => void;
  onSaved: () => void | Promise<void>;
}) {
  const { templates, setTemplates, mediators, setMediators, olxList, setOlxList, onSaved } = options;

  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [dealEditingId, setDealEditingId] = useState<string | null>(null);
  const [dealDate, setDealDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dealStatus, setDealStatus] = useState<DealStatus>("NEW");
  const [dealClientSearch, setDealClientSearch] = useState("");
  const [dealClientId, setDealClientId] = useState<string | null>(null);
  const [dealClientSkip, setDealClientSkip] = useState(false);
  const [dealClients, setDealClients] = useState<ClientListItem[]>([]);
  const [dealWorkers, setDealWorkers] = useState<DealWorker[]>([]);
  const [dealAmounts, setDealAmounts] = useState<DealAmtRow[]>([]);
  const [dealParticipants, setDealParticipants] = useState<DealParticipantRow[]>([]);
  const [dealComment, setDealComment] = useState("");
  const [dealTemplateId, setDealTemplateId] = useState<string | null>(null);
  const [dealTemplateStep, setDealTemplateStep] = useState<"pick" | "form">("pick");
  const [dealDataRows, setDealDataRows] = useState<Array<{ _id: string; data: Record<string, string> }>>([]);
  const [dealMediatorId, setDealMediatorId] = useState("");
  const [dealMediatorPct, setDealMediatorPct] = useState("");
  const [dealOlxId, setDealOlxId] = useState("");
  const [dealOlxPct, setDealOlxPct] = useState("");
  const [dealInfoPct, setDealInfoPct] = useState("");

  const newAmtRow = useCallback((): DealAmtRow => {
    return {
      id: crypto.randomUUID(),
      bank: "ING",
      operationType: "ATM",
      amountIn: "",
      currencyIn: "PLN",
      amountOut: "",
      currencyOut: "PLN",
      shopName: "",
    };
  }, []);

  const applyDealMediatorPct = useCallback(
    (pct: string, tplId?: string | null) => {
      setDealMediatorPct(pct);
      const tpl = templates.find((t) => t.id === (tplId ?? dealTemplateId));
      const mk = mediatorPctFieldKey(tpl);
      if (!mk) return;
      setDealDataRows((prev) => {
        if (prev.length === 0) return [{ _id: crypto.randomUUID(), data: { [mk]: pct } }];
        return prev.map((row, i) => (i === 0 ? { ...row, data: { ...row.data, [mk]: pct } } : row));
      });
    },
    [templates, dealTemplateId],
  );

  const setDealMediatorSelection = useCallback(
    (mediatorId: string) => {
      setDealMediatorId(mediatorId);
      if (!mediatorId) {
        applyDealMediatorPct("");
        return;
      }
      const m = mediators.find((x) => x.id === mediatorId);
      const pct =
        m?.defaultPct != null && m.defaultPct !== "" ? String(m.defaultPct) : dealMediatorPct;
      applyDealMediatorPct(pct);
    },
    [mediators, dealMediatorPct, applyDealMediatorPct],
  );

  const setDealOlxSelection = useCallback(
    (olxId: string) => {
      setDealOlxId(olxId);
      if (!olxId) {
        setDealOlxPct("");
        return;
      }
      const o = olxList.find((x) => x.id === olxId);
      if (o?.defaultPct != null && o.defaultPct !== "") setDealOlxPct(String(o.defaultPct));
    },
    [olxList],
  );

  const fetchDealDropdowns = useCallback(() => {
    Promise.all([
      fetch("/api/clients", { credentials: "include" }),
      fetch("/api/users/public", { credentials: "include" }),
      fetch("/api/mediators", { credentials: "include" }),
      fetch("/api/olx", { credentials: "include" }),
    ]).then(async ([cRes, wRes, mRes, oRes]) => {
      if (cRes.ok) setDealClients(await cRes.json());
      if (wRes.ok) setDealWorkers(await wRes.json());
      if (mRes.ok) setMediators(await mRes.json());
      if (oRes.ok) setOlxList(await oRes.json());
    });
  }, [setMediators, setOlxList]);

  const closeDealModal = useCallback(() => setDealModalOpen(false), []);

  const openDealModal = useCallback(async () => {
    const list = await fetchDealTemplates();
    setTemplates(list);
    if (list.length === 0) {
      alert("Сначала создайте шаблон сделки в настройках");
      return;
    }
    setDealModalOpen(true);
    setDealEditingId(null);
    setDealDate(new Date().toISOString().slice(0, 10));
    setDealStatus("NEW");
    setDealClientSearch("");
    setDealClientId(null);
    setDealClientSkip(false);
    setDealComment("");
    setDealAmounts([newAmtRow()]);
    setDealParticipants([{ id: crypto.randomUUID(), userId: "", pct: "100" }]);
    if (list.length === 1) {
      setDealTemplateId(list[0].id);
      setDealTemplateStep("form");
    } else {
      setDealTemplateId(list[0].id);
      setDealTemplateStep("pick");
    }
    setDealDataRows([{ _id: crypto.randomUUID(), data: {} }]);
    setDealMediatorId("");
    setDealMediatorPct("");
    setDealOlxId("");
    setDealOlxPct("");
    setDealInfoPct("");
    fetchDealDropdowns();
  }, [setTemplates, newAmtRow, fetchDealDropdowns]);

  const openDealEditModal = useCallback(
    (deal: Deal) => {
      setDealModalOpen(true);
      setDealEditingId(deal.id);
      setDealDate((deal.dealDate ?? new Date().toISOString()).slice(0, 10));
      setDealStatus(deal.status);
      setDealClientSearch("");
      setDealClientId(deal.clientId ?? null);
      setDealClientSkip(!deal.clientId);
      setDealComment(deal.comment ?? "");
      setDealTemplateId(deal.templateId ?? null);
      setDealTemplateStep("form");
      const linkPct = deal.mediatorLink ? String(deal.mediatorLink.pct) : "";
      const mk = deal.template?.calcMediatorPctKey ?? null;
      setDealDataRows(
        (deal.dataRows ?? []).length > 0
          ? deal.dataRows!.map((r, i) => {
              const data = Object.fromEntries(
                Object.entries(r.data).map(([k, v]) => [k, String(v ?? "")]),
              );
              if (i === 0 && mk && linkPct && !data[mk]) data[mk] = linkPct;
              return { _id: r.id, data };
            })
          : [{ _id: crypto.randomUUID(), data: mk && linkPct ? { [mk]: linkPct } : {} }],
      );
      setDealAmounts(
        (deal.amounts ?? []).map((a) => ({
          id: a.id,
          bank: a.bank,
          operationType: a.operationType,
          amountIn: String(a.amountIn ?? ""),
          currencyIn: a.currencyIn,
          amountOut: String(a.amountOut ?? ""),
          currencyOut: a.currencyOut,
          shopName: a.shopName ?? "",
        })),
      );
      setDealParticipants(
        (deal.participants ?? []).map((p) => ({ id: p.id, userId: p.user.id, pct: String(p.pct) })),
      );
      setDealMediatorId(deal.mediatorLink?.mediatorId ?? "");
      setDealMediatorPct(linkPct);
      setDealOlxId(deal.olxLink?.olxId ?? "");
      setDealOlxPct(deal.olxLink ? String(deal.olxLink.pct) : "");
      setDealInfoPct(deal.infoPct != null && deal.infoPct !== "" ? String(deal.infoPct) : "");
      fetchDealDropdowns();
    },
    [fetchDealDropdowns],
  );

  const saveDeal = useCallback(async () => {
    const activeTpl = dealTemplateId ? templates.find((t) => t.id === dealTemplateId) : null;
    if (!dealEditingId && !activeTpl) {
      alert("Выберите шаблон сделки");
      return;
    }
    const needWorkers = activeTpl ? activeTpl.hasWorkers : true;

    const parts = dealParticipants
      .filter((p) => p.userId)
      .map((p) => ({ userId: p.userId, pct: Number(p.pct) || 0 }));
    if (needWorkers && parts.length > 0) {
      const totalPct = parts.reduce((s, p) => s + p.pct, 0);
      if (totalPct !== 100) return alert("Проценты участников должны суммарно быть 100%");
    }

    const selectedClient = dealClientId ? dealClients.find((c) => c.id === dealClientId) : null;
    const tplName2 = activeTpl ? ` [${activeTpl.name}]` : "";
    const titleText = selectedClient
      ? `Сделка — ${selectedClient.name}${tplName2}`
      : `Сделка${tplName2}`;

    const basePayload = {
      title: titleText,
      status: dealStatus,
      clientId: dealClientSkip ? null : (dealClientId ?? null),
      dealDate,
      comment: dealComment || null,
    };

    if (activeTpl) {
      const mk = mediatorPctFieldKey(activeTpl);
      const rowsPayload = dealDataRows.map((r, i) => {
        const data = { ...r.data };
        if (i === 0 && mk && dealMediatorPct !== "") data[mk] = dealMediatorPct;
        return { data, order: i };
      });
      const mediatorPayload = {
        mediatorId: dealMediatorId || null,
        mediatorPct: dealMediatorPct ? Number(dealMediatorPct) : null,
        olxId: dealOlxId || null,
        olxPct: dealOlxPct ? Number(dealOlxPct) : null,
        infoPct: dealInfoPct !== "" ? Number(dealInfoPct) : null,
      };
      const payload = { ...basePayload, templateId: activeTpl.id, dataRows: rowsPayload, ...mediatorPayload };

      if (!dealEditingId) {
        const dRes = await fetch("/api/deals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!dRes.ok) return alert("Не удалось создать сделку");
        const deal = await dRes.json();
        if (needWorkers && parts.length > 0) {
          await fetch(`/api/deals/${deal.id}/participants`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: parts }),
          });
        }
      } else {
        const upd = await fetch(`/api/deals/${dealEditingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!upd.ok) return alert("Не удалось обновить сделку");
        if (needWorkers) {
          await fetch(`/api/deals/${dealEditingId}/participants`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: parts }),
          });
        }
      }
    } else {
      if (parts.length > 0) {
        const totalPct = parts.reduce((s, p) => s + p.pct, 0);
        if (totalPct !== 100) return alert("Проценты участников должны суммарно быть 100%");
      }
      const amountsPayload = dealAmounts.map((r) => ({
        amountIn: Number(r.amountIn) || 0,
        currencyIn: r.currencyIn,
        amountOut: Number(r.amountOut) || 0,
        currencyOut: r.currencyOut,
        bank: r.bank,
        operationType: r.operationType,
        shopName: r.operationType === "PURCHASE" ? r.shopName || null : null,
      }));

      if (!dealEditingId) {
        const dRes = await fetch("/api/deals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });
        if (!dRes.ok) return alert("Не удалось создать сделку");
        const deal = await dRes.json();
        for (const a of amountsPayload) {
          await fetch(`/api/deals/${deal.id}/amounts`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(a),
          });
        }
        if (parts.length > 0) {
          await fetch(`/api/deals/${deal.id}/participants`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: parts }),
          });
        }
      } else {
        const upd = await fetch(`/api/deals/${dealEditingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });
        if (!upd.ok) return alert("Не удалось обновить сделку");
        await fetch(`/api/deals/${dealEditingId}/amounts`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amounts: amountsPayload }),
        });
        await fetch(`/api/deals/${dealEditingId}/participants`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants: parts }),
        });
      }
    }

    closeDealModal();
    await onSaved();
  }, [
    dealTemplateId,
    templates,
    dealEditingId,
    dealParticipants,
    dealClientId,
    dealClients,
    dealClientSkip,
    dealStatus,
    dealDate,
    dealComment,
    dealDataRows,
    dealMediatorId,
    dealMediatorPct,
    dealOlxId,
    dealOlxPct,
    dealInfoPct,
    dealAmounts,
    closeDealModal,
    onSaved,
  ]);

  return {
    dealModalOpen,
    dealEditingId,
    dealDate,
    setDealDate,
    dealStatus,
    setDealStatus,
    dealClientSearch,
    setDealClientSearch,
    dealClientId,
    setDealClientId,
    dealClientSkip,
    setDealClientSkip,
    dealClients,
    dealComment,
    setDealComment,
    dealDataRows,
    setDealDataRows,
    dealAmounts,
    setDealAmounts,
    dealParticipants,
    setDealParticipants,
    dealWorkers,
    dealTemplateId,
    setDealTemplateId,
    dealTemplateStep,
    setDealTemplateStep,
    dealMediatorId,
    dealMediatorPct,
    dealOlxId,
    dealOlxPct,
    setDealOlxPct,
    dealInfoPct,
    setDealInfoPct,
    mediators,
    olxList,
    openDealModal,
    openDealEditModal,
    closeDealModal,
    saveDeal,
    setDealMediatorSelection,
    applyDealMediatorPct,
    setDealOlxSelection,
    newAmtRow,
  };
}
