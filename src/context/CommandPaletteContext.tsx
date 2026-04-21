"use client";

import { createContext, useContext } from "react";

export interface CommandPaletteApi {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteApi | null>(null);

export function useCommandPaletteContext(): CommandPaletteApi | null {
  return useContext(CommandPaletteContext);
}
