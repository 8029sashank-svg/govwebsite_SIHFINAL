'use client';

import React from 'react';

/**
 * GroundGrid
 * ----------
 * Ported from the standalone Atlas prototype (src/three/GroundGrid.jsx).
 * Purely decorative backdrop beneath the extruded districts.
 */
export default function GroundGrid({
  center = [500, 0, -500] as [number, number, number],
  size = 2600,
}: {
  center?: [number, number, number];
  size?: number;
}) {
  return (
    <group>
      <mesh position={[center[0], -0.6, center[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#070a10" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[size, 60, '#123244', '#0a141c']} position={[center[0], -0.55, center[2]]} />
    </group>
  );
}
