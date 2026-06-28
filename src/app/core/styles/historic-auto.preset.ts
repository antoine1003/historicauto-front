import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Palette générée à partir du gold de la charte (#B8860B).
 * Le 600 correspond exactement au hover défini dans auth.theme.css (#9A7009) —
 * cohérence garantie entre le thème PrimeNG et le CSS custom existant.
 */
export const HistoricAutoPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#FDFBF0',
      100: '#FBF3D9',
      200: '#F5E4AC',
      300: '#EDD17A',
      400: '#DCB54C',
      500: '#B8860B',
      600: '#9A7009',
      700: '#7C5A07',
      800: '#5E4505',
      900: '#4A3704',
      950: '#2E2202',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
      },
      // Adapte si ton .auth-theme-toggle bascule un mode sombre
      dark: {
        primary: {
          color: '{primary.400}',
          contrastColor: '#1A1714',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
      },
    },
  },
  components: {
    button: {
      root: {
        // Aligné avec rounded-sm de Tailwind (0.125rem), au lieu du rounded-md par défaut de Aura
        borderRadius: '0.125rem',
        label: {
          fontWeight: '600',
        },
      },
    },
  },
});
