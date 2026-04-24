"use client";

import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Tailwind classes to control dimensions and shape (e.g. "h-4 w-32 rounded").
   */
  className?: string;
}

const BASE_CLASS =
  "relative overflow-hidden bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse";

/**
 * Low-level shimmer block. Compose with Tailwind classes to size/shape it.
 */
export function Skeleton({ className = "", ...rest }: SkeletonProps) {
  return <div className={`${BASE_CLASS} rounded-md ${className}`} aria-hidden="true" {...rest} />;
}

export interface SkeletonAvatarProps {
  size?: number;
  className?: string;
}

export function SkeletonAvatar({ size = 40, className = "" }: SkeletonAvatarProps) {
  return (
    <div
      className={`${BASE_CLASS} rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  /**
   * Number of lines to render.
   */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  const safeLines = Math.max(1, lines);
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: safeLines }).map((_, i) => {
        const isLast = i === safeLines - 1;
        const widthClass = isLast ? "w-2/3" : "w-full";
        return <div key={i} className={`${BASE_CLASS} rounded h-3.5 ${widthClass}`} />;
      })}
    </div>
  );
}

export interface SkeletonRowProps {
  className?: string;
  showAvatar?: boolean;
  showTrailing?: boolean;
}

/**
 * A typical list-row skeleton: optional leading avatar, two stacked text lines,
 * optional trailing value block. Matches the card/row patterns in the app.
 */
export function SkeletonRow({
  className = "",
  showAvatar = true,
  showTrailing = true,
}: SkeletonRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm ${className}`}
      aria-hidden="true"
    >
      {showAvatar && <SkeletonAvatar size={40} />}
      <div className="flex-1 min-w-0 space-y-2">
        <div className={`${BASE_CLASS} rounded h-4 w-1/2`} />
        <div className={`${BASE_CLASS} rounded h-3 w-1/3`} />
      </div>
      {showTrailing && (
        <div className="space-y-2 items-end flex flex-col">
          <div className={`${BASE_CLASS} rounded h-4 w-16`} />
          <div className={`${BASE_CLASS} rounded h-3 w-10`} />
        </div>
      )}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
  /**
   * Number of text lines inside the card body.
   */
  lines?: number;
}

/**
 * Card-style skeleton matching app cards (rounded-xl, border-gray-200, p-5).
 */
export function SkeletonCard({ className = "", lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 mb-4">
        <SkeletonAvatar size={36} />
        <div className="flex-1 space-y-2">
          <div className={`${BASE_CLASS} rounded h-4 w-2/5`} />
          <div className={`${BASE_CLASS} rounded h-3 w-1/4`} />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}
