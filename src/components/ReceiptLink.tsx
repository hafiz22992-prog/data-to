import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { FileText, Loader2 } from "lucide-react";

/**
 * رابط عرض إيصال التحويل البنكي لعملية دفع — يحميه الخادم:
 * api.payments.getReceiptUrl يعيد الرابط فقط لصاحب الحجز أو المالك أو
 * الشركة المشغلة — أي مستخدم آخر يعيد null (لا تسريب لإيصالات الغير).
 */
export function ReceiptLink({ paymentId }: { paymentId: Id<"payments"> }) {
  const url = useQuery(api.payments.getReceiptUrl, { paymentId });

  if (url === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        جارٍ التحقق…
      </span>
    );
  }
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-muted"
    >
      <FileText className="size-3" />
      عرض الإيصال
    </a>
  );
}
