import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import {
  Volleyball, Calendar, MapPin, Heart, MessageCircle,
  FolderOpen, CircleDot, CircleDashed, CircleCheck, Plus,
  Moon, Sun, User, Settings, House,
  Building2, Users, Layers, CreditCard, Palette, Upload, Save,
  Sparkles, LoaderCircle, Inbox, Folder, FileText, List, Package,
  Truck, ChevronDown, ChevronRight, ArrowLeft, Mail, Phone, Pencil, X, Image, Check, SquarePen, Search,
  Warehouse, Spotlight, Headset, Signature, Martini, PersonStanding, CheckSquare, AlertTriangle, ChevronLeft, Store,
  MessageSquare, Bug, Lightbulb, CircleHelp, ClipboardPen,
  Utensils, Music, Mic, Tv, Flower2, Zap, Camera, Coffee,
  ShoppingBag, Award, Briefcase, Globe, Wine, Star,
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
        Utensils, Music, Mic, Tv, Flower2, Zap, Camera, Coffee,
        ShoppingBag, Award, Briefcase, Globe, Wine, Star,
      }),
    },
  ]
};
