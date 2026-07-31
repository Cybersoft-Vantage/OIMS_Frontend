export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  badge?: {
    title?: string;
    type?: string;
  };
  allowedRoles?: string[];
  children?: NavigationItem[];
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'navigation',
    title: 'Main Menu',
    type: 'group',
    icon: 'icon-group',
    children: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'item',
        url: '/analytics',
        icon: 'feather icon-home'
      },
      {
        id: 'basic',
        title: 'OIMS Management',
        type: 'collapse',
        icon: 'feather icon-box',
        children: [
          {
            id: 'inventory',
            title: 'Inventory Management',
            type: 'item',
            url: '/inventory',
            icon: 'feather icon-box'
          },
         
          {
            id: 'user-management',
            title: 'User\nManagement',
            type: 'collapse',
            icon: 'feather icon-box',
            classes: 'user-management-text',
            allowedRoles: ['Admin', 'HR'],
            children: [
              {
                id: 'user-list',
                title: 'User List',
                type: 'item',
                url: '/users/list',
                allowedRoles: ['Admin', 'HR']
              },
              {
                id: 'user-history',
                title: 'User History',
                type: 'item',
                url: '/users/history',
                allowedRoles: ['Admin', 'HR']
              }
            ]
          },
        ]
      }
    ]
  },
  // {
  //   id: 'Ui Component',
  //   title: 'OIMS Management',
  //   type: 'group',
  //   icon: 'icon-group',
  //   children: [
  //     {
  //       id: 'basic',
  //       title: 'OIMS Management',
  //       type: 'collapse',
  //       icon: 'feather icon-box',
  //       children: [
  //         {
  //           id: 'inventory',
  //           title: 'Inventory Management',
  //           type: 'item',
  //           url: '/inventory',
  //           icon: 'feather icon-box'
  //         },
  //         {
  //           id: 'user-management',
  //           title: 'User Management',
  //           type: 'collapse',
  //           children: [
  //             {
  //               id: 'user-list',
  //               title: 'User List',
  //               type: 'item',
  //               url: '/users/list'
  //             },
  //             {
  //               id: 'user-history',
  //               title: 'User History',
  //               type: 'item',
  //               url: '/users/history'
  //             }
  //           ]
  //         },
  //         // {
  //         //   id: 'Breadcrumb & Pagination',
  //         //   title: 'Total Inventory in Stock',
  //         //   type: 'item',
  //         //   url: '/component/breadcrumb-paging'
  //         // },
  //         // {
  //         //   id: 'Collapse',
  //         //   title: 'Required Inventory',
  //         //   type: 'item',
  //         //   url: '/component/collapse'
  //         // },
  //         // {
  //         //   id: 'Tabs & Pills',
  //         //   title: 'Damaged Inventory',
  //         //   type: 'item',
  //         //   url: '/component/tabs-pills'
  //         // },
  //         // {
  //         //   id: 'Typography',
  //         //   title: 'Inventory History',
  //         //   type: 'item',
  //         //   url: '/component/typography'
  //         // }
  //       ]
  //     }
  //   ]
  // },
  // {
  //   id: 'Authentication',
  //   title: 'MANAGE USERS',
  //   type: 'group',
  //   icon: 'icon-group',
  //   children: [
  //     {
  //       id: 'signup',
  //       title: 'Add User',
  //       type: 'item',
  //       url: '/register',
  //       icon: 'feather icon-at-sign',
  //       target: true,
  //       breadcrumbs: false
  //     },
  //     {
  //       id: 'signin',
  //       title: 'User Details',
  //       type: 'item',
  //       url: '/login',
  //       icon: 'feather icon-log-in',
  //       target: true,
  //       breadcrumbs: false
  //     }
  //   ]
  // },
  // {
  //   id: 'chart',
  //   title: 'Chart',
  //   type: 'group',
  //   icon: 'icon-group',
  //   children: [
  //     {
  //       id: 'apexchart',
  //       title: 'ApexChart',
  //       type: 'item',
  //       url: '/chart',
  //       classes: 'nav-item',
  //       icon: 'feather icon-pie-chart'
  //     }
  //   ]
  // },
  // {
  //   id: 'forms & tables',
  //   title: 'Forms & Tables',
  //   type: 'group',
  //   icon: 'icon-group',
  //   children: [
  //     {
  //       id: 'forms',
  //       title: 'Basic Forms',
  //       type: 'item',
  //       url: '/forms',
  //       classes: 'nav-item',
  //       icon: 'feather icon-file-text'
  //     },
  //     {
  //       id: 'tables',
  //       title: 'Tables',
  //       type: 'item',
  //       url: '/tables',
  //       classes: 'nav-item',
  //       icon: 'feather icon-server'
  //     }
  //   ]
  // },
  // {
  //   id: 'other',
  //   title: 'Other',
  //   type: 'group',
  //   icon: 'icon-group',
  //   children: [
  //     {
  //       id: 'sample-page',
  //       title: 'Sample Page',
  //       type: 'item',
  //       url: '/sample-page',
  //       classes: 'nav-item',
  //       icon: 'feather icon-sidebar'
  //     },
  //     {
  //       id: 'menu-level',
  //       title: 'Menu Levels',
  //       type: 'collapse',
  //       icon: 'feather icon-menu',
  //       children: [
  //         {
  //           id: 'menu-level-2.1',
  //           title: 'Menu Level 2.1',
  //           type: 'item',
  //           url: 'javascript:',
  //           external: true
  //         },
  //         {
  //           id: 'menu-level-2.2',
  //           title: 'Menu Level 2.2',
  //           type: 'collapse',
  //           children: [
  //             {
  //               id: 'menu-level-2.2.1',
  //               title: 'Menu Level 2.2.1',
  //               type: 'item',
  //               url: 'javascript:',
  //               external: true
  //             },
  //             {
  //               id: 'menu-level-2.2.2',
  //               title: 'Menu Level 2.2.2',
  //               type: 'item',
  //               url: 'javascript:',
  //               external: true
  //             }
  //           ]
  //         }
  //       ]
  //     }
  //   ]
  // }
];
