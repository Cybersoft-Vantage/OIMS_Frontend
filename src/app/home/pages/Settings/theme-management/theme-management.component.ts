import { Component, inject } from '@angular/core';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-theme-management',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './theme-management.component.html',
  styleUrls: ['./theme-management.component.scss']
})
export class ThemeManagementComponent {
  readonly themeService = inject(ThemeService);
  readonly themes = this.themeService.themes;

  constructor() {
    this.themeService.initialize();
  }

  chooseTheme(themeId: Parameters<ThemeService['setTheme']>[0]): void {
    this.themeService.setTheme(themeId);
  }

  restoreDefault(): void {
    this.themeService.restoreDefaultTheme();
  }
}
