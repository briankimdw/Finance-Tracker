"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateActionOnClick = { label: string; onClick: () => void };
type EmptyStateActionHref = { label: string; href: string };
export type EmptyStateAction = EmptyStateActionOnClick | EmptyStateActionHref;

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /**
   * Additional classes applied to the outer wrapper.
   */
  className?: string;
}

function isHrefAction(action: EmptyStateAction): action is EmptyStateActionHref {
  return typeof (action as EmptyStateActionHref).href === "string";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
        <Icon size={28} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {isHrefAction(action) ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 transition-all hover:shadow-lg hover:shadow-blue-600/20"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 transition-all hover:shadow-lg hover:shadow-blue-600/20"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
