"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Locks page scroll, closes on Escape and moves focus into the panel while open. */
function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, panel]);
}

const noopSubscribe = () => () => {};

/** Renders into <body> only after hydration (server and first client render match). */
function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (still read by screen readers). */
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal that becomes a bottom sheet on mobile (< md) and a centred dialog on larger screens.
 */
export function Modal({ open, onClose, title, hideTitle, children, footer, className }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useOverlay(open, onClose, panel);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
            <motion.div
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden
            />
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0.6 }}
              animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className={cn(
                "relative flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-surface shadow-sheet outline-none md:max-w-lg md:rounded-sheet",
                className,
              )}
            >
              <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
              <div className={cn("flex items-center justify-between gap-4 px-5 pt-3 pb-2 md:pt-5", hideTitle && "absolute top-0 right-0 z-10 pt-4")}>
                <h2 className={cn("text-lg font-bold", hideTitle && "sr-only")}>{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-10 items-center justify-center rounded-full bg-cream text-ink transition hover:bg-mango-soft"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
              {footer && <div className="border-t border-line px-5 py-4 pb-safe md:pb-4">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Always a bottom sheet, on every screen size. */
export function BottomSheet(props: OverlayProps) {
  return <Modal {...props} className={cn("md:max-w-xl", props.className)} />;
}

/** Side drawer (cart preview, admin order detail, mobile menu). */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  className,
}: OverlayProps & { side?: "left" | "right" }) {
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useOverlay(open, onClose, panel);
  const offscreen = side === "right" ? "100%" : "-100%";

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80]">
            <motion.div
              className="absolute inset-0 bg-ink/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden
            />
            <motion.aside
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { x: offscreen }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: offscreen }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              className={cn(
                "absolute top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-glass outline-none",
                side === "right" ? "right-0 rounded-l-sheet" : "left-0 rounded-r-sheet",
                className,
              )}
            >
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
                <h2 className="text-lg font-bold">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-10 items-center justify-center rounded-full bg-cream text-ink transition hover:bg-mango-soft"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
              {footer && <div className="border-t border-line px-5 py-4 pb-safe">{footer}</div>}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
