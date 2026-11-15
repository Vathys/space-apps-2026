"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";

/** A zoom request from the stage's + / − buttons: a new `n` zooms once, in (+1) or out (−1). */
export type ZoomSignal = { n: number; dir: 1 | -1 } | null;

/**
 * Zooms the scene's default camera when a new signal arrives: closer to or farther from the orbit target, or, where
 * the controls can't zoom (the lander cam looks around from the mast tip), a narrower or wider field of view.
 */
export function SceneZoom({ signal }: { signal: ZoomSignal }) {
  const get = useThree((s) => s.get);
  const seen = useRef(signal?.n ?? 0); // a signal from before this scene mounted is not a request to it
  useEffect(() => {
    if (!signal || signal.n === seen.current) return;
    seen.current = signal.n;
    // Read the camera and controls now (not as hook values): they are three.js objects this moves
    const { camera, invalidate } = get();
    const controls = get().controls as OrbitControls | null; // both scenes make drei's OrbitControls the default
    const step = signal.dir > 0 ? 0.8 : 1.25;
    if (controls?.enableZoom) {
      const off = camera.position.clone().sub(controls.target);
      off.setLength(THREE.MathUtils.clamp(off.length() * step, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(off);
      controls.update();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.clamp(camera.fov * step, 20, 90);
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [signal, get]);
  return null;
}
