import {
  Target, Plane, Home, Car, Smartphone, Gift, GraduationCap,
  Heart, Briefcase, Music, Camera, Gamepad2, ShoppingBag,
  Tv, Bike, Trophy, Sparkles,
} from "lucide-react";

export const GOAL_ICON_MAP: Record<string, typeof Target> = {
  Target, Plane, Home, Car, Smartphone, Gift, GraduationCap,
  Heart, Briefcase, Music, Camera, Gamepad2, ShoppingBag,
  Tv, Bike, Trophy, Sparkles,
};

export function getGoalIcon(name: string): typeof Target {
  return GOAL_ICON_MAP[name] || Target;
}
