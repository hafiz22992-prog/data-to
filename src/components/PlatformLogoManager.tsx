import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Upload, Image, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * إدارة شعار خطوط زحل — للمالك فقط.
 * يتيح رفع شعار المنصة واستبداله وحذفه.
 */
export function PlatformLogoManager() {
  const settings = useQuery(api.settings.get);
  const generateUploadUrl = useMutation(api.settings.generateUploadUrl);
  const setPlatformLogo = useMutation(api.settings.setPlatformLogo);
  const removePlatformLogo = useMutation(api.settings.removePlatformLogo);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (settings === undefined) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentLogo = settings?.platformLogo || null;

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 2 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("تعذر رفع الصورة");
      const { storageId } = await result.json();
      await setPlatformLogo({ logoStorageId: storageId });
      toast.success("تم حفظ شعار خطوط زحل بنجاح");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذر رفع الشعار");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removePlatformLogo();
      toast.success("تم حذف شعار خطوط زحل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حذف الشعار");
    }
  };

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Image className="size-4 text-primary" />
            <span className="text-sm font-bold">شعار خطوط زحل</span>
            {currentLogo ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                مُرفوع
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {/* Logo preview */}
          <div className="relative group">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="شعار خطوط زحل"
                className="h-20 w-20 rounded-lg border bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
                <Image className="size-8 text-slate-400" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {currentLogo ? "استبدال الشعار" : "رفع الشعار"}
            </button>
            {currentLogo ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
              >
                <Trash2 className="size-3" />
                حذف الشعار
              </button>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              {currentLogo
                ? "انقر \"استبدال\" لتحميل شعار جديد"
                : "ارفع صورة شعار خطوط زحل (PNG/JPG، أقل من 2MB)"}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
