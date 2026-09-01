import React, { useState } from "react";
import { Image, Upload, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

export function LogoUploader() {
  const settings = useQuery(api.settings.get);
  const updateLogo = useMutation(api.settings.updateLogo);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await updateLogo({ logoUrl: reader.result as string });
        toast.success("تم حفظ شعار المنصة بنجاح");
      } catch {
        toast.error("تعذر حفظ الشعار");
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    try {
      await updateLogo({ logoUrl: undefined });
      toast.success("تم حذف شعار المنصة");
    } catch {
      toast.error("تعذر حذف الشعار");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Image className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold">شعار المنصة</h3>
          <p className="text-xs text-muted-foreground">
            يظهر على جميع التذاكر والفواتير
          </p>
        </div>
      </div>

      {settings?.platformLogo ? (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
          <img
            src={settings.platformLogo}
            alt="شعار المنصة"
            className="h-12 rounded border bg-white object-contain p-1"
          />
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
          >
            <Trash2 className="size-3.5" />
            حذف الشعار
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 transition-colors hover:bg-muted/30">
          {loading ? (
            <Loader2 className="mb-2 size-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="mb-2 size-8 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {loading ? "جارٍ الرفع..." : "اضغط لرفع الشعار"}
          </span>
          <span className="text-xs text-muted-foreground">
            PNG أو JPG بخلفية شفافة (أقل من 2MB)
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={loading}
          />
        </label>
      )}
    </div>
  );
}
