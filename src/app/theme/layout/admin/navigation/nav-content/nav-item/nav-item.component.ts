// angular import
import { Component, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';

// project import
import { NavigationItem } from '../../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { LayoutStateService } from 'src/app/theme/shared/service/layout-state.service';

@Component({
  selector: 'app-nav-item',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-item.component.html',
  styleUrls: ['./nav-item.component.scss']
})
export class NavItemComponent {
  // public props
  item = input<NavigationItem>();
  private layoutState = inject(LayoutStateService);

  // public method
  closeOtherMenu(event: MouseEvent) {
    const link = event.currentTarget as HTMLElement | null;
    const item = link?.closest('li') as HTMLElement | null;
    const owningMenu = item?.closest('li.pcoded-hasmenu') as HTMLElement | null;

    if (owningMenu) {
      const sections = document.querySelectorAll<HTMLElement>('li.pcoded-hasmenu');
      sections.forEach((section) => {
        const isCurrent = section === owningMenu;
        const isAncestor = section.contains(owningMenu);
        const isDescendant = owningMenu.contains(section);

        if (!isCurrent && !isAncestor && !isDescendant) {
          section.classList.remove('active');
          section.classList.remove('pcoded-trigger');
        }
      });

      // Keep parent menu expanded for nested item navigation.
      let ancestor = owningMenu as HTMLElement | null;
      while (ancestor) {
        ancestor.classList.add('pcoded-trigger');
        ancestor.classList.add('active');
        ancestor = ancestor.parentElement?.closest('li.pcoded-hasmenu') as HTMLElement | null;
      }
    }

    const isMobile = window.innerWidth < 992;
    if (isMobile) {
      this.layoutState.closeNavCollapsedMob();
      if (document.querySelector('app-navigation.pcoded-navbar')?.classList.contains('mob-open')) {
        document.querySelector('app-navigation.pcoded-navbar')?.classList.remove('mob-open');
      }
    }
  }
}
