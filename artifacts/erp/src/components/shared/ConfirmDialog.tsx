import { ReactNode } from "react";
import { AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default" | "warning";
  loading?: boolean;
  onConfirm: () => void;
}

const VARIANT_CONFIG = {
  destructive: {
    icon: Trash2,
    iconClass: "text-red-500",
    actionClass: "bg-red-600 hover:bg-red-700 text-white border-red-600",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-500",
    actionClass: "bg-amber-600 hover:bg-amber-700 text-white border-amber-600",
  },
  default: {
    icon: CheckCircle2,
    iconClass: "text-primary",
    actionClass: "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  const { icon: Icon, iconClass, actionClass } = VARIANT_CONFIG[variant];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[420px] shadow-modal">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "mt-0.5 shrink-0 h-9 w-9 rounded-full flex items-center justify-center",
                variant === "destructive"
                  ? "bg-red-50 dark:bg-red-950/40"
                  : variant === "warning"
                  ? "bg-amber-50 dark:bg-amber-950/40"
                  : "bg-primary/10"
              )}
            >
              <Icon className={cn("h-5 w-5", iconClass)} />
            </div>
            <div>
              <AlertDialogTitle className="text-[15px]">{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="text-[13px] mt-1 leading-relaxed">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel className="text-[13px]" disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={cn("text-[13px] gap-2", actionClass)}
          >
            {loading && (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
