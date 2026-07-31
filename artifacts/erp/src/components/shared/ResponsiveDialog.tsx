import { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Max-width class for the desktop Dialog (default: "sm:max-w-lg") */
  maxWidth?: string;
  className?: string;
}

/**
 * On phones (< 640 px) renders as a bottom sheet for comfortable thumb reach.
 * On tablet and desktop renders as a standard centred Dialog.
 *
 * Usage:
 *   <ResponsiveDialog open={open} onOpenChange={setOpen} title="New Vendor">
 *     <form>…</form>
 *   </ResponsiveDialog>
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = "sm:max-w-lg",
  className,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "rounded-t-2xl max-h-[92dvh] overflow-y-auto",
            // Safe-area bottom padding for notched phones
            "pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
            className
          )}
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(maxWidth, "overflow-y-auto max-h-[90dvh]", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
