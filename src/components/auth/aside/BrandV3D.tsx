import { useRef } from "react";
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

/** Geometria fiel à logo: dois trilhos arredondados, barra de liquidação e nó no vértice. */
const RAIL_R = 0.22;
const RAIL_LEN = 2.155;
const RAIL_ANGLE = Math.atan2(0.94, 1.94);

function Mark({ animated }: { animated: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const node = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ pointer, clock }, raw) => {
    const g = ref.current;
    if (!g || !animated) return;
    const dt = Math.min(raw, 0.05);
    const k = 1 - Math.exp(-DAMP * dt);
    const spin = Math.sin(clock.elapsedTime * 0.35) * 0.35;
    g.rotation.y += (pointer.x * TILT + spin - g.rotation.y) * k;
    g.rotation.x += (-pointer.y * TILT * 0.6 - g.rotation.x) * k;
    if (node.current) node.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 2.4) * 0.3;
  });

  return (
    <group ref={ref} rotation={[0, -0.25, 0]} scale={0.5} position={[0, 0.22, 0]}>
      {/* trilho esquerdo — cromado */}
      <mesh position={[-0.47, -0.03, 0]} rotation-z={RAIL_ANGLE} castShadow>
        <capsuleGeometry args={[RAIL_R, RAIL_LEN, 16, 48]} />
        <meshPhysicalMaterial color="#eef3fa" metalness={1} roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.8} />
      </mesh>
      {/* trilho direito — esmeralda polida */}
      <mesh position={[0.47, -0.03, 0]} rotation-z={-RAIL_ANGLE} castShadow>
        <capsuleGeometry args={[RAIL_R, RAIL_LEN, 16, 48]} />
        <meshPhysicalMaterial color={EMERALD} metalness={0.55} roughness={0.18} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.5} iridescence={0.4} />
      </mesh>
      {/* barra de liquidação */}
      <mesh position={[0, 0.125, 0.26]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.045, 0.82, 8, 24]} />
        <meshStandardMaterial color={EMERALD} emissive={EMERALD} emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      {/* nó de liquidação no vértice */}
      <mesh position={[0, -1.02, 0.18]}>
        <sphereGeometry args={[0.2, 48, 48]} />
        <meshStandardMaterial ref={node} color={EMERALD} emissive={EMERALD} emissiveIntensity={0.7} toneMapped={false} roughness={0.2} metalness={0.3} />
      </mesh>
      <pointLight position={[0, -1.02, 0.6]} color={EMERALD} intensity={2.5} distance={2.5} />
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
