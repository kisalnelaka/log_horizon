import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM } from '@pixiv/three-vrm';
import { retargetAnimation } from 'vrm-mixamo-retarget';

export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  const fbx = await loader.loadAsync(url);

  if (!fbx || !fbx.animations.length) {
    throw new Error(`[Animation Loader] No animation found in "${url}"`);
  }

  const clip = retargetAnimation(fbx, vrm);

  if (!clip) {
    throw new Error(`[Animation Loader] Failed to retarget animation from "${url}"`);
  }

  // Strip horizontal position root motion drift to prevent the rubber-band jerking loop
  clip.tracks.forEach((track) => {
    if (track.name.endsWith('.position')) {
      const values = (track as THREE.VectorKeyframeTrack).values;
      // Anchor the starting X and Z position offset of the loop so it doesn't drift/snap back
      const startX = values[0];
      const startZ = values[2];

      for (let i = 0; i < values.length; i += 3) {
        values[i] = startX;     // Lock horizontal X drift
        values[i + 2] = startZ; // Lock horizontal Z drift
        // Leave values[i + 1] (Y axis) alone so jumping/crouching height changes work fine
      }
    }
  });

  return clip;
}