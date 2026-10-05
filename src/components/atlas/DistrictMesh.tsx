'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AtlasDistrict } from '@/lib/atlas/types';

const BASE_HEIGHT = 2;
const MAX_EXTRA_HEIGHT = 34;
const HOVER_LIFT = 3.5;
const SELECT_LIFT = 1.5;

const COLOR_DEFAULT = new THREE.Color('#1b6fa8');
const COLOR_HOVER = new THREE.Color('#4df3ff');
const COLOR_SELECTED = new THREE.Color('#a78bff');
const COLOR_DIM = new THREE.Color('#0e2536');

/**
 * DistrictMesh
 * ------------
 * Ported from the standalone Atlas prototype (src/three/DistrictMesh.jsx).
 * Renders one district as an extruded 3D block; height encodes
 * `devIndex`. All per-frame motion (lift, color, opacity) is driven with
 * THREE.MathUtils.damp inside useFrame rather than React state, so
 * hovering/selecting never triggers a re-render storm across 34 meshes.
 */
export interface DistrictMeshProps {
  district: AtlasDistrict;
  isHovered: boolean;
  isSelected: boolean;
  dimmed: boolean;
  onHover: (id: string) => void;
  onUnhover: (id: string) => void;
  onSelect: (id: string) => void;
}

export default function DistrictMesh({ district, isHovered, isSelected, dimmed, onHover, onUnhover, onSelect }: DistrictMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const outlineRef = useRef<THREE.Mesh>(null);
  const outlineMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const extrudeHeight = BASE_HEIGHT + (district.devIndex / 100) * MAX_EXTRA_HEIGHT;

  const geometry = useMemo(() => {
    const geoms = district.shapes.map((shape) => {
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeHeight,
        bevelEnabled: true,
        bevelThickness: 0.4,
        bevelSize: 0.3,
        bevelSegments: 1,
        curveSegments: 6,
      });
      g.computeVertexNormals();
      return g;
    });
    return geoms.length > 1 ? mergeGeometries(geoms, false) : geoms[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district.id, extrudeHeight]);

  const outlineGeometry = geometry;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetLift = isSelected ? SELECT_LIFT : isHovered ? HOVER_LIFT : 0;
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetLift, 8, delta);

    if (materialRef.current) {
      const targetColor = isSelected ? COLOR_SELECTED : isHovered ? COLOR_HOVER : dimmed ? COLOR_DIM : COLOR_DEFAULT;
      materialRef.current.color.lerp(targetColor, 1 - Math.pow(0.001, delta));
      materialRef.current.emissive.lerp(targetColor, isHovered || isSelected ? 0.12 : 0.02);
      const targetOpacity = dimmed && !isSelected ? 0.35 : 1;
      materialRef.current.opacity = THREE.MathUtils.damp(materialRef.current.opacity, targetOpacity, 6, delta);
    }

    if (outlineMatRef.current) {
      const targetGlow = isHovered || isSelected ? 0.85 : 0;
      outlineMatRef.current.opacity = THREE.MathUtils.damp(outlineMatRef.current.opacity, targetGlow, 10, delta);
    }
    if (outlineRef.current) {
      const targetScale = isHovered || isSelected ? 1.012 : 1;
      outlineRef.current.scale.x = THREE.MathUtils.damp(outlineRef.current.scale.x, targetScale, 10, delta);
      outlineRef.current.scale.z = THREE.MathUtils.damp(outlineRef.current.scale.z, targetScale, 10, delta);
    }
  });

  return (
    <group
      ref={groupRef}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(district.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onUnhover(district.id);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(district.id);
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={materialRef}
          color={COLOR_DEFAULT}
          emissive={COLOR_DEFAULT}
          emissiveIntensity={0.35}
          roughness={0.45}
          metalness={0.15}
          transparent
          opacity={1}
        />
      </mesh>

      {/* Neon rim: same geometry, back faces only, additive blend, glows outward */}
      <mesh ref={outlineRef} geometry={outlineGeometry}>
        <meshBasicMaterial
          ref={outlineMatRef}
          color={isSelected ? COLOR_SELECTED : COLOR_HOVER}
          side={THREE.BackSide}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
