import { type ImageSourcePropType } from 'react-native';
import { packArtUrl } from './api';
import type { PackArt } from '../types';

export type ArtSources = {
  body: ImageSourcePropType;
  /** Baked silhouette for magnets; absent for flat stickers. */
  shadow?: ImageSourcePropType;
};

/**
 * Bundled Starter art (docs/plan-magnets.md §4). Starter ships inside the app
 * so the board renders on first launch with no network; every other pack's art
 * lives in the public `packs/` Storage bucket and is resolved by URL.
 *
 * The `require`s are static on purpose — Metro can only bundle statically known
 * assets. `npm run bake:packs` generates these files.
 */
const STARTER: Record<string, ArtSources> = {
  st_fuji: {
    body: require('../../assets/packs/starter/st_fuji.webp'),
    shadow: require('../../assets/packs/starter/st_fuji_shadow.webp'),
  },
  st_boba: {
    body: require('../../assets/packs/starter/st_boba.webp'),
    shadow: require('../../assets/packs/starter/st_boba_shadow.webp'),
  },
  st_bus: {
    body: require('../../assets/packs/starter/st_bus.webp'),
    shadow: require('../../assets/packs/starter/st_bus_shadow.webp'),
  },
  st_cat: {
    body: require('../../assets/packs/starter/st_cat.webp'),
    shadow: require('../../assets/packs/starter/st_cat_shadow.webp'),
  },
  st_shell: {
    body: require('../../assets/packs/starter/st_shell.webp'),
    shadow: require('../../assets/packs/starter/st_shell_shadow.webp'),
  },
  st_love: { body: require('../../assets/packs/starter/st_love.webp') },
  st_gotit: { body: require('../../assets/packs/starter/st_gotit.webp') },
  st_done: { body: require('../../assets/packs/starter/st_done.webp') },
  st_great: { body: require('../../assets/packs/starter/st_great.webp') },
  st_haha: { body: require('../../assets/packs/starter/st_haha.webp') },
  st_thanks: { body: require('../../assets/packs/starter/st_thanks.webp') },
  st_yum: { body: require('../../assets/packs/starter/st_yum.webp') },
  st_onit: { body: require('../../assets/packs/starter/st_onit.webp') },
};

/** Resolve a pack-art row to bundled or remote image sources. */
export function artSources(art: PackArt): ArtSources | null {
  if (art.packId === 'starter') return STARTER[art.artId] ?? null;
  // Remote packs: versioned Storage paths. Magnets carry a `_shadow` sibling;
  // stickers are flat.
  const body = { uri: packArtUrl(art.path) };
  if (art.kind === 'sticker') return { body };
  const shadowPath = art.path.replace(/@3x\.webp$/, '_shadow@3x.webp');
  return { body, shadow: { uri: packArtUrl(shadowPath) } };
}
