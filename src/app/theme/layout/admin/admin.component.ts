// Angular Import
import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// Project Import
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { Footer } from './footer/footer';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-admin',
  imports: [RouterModule, NavBarComponent, NavigationComponent, CommonModule, BreadcrumbComponent, Footer],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private layoutState = inject(LayoutStateService);
  private themeService = inject(ThemeService);

  // public props
  navCollapsed = false;
  /**
   * Mobile drawer state. Held in the shared service because nav items close the
   * drawer on navigation - reading the signal here is what actually applies the
   * `mob-open` class, so the two stay in sync.
   */
  readonly navCollapsedMob = this.layoutState.navCollapsedMob;
  windowWidth: number;

  // constructor
  constructor() {
    this.windowWidth = window.innerWidth;
    this.themeService.initialize();
  }

  /** The icon-rail collapse only applies from the large breakpoint upwards. */
  get isDesktop(): boolean {
    return this.windowWidth >= 992;
  }

  @HostListener('window:resize', ['$event'])
  // eslint-disable-next-line
  onResize(event: any): void {
    this.windowWidth = event.target.innerWidth;
    if (this.windowWidth < 992) {
      document.querySelector('.pcoded-navbar')?.classList.add('menupos-static');
    } else {
      // Leaving the mobile breakpoint: make sure the drawer is not left open.
      this.layoutState.closeNavCollapsedMob();
    }
  }

  // public method
  navMobClick() {
    this.layoutState.toggleNavCollapsedMob();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.layoutState.closeNavCollapsedMob();
  }
}
