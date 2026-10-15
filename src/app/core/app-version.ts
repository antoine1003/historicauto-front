// Import nommé : esbuild ne garde que ce champ, le reste de package.json (dépendances, scripts)
// n'atterrit pas dans le bundle livré au navigateur.
import { version } from '../../../package.json';

/** Version du front, tenue par `npm version` (package.json + tag vX.Y.Z). */
export const APP_VERSION = version;
