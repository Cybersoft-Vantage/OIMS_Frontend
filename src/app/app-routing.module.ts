// Angular Import
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { authGuard } from './guards/auth.guard';

// project import
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: '/analytics',
        pathMatch: 'full'
      },
      {
        path: 'analytics',
        loadComponent: () => import('./home/dashboard/dash-analytics.component').then((c) => c.DashAnalyticsComponent),
        canActivate: [authGuard]
      },
      // {
      //   path: 'component',
      //   loadChildren: () => import('./home/ui-element/ui-basic.module').then((m) => m.UiBasicModule),
      //   canActivate: [authGuard]
      // },
      // {
      //   path: 'chart',
      //   loadComponent: () => import('./home/chart-maps/core-apex.component').then((c) => c.CoreApexComponent),
      //   canActivate: [authGuard]
      // },
      // {
      //   path: 'forms',
      //   loadComponent: () => import('./home/forms/form-elements/form-elements.component').then((c) => c.FormElementsComponent),
      //   canActivate: [authGuard]
      // },
      // {
      //   path: 'tables',
      //   loadComponent: () => import('./home/tables/tbl-bootstrap/tbl-bootstrap.component').then((c) => c.TblBootstrapComponent),
      //   canActivate: [authGuard]
      // },
      // {
      //   path: 'sample-page',
      //   loadComponent: () => import('./home/other/sample-page/sample-page.component').then((c) => c.SamplePageComponent),
      //   canActivate: [authGuard]
      // },
      {
        path: 'inventory',
        loadComponent: () => import('./home/pages/InventoryManagement/inventory-management').then((c) => c.InventoryManagement),
        children: [
          {
            path: '',
            redirectTo: 'detailed-categories',
            pathMatch: 'full'
          },
          // {
          //   path: 'categories',
          //   loadComponent: () => import('./home/pages/InventoryManagement/category/category').then((c) => c.Category),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'assets',
          //   loadComponent: () => import('./home/pages/InventoryManagement/asset/asset').then((c) => c.AssetPage),
          //   canActivate: [authGuard]
          // },
          {
            path: 'statuses',
            loadComponent: () => import('./home/pages/InventoryManagement/asset-status/asset-status').then((c) => c.AssetStatusPage),
            canActivate: [authGuard]
          },
          // {
          //   path: 'subcategories',
          //   loadComponent: () => import('./home/pages/InventoryManagement/subcategory/subcategory').then((c) => c.Subcategory),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'components',
          //   loadComponent: () => import('./home/pages/InventoryManagement/component-detail/component-detail').then((c) => c.ComponentDetail),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'history',
          //   loadComponent: () => import('./home/pages/InventoryManagement/asset-history/asset-history').then((c) => c.AssetHistoryPage),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'assign',
          //   loadComponent: () => import('./home/pages/InventoryManagement/assign-asset/assign-asset').then((c) => c.AssignAsset),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'assignments',
          //   loadComponent: () => import('./home/pages/InventoryManagement/assignments-list/assignments-list').then((c) => c.AssignmentsList),
          //   canActivate: [authGuard]
          // },
          {
            path: 'procurement',
            loadComponent: () => import('./home/pages/InventoryManagement/procurement/procurement').then((c) => c.Procurement),
            canActivate: [authGuard]
          },
          {
            path: 'licensing',
            loadComponent: () => import('./home/pages/InventoryManagement/licensing/licensing').then((c) => c.Licensing),
            canActivate: [authGuard]
          },
          {
            path: 'maintenance',
            loadComponent: () => import('./home/pages/InventoryManagement/maintenance/maintenance').then((c) => c.Maintenance),
            canActivate: [authGuard]
          },
          // {
          //   path: 'consumables',
          //   loadComponent: () => import('./home/pages/InventoryManagement/consumables/consumables').then((c) => c.Consumables),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'alerts',
          //   loadComponent: () => import('./home/pages/InventoryManagement/alerts/alerts').then((c) => c.Alerts),
          //   canActivate: [authGuard]
          // },
          // {
          //   path: 'admin',
          //   loadComponent: () => import('./home/pages/InventoryManagement/admin/admin').then((c) => c.InventoryAdmin),
          //   canActivate: [authGuard],
          //   data: { roles: ['Admin', 'HR'] }
          // },
          // {
          //   path: 'import',
          //   loadComponent: () => import('./home/pages/InventoryManagement/bulk-import/import').then((c) => c.InventoryImport),
          //   canActivate: [authGuard]
          // },
          {
            path: 'manage-asset',
            loadComponent: () => import('./home/pages/InventoryManagement/add-detailed-asset/add-detailed-asset').then((c) => c.AddDetailedAsset),
            canActivate: [authGuard]
          }
          ,
          {
            path: 'detailed-categories',
            loadComponent: () => import('./home/pages/InventoryManagement/add-detailed-category/add-detailed-category').then((c) => c.AddDetailedCategory),
            canActivate: [authGuard]
          }
          ,
          {
            path: 'assign-detailed',
            loadComponent: () => import('./home/pages/InventoryManagement/assign-detailed-asset/assign-detailed-asset').then((c) => c.AssignDetailedAsset),
            canActivate: [authGuard]
          },
          {
            path: 'detailed-assignments',
            loadComponent: () => import('./home/pages/InventoryManagement/detailed-assignments-list/detailed-assignments-list').then((c) => c.DetailedAssignmentsList),
            canActivate: [authGuard]
          },
          {
            path: 'detailed-history',
            loadComponent: () => import('./home/pages/InventoryManagement/detailed-history/detailed-history').then((c) => c.DetailedHistory),
            canActivate: [authGuard]
          },
          {
            path: 'restore',
            loadComponent: () => import('./home/pages/InventoryManagement/restore/restore').then((c) => c.RestorePage),
            canActivate: [authGuard]
          },
          {
            path: 'reports',
            loadComponent: () => import('./home/pages/InventoryManagement/reports/reports').then((c) => c.ReportsPage),
            canActivate: [authGuard]
          },
          {
            path: 'detailed-asset/:id',
            loadComponent: () => import('./home/pages/InventoryManagement/detailed-asset-detail/detailed-asset-detail').then((c) => c.DetailedAssetDetail),
            canActivate: [authGuard]
          }
        ]
      },
      {
        path: 'users',
        children: [
          {
            path: 'list',
            loadComponent: () => import('./home/pages/Usermanagement/adduser/adduser').then((c) => c.Adduser),
            canActivate: [authGuard],
            data: { roles: ['Admin', 'HR'] }
          },
          {
            path: 'history',
            loadComponent: () => import('./home/pages/Usermanagement/userhistory/userhistory').then((c) => c.Userhistory),
            canActivate: [authGuard],
            data: { roles: ['Admin', 'HR'] }
          }
              ,
              {
                path: 'profile',
                loadComponent: () => import('./home/pages/Usermanagement/profile/profile').then((c) => c.ProfilePage),
                canActivate: [authGuard]
              }
        ]
      },
      {
        path: 'settings',
        children: [
          {
            path: 'theme',
            loadComponent: () => import('./home/pages/Settings/theme-management/theme-management.component').then((c) => c.ThemeManagementComponent),
            canActivate: [authGuard]
          }
        ]
      }
    ]
  },
  {
    path: '',
    component: GuestComponent,
    children: [
      // {
      //   path: 'register',
      //   loadComponent: () => import('./home/pages/authentication/sign-up/sign-up.component').then((c) => c.SignUpComponent)
      // },
      {
        path: 'login',
        loadComponent: () => import('./home/pages/authentication/sign-in/sign-in.component').then((c) => c.SignInComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
