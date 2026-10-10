import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/**
 * "V" da VENXPAY em vidro fumê, iluminado como foto de produto.
 * Inclina na direção do ponteiro com amortecimento exponencial.
 * Cores de luz da cena 3D espelham a paleta da marca (esmeralda/azul).
 */
const EMERALD = "#10d9a0";
const STEEL = "#3aa8ff";
const TILT = 0.35; // radianos máximos
const DAMP = 4;

function useVGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.25, 1);
    s.lineTo(-0.66, 1);
    s.lineTo(0, -0.32);
    s.lineTo(0.66, 1);
    s.lineTo(1.25, 1);
    s.lineTo(0.3, -1);
    s.lineTo(-0.3, -1);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.42, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 6, curveSegments: 8,
    });
    g.center();
    return g;
  }, []);
}

function Mark({ animated }: { animated: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const geometry = useVGeometry();

  useFrame(({ pointer, clock }, raw) => {
    const g = ref.current;
    if (!g || !animated) return;
    const dt = Math.min(raw, 0.05);
    const k = 1 - Math.exp(-DAMP * dt);
    const spin = Math.sin(clock.elapsedTime * 0.35) * 0.35;
    g.rotation.y += (pointer.x * TILT + spin - g.rotation.y) * k;
    g.rotation.x += (-pointer.y * TILT * 0.6 - g.rotation.x) * k;
  });

  return (
    <group ref={ref} rotation={[0, -0.25, 0]} scale={0.5}>
      <mesh geometry={geometry} castShadow>
        <meshPhysicalMaterial
          color="#1a2c4d"
          metalness={0.85}
          roughness={0.28}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1.6}
          iridescence={0.35}
          iridescenceIOR={1.3}
        />
      </mesh>
    </group>
  );
}

export interface BrandV3DProps {
  animated: boolean;
}

export default function BrandV3D({ animated }: BrandV3DProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={animated ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.15, 5.2], fov: 32 }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <Float enabled={animated} speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
        <Mark animated={animated} />
      </Float>
      <ContactShadows position={[0, -0.95, 0]} opacity={0.55} scale={7} blur={2.6} far={3} color="#000814" />
      <Environment resolution={256}>
        <color attach="background" args={["#060d1f"]} />
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 4, 2]} scale={[6, 0.6, 1]} />
        <Lightformer form="rect" intensity={4} color={EMERALD} position={[-4, 0.5, 1]} rotation-y={Math.PI / 2} scale={[8, 0.5, 1]} />
        <Lightformer form="rect" intensity={4} color={STEEL} position={[4, -0.5, 1]} rotation-y={-Math.PI / 2} scale={[8, 0.5, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#9fc4ff" position={[2, 2, 7]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} color={EMERALD} position={[-3, -2, 6]} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={1.5} color={STEEL} position={[0, 0, -6]} scale={4} />
      </Environment>
    </Canvas>
  );
}
