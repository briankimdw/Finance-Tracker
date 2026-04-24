"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { CheckCircle, AlertCircle, Info, Loader2, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info" | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

interface InternalToast extends ToastItem {
  createdAt: number;
}

interface PromiseMessages<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: unknown) => string);
}

export interface ToastApi {
  success: (message: string, options?: { action?: ToastAction; duration?: number }) => string;
  error: (message: string, options?: { action?: ToastAction; duration?: number }) => string;
  info: (message: string, options?: { action?: ToastAction; duration?: number }) => string;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>) => Promise<T>;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 3500;

function genId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface ProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ProviderProps) {
  const [toasts, setToasts] = useState<InternalToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string, duration: number) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      if (duration <= 0 || !isFinite(duration)) return;
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const push = useCallback(
    (toast: Omit<InternalToast, "createdAt">) => {
      const next: InternalToast = { ...toast, createdAt: Date.now() };
      setToasts((prev) => [...prev, next]);
      const duration = toast.duration ?? (toast.variant === "loading" ? Infinity : DEFAULT_DURATION);
      schedule(toast.id, duration);
      return toast.id;
    },
    [schedule]
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<InternalToast, "id" | "createdAt">>) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (patch.duration !== undefined || patch.variant !== undefined) {
        const nextDuration =
          patch.duration ?? (patch.variant === "loading" ? Infinity : DEFAULT_DURATION);
        schedule(id, nextDuration);
      }
    },
    [schedule]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => {
    const make = (variant: ToastVariant) =>
      (message: string, options?: { action?: ToastAction; duration?: number }) =>
        push({
          id: genId(),
          message,
          variant,
          action: options?.action,
          duration: options?.duration,
        });

    return {
      success: make("success"),
      error: make("error"),
      info: make("info"),
      loading: (message: string) =>
        push({
          id: genId(),
          message,
          variant: "loading",
          duration: Infinity,
        }),
      dismiss,
      promise: async <T,>(promise: Promise<T>, messages: PromiseMessages<T>): Promise<T> => {
        const id = push({
          id: genId(),
          message: messages.loading,
          variant: "loading",
          duration: Infinity,
        });
        try {
          const data = await promise;
          const msg = typeof messages.success === "function" ? messages.success(data) : messages.success;
          update(id, { message: msg, variant: "success", duration: DEFAULT_DURATION });
          return data;
        } catch (err) {
          const msg = typeof messages.error === "function" ? messages.error(err) : messages.error;
          update(id, { message: msg, variant: "error", duration: DEFAULT_DURATION });
          throw err;
        }
      },
    };
  }, [dismiss, push, update]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

interface ViewportProps {
  toasts: InternalToast[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ViewportProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-20 sm:pb-4 lg:items-end lg:right-4 lg:left-auto lg:pb-4"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CardProps {
  toast: InternalToast;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: CardProps) {
  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 80 || info.velocity.x > 500 || info.velocity.x < -500) {
      onDismiss(toast.id);
    }
  };

  const { icon, iconColor, iconBg } = getVariantStyles(toast.variant);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      role="status"
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className="pointer-events-auto w-full max-w-sm cursor-grab active:cursor-grabbing rounded-xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg shadow-gray-900/10 dark:shadow-black/30 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm text-gray-900 dark:text-gray-100 break-words">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="mt-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function getVariantStyles(variant: ToastVariant): {
  icon: ReactNode;
  iconColor: string;
  iconBg: string;
} {
  switch (variant) {
    case "success":
      return {
        icon: <CheckCircle size={16} />,
        iconColor: "text-green-600 dark:text-green-400",
        iconBg: "bg-green-50 dark:bg-green-950/40",
      };
    case "error":
      return {
        icon: <AlertCircle size={16} />,
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-50 dark:bg-red-950/40",
      };
    case "loading":
      return {
        icon: <Loader2 size={16} className="animate-spin" />,
        iconColor: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-50 dark:bg-blue-950/40",
      };
    case "info":
    default:
      return {
        icon: <Info size={16} />,
        iconColor: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-50 dark:bg-blue-950/40",
      };
  }
}
