import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
// Lucide-angular publishes with sideEffects:false, so esbuild tree-shakes any
// icon that isn't named-imported here. Runtime `name in this.icons` lookups
// (used by <lucide-icon name="...">) don't anchor the bundler. That means:
//   - every icon name that appears in the DB (e.g. shared.feedback_categories
//     icon_name values, marketing seed) MUST be imported below;
//   - free-form admin-picked names won't render unless the picker only offers
//     icons that are in this list.
// If we ever need free-form names without redeploys, the path is a custom
// directive that fetches SVG strings from the lucide-static CDN at runtime.
import {
  Volleyball, Calendar, MapPin, Heart, MessageCircle,
  FolderOpen, CircleDot, CircleDashed, CircleCheck, Plus,
  Moon, Sun, User, Settings, House,
  Building2, Users, Layers, CreditCard, Palette, Upload, Save,
  Sparkles, LoaderCircle, Inbox, Folder, FileText, List, Package,
  Truck, ChevronDown, ChevronRight, ArrowLeft, Mail, Phone, Pencil, X, Image, Check, SquarePen, Search,
  Warehouse, Spotlight, Headset, Signature, Martini, PersonStanding, CheckSquare, AlertTriangle, ChevronLeft, Store,
  MessageSquare, Bug, Lightbulb, CircleHelp, ClipboardPen,
  ChevronUp, Link2, Utensils, Music, Mic, Tv, Flower2, Zap, Camera, Coffee,
  ShoppingBag, Award, Briefcase, Globe, Wine, Star,
  // Added for shared.feedback_categories area seed (Auth/Dashboard/Mobile/
  // Notifications/Technical) and the 'Area' namespace circle on the
  // categories admin page, plus FlaskConical for the Test Run folder type.
  Shield, LayoutDashboard, Smartphone, Bell, Wrench, Compass, FlaskConical,
} from 'lucide-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Volleyball, Calendar, MapPin, Heart, MessageCircle,
        FolderOpen, CircleDot, CircleDashed, CircleCheck, Plus,
        Moon, Sun, User, Settings, House,
        Building2, Users, Layers, CreditCard, Palette, Upload, Save,
        Sparkles, LoaderCircle, Inbox, Folder, FileText, List, Package,
        Truck, ChevronDown, ChevronRight, ArrowLeft, Mail, Phone, Pencil, X, Image, Check, SquarePen, Search,
        Warehouse, Spotlight, Headset, Signature, Martini, PersonStanding, CheckSquare, AlertTriangle, ChevronLeft, Store,
        MessageSquare, Bug, Lightbulb, CircleHelp, ClipboardPen,
        ChevronUp, Link2, Utensils, Music, Mic, Tv, Flower2, Zap, Camera, Coffee,
        ShoppingBag, Award, Briefcase, Globe, Wine, Star,
        Shield, LayoutDashboard, Smartphone, Bell, Wrench, Compass, FlaskConical,
      }),
    },
  ]
};
