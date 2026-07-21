"use client";

import { useEffect, useState } from "react";
import { useMotionValue, animate } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

/**
 * Smoothly animates a number from its previous value to the new value.
 * Perfect for financial stat cards.
 *
 * The animated frames are pushed through React state (via the motion value's
 * change subscription) rather than rendered as a MotionValue child — motion
 * children only re-resolve when the parent re-renders, which froze values on
 * pages that render exactly once after their data loads.
 */
export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 0.8,
  className = "",
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const format = (latest: number) =>
    `${prefix}${latest.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    const unsubscribe = motionValue.on("change", (latest) => setDisplay(format(latest)));
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    });
    // rAF is throttled or fully paused in background/hidden tabs, which would
    // freeze the animation mid-flight — always settle on the exact final value.
    const settle = setTimeout(() => {
      motionValue.set(value);
      setDisplay(format(value));
    }, duration * 1000 + 150);
    return () => {
      clearTimeout(settle);
      unsubscribe();
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefix, suffix, decimals, motionValue]);

  return <span className={`tabular-nums ${className}`}>{display}</span>;
}
