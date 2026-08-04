import { Injectable, signal } from '@angular/core';

export type AppThemeId = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'contrast';

export interface AppThemeOption {
  id: AppThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'oims_theme';
  private readonly defaultTheme: AppThemeId = 'light';
  readonly themes: AppThemeOption[] = [
    { id: 'light', name: 'Light', description: 'Clean neutral workspace for day-to-day use.', preview: ['#f6f7fb', '#0b4eb3', '#ffffff'] },
    { id: 'dark', name: 'Dark', description: 'Low-glare dark surfaces with cool contrast.', preview: ['#111827', '#1f2937', '#60a5fa'] },
    { id: 'ocean', name: 'Ocean', description: 'Blue-green palette with calm dashboard contrast.', preview: ['#e6f4f1', '#0f766e', '#134e4a'] },
    { id: 'forest', name: 'Forest', description: 'Muted green theme with warm panel accents.', preview: ['#edf7ed', '#2f6b3b', '#d7ecd8'] },
    { id: 'sunset', name: 'Sunset', description: 'Warm amber and plum accents for a richer look.', preview: ['#fff3e8', '#b45309', '#7c2d12'] },
    { id: 'contrast', name: 'High Contrast', description: 'Maximum contrast for accessibility and focus.', preview: ['#000000', '#ffffff', '#ffd400'] }
  ];
  readonly currentTheme = signal<AppThemeId>(this.defaultTheme);
  private initialized = false;

  initialize(): void {
    if (this.initialized) {
      return;
    }
    const savedTheme = this.readStoredTheme();
    this.applyTheme(savedTheme ?? this.defaultTheme);
    this.initialized = true;
  }

  setTheme(theme: AppThemeId): void {
    this.applyTheme(theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.storageKey, theme);
    }
  }

  restoreDefaultTheme(): void {
    this.setTheme(this.defaultTheme);
  }

  isActive(theme: AppThemeId): boolean {
    return this.currentTheme() === theme;
  }

  private readStoredTheme(): AppThemeId | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const stored = window.localStorage.getItem(this.storageKey) as AppThemeId | null;
    return this.themes.some((theme) => theme.id === stored) ? stored : null;
  }

  private applyTheme(theme: AppThemeId): void {
    this.currentTheme.set(theme);
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }
}
