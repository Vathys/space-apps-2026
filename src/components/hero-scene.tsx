"use client";

import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { compressAltitude, dirFromSite, dirToScene, fixedFromLatLon, siteFrame, toScene, type RelayTrack, type Vec3 } from "@/lib/lunanav/moon";

// The 3D Moon first look, after the team pitch: NASA LROC colour, LOLA south-pole relief, south pole up, the sites
// from index.json, and the Sun and Earth where the site file puts them at the scenario start. Decoration (D-21): every
// position comes from the data files, and the beam colour comes from the analysis result; nothing is computed here.

export interface HeroSite {
  id: string;
  name: string;
  latDeg: number;
  lonEastDeg: number;
}

/** What the selected site sees at the first sample of the chosen scenario (file values) */
export interface HeroSky {
  earthAzDeg: number;
  earthElDeg: number;
  sunAzDeg: number;
  sunElDeg: number;
  /** Direct-to-Earth line of sight at that sample, from the analysis; null before a result exists */
  dte: boolean | null;
  /** The selected relay config's satellites; `linked` is the complete path at that sample, null before a result */
  relays: (RelayTrack & { linked: boolean | null })[];
}

// shortcut: relay heights are shrunk to this fraction so the 19,000 km apolune fits the frame; directions from the Moon's
// centre are exact. Upgrade: a true-scale camera mode if judges ask for real distances.
const ALT_SCALE = 0.15;
const orbitPoint = (p: Vec3) => V(toScene(compressAltitude(p, ALT_SCALE)));

const PR = 0.3; // radius of the polar relief patch in scene units (≈ 8.6° of latitude around the pole)
const V = (v: Vec3) => new THREE.Vector3(...v);

/** A texture of our own from a loaded image, so the loader's cached object is never changed during render. */
function useImageTexture(url: string, { flipY = true, srgb = false }: { flipY?: boolean; srgb?: boolean }) {
  const img = useLoader(THREE.ImageLoader, url);
  return useMemo(() => {
    const t = new THREE.Texture(img);
    t.flipY = flipY;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [img, flipY, srgb]);
}

/** The LROC mosaic pinches into streaks near the pole: fade the south cap to the 70–74° S band average (as the pitch does). */
function useMoonTexture() {
  const img = useLoader(THREE.ImageLoader, "/textures/moon-lroc.jpg");
  return useMemo(() => {
    const c = document.createElement("canvas");
    const W = (c.width = img.width);
    const H = (c.height = img.height);
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const im = g.getImageData(0, 0, W, H);
    const d = im.data;
    const row = (lat: number) => Math.round(((90 - lat) / 180) * H);
    const avg = [0, 0, 0];
    let n = 0;
    for (let y = row(-70); y < row(-74); y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        avg[0] += d[i]!;
        avg[1] += d[i + 1]!;
        avg[2] += d[i + 2]!;
        n++;
      }
    for (let y = row(-72); y < H; y++) {
      const lat = 90 - (y / H) * 180;
      const t0 = Math.min(1, Math.max(0, (-72 - lat) / 9));
      const t = t0 * t0 * (3 - 2 * t0);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) d[i + k] = d[i + k]! * (1 - t) + (avg[k]! / n) * t;
      }
    }
    g.putImageData(im, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { tex, cap: new THREE.Color(avg[0]! / n / 255, avg[1]! / n / 255, avg[2]! / n / 255).convertSRGBToLinear() };
  }, [img]);
}

function Moon() {
  const { tex, cap } = useMoonTexture();
  // The relief maps are laid out on the patch's own UVs (not flipped), as baked for the pitch
  const normal = useImageTexture("/textures/pole-normal.jpg", { flipY: false });
  const occlusion = useImageTexture("/textures/pole-occlusion.jpg", { flipY: false, srgb: true });
  const patch = useMemo(() => {
    // A disc on the sphere around the south pole (scene +y), with UVs on the scene x/z plane, as the relief maps expect
    const NR = 60;
    const NS = 180;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NR; i++) {
      const r = PR * (i / NR);
      for (let j = 0; j <= NS; j++) {
        const a = (j / NS) * Math.PI * 2;
        const x = r * Math.cos(a);
        const z = r * Math.sin(a);
        const v = new THREE.Vector3(x, 2, z).normalize().multiplyScalar(2.002);
        pos.push(v.x, v.y, v.z);
        uv.push((x / PR + 1) / 2, (z / PR + 1) / 2);
      }
    }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NS; j++) {
        const a = i * (NS + 1) + j;
        const b = a + NS + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // Soft edge, so the relief patch melts into the mosaic
    const fade = document.createElement("canvas");
    fade.width = fade.height = 256;
    const fg = fade.getContext("2d")!;
    const gr = fg.createRadialGradient(128, 128, 90, 128, 128, 128);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(1, "#000");
    fg.fillStyle = gr;
    fg.fillRect(0, 0, 256, 256);
    return { geo, alpha: new THREE.CanvasTexture(fade) };
  }, []);
  return (
    <>
      {/* SphereGeometry has north on +y; turned 180° about x, north is −y and the south pole points up */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[2, 160, 120]} />
        <meshStandardMaterial map={tex} bumpMap={tex} bumpScale={0.004} roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={patch.geo}>
        <meshStandardMaterial map={occlusion} normalMap={normal} color={cap.clone().multiplyScalar(2.2)} alphaMap={patch.alpha} transparent roughness={1} metalness={0} />
      </mesh>
    </>
  );
}

function Graticule() {
  const lines = useMemo(() => {
    const out: THREE.Line[] = [];
    const mat = new THREE.LineBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.18 });
    const at = (lat: number, lon: number) => V(toScene(fixedFromLatLon(lat, lon))).multiplyScalar(1.003);
    for (const lat of [-30, -50, -70, -80, -85]) {
      const p: THREE.Vector3[] = [];
      for (let k = 0; k <= 240; k++) p.push(at(lat, k * 1.5));
      out.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), mat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const p: THREE.Vector3[] = [];
      for (let lat = -10; lat >= -86; lat -= 1) p.push(at(lat, lon));
      out.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), mat));
    }
    return out;
  }, []);
  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  );
}

function Label({ at, text, color }: { at: THREE.Vector3; text: string; color: string }) {
  return (
    <Html position={at} center zIndexRange={[10, 0]}>
      <span className="pointer-events-none flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#0d1730]/90 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-[#e9efff] uppercase">
        <i className="inline-block size-[7px]" style={{ background: color }} />
        {text}
      </span>
    </Html>
  );
}

function Pin({ site, selected }: { site: HeroSite; selected: boolean }) {
  const up = V(dirToScene(siteFrame(site.latDeg, site.lonEastDeg).up));
  const base = V(toScene(fixedFromLatLon(site.latDeg, site.lonEastDeg)));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const h = selected ? 0.32 : 0.22;
  return (
    <group position={base} quaternion={q}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, h, 8]} />
        <meshBasicMaterial color={selected ? "#ff5b3d" : "#8d99b6"} />
      </mesh>
      <mesh position={[0, h, 0]}>
        <sphereGeometry args={[selected ? 0.03 : 0.022, 16, 12]} />
        <meshBasicMaterial color={selected ? "#ff5b3d" : "#8d99b6"} />
      </mesh>
    </group>
  );
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,226,150,1)");
  gr.addColorStop(0.25, "rgba(255,196,80,.55)");
  gr.addColorStop(1, "rgba(255,196,80,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function SkyBodies({ site, sky }: { site: HeroSite; sky: HeroSky }) {
  const earthTex = useImageTexture("/textures/earth-blue-marble.jpg", { srgb: true });
  const glow = useMemo(() => glowTexture(), []);
  const frame = siteFrame(site.latDeg, site.lonEastDeg);
  const pin = V(toScene(fixedFromLatLon(site.latDeg, site.lonEastDeg))).add(V(dirToScene(frame.up)).multiplyScalar(0.32));
  // Directions from the site file; distances are for the picture only (not to scale)
  const earthDir = V(dirToScene(dirFromSite(frame, sky.earthAzDeg, sky.earthElDeg)));
  const sunDir = V(dirToScene(dirFromSite(frame, sky.sunAzDeg, sky.sunElDeg)));
  const earth = pin.clone().addScaledVector(earthDir, 3.3);
  const sun = pin.clone().addScaledVector(sunDir, 60);
  const d = earth.clone().sub(pin);
  const beam = { mid: pin.clone().addScaledVector(d, 0.5), L: d.length(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()) };
  return (
    <>
      <directionalLight position={sunDir.clone().multiplyScalar(30)} intensity={2.4} color="#fff4e4" />
      <mesh position={earth}>
        <sphereGeometry args={[0.42, 48, 32]} />
        <meshStandardMaterial map={earthTex} roughness={0.55} emissive="#0d2c66" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={earth}>
        <sphereGeometry args={[0.46, 48, 32]} />
        <meshBasicMaterial color="#6fa4ff" transparent opacity={0.2} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <sprite position={sun} scale={[16, 16, 1]}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </sprite>
      {sky.dte !== null && (
        <mesh position={beam.mid} quaternion={beam.q} scale={[0.012, beam.L, 0.012]}>
          <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
          <meshBasicMaterial color={sky.dte ? "#5b98ff" : "#ff5b3d"} transparent opacity={0.85} />
        </mesh>
      )}
      <Label at={earth.clone().add(new THREE.Vector3(0, 0.7, 0))} text="Earth" color="#5b98ff" />
      <Label at={sun.clone().add(new THREE.Vector3(0, 3, 0))} text="Sun" color="#f3b73a" />
    </>
  );
}

/** Each satellite's orbit over one period from the scenario start, and where it is at that start. Heights not to scale. */
function Relays({ relays }: { relays: HeroSky["relays"] }) {
  const lines = useMemo(
    () =>
      relays.map((r) => {
        const color = r.linked === null ? "#8d99b6" : r.linked ? "#2fd3a3" : "#ff5b3d";
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
        return { r, color, now: orbitPoint(r.nowKm), line: new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.trackKm.map(orbitPoint)), mat) };
      }),
    [relays],
  );
  return (
    <>
      {lines.map(({ r, color, now, line }) => (
        <group key={r.id}>
          <primitive object={line} />
          <mesh position={now}>
            <octahedronGeometry args={[0.07]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Label at={now.clone().add(new THREE.Vector3(0, 0.25, 0))} text={r.name} color={color} />
        </group>
      ))}
    </>
  );
}

function Stars() {
  const positions = useMemo(() => {
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const p = new Float32Array(2200 * 3);
    for (let i = 0; i < 2200; i++) {
      const u = rnd() * 2 - 1;
      const t = rnd() * 2 * Math.PI;
      const s = Math.sqrt(1 - u * u);
      p.set([500 * s * Math.cos(t), 500 * u, 500 * s * Math.sin(t)], i * 3);
    }
    return p;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#dfe8ff" size={1.6} sizeAttenuation={false} transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

/** Frame the Moon to the right of the text on wide screens, under it on narrow ones. */
function Rig({ animate }: { animate: boolean }) {
  const narrow = useThree((s) => s.size.width / s.size.height < 0.9);
  const target: Vec3 = narrow ? [0, 3.4, 0] : [-1.9, 0.6, 0];
  return (
    <OrbitControls
      target={target}
      enablePan={false}
      enableZoom
      minDistance={4}
      maxDistance={16}
      autoRotate={animate}
      autoRotateSpeed={0.35}
      maxPolarAngle={Math.PI * 0.62}
    />
  );
}

export default function HeroScene({ animate, sites, selectedId, sky }: { animate: boolean; sites: HeroSite[]; selectedId: string | null; sky: HeroSky | null }) {
  const selected = sites.find((s) => s.id === selectedId) ?? null;
  return (
    <Canvas
      camera={{ position: [-1.9, 5.2, 8.2], fov: 36, near: 0.01, far: 800 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
      frameloop={animate ? "always" : "demand"}
      aria-label="Three-dimensional Moon with the south pole facing up, the landing sites, Earth, the Sun and the selected relay satellites' orbits. Drag to rotate."
    >
      <hemisphereLight args={["#f4f7fb", "#3a4560", 0.55]} />
      <Stars />
      {/* The textures load in the background; the stars and controls are there from the first frame */}
      <Suspense fallback={null}>
          <Moon />
          <Graticule />
          {sites.map((s) => (
            <Pin key={s.id} site={s} selected={s.id === selectedId} />
          ))}
          {selected && <Label at={V(toScene(fixedFromLatLon(selected.latDeg, selected.lonEastDeg))).multiplyScalar(1.22)} text={selected.name} color="#ff5b3d" />}
          {selected && sky && <SkyBodies site={selected} sky={sky} />}
          {selected && sky && <Relays relays={sky.relays} />}
      </Suspense>
      <Rig animate={animate} />
    </Canvas>
  );
}
