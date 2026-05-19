import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * 3D Hologramm Raum - Minimal Version (kein drei, nur reines r3f)
 */

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[16, 16, 16, 16]} />
      <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.25} />
    </mesh>
  );
}

function FloorFill() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[16, 16]} />
      <meshBasicMaterial color="#011a26" transparent opacity={0.5} />
    </mesh>
  );
}

function RoomWireframe() {
  return (
    <mesh position={[0, 1.5, 0]}>
      <boxGeometry args={[16, 3, 16]} />
      <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.18} />
    </mesh>
  );
}

function Router({ position = [0, 0.5, 0] }) {
  const ref = useRef();
  const ringRefs = useRef([null, null, null]);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
    ringRefs.current.forEach((r, i) => {
      if (!r) return;
      const t = (state.clock.elapsedTime + i * 0.8) % 3;
      const scale = 0.6 + t * 1.4;
      r.scale.set(scale, 1, scale);
      if (r.material) {
        r.material.opacity = Math.max(0, 0.55 - t / 3);
      }
    });
  });
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh>
          <boxGeometry args={[0.9, 0.18, 0.6]} />
          <meshBasicMaterial color="#00f0ff" wireframe />
        </mesh>
        <mesh>
          <boxGeometry args={[0.9, 0.18, 0.6]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.08} />
        </mesh>
        {/* LEDs */}
        <mesh position={[-0.3, 0.1, 0.31]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <mesh position={[-0.15, 0.1, 0.31]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <mesh position={[0, 0.1, 0.31]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        {/* Antennas */}
        {[
          [-0.45, 0.4, -0.25, -0.4],
          [-0.15, 0.4, -0.25, -0.2],
          [0.15, 0.4, -0.25, 0.2],
          [0.45, 0.4, -0.25, 0.4],
        ].map(([x, y, z, rz], i) => (
          <group key={i} position={[x, y, z]} rotation={[0, 0, rz]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 12]} />
              <meshBasicMaterial color="#00f0ff" wireframe />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshBasicMaterial color="#00f0ff" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Expanding signal rings */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => (ringRefs.current[i] = el)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.45, 0]}
        >
          <ringGeometry args={[0.6, 0.65, 64]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function RadarSweep() {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.7;
    }
  });
  return (
    <group ref={ref} position={[0, 0.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 8, 64, 1, 0, Math.PI / 4]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Heatmap({ grid }) {
  const geomRef = useRef();
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(grid.length * 3);
    const colors = new Float32Array(grid.length * 3);
    grid.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const intensity = p.intensity || 0;
      const r = Math.min(1, intensity * 1.4);
      const g = Math.min(1, 0.4 + intensity * 0.8);
      const b = 1.0;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    });
    return { positions, colors };
  }, [grid]);

  useEffect(() => {
    if (!geomRef.current || positions.length === 0) return;
    geomRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geomRef.current.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geomRef.current.computeBoundingSphere();
  }, [positions, colors]);

  if (grid.length === 0) return null;

  return (
    <points>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial vertexColors size={0.2} sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

function DeviceMarker({ device }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = device.y + Math.sin(state.clock.elapsedTime * 1.5 + device.x) * 0.05;
    }
  });
  const color = device.blocked ? "#ef4444" : "#00f0ff";
  return (
    <group position={[device.x, device.y, device.z]} ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function DetectedObject({ obj }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3 + obj.x) * 0.15;
      ref.current.scale.set(s, s, s);
    }
  });
  const color = obj.confidence > 0.75 ? "#ff4dd6" : "#f59e0b";
  return (
    <group position={[obj.x, obj.y, obj.z]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[obj.size + 0.2, 0]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[obj.size + 0.2, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -obj.y + 0.01, 0]}>
        <ringGeometry args={[0.2, 0.45, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CameraOrbit() {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.1;
    state.camera.position.x = Math.cos(t) * 13;
    state.camera.position.z = Math.sin(t) * 13;
    state.camera.position.y = 9;
    state.camera.lookAt(0, 1, 0);
  });
  return null;
}

export default function Holo3DRoom({ grid = [], devices = [], objects = [] }) {
  return (
    <Canvas
      camera={{ position: [13, 9, 13], fov: 50 }}
      style={{ background: "#020611" }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#00f0ff" />
      <CameraOrbit />
      <FloorFill />
      <Floor />
      <RoomWireframe />
      <RadarSweep />
      <Router />
      <Heatmap grid={grid} />
      {devices.map((d) => (
        <DeviceMarker key={d.mac} device={d} />
      ))}
      {objects.map((o) => (
        <DetectedObject key={o.id} obj={o} />
      ))}
    </Canvas>
  );
}
