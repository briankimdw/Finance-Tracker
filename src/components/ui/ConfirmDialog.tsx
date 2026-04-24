"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle } from "lucide-react";
import { BottomSheet } from "./BottomSheet";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface DialogState {
  open: boolean;
  options: ConfirmOptions;
}

const DEFAULT_STATE: DialogState = {
  open: false,
  options: { title: "" },
};

interface ProviderProps {
  children: ReactNode;
}

export function ConfirmDialogProvider({ children }: ProviderProps) {
  const [state, setState] = useState<DialogState>(DEFAULT_STATE);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const resolve = useCallback((value: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
    if (r) r(value);
  }, []);

  const handleClose = useCallback(() => resolve(false), [resolve]);
  const handleConfirm = useCallback(() => resolve(true), [resolve]);

  const opts = state.options;
  const destructive = opts.destructive ?? false;
  const confirmLabel = opts.confirmLabel ?? (destructive ? "Delete" : "Confirm");
  const cancelLabel = opts.cancelLabel ?? "Cancel";

  const confirmClass = destructive
    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500/30 hover:shadow-red-600/20"
    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/30 hover:shadow-blue-600/20";

  const iconWrapperClass = destructive
    ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400";

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <BottomSheet
        isOpen={state.open}
        onClose={handleClose}
        size="sm"
        closeOnBackdrop
      >
        <div className="flex flex-col items-start gap-4 pt-1">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${iconWrapperClass}`}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{opts.title}</h3>
            {opts.message && (
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{opts.message}</p>
            )}
          </div>
          <div className="flex w-full gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm py-2.5 px-4 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              autoFocus
              className={`flex-1 rounded-xl text-white font-medium text-sm py-2.5 px-4 transition-all hover:shadow-lg focus:outline-none focus:ring-2 ${confirmClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </BottomSheet>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return ctx;
}
