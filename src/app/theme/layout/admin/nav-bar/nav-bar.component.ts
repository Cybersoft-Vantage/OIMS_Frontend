// angular import
import { Component, HostListener, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavLeftComponent } from './nav-left/nav-left.component';
import { NavRightComponent } from './nav-right/nav-right.component';

@Component({
  selector: 'app-nav-bar',
  imports: [SharedModule, NavLeftComponent, NavRightComponent, RouterModule, CommonModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss']
})
export class NavBarComponent {
  // public props
  menuClass: boolean;
  collapseStyle: string;
  windowWidth: number;

  NavCollapse = output();
  NavCollapsedMob = output();

  // constructor
  constructor() {
    this.menuClass = false;
    this.collapseStyle = 'none';
    this.windowWidth = window.innerWidth;
  }

  @HostListener('window:resize', ['$event'])
  // eslint-disable-next-line
  onResize(event: any): void {
    // Kept current so the breakpoint guards below do not act on a stale width.
    this.windowWidth = event?.target?.innerWidth ?? window.innerWidth;
  }

  // public method
  toggleMobOption() {
    this.menuClass = !this.menuClass;
    this.collapseStyle = this.menuClass ? 'block' : 'none';
  }

  navCollapse() {
    if (window.innerWidth >= 992) {
      this.NavCollapse.emit();
    }
  }

  navCollapseMob() {
    if (window.innerWidth < 992) {
      this.NavCollapsedMob.emit();
    }
  }
}
