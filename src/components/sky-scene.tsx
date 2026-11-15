"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ridgeGeometry, skyDirection, type SkyBody, type Vec3 } from "@/lib/lunanav/sky";
import type { HorizonProfile } from "@/lib/lunanav/types";
import { horizonElevationDeg } from "@/lib/lunanav/visibility";

const SKY_R = 50; // bodies sit on this sphere; sizes are for legibility, not to scale
// The terrain must be nearer than the bodies, or a body behind a ridge would be drawn in front of it
const RIDGE_R = 40;
const BELOW_DEG = -85;

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
// The --link-* signal colours of globals.css (three.js can't read CSS variables): blue direct, green relay, red blocked
const C = { direct: "#4a86f0", relay: "#14a67c", blocked: "#d9503c", idle: "#93a0b8" };
// Real horizons dip below 0° (−2.6° at both sites), so bodies are gated by the terrain profile, not by 0°; the ridge
// wall then hides exactly what the terrain hides. A Sun or Earth disk sitting on the ridge keeps its visible top.
const DISK_MARGIN_DEG = 3;
const overRidge = (h: HorizonProfile, b: SkyBody, marginDeg = 0) => b.elevationDeg > horizonElevationDeg(h, b.azimuthDeg) - marginDeg;
const CHIP ="pointer-events-none select-none whitespace-nowrap rounded-sm border border-white/10 bg-[#0e1524]/90 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#e8edf6]";

/** Decoration only: a fixed pseudo-random star field (no real catalogue). */
function Stars() {
  const positions = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const out = new Float32Array(1600 * 3);
    for (let i = 0; i < 1600; i++) {
      const z = 2 * rand() - 1;
      const a = 2 * Math.PI * rand();
      const r = Math.sqrt(1 - z * z);
      out.set([r * Math.cos(a) * 90, z * 90, r * Math.sin(a) * 90], i * 3);
    }
    return out;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.5} sizeAttenuation color="#cfd8ff" transparent opacity={0.8} />
    </points>
  );
}

// The scene origin is the antenna (where the file's elevations are measured); the ground sits this far below it
const GROUND = 1;

// Decoration only: a fixed set of craters (x, z, radius) around the lander, and a seeded rock field. Real south-pole
// craters hold ice in permanent shadow, so the crater floors are tinted as ice; their places are not from data.
const CRATERS: [number, number, number][] = [
  [5.5, -3.2, 2.2], [-6.8, 2.1, 3.0], [2.4, 7.6, 1.6], [-3.1, -8.4, 2.6], [11.5, 4.2, 3.4], [-12.6, -6.1, 2.8],
  [8.2, -11.3, 2.0], [-9.4, 10.8, 3.6], [15.8, -2.6, 2.4], [-2.2, 14.6, 2.2], [3.6, -15.8, 3.0], [-16.4, 1.8, 2.6],
];
/** The ground filter: decorated regolith, the same with ice-tinted crater floors, or the data alone (skyline only). */
export type Surface = "regolith" | "ice" | "data";

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Decoration: a seeded scatter of small craters between the big ones
const SMALL_CRATERS: [number, number, number][] = (() => {
  const r = rand(29);
  return Array.from({ length: 56 }, () => {
    const a = r() * Math.PI * 2;
    const d = 2.4 + r() * 17;
    return [Math.cos(a) * d, Math.sin(a) * d, 0.25 + r() ** 2 * 0.9] as [number, number, number];
  });
})();
const ALL_CRATERS = [...CRATERS, ...SMALL_CRATERS];

/** Decoration: tileable fractal value noise drawn once into a canvas, for regolith grain, rock and foil bumps. */
function noiseTexture(size: number, seed: number, octaves: number, base: number, amp: number, srgb = false) {
  const rnd = rand(seed);
  const layers = Array.from({ length: octaves }, (_, o) => {
    const period = 8 << o;
    return { period, v: Float32Array.from({ length: period * period }, rnd) };
  });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      let w = 1;
      let total = 0;
      for (const { period: P, v } of layers) {
        const fx = (x / size) * P;
        const fy = (y / size) * P;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = sm(fx - ix);
        const ty = sm(fy - iy);
        const at = (i: number, j: number) => v[(j % P) * P + (i % P)];
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
        h += w * (top + (bottom - top) * ty);
        total += w;
        w *= 0.55;
      }
      const val = Math.round(255 * Math.min(1, Math.max(0, base + amp * (h / total - 0.5) * 2)));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = val;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/** The noise textures of the scene, made once and disposed with it. */
function useNoise(size: number, seed: number, octaves: number, base: number, amp: number, srgb = false) {
  const tex = useMemo(() => noiseTexture(size, seed, octaves, base, amp, srgb), [size, seed, octaves, base, amp, srgb]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Decoration: smooth 2D value noise from a lattice hash, about 0..1, with no repeating period. */
function valueNoise(x: number, z: number) {
  const hash = (i: number, j: number) => {
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const i = Math.floor(x);
  const j = Math.floor(z);
  const u = (x - i) ** 2 * (3 - 2 * (x - i));
  const v = (z - j) ** 2 * (3 - 2 * (z - j));
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal sum of valueNoise, about -0.5..0.5; octaves are rotated so lattice lines don't line up. */
function fbm(x: number, z: number, octaves: number) {
  let sum = 0;
  let w = 0.5;
  for (let o = 0; o < octaves; o++) {
    sum += w * (valueNoise(x + o * 17.3, z - o * 9.1) - 0.5);
    [x, z] = [(x * 0.8 - z * 0.6) * 2.03, (x * 0.6 + z * 0.8) * 2.03];
    w *= 0.5;
  }
  return sum * 2;
}

/** Crater relief at (x, z): a bowl below, a raised rim around it. */
function craterRelief(x: number, z: number) {
  let h = 0;
  for (const [cx, cz, rad] of ALL_CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / rad;
    if (d < 1) h -= 0.32 * rad * (1 - d * d);
    h += 0.1 * rad * Math.exp(-(((d - 1) / 0.18) ** 2));
  }
  return h;
}

/**
 * Ground height (y) at radius r and azimuth az. The rim, at RIDGE_R, is exactly the site file's horizon profile; inside
 * it the decoration (bumps, craters) fades out toward the rim, so the far terrain keeps the profile's skyline.
 */
function groundY(horizon: HorizonProfile, azDeg: number, r: number, deco = true) {
  const t = Math.min(1, Math.max(0, (r - 0.6) / (RIDGE_R - 0.6)) ** (1 / 1.4));
  const rim = r * Math.tan((horizonElevationDeg(horizon, azDeg) * Math.PI) / 180);
  const [dx, , dz] = skyDirection(azDeg, 0);
  // Flat pad under the lander
  const pad = Math.min(1, Math.max(0, (r - 1.4) / 1.2));
  // Rolling ground and fine undulation from noise (no period, so no ripples), plus the craters
  const fx = dx * r;
  const fz = dz * r;
  const roll = 0.55 * fbm(fx * 0.12, fz * 0.12, 3) + 0.08 * fbm(fx * 0.8, fz * 0.8, 3);
  const relief = deco ? (roll + craterRelief(fx, fz)) * pad * (1 - t) ** 2 : 0;
  return -GROUND * (1 - t) + rim * t * t + relief;
}

/**
 * The terrain as a lit 3D bowl around the lander: grey regolith, craters with ice-tinted floors, and a rock field
 * (decoration), under a rim that is the site file's horizon profile (so the skyline hides what the terrain hides).
 */
function Terrain({ horizon, meshRef, surface }: { horizon: HorizonProfile; meshRef: RefObject<THREE.Mesh | null>; surface: Surface }) {
  const deco = surface !== "data";
  const geo = useMemo(() => {
    const n = horizon.elevationDeg.length;
    const M = 110;
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const ice = new THREE.Color("#cfe6f7");
    const c = new THREE.Color();
    for (let j = 0; j <= M; j++) {
      const t = j / M;
      const r = 0.6 + (RIDGE_R - 0.6) * t ** 1.4;
      for (let k = 0; k <= n; k++) {
        const az = k * horizon.azimuthStepDeg;
        const [x, , z] = skyDirection(az, 0);
        pos.push(x * r, groundY(horizon, az, r, deco), z * r);
        uv.push(x * r * 0.3, z * r * 0.3);
        // Regolith grey with a little variation; ice in the crater floors (ice filter only). Data only: one flat grey
        const g = deco ? 0.5 + 0.1 * fbm(x * r * 0.09, z * r * 0.09, 3) : 0.42;
        c.setRGB(g, g, g * 1.03);
        const floor = craterRelief(x * r, z * r);
        if (surface === "ice" && floor < -0.12 && t < 0.7) c.lerp(ice, Math.min(1, (-floor - 0.12) * 2.2));
        col.push(c.r, c.g, c.b);
      }
    }
    const index: number[] = [];
    const row = n + 1;
    for (let j = 0; j < M; j++) {
      for (let k = 0; k < n; k++) {
        const a = j * row + k;
        index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [horizon, surface, deco]);
  const edge = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(ridgeGeometry(horizon, RIDGE_R, BELOW_DEG).top, 3));
    return g;
  }, [horizon]);
  // Built by hand, so R3F won't dispose them
  useEffect(
    () => () => {
      geo.dispose();
      edge.dispose();
    },
    [geo, edge],
  );
  const grain = useNoise(512, 3, 6, 0.86, 0.3, true);
  return (
    <>
      <mesh ref={meshRef} geometry={geo} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={deco ? grain : null}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      {deco && <Rocks horizon={horizon} />}
      <line>
        <primitive object={edge} attach="geometry" />
        <lineBasicMaterial color="#c9d3ea" transparent opacity={deco ? 0.35 : 0.9} />
      </line>
    </>
  );
}

/** Decoration: a seeded field of boulders sitting on the ground. */
function Rocks({ horizon }: { horizon: HorizonProfile }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const COUNT = 360;
  const geo = useMemo(() => {
    // Positions only, so the faces share vertices and the jitter leaves no cracks
    const base = new THREE.IcosahedronGeometry(1, 1);
    base.deleteAttribute("normal");
    base.deleteAttribute("uv");
    const g = mergeVertices(base);
    base.dispose();
    const pos = g.attributes.position;
    const rnd = rand(5);
    for (let i = 0; i < pos.count; i++) {
      const k = 0.72 + rnd() * 0.5;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const rnd = rand(11);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < COUNT; i++) {
      const az = rnd() * 360;
      const r = 1.9 + rnd() ** 1.4 * 21;
      const [x, , z] = skyDirection(az, 0);
      const sz = 0.025 + rnd() ** 4 * 0.42;
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      m.compose(new THREE.Vector3(x * r, groundY(horizon, az, r) + sz * 0.35, z * r), q, new THREE.Vector3(sz, sz * (0.6 + rnd() * 0.5), sz));
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [horizon]);
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, COUNT]} castShadow receiveShadow>
      <meshStandardMaterial color="#8a8b90" roughness={1} flatShading />
    </instancedMesh>
  );
}

/** The lander's work lamp: a warm glow on its deck and a pool of light on the ground under it (decoration). */
function LampGlow() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,226,170,0.95)");
    grad.addColorStop(0.35, "rgba(255,200,120,0.35)");
    grad.addColorStop(1, "rgba(255,190,100,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <>
      <sprite position={[0.2, -GROUND + 0.95, 0.25]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial map={tex} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </sprite>
      <mesh position={[0, -GROUND + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 40]} />
        <meshBasicMaterial map={tex} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.55} />
      </mesh>
    </>
  );
}

/** Illustration only (no data): the lander, its antenna tip at the scene origin. */
function Lander() {
  const foil = useNoise(256, 23, 5, 0.5, 1);
  const gold = <meshStandardMaterial color="#c99a3a" metalness={1} roughness={0.3} bumpMap={foil} bumpScale={3} />;
  const steel = <meshStandardMaterial color="#c4cad4" metalness={0.85} roughness={0.35} />;
  const y0 = -GROUND;
  return (
    <group>
      {/* Engine bell and propellant tanks */}
      <mesh position={[0, y0 + 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.17, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.9} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0.3 * side, y0 + 0.5, 0.22 * side]} castShadow>
          <sphereGeometry args={[0.12, 24, 16]} />
          {steel}
        </mesh>
      ))}
      <mesh position={[0, y0 + 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.36, 8, 3]} />
        {gold}
      </mesh>
      <mesh position={[0, y0 + 0.8, 0]} castShadow>
        <boxGeometry args={[0.42, 0.14, 0.42]} />
        {steel}
      </mesh>
      {/* Solar panel */}
      <mesh position={[0.55, y0 + 0.85, 0]} rotation={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[0.5, 0.02, 0.32]} />
        <meshStandardMaterial color="#1d3d8a" metalness={0.4} roughness={0.25} emissive="#0a1a44" />
      </mesh>
      {[0, 1, 2, 3].map((q) => (
        <group key={q} rotation={[0, (q * Math.PI) / 2 + Math.PI / 4, 0]}>
          <mesh position={[0.42, y0 + 0.24, 0]} rotation={[0, 0, 0.5]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.55, 6]} />
            {steel}
          </mesh>
          <mesh position={[0.55, y0 + 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.03, 12]} />
            {steel}
          </mesh>
        </group>
      ))}
      {/* Antenna mast up to the origin, where the elevations in the files are measured from */}
      <mesh position={[0, (y0 + 0.87) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, -(y0 + 0.87), 6]} />
        {steel}
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} castShadow>
        <sphereGeometry args={[0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
        <meshStandardMaterial color="#eef2f8" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshBasicMaterial color="#d9503c" />
      </mesh>
      {/* Lander lights (decoration), drawn as glows rather than light sources: real point lights next to the
          shadow-mapped Sun crashed the software WebGL renderer in testing */}
      <LampGlow />
      <mesh position={[0.36, y0 + 0.62, 0]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color="#ff3b30" />
      </mesh>
      <mesh position={[-0.36, y0 + 0.62, 0]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color="#34d399" />
      </mesh>
    </group>
  );
}

/** The link mask: horizon + minElevationDeg, drawn as a dashed ring just in front of the terrain. */
function MaskRing({ horizon, maskDeg }: { horizon: HorizonProfile; maskDeg: number }) {
  const line = useMemo(() => {
    const g = ridgeGeometry({ ...horizon, elevationDeg: horizon.elevationDeg.map((e) => e + maskDeg) }, RIDGE_R - 0.3, BELOW_DEG);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(g.top, 3));
    const l = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: "#c9d3ea", dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.8 }));
    l.computeLineDistances();
    return l;
  }, [horizon, maskDeg]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** A body's path across the sky over the scenario, as dots on the sky sphere (file az/el; hidden behind the terrain). */
function SkyPath({ points, color }: { points: { azimuthDeg: number; elevationDeg: number }[]; color: string }) {
  const positions = useMemo(() => new Float32Array(points.flatMap((p) => scale(skyDirection(p.azimuthDeg, p.elevationDeg), SKY_R - 0.5))), [points]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.35} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

function Compass() {
  return (
    <>
      {(
        [
          ["N", 0],
          ["E", 90],
          ["S", 180],
          ["W", 270],
        ] as const
      ).map(([label, az]) => (
        <Html key={label} position={scale(skyDirection(az, 1.5), RIDGE_R - 1)} center zIndexRange={[10, 0]}>
          <span className="pointer-events-none select-none font-mono text-xs font-semibold text-muted-foreground">{label}</span>
        </Html>
      ))}
    </>
  );
}

/** A small name tag that follows a body; the numbers are the file values at this sample. */
/** Anchored on the body itself, so it hides exactly when the terrain hides the body. */
function Tag({ body, ridge, liftPx = 22 }: { body: SkyBody; ridge: RefObject<THREE.Mesh | null>; liftPx?: number }) {
  return (
    <Html position={scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R)} center occlude={[ridge as RefObject<THREE.Object3D>]} zIndexRange={[10, 0]}>
      <span
        style={{ transform: `translateY(-${liftPx}px)` }}
        className={`${CHIP} block px-1.5 py-0.5`}
      >
        {body.label} · {body.elevationDeg.toFixed(1)}°
      </span>
    </Html>
  );
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,244,200,1)");
  grad.addColorStop(0.25, "rgba(255,214,120,0.5)");
  grad.addColorStop(1, "rgba(255,200,80,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function Sun({ body }: { body: SkyBody }) {
  const glow = useMemo(() => glowTexture(), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const p = scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R);
  return (
    <group position={p}>
      <sprite scale={[9, 9, 1]}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial color="#fff6d6" />
      </mesh>
    </group>
  );
}

function Earth({ body }: { body: SkyBody }) {
  const p = scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R);
  return (
    <mesh position={p}>
      <sphereGeometry args={[1.5, 32, 32]} />
      <meshStandardMaterial color="#3a7bc8" roughness={0.85} emissive="#0b2342" />
    </mesh>
  );
}

/** A glowing beam from the lander's antenna (the origin) to a body. */
function Ray({ body, color }: { body: SkyBody; color: string }) {
  const { mid, q } = useMemo(() => {
    const d = new THREE.Vector3(...skyDirection(body.azimuthDeg, body.elevationDeg));
    return { mid: d.clone().multiplyScalar(SKY_R / 2), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d) };
  }, [body.azimuthDeg, body.elevationDeg]);
  return (
    <mesh position={mid} quaternion={q} scale={[0.03, SKY_R, 0.03]}>
      <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

/** Styled by the complete path only (§5): no per-leg look, so a relay that sees Earth but not the lander looks unlinked. */
function Satellite({ body, link, visible }: { body: SkyBody; link: boolean | null; visible: boolean }) {
  const p = scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R);
  const color = link === null ? C.idle : link ? C.relay : C.blocked;
  return (
    <>
      <mesh position={p} visible={visible}>
        <octahedronGeometry args={[link ? 0.9 : 0.6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {link !== null && (link || visible) && <Ray body={body} color={color} />}
    </>
  );
}

/**
 * The camera and controls for the chosen view. Only this part is rebuilt on a view change, never the Canvas: its drei
 * Html labels live outside React's DOM tree, and remounting the Canvas made React fail removing them (the page froze).
 */
function ViewRig({ cam, start, fov }: { cam: boolean; start: Vec3; fov: number }) {
  return <CameraFor key={cam ? "lander" : "chase"} cam={cam} start={start} fov={fov} />;
}

function CameraFor({ cam, start, fov }: { cam: boolean; start: Vec3; fov: number }) {
  // Frozen at the view's first render: `start` follows the replay's look direction every tick, and the user's drag must stay
  const [position] = useState(start);
  return (
    <>
      <PerspectiveCamera makeDefault position={position} fov={fov} near={0.01} far={300} />
      {cam ? (
        <OrbitControls target={[0, 0, 0]} enableZoom={false} enablePan={false} rotateSpeed={-0.45} minPolarAngle={Math.PI / 2 - 0.25} maxPolarAngle={Math.PI - 0.05} />
      ) : (
        <OrbitControls target={[0, -0.5, 0]} enablePan={false} minDistance={2.5} maxDistance={30} minPolarAngle={0.15} maxPolarAngle={Math.PI / 2 - 0.03} />
      )}
    </>
  );
}

export default function SkyScene({
  horizon,
  minElevationDeg,
  bodies,
  links,
  lookAzimuthDeg,
  view = "chase",
  surface = "ice",
  active = true,
  paths,
}: {
  horizon: HorizonProfile;
  minElevationDeg: number;
  bodies: SkyBody[];
  /** body id -> path state from network.ts; null when no result exists yet */
  links: Record<string, boolean> | null;
  lookAzimuthDeg: number;
  /** chase: behind the lander; lander: from its mast, the point the file's elevations are measured from */
  view?: "chase" | "lander";
  surface?: Surface;
  /** false while its stage tab is hidden: no frames are drawn */
  active?: boolean;
  /** Earth's and the Sun's directions over the scenario (file values), drawn as dotted paths on the sky */
  paths?: { earth: { azimuthDeg: number; elevationDeg: number }[]; sun: { azimuthDeg: number; elevationDeg: number }[] };
}) {
  const ridge = useRef<THREE.Mesh>(null);
  const sun = bodies.find((b) => b.kind === "sun");
  const earth = bodies.find((b) => b.kind === "earth");
  const sunDir: Vec3 = sun ? skyDirection(sun.azimuthDeg, Math.max(sun.elevationDeg, 0.5)) : [0, 1, 0];
  // Sunlight only while the file's Sun is over the terrain; otherwise a faint bluish fill (decoration)
  const sunUp = !!sun && overRidge(horizon, sun);
  // Third-person camera: behind the lander, looking toward lookAzimuthDeg over it
  const [lx, , lz] = skyDirection(lookAzimuthDeg, 0);
  const cam = view === "lander";
  // Lander cam: a tiny radius around the mast tip, so OrbitControls turns it into a look-around
  const start: Vec3 = cam ? scale(skyDirection(lookAzimuthDeg, 12), -0.01) : [-lx * 4.5, 1.3, -lz * 4.5];
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      shadows="soft"
      camera={{ position: start, fov: cam ? 64 : 55, near: 0.01, far: 300 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      aria-label="3D view of the lander on the terrain, with the Sun, Earth and relay satellites where the data files put them"
    >
      <color attach="background" args={["#070b14"]} />
      {/* No air, so almost no fill: a faint Earthshine-blue sky light (decoration); brighter when the Sun is down so the scene stays readable */}
      <hemisphereLight args={[sunUp ? "#9fb2d8" : "#6f8fd0", "#141619", sunUp ? 0.14 : 0.32]} />
      <directionalLight
        position={scale(sunDir, 30)}
        intensity={sunUp ? 3.6 : 0}
        color="#fff6e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={80}
      />
      {/* Reflections for the lander's metal and foil (decoration): two soft panels, rendered once */}
      <Environment resolution={64} environmentIntensity={0.5}>
        <Lightformer intensity={3} color="#fff1dc" position={[6, 5, -6]} scale={[10, 4, 1]} />
        <Lightformer intensity={0.6} color="#6f9be8" position={[-6, 3, 6]} scale={[8, 8, 1]} />
      </Environment>
      <Stars />
      <Terrain horizon={horizon} meshRef={ridge} surface={surface} />
      {!cam && <Lander />}
      {minElevationDeg > 0 && <MaskRing horizon={horizon} maskDeg={minElevationDeg} />}
      <Compass />
      {paths && <SkyPath points={paths.earth} color={C.direct} />}
      {paths && <SkyPath points={paths.sun} color="#b8871f" />}
      {sun && overRidge(horizon, sun, DISK_MARGIN_DEG) && (
        <>
          <Sun body={sun} />
          <Tag body={sun} ridge={ridge} liftPx={34} />
        </>
      )}
      {earth && overRidge(horizon, earth, DISK_MARGIN_DEG) && (
        <>
          <Earth body={earth} />
          <Tag body={earth} ridge={ridge} />
        </>
      )}
      {bodies
        .filter((b) => b.kind === "satellite")
        .map((b) => {
          const visible = overRidge(horizon, b);
          return (
            <group key={b.id}>
              <Satellite body={b} link={links ? (links[b.id] ?? false) : null} visible={visible} />
              {visible && <Tag body={b} ridge={ridge} liftPx={18} />}
            </group>
          );
        })}
      {/* A clear direct path is always drawn (it can be below 0° over low terrain); a blocked one only when Earth is over the ridge */}
      {earth && links && (links.earth || overRidge(horizon, earth)) && <Ray body={earth} color={links.earth ? C.direct : C.blocked} />}
      <ViewRig cam={cam} start={start} fov={cam ? 64 : 55} />
    </Canvas>
  );
}
