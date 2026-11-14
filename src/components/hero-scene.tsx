"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// Decoration only (D-21): an illustrative Moon, Earth, Sun and relay orbit for the first look.
// Not to scale and not data: no number in the app comes from this scene.

/** Small deterministic PRNG, so the procedural surfaces look the same on every load. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Procedural lunar surface (equirectangular): grey regolith, dark maria, craters. No external image, so no licence. */
function moonCanvas() {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const r = rng(11);
  g.fillStyle = "#8d8f95";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 120 + Math.floor(r() * 50);
    g.fillStyle = `rgba(${v},${v},${v + 4},0.18)`;
    g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
  }
  for (let i = 0; i < 14; i++) {
    const x = r() * w;
    const y = h * (0.25 + r() * 0.5);
    const rad = 40 + r() * 110;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, "rgba(58,60,66,0.55)");
    grad.addColorStop(1, "rgba(58,60,66,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, rad * 1.4, rad, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Craters: a power-law of sizes (many small, few large), each a soft darker floor with a faint bright rim
  for (let i = 0; i < 1400; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = Math.pow(r(), 4) * 34 + 1;
    const floor = g.createRadialGradient(x + rad * 0.2, y + rad * 0.2, rad * 0.1, x, y, rad);
    floor.addColorStop(0, "rgba(52,54,60,0.28)");
    floor.addColorStop(0.75, "rgba(70,72,78,0.18)");
    floor.addColorStop(1, "rgba(70,72,78,0)");
    g.fillStyle = floor;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    if (rad > 4) {
      g.strokeStyle = "rgba(214,216,222,0.16)";
      g.lineWidth = Math.max(1, rad * 0.12);
      g.beginPath();
      g.arc(x, y, rad * 0.95, Math.PI * 0.9, Math.PI * 1.9);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Procedural Earth: ocean, a few continents, clouds. Illustrative only. */
function earthCanvas() {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const r = rng(5);
  g.fillStyle = "#1d4f91";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#3f7d4a";
  for (let i = 0; i < 7; i++) {
    const x = r() * w;
    const y = h * (0.2 + r() * 0.6);
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * 70, y + (r() - 0.5) * 40, 10 + r() * 30, 8 + r() * 18, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 60; i++) {
    g.beginPath();
    g.ellipse(r() * w, r() * h, 12 + r() * 40, 2 + r() * 5, (r() - 0.5) * 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#f2f5f8";
  g.fillRect(0, 0, w, 12);
  g.fillRect(0, h - 12, w, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowCanvas(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.2, outer);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function Stars() {
  const positions = useMemo(() => {
    const r = rng(3);
    const out = new Float32Array(2500 * 3);
    for (let i = 0; i < 2500; i++) {
      const z = 2 * r() - 1;
      const a = 2 * Math.PI * r();
      const s = Math.sqrt(1 - z * z);
      out.set([s * Math.cos(a) * 120, z * 120, s * Math.sin(a) * 120], i * 3);
    }
    return out;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.28} sizeAttenuation color="#dbe4ff" transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

// Where the Moon sits: low right on wide screens (text on the left), under the text on narrow ones
const MOON_WIDE: [number, number, number] = [1.75, -0.35, 0.9];
const MOON_NARROW: [number, number, number] = [0.35, -2.05, 0.2];

// Illustrative frozen elliptical orbit with apolune over the south pole (the LCRNS idea), shrunk to fit the frame.
const ORBIT = { a: 2.1, e: 0.5, incDeg: 62 };

function orbitPoint(nu: number, out = new THREE.Vector3()) {
  const { a, e } = ORBIT;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  // Perilune over the north (+y), apolune over the south (-y), tilted toward the camera
  out.set(r * Math.sin(nu), r * Math.cos(nu), 0);
  return out.applyAxisAngle(new THREE.Vector3(0, 1, 0), (ORBIT.incDeg * Math.PI) / 180 - Math.PI / 2);
}

function Relay({ animate }: { animate: boolean }) {
  const sat = useRef<THREE.Group>(null);
  const nu = useRef(Math.PI * 0.85);
  const orbit = useMemo(() => {
    const pts: number[] = [];
    for (let k = 0; k <= 256; k++) pts.push(...orbitPoint((k / 256) * Math.PI * 2).toArray());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.45, dashSize: 0.08, gapSize: 0.06 }));
    line.computeLineDistances(); // dashed lines need per-vertex distances
    return line;
  }, []);
  useFrame((_, dt) => {
    if (!sat.current) return;
    if (animate) {
      // Kepler's second law, roughly: faster near perilune, slow near apolune
      const r = orbitPoint(nu.current).length();
      nu.current = (nu.current + (dt * 0.9) / (r * r)) % (Math.PI * 2);
    }
    orbitPoint(nu.current, sat.current.position);
  });
  const glow = useMemo(() => glowCanvas("rgba(190,255,220,1)", "rgba(74,222,128,0.35)"), []);
  return (
    <>
      <primitive object={orbit} />
      <group ref={sat}>
        <mesh>
          <octahedronGeometry args={[0.05]} />
          <meshBasicMaterial color="#eafff2" />
        </mesh>
        <sprite scale={[0.45, 0.45, 1]}>
          <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
        </sprite>
      </group>
    </>
  );
}

function Scene({ animate }: { animate: boolean }) {
  const narrow = useThree((st) => st.size.width / st.size.height < 0.9);
  const moonMap = useMemo(() => moonCanvas(), []);
  const earthMap = useMemo(() => earthCanvas(), []);
  const sunGlow = useMemo(() => glowCanvas("rgba(255,250,235,1)", "rgba(255,196,96,0.45)"), []);
  const earthGlow = useMemo(() => glowCanvas("rgba(120,180,255,0.0)", "rgba(96,165,250,0.35)"), []);
  const moon = useRef<THREE.Mesh>(null);
  const rig = useRef<THREE.Group>(null);
  const sunDir = new THREE.Vector3(1, 0.35, 0.55).normalize();
  const earthPos = new THREE.Vector3(1.0, 2.25, -3.5);

  useFrame((state, dt) => {
    if (!animate) return;
    if (moon.current) moon.current.rotation.y += dt * 0.02;
    if (rig.current) {
      // A slow drift of the whole view, like a camera on a spacecraft
      const t = state.clock.elapsedTime * 0.05;
      rig.current.rotation.y = Math.sin(t) * 0.12;
      rig.current.rotation.x = Math.cos(t * 0.7) * 0.04;
    }
  });

  return (
    <>
      <color attach="background" args={["#020309"]} />
      <ambientLight intensity={0.06} />
      <directionalLight position={sunDir.clone().multiplyScalar(20)} intensity={3.2} color="#fff4e0" />
      <Stars />
      <group ref={rig}>
        <sprite position={sunDir.clone().multiplyScalar(40)} scale={[16, 16, 1]}>
          <spriteMaterial map={sunGlow} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
        </sprite>
        {/* South pole tilted toward the camera, where LunaNav's sites are */}
        <group position={narrow ? MOON_NARROW : MOON_WIDE}>
        <mesh ref={moon} rotation={[-0.75, 0, 0.12]}>
          <sphereGeometry args={[1, 128, 128]} />
          <meshStandardMaterial map={moonMap} bumpMap={moonMap} bumpScale={0.25} roughness={1} metalness={0} />
        </mesh>
          <Relay animate={animate} />
        </group>
        <group position={earthPos}>
          <mesh rotation={[0.4, 0, 0.41]}>
            <sphereGeometry args={[0.42, 64, 64]} />
            <meshStandardMaterial map={earthMap} roughness={0.8} emissive="#0a1d3a" emissiveIntensity={0.25} />
          </mesh>
          <sprite scale={[1.5, 1.5, 1]}>
            <spriteMaterial map={earthGlow} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
          </sprite>
        </group>
      </group>
    </>
  );
}

export default function HeroScene({ animate }: { animate: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      frameloop={animate ? "always" : "demand"}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      aria-hidden
    >
      <Scene animate={animate} />
    </Canvas>
  );
}
