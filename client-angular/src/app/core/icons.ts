// Single source of truth for the Lucide icons available in this app.
//
// Why this exists:
//   lucide-angular ships with `sideEffects: false`, so esbuild tree-shakes any
//   icon that isn't named-imported somewhere. Runtime `<lucide-icon name="x">`
//   lookups don't anchor the bundler. To make an icon usable, it MUST be
//   imported here AND included in ICON_REGISTRY.
//
// How to use:
//   - app.config.ts passes ICON_REGISTRY to LucideIconProvider so any name
//     resolves at runtime.
//   - The icon picker in ImageUploadPanelComponent and the area drawer pull
//     their option list from registeredIconNames() (kebab-case).
//   - server/scripts/check-icons.js reads this file and validates that every
//     icon_name written to shared.feedback_categories is registered.
//
// Naming notes:
//   - Some Lucide names were renamed upstream (Home → House, Grid → LayoutGrid,
//     XCircle → CircleX, AlertCircle → CircleAlert, MoreHorizontal → Ellipsis,
//     Unlock → LockOpen, BarChart2 → ChartBar, PieChart → ChartPie,
//     CheckCircle2 → CircleCheck, FileQuestion → FileQuestionMark, Sidebar →
//     PanelLeft). Use the canonical names below; kebab-case forms exposed via
//     registeredIconNames() reflect the canonical name (e.g. 'circle-x', not
//     'x-circle').

import {
  Activity, AlarmClock, AlertTriangle,
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Award,
  Bell, Briefcase, Building2, Bug,
  Calendar, CalendarDays, Camera, Car,
  ChartBar, ChartPie,
  ChefHat, Check, CheckSquare,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleAlert, CircleCheck, CircleDashed, CircleDot,
  CircleHelp, CircleX,
  ClipboardList, ClipboardPen, Clock, Code, Coffee, Compass, Copy,
  Cpu, CreditCard,
  Database, Download,
  Ellipsis, EllipsisVertical, ExternalLink, Eye, EyeOff,
  FileQuestionMark, FileText, Flag, FlaskConical, Flower2, Folder, FolderOpen,
  Gauge, Gift, GitBranch, Globe,
  Headphones, Headset, Heart, House,
  Image, Inbox, Info,
  Key,
  LayoutDashboard, LayoutGrid, Layers, Lightbulb,
  Link, Link2, List, LoaderCircle, Lock, LockOpen,
  Mail, MapPin, Martini, Menu, MessageCircle, MessageSquare,
  Mic, Microscope, Minus, Monitor, Moon, Music,
  Package, Palette, PanelLeft, Pencil, PersonStanding, Phone, Pizza, Plane, Plus,
  Rocket,
  Save, Search, Send, Settings, Share2, Shield, ShoppingBag,
  Signature, Smartphone, Sparkles, Spotlight, SquarePen, Star, Store, Sun, SunMedium,
  Tag, Terminal, Ticket, Timer, Trash2, TrendingUp, Trophy, Truck, Tv,
  Upload, User, Users, Utensils,
  Video, Volleyball,
  Warehouse, Wine, Wrench,
  X, Zap
} from 'lucide-angular';

/**
 * The canonical icon registry. Keys are PascalCase (matching the Lucide export
 * name) — that's what `LucideIconProvider` looks up after the component
 * normalises kebab-case input (`<lucide-icon name="building-2">` →
 * `Building2`).
 */
export const ICON_REGISTRY = {
  Activity, AlarmClock, AlertTriangle,
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Award,
  Bell, Briefcase, Building2, Bug,
  Calendar, CalendarDays, Camera, Car,
  ChartBar, ChartPie,
  ChefHat, Check, CheckSquare,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, CircleAlert, CircleCheck, CircleDashed, CircleDot,
  CircleHelp, CircleX,
  ClipboardList, ClipboardPen, Clock, Code, Coffee, Compass, Copy,
  Cpu, CreditCard,
  Database, Download,
  Ellipsis, EllipsisVertical, ExternalLink, Eye, EyeOff,
  FileQuestionMark, FileText, Flag, FlaskConical, Flower2, Folder, FolderOpen,
  Gauge, Gift, GitBranch, Globe,
  Headphones, Headset, Heart, House,
  Image, Inbox, Info,
  Key,
  LayoutDashboard, LayoutGrid, Layers, Lightbulb,
  Link, Link2, List, LoaderCircle, Lock, LockOpen,
  Mail, MapPin, Martini, Menu, MessageCircle, MessageSquare,
  Mic, Microscope, Minus, Monitor, Moon, Music,
  Package, Palette, PanelLeft, Pencil, PersonStanding, Phone, Pizza, Plane, Plus,
  Rocket,
  Save, Search, Send, Settings, Share2, Shield, ShoppingBag,
  Signature, Smartphone, Sparkles, Spotlight, SquarePen, Star, Store, Sun, SunMedium,
  Tag, Terminal, Ticket, Timer, Trash2, TrendingUp, Trophy, Truck, Tv,
  Upload, User, Users, Utensils,
  Video, Volleyball,
  Warehouse, Wine, Wrench,
  X, Zap
} as const;

export type IconName = keyof typeof ICON_REGISTRY;

/**
 * PascalCase → kebab-case (matches lucide-angular's `toPascalCase` reversed).
 * Building2 → 'building-2', LayoutDashboard → 'layout-dashboard',
 * ChevronRight → 'chevron-right', X → 'x'.
 */
export function iconToKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * The canonical kebab-case names that `<lucide-icon name="…">` accepts.
 * Sorted alphabetically, used by both the icon picker UI and the build-time
 * validation script.
 */
export function registeredIconNames(): string[] {
  return Object.keys(ICON_REGISTRY).map(iconToKebab).sort();
}
