import { NavLink, ThemeConfig } from './theme.interfaces';

const citcomHeaderLinks: NavLink[] = [
  {
    label: 'HEADER._home',
    url: '/',
    isRouterLink: true
  },
  {
    label: 'HEADER._browse',
    id: 'searchDropdown', // ID para el toggle de Flowbite
    children: [
      { label: 'HEADER._services', url: '/search', isRouterLink: true },
      { label: 'HEADER._catalogs', url: '/catalogues', isRouterLink: true }
    ]
  }
];


export const CITCOM_THEME_CONFIG: ThemeConfig = {
  name: 'CITCOM',
  displayName: 'CITCOM Marketplace',
  isDefault: true,
  assets: {
    logoUrl: 'assets/themes/citcom/logo-citcom.png',
    jumboBgUrl: 'assets/themes/citcom/blueBackground.png',
    cardDefaultBgUrl: 'assets/themes/citcom/cardBackground.svg'
  },
  links: {
    headerLinks: citcomHeaderLinks,
  },
  dashboard: {
    showFeaturedOfferings: true,
    showPlatformBenefits: false,
  }
};
