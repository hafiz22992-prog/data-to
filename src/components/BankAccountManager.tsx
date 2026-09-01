import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type BankAccountRow = Doc<"bankAccounts">;

interface BankForm {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  iban: string;
  beneficiaryName: string;
  description: string;
  displayOrder: string;
}

const emptyForm: BankForm = {
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  iban: "",
  beneficiaryName: "",
  description: "",
  displayOrder: "0",
};

const inputCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2";
const labelCls = "block text-[11px] font-semibold text-muted-foreground";

/**
 * إدارة الحسابات البنكية للمنصة (Bank Accounts Management) — المالك فقط:
 * - إضافة / تعديل / حذف / تفعيل / تعطيل / ترتيب الحسابات.
 * - الحساب النشط يظهر للمسافرين عند اختيار «التحويل البنكي» في الحجز.
 * الحماية خادمية بالكامل في api.bankAccounts.* — أي دور غير المالك يُرفض حتى لو
 * استُدعيت الدوال مباشرة. صاحب الشركة لا يدير الحسابات العامة، والمسافر يرى
 * الحسابات النشطة فقط (لا بيانات إدارية).
 */
export function BankAccountManager() {
  const accounts = useQuery(api.bankAccounts.list);
  const createAccount = useMutation(api.bankAccounts.create);
  const updateAccount = useMutation(api.bankAccounts.update);
  const removeAccount = useMutation(api.bankAccounts.remove);
  const setActive = useMutation(api.bankAccounts.setActive);
  const reorder = useMutation(api.bankAccounts.reorder);

  const [editing, setEditing] = useState<BankAccountRow | "new" | null>(null);
  const [form, setForm] = useState<BankForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  const startNew = () => {
    setForm({
      ...emptyForm,
      displayOrder: String((accounts?.length ?? 0) + 1),
    });
    setEditing("new");
  };

  const startEdit = (account: BankAccountRow) => {
    setForm({
      bankName: account.bankName,
      accountHolderName: account.accountHolderName,
      accountNumber: account.accountNumber ?? "",
      iban: account.iban ?? "",
      beneficiaryName: account.beneficiaryName,
      description: account.description ?? "",
      displayOrder: String(account.displayOrder ?? 0),
    });
    setEditing(account);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const payload = {
        bankName: form.bankName,
        accountHolderName: form.accountHolderName,
        accountNumber: form.accountNumber.trim() || undefined,
        iban: form.iban.trim() || undefined,
        beneficiaryName: form.beneficiaryName,
        description: form.description.trim() || undefined,
        displayOrder: Number(form.displayOrder) || 0,
      };
      if (editing === "new") {
        await createAccount({ ...payload, active: true });
        toast.success("أُضيف الحساب البنكي — سيظهر للمسافرين عند اختيار «التحويل البنكي»");
      } else {
        await updateAccount({ accountId: editing._id, ...payload });
        toast.success("حُدّث الحساب البنكي");
      }
      cancelEdit();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الحساب البنكي");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (account: BankAccountRow) => {
    setBusy(true);
    try {
      await setActive({ accountId: account._id, active: !account.active });
      toast.success(account.active ? "عُطّل الحساب — لن يظهر للمسافرين" : "فُعّل الحساب — سيظهر للمسافرين");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة الحساب");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (account: BankAccountRow) => {
    if (!window.confirm(`حذف الحساب البنكي «${account.bankName}» نهائياً؟`)) return;
    setBusy(true);
    try {
      await removeAccount({ accountId: account._id });
      toast.success("حُذف الحساب البنكي");
      if (editing === account) cancelEdit();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر حذف الحساب");
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    if (!accounts) return;
    const target = index + dir;
    if (target < 0 || target >= accounts.length) return;
    const ordered = accounts.map((a) => a._id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setBusy(true);
    try {
      await reorder({ orderedIds: ordered });
      toast.success("حُدّث ترتيب الحسابات");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الترتيب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* زر إضافة حساب بنكي */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-muted-foreground">
          الحسابات النشطة تظهر للمسافرين عند اختيار «التحويل البنكي» في الحجز —
          مرتبة حسب «ترتيب العرض». المالك فقط يستطيع إدارة هذه الحسابات.
        </p>
        <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={startNew}>
          <Plus className="size-4" />
          إضافة حساب بنكي
        </Button>
      </div>

      {/* نموذج الإضافة / التعديل */}
      {editing ? (
        <form onSubmit={handleSave} className="rounded-xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold">
            <Landmark className="size-4 text-primary" />
            {editing === "new" ? "إضافة حساب بنكي جديد" : `تعديل حساب ${editing.bankName}`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className={labelCls}>اسم البنك *</label>
              <input
                required
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                placeholder="STC Bank، الراجحي، …"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>اسم صاحب الحساب *</label>
              <input
                required
                value={form.accountHolderName}
                onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
                placeholder="مؤسسة النقل …"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>اسم المستفيد *</label>
              <input
                required
                value={form.beneficiaryName}
                onChange={(e) => setForm((f) => ({ ...f, beneficiaryName: e.target.value }))}
                placeholder="منصة خطوط زحل"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>رقم الحساب (أو الآيبان — أحدهما مطلوب)</label>
              <input
                dir="ltr"
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder="1234567890"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>الآيبان IBAN (أو رقم الحساب — أحدهما مطلوب)</label>
              <input
                dir="ltr"
                value={form.iban}
                onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                placeholder="SA0000000000000000000000"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>ترتيب العرض</label>
              <input
                type="number"
                min={1}
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>وصف اختياري</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="مثال: حسابات الشركة الموحدة لاستقبال التحويلات"
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className="h-8 gap-1 text-xs" disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {editing === "new" ? "إضافة الحساب" : "حفظ التعديلات"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={cancelEdit}
            >
              <X className="size-3.5" />
              إلغاء
            </Button>
          </div>
        </form>
      ) : null}

      {/* بطاقات الحسابات */}
      {accounts === undefined ? (
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-4 text-center">
          <Landmark className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold">لا توجد حسابات بنكية بعد</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            أضف حساباً بنكياً (STC Bank، الراجحي، الإنماء…) ليتمكن المسافرون من
            التحويل المباشر عند اختيار «التحويل البنكي» في الحجز.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {accounts.map((account, index) => (
            <div key={account._id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Landmark className="size-4" />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-extrabold">
                      {account.bankName}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          account.active
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-rose-300 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {account.active ? "● نشط" : "معطّل"}
                      </Badge>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      الترتيب: {account.displayOrder ?? index + 1}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={busy || index === 0}
                    onClick={() => handleMove(index, -1)}
                    aria-label="تحريك لأعلى"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={busy || index === accounts.length - 1}
                    onClick={() => handleMove(index, 1)}
                    aria-label="تحريك لأسفل"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => startEdit(account)}
                  >
                    <Pencil className="size-3.5" />
                    تعديل
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    disabled={busy}
                    onClick={() => handleToggle(account)}
                  >
                    <Power className="size-3.5" />
                    {account.active ? "تعطيل" : "تفعيل"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => handleRemove(account)}
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">صاحب الحساب</p>
                  <p className="mt-0.5 font-extrabold text-foreground">{account.accountHolderName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">المستفيد</p>
                  <p className="mt-0.5 font-extrabold text-foreground">{account.beneficiaryName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">رقم الحساب</p>
                  <p className="mt-0.5 font-mono font-bold text-foreground" dir="ltr">
                    {account.accountNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">الآيبان (IBAN)</p>
                  <p className="mt-0.5 font-mono font-bold text-foreground" dir="ltr">
                    {account.iban || "—"}
                  </p>
                </div>
              </div>
              {account.description ? (
                <p className="mt-2.5 rounded-md bg-muted/50 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                  {account.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
