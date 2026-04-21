"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X } from "lucide-react";

export type BottomSheetSize = "sm" | "md" | "lg" | "full";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: BottomSheetSize;
  /**
   * When false, hides the mobile drag handle + disables drag-to-close.
   * Default: true.
   */
  dismissible?: boolean;
  /**
   * When false, clicking the backdrop will NOT close the sheet.
   * Default: true.
   */
  closeOnBackdrop?: boolean;
}

const DESKTOP_MAX_WIDTH: Record<BottomSheetSize, string> = {
  sm: "lg:max-w-sm",
  md: "lg:max-w-md",
  lg: "lg:max-w-2xl",
  full: "lg:max-w-5xl",
};

const MOBILE_HEIGHT: Record<BottomSheetSize, string> = {
  sm: "max-h-[50vh]",
  md: "max-h-[75vh]",
  lg: "max-h-[90vh]",
  full: "h-[100dvh]",
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  dismissible = true,
  closeOnBackdrop = true,
}: BottomSheetProps) {
  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, dismissible]);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (!dismissible) return;
    if (info.offset.y > 120 || info.velocity.y > 600) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (closeOnBackdrop) onClose();
            }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Mobile: bottom drawer */}
          <motion.div
            key="mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag={dismissible ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className={`lg:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl shadow-gray-900/20 border-t border-gray-200 overflow-hidden flex flex-col pb-safe ${MOBILE_HEIGHT[size]}`}
          >
            {/* Drag handle */}
            {dismissible && (
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>
            )}
            {(title || dismissible) && (
              <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">{title ?? ""}</h2>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>

          {/* Desktop: centered modal */}
          <div className="hidden lg:flex absolute inset-0 items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="desktop"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className={`pointer-events-auto relative w-full ${DESKTOP_MAX_WIDTH[size]} max-h-[90vh] bg-white rounded-2xl shadow-2xl shadow-gray-900/10 border border-gray-100 flex flex-col overflow-hidden`}
            >
              {(title || dismissible) && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">{title ?? ""}</h2>
                  {dismissible && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close"
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-5">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
