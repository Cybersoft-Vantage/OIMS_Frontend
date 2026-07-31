// angular import
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// project import
import { NavigationItem } from '../../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavItemComponent } from '../nav-item/nav-item.component';

@Component({
  selector: 'app-nav-collapse',
  imports: [SharedModule, NavItemComponent, RouterModule, CommonModule],
  templateUrl: './nav-collapse.component.html',
  styleUrls: ['./nav-collapse.component.scss']
})
export class NavCollapseComponent {
  // public props
  item = input.required<NavigationItem>();

  // public method
  navCollapse(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const trigger = e.currentTarget as HTMLElement | null;
    const parent = trigger?.closest('li.pcoded-hasmenu') as HTMLElement | null;
    if (!parent) {
      return;
    }

    const shouldOpen = !parent.classList.contains('pcoded-trigger');
    const sections = document.querySelectorAll<HTMLElement>('.pcoded-hasmenu');

    sections.forEach((section) => {
      const isCurrent = section === parent;
      const isAncestor = section.contains(parent);
      const isDescendant = parent.contains(section);

      if (!isCurrent && !isAncestor && !isDescendant) {
        section.classList.remove('pcoded-trigger');
      }
    });

    if (shouldOpen) {
      let ancestor = parent.parentElement?.closest('li.pcoded-hasmenu') as HTMLElement | null;
      while (ancestor) {
        ancestor.classList.add('pcoded-trigger');
        ancestor = ancestor.parentElement?.closest('li.pcoded-hasmenu') as HTMLElement | null;
      }
    }

    parent.classList.toggle('pcoded-trigger', shouldOpen);
  }
}
