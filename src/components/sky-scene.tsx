"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { skyDirection, type SkyBody, type Vec3 } from "@/lib/lunanav/sky";
import type { HorizonProfile } from "@/lib/lunanav/types";

const SKY_R = 50; // bodies sit on this sphere; sizes are for legibility, not to scale
const RIDGE_R = 55;
const BELOW_DEG = -85;

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];

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

/** The terrain skyline: a dark wall up to the real horizon profile, with a lit edge. */
function Ridge({ horizon }: { horizon: HorizonProfile }) {
  const { fill, edge } = useMemo(() => {
    const n = horizon.elevationDeg.length;
    const verts: number[] = [];
    const top: number[] = [];
    for (let k = 0; k <= n; k++) {
      const az = k * horizon.azimuthStepDeg; // k = n repeats azimuth 0 to close the ring
      const t = scale(skyDirection(az, horizon.elevationDeg[k % n]!), RIDGE_R);
      const b = scale(skyDirection(az, BELOW_DEG), RIDGE_R);
      verts.push(...t, ...b);
      top.push(...t);
    }
    const idx: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    fillGeo.setIndex(idx);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(top, 3));
    return { fill: fillGeo, edge: edgeGeo };
  }, [horizon]);
  return (
    <>
      <mesh geometry={fill}>
        <meshBasicMaterial color="#07080c" side={THREE.DoubleSide} />
      </mesh>
      <line>
        <primitive object={edge} attach="geometry" />
        <lineBasicMaterial color="#6b7688" />
      </line>
    </>
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
          <span className="pointer-events-none select-none font-mono text-xs text-slate-400">{label}</span>
        </Html>
      ))}
    </>
  );
}

/** A small name tag that follows a body; the numbers are the file values at this sample. */
function Tag({ body, dy = 2.4 }: { body: SkyBody; dy?: number }) {
  const [x, y, z] = scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R);
  return (
    <Html position={[x, y + dy, z]} center zIndexRange={[10, 0]}>
      <span className="pointer-events-none select-none whitespace-nowrap rounded border border-white/15 bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
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

function Satellite({ body, link }: { body: SkyBody; link: boolean | null }) {
  const p = scale(skyDirection(body.azimuthDeg, body.elevationDeg), SKY_R);
  const visible = body.elevationDeg > 0;
  const color = link === null ? "#9aa4b5" : link ? "#4ade80" : "#f87171";
  return (
    <>
      <mesh position={p} visible={visible}>
        <octahedronGeometry args={[body.seesEarth ? 0.9 : 0.6]} />
        <meshBasicMaterial color={body.seesEarth ? "#e6edf7" : "#6b7280"} />
      </mesh>
      {link !== null && visible && (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array([0, -0.2, 0, ...p]), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={color} />
        </line>
      )}
    </>
  );
}

export default function SkyScene({
  horizon,
  bodies,
  links,
  lookAzimuthDeg,
}: {
  horizon: HorizonProfile;
  bodies: SkyBody[];
  /** body id -> path state from network.ts; null when no result exists yet */
  links: Record<string, boolean> | null;
  lookAzimuthDeg: number;
}) {
  const sun = bodies.find((b) => b.kind === "sun");
  const earth = bodies.find((b) => b.kind === "earth");
  const sunDir: Vec3 = sun ? skyDirection(sun.azimuthDeg, Math.max(sun.elevationDeg, 0.5)) : [0, 1, 0];
  const start = scale(skyDirection(lookAzimuthDeg, 12), -0.01); // OrbitControls orbits a point; a tiny radius is a look-around
  return (
    <Canvas camera={{ position: start, fov: 62, near: 0.01, far: 200 }} dpr={[1, 2]} gl={{ antialias: true }} aria-label="3D sky seen from the lander">
      <color attach="background" args={["#02030a"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={scale(sunDir, 10)} intensity={2.2} />
      <Stars />
      <Ridge horizon={horizon} />
      <Compass />
      {sun && sun.elevationDeg > -2 && (
        <>
          <Sun body={sun} />
          <Tag body={sun} dy={5} />
        </>
      )}
      {earth && earth.elevationDeg > -2 && (
        <>
          <Earth body={earth} />
          <Tag body={earth} />
        </>
      )}
      {bodies
        .filter((b) => b.kind === "satellite")
        .map((b) => (
          <group key={b.id}>
            <Satellite body={b} link={links ? (links[b.id] ?? false) : null} />
            {b.elevationDeg > 0 && <Tag body={b} dy={1.8} />}
          </group>
        ))}
      {earth && links && earth.elevationDeg > 0 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([0, -0.2, 0, ...scale(skyDirection(earth.azimuthDeg, earth.elevationDeg), SKY_R)]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={links.earth ? "#4ade80" : "#f87171"} />
        </line>
      )}
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.45} minPolarAngle={Math.PI / 2 - 0.2} maxPolarAngle={Math.PI - 0.05} />
    </Canvas>
  );
}
