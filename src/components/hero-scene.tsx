"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { LINK_3D } from "@/components/link-state";
import { SceneZoom, type ZoomSignal } from "@/components/scene-zoom";
import { DESCENT_S } from "@/components/story-timing";
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

/** What the selected site sees at the replay's current sample (file values) */
export interface HeroSky {
  earthAzDeg: number;
  earthElDeg: number;
  sunAzDeg: number;
  sunElDeg: number;
  /** Direct-to-Earth line of sight at that sample, from the analysis; null before a result exists */
  dte: boolean | null;
  /**
   * The selected relay config's satellites: a track (stable between replay days, so it isn't rebuilt every tick),
   * the position now, and `linked`, the complete path at that sample (null before a result)
   */
  relays: (RelayTrack & { nowKm: Vec3; linked: boolean | null })[];
}

const LINK = LINK_3D;

// shortcut: relay heights are shrunk to this fraction so the 19,000 km apolune fits the frame; directions from the Moon's
// centre are exact. Upgrade: a true-scale camera mode if judges ask for real distances.
const ALT_SCALE = 0.15;
const orbitPoint = (p: Vec3) => V(toScene(compressAltitude(p, ALT_SCALE)));

// The lander (illustration, no data): beams leave its antenna tip; it descends from this height over DESCENT_S
const LANDER_TOP = 0.16; // in model units, before LANDER_SCALE
const LANDER_SCALE = 1.6; // not to scale: big enough to see from the hero camera
const DESCENT_FROM = 2.2;
// Powered descent in three phases, like real landers (Apollo, CLPS, Artemis HLS): a braking burn from orbit with the
// engine facing the direction of travel, a pitch-over to upright, then a slow vertical terminal descent
const COME_FROM = 1.8; // horizontal start offset in scene units
const BRAKE_TILT = -1.2; // rad about the local z axis during braking: the engine points along the travel (−x)

const PR = 0.3; // radius of the polar relief patch in scene units (≈ 8.6° of latitude around the pole)
const V = (v: Vec3) => new THREE.Vector3(...v);
const MOON_R = 2; // scene units (SCENE_PER_KM)

// N and S hang off the poles, E and W sit on the equator at 90° E and 90° W (east-positive longitude). Built once.
// The S chip is left out while a site is selected: the site's own label says "south pole" (they would overlap).
const COMPASS = (
  [
    ["S · south pole", -90, 0, 1.45],
    ["N", 90, 0, 1.45],
    ["E", 0, 90, 1.12],
    ["W", 0, -90, 1.12],
  ] as const
).map(([text, lat, lon, out]) => ({ text, at: V(toScene(fixedFromLatLon(lat, lon))).multiplyScalar(out) }));
const camLocal = new THREE.Vector3();
const toLabel = new THREE.Vector3();

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
      <span className="pointer-events-none flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#0e1524]/90 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-[#e8edf6] uppercase">
        <i className="inline-block size-[7px]" style={{ background: color }} />
        {text}
      </span>
    </Html>
  );
}

/**
 * A compass letter on the Moon. It fades out while the globe is between it and the camera (an Html label is drawn
 * over the globe otherwise, pointing the wrong way). The Moon sits at the scene origin, untransformed.
 */
function CompassLabel({ text, at }: { text: string; at: THREE.Vector3 }) {
  const box = useRef<HTMLSpanElement>(null);
  const shown = useRef<boolean | null>(null);
  useFrame(({ camera }) => {
    if (!box.current) return;
    // Closest point to the Moon's centre on the segment camera → label: inside the sphere means hidden
    camLocal.copy(camera.position);
    toLabel.copy(at).sub(camLocal);
    const t = THREE.MathUtils.clamp(-camLocal.dot(toLabel) / toLabel.lengthSq(), 0, 1);
    const visible = camLocal.addScaledVector(toLabel, t).length() > MOON_R;
    if (shown.current === visible) return;
    shown.current = visible;
    box.current.style.opacity = visible ? "1" : "0";
  });
  return (
    <Html position={at} center zIndexRange={[10, 0]}>
      <span ref={box} className="pointer-events-none flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#0e1524]/90 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-[#e8edf6] uppercase transition-opacity">
        <i className="inline-block size-[7px]" style={{ background: "#93a0b8" }} />
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
        <meshBasicMaterial color={selected ? "#d9503c" : "#93a0b8"} />
      </mesh>
      <mesh position={[0, h, 0]}>
        <sphereGeometry args={[selected ? 0.03 : 0.022, 16, 12]} />
        <meshBasicMaterial color={selected ? "#d9503c" : "#93a0b8"} />
      </mesh>
    </group>
  );
}

/**
 * Illustration only (no data): the lander comes in from orbit on a braking burn, pitches upright, descends vertically
 * onto the selected site with its engine lit, and kicks up a ring of dust at touchdown.
 * Remounted per site (keyed), so a new site gets a new landing. Without animation it is shown landed.
 */
function Lander({ site, animate, onLanded, startMs }: { site: HeroSite; animate: boolean; onLanded: () => void; startMs: RefObject<number> }) {
  const up = V(dirToScene(siteFrame(site.latDeg, site.lonEastDeg).up));
  const base = V(toScene(fixedFromLatLon(site.latDeg, site.lonEastDeg)));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const body = useRef<THREE.Group>(null);
  const plume = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Mesh>(null);
  const dustT0 = useRef<number | null>(null);
  const done = useRef(false);
  const land = useCallback(() => {
    if (body.current) {
      body.current.position.set(0, 0, 0);
      body.current.rotation.z = 0;
    }
    if (plume.current) plume.current.visible = false;
    if (!done.current) {
      done.current = true;
      onLanded();
    }
  }, [onLanded]);
  // Start high before the first frame (set once here, not as a prop, so replay re-renders don't reset it)
  useLayoutEffect(() => {
    if (body.current) {
      body.current.position.set(COME_FROM, DESCENT_FROM, 0);
      body.current.rotation.z = BRAKE_TILT;
    }
  }, []);
  // No animation (reduced motion, or scrolled away mid-descent): show it landed
  useEffect(() => {
    if (!animate) land();
  }, [animate, land]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Touchdown dust: a ring of regolith blown out by the engine, spreading and fading (runs on after landing)
    if (dust.current && dustT0.current !== null) {
      const a = (t - dustT0.current) / 1.5;
      dust.current.visible = a < 1;
      dust.current.scale.setScalar(0.6 + 2.6 * a);
      (dust.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - a);
    }
    if (done.current || !body.current || !plume.current) return;
    // Timed from when the landing started, not from this first frame: the textures may have loaded late
    const k = Math.min(1, (performance.now() - startMs.current) / 1000 / DESCENT_S);
    // Braking: the horizontal speed bleeds off by 60% of the descent; height falls fast first, slowly at the end
    body.current.position.set(COME_FROM * (1 - THREE.MathUtils.smoothstep(k, 0, 0.6)), DESCENT_FROM * (1 - k) ** 2, 0);
    // Pitch-over from the braking attitude to upright between 35% and 65%, then the vertical terminal descent
    body.current.rotation.z = BRAKE_TILT * (1 - THREE.MathUtils.smoothstep(k, 0.35, 0.65));
    plume.current.scale.set(1, 0.5 + 1.8 * (1 - THREE.MathUtils.smoothstep(k, 0.5, 1)), 1); // full thrust braking, throttled down near the ground
    if (k > 0.9 && dustT0.current === null) dustT0.current = t;
    if (k >= 1) land();
  });
  const gold = <meshStandardMaterial color="#d8b45a" metalness={0.7} roughness={0.35} />;
  return (
    <group position={base} quaternion={q}>
      <group ref={body}>
       <group scale={LANDER_SCALE}>
        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[0.07, 0.05, 0.07]} />
          {gold}
        </mesh>
        {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => (
          <group key={`${x}${z}`}>
            <mesh position={[0.045 * x, 0.03, 0.045 * z]}>
              <cylinderGeometry args={[0.004, 0.004, 0.06, 6]} />
              <meshStandardMaterial color="#c8ced8" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0.05 * x, 0.002, 0.05 * z]}>
              <cylinderGeometry args={[0.012, 0.012, 0.004, 10]} />
              <meshStandardMaterial color="#c8ced8" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, (0.1 + LANDER_TOP) / 2, 0]}>
          <cylinderGeometry args={[0.003, 0.003, LANDER_TOP - 0.1, 6]} />
          <meshStandardMaterial color="#e8edf6" />
        </mesh>
        <mesh position={[0, LANDER_TOP, 0]}>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshBasicMaterial color="#d9503c" />
        </mesh>
        {/* Engine plume: cone pointing down from under the body; its length shrinks as the lander slows */}
        <mesh ref={plume} position={[0, 0.05, 0]}>
          <coneGeometry args={[0.022, 0.09, 12, 1, true]} />
          <meshBasicMaterial color="#ffb347" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
       </group>
      </group>
      <mesh ref={dust} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.05, 0.12, 40]} />
        <meshBasicMaterial color="#cfc6b6" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
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

/** The pin top, Earth and Sun in the scene. Directions from the site file; distances are for the picture only (not to scale). */
function skyPoints(site: HeroSite, sky: HeroSky) {
  const frame = siteFrame(site.latDeg, site.lonEastDeg);
  const pin = V(toScene(fixedFromLatLon(site.latDeg, site.lonEastDeg))).add(V(dirToScene(frame.up)).multiplyScalar(LANDER_TOP * LANDER_SCALE));
  const earthDir = V(dirToScene(dirFromSite(frame, sky.earthAzDeg, sky.earthElDeg)));
  const sunDir = V(dirToScene(dirFromSite(frame, sky.sunAzDeg, sky.sunElDeg)));
  return { pin, earth: pin.clone().addScaledVector(earthDir, 2.8), sun: pin.clone().addScaledVector(sunDir, 60), sunDir };
}

/** A link drawn as a thin glowing tube from `a` to `b`. */
function Beam({ a, b, color, width = 0.012, opacity = 0.85 }: { a: THREE.Vector3; b: THREE.Vector3; color: string; width?: number; opacity?: number }) {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={a.clone().addScaledVector(d, 0.5)} quaternion={q} scale={[width, d.length(), width]}>
      <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function SkyBodies({ site, sky, landed }: { site: HeroSite; sky: HeroSky; landed: boolean }) {
  const earthTex = useImageTexture("/textures/earth-blue-marble.jpg", { srgb: true });
  const glow = useMemo(() => glowTexture(), []);
  const { pin, earth, sun, sunDir } = skyPoints(site, sky);
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
      {landed && sky.dte !== null && <Beam a={pin} b={earth} color={sky.dte ? LINK.direct : LINK.blocked} />}
      <Label at={earth.clone().add(new THREE.Vector3(0, 0.7, 0))} text="Earth" color="#4a86f0" />
      <Label at={sun.clone().add(new THREE.Vector3(0, 3, 0))} text="Sun" color="#b8871f" />
    </>
  );
}

/** One orbit track; the buffer is rebuilt only when the page hands over a new track (once per replay day). */
function Orbit({ trackKm, color }: { trackKm: Vec3[]; color: string }) {
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(trackKm.flatMap((p) => orbitPoint(p).toArray()), 3)),
    [trackKm],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.55} />
    </line>
  );
}

/**
 * Each satellite on its orbit at the replay time. Heights not to scale. A complete relay path (§5: complete paths only,
 * no per-leg look) is drawn as lander → satellite → Earth beams.
 */
function Relays({ site, sky, landed }: { site: HeroSite; sky: HeroSky; landed: boolean }) {
  const { pin, earth } = skyPoints(site, sky);
  return (
    <>
      {sky.relays.map((r) => {
        const color = r.linked === null ? LINK.idle : r.linked ? LINK.relay : LINK.blocked;
        const now = orbitPoint(r.nowKm);
        return (
          <group key={r.id}>
            <Orbit trackKm={r.trackKm} color={color} />
            <mesh position={now}>
              <octahedronGeometry args={[r.linked ? 0.09 : 0.06]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {landed && r.linked && (
              <>
                {/* Thinner than the DTE beam: with several relays linked at once, the scene stays readable */}
                <Beam a={pin} b={now} color={LINK.relay} width={0.006} opacity={0.6} />
                <Beam a={now} b={earth} color={LINK.relay} width={0.006} opacity={0.35} />
              </>
            )}
            <Label at={now.clone().add(new THREE.Vector3(0, 0.25, 0))} text={r.name} color={color} />
          </group>
        );
      })}
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
  const target: Vec3 = narrow ? [0, 1.2, 0] : [0, 0.4, 0];
  return (
    <OrbitControls
      makeDefault
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

export default function HeroScene({
  animate,
  sites,
  selectedId,
  sky,
  landingKey = 0,
  zoom = null,
}: {
  animate: boolean;
  sites: HeroSite[];
  selectedId: string | null;
  sky: HeroSky | null;
  /** Bump to land again (the story's touchdown) */
  landingKey?: number;
  /** The stage's + / − buttons */
  zoom?: ZoomSignal;
}) {
  const selected = sites.find((s) => s.id === selectedId) ?? null;
  // Links come up only once the lander has touched down at the selected site
  const [landedAt, setLandedAt] = useState<string | null>(null);
  const landingId = `${selectedId}#${landingKey}`;
  const landed = !!selected && landedAt === landingId;
  const onLanded = useCallback(() => setLandedAt(landingId), [landingId]);
  // The landing clock starts with the landing (a new site or the story's touchdown), outside the textures' Suspense
  const landingStartMs = useRef(0);
  useEffect(() => {
    landingStartMs.current = performance.now();
  }, [landingId]);
  return (
    <Canvas
      camera={{ position: [-1.9, 5.2, 8.2], fov: 36, near: 0.01, far: 800 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true }}
      frameloop={animate ? "always" : "demand"}
      aria-label="Three-dimensional Moon with the south pole facing up, the landing sites, Earth, the Sun and the selected relay satellites' orbits. Drag to rotate."
    >
      <hemisphereLight args={["#f4f7fb", "#2a3350", 0.45]} />
      <Stars />
      <SceneZoom signal={zoom} />
      {/* The textures load in the background; the stars and controls are there from the first frame */}
      <Suspense fallback={null}>
          <Moon />
          <Graticule />
          {sites.map((s) => (s.id === selectedId ? <Lander key={`${s.id}#${landingKey}`} site={s} animate={animate} onLanded={onLanded} startMs={landingStartMs} /> : <Pin key={s.id} site={s} selected={false} />))}
          {/* Compass on the Moon: the scene has the south pole up, so a top-of-the-globe landing reads as north otherwise */}
          {COMPASS.filter((c) => !(selected && c.text.startsWith("S"))).map((c) => (
            <CompassLabel key={c.text} text={c.text} at={c.at} />
          ))}
          {selected && <Label at={V(toScene(fixedFromLatLon(selected.latDeg, selected.lonEastDeg))).multiplyScalar(1.22)} text={`${landed ? "" : "Landing · "}${selected.name} · south pole`} color="#d9503c" />}
          {selected && sky && <SkyBodies site={selected} sky={sky} landed={landed} />}
          {selected && sky && <Relays site={selected} sky={sky} landed={landed} />}
      </Suspense>
      <Rig animate={animate} />
    </Canvas>
  );
}
