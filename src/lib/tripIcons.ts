import {
  Plane, Globe, MapPin, Compass, Mountain, Palmtree,
  Building2, Tent, Ship, Backpack, Camera, Heart,
  Bed, Utensils, ShoppingBag, Package,
} from "lucide-react";

export const TRIP_ICON_MAP: Record<string, typeof Plane> = {
  Plane, Globe, MapPin, Compass, Mountain, Palmtree,
  Building2, Tent, Ship, Backpack, Camera, Heart,
};

export function getTripIcon(name: string): typeof Plane {
  return TRIP_ICON_MAP[name] || Plane;
}

// Item category → icon
export const CATEGORY_ICON: Record<string, typeof Plane> = {
  lodging: Bed,
  transport: Plane,
  food: Utensils,
  activity: MapPin,
  shopping: ShoppingBag,
  other: Package,
};

export function getCategoryIcon(category: string): typeof Plane {
  return CATEGORY_ICON[category] || Package;
}
