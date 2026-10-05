'use client';

import { useCallback, useRef, useState } from 'react';
import type { RootState } from '@react-three/fiber';

/**
 * useWebglGuard.ts
 * ----------------
 * Ported from the standalone Atlas prototype (src/hooks/useWebglGuard.js).
 * Detects WebGL context loss (driver crash, GPU reset, tab backgrounded
 * on a low-power device) and restoration, so the UI can show a clear
 * recovery screen instead of a silently blank canvas. Wire `bindCanvas`
 * to the <Canvas onCreated> callback.
 */
export function useWebglGuard() {
  const [lost, setLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handlersRef = useRef<{ onLost: (e: Event) => void; onRestored: () => void } | null>(null);

  const bindCanvas = useCallback((state: RootState) => {
    const canvas = state.gl.domElement;
    canvasRef.current = canvas;

    const onLost = (e: Event) => {
      e.preventDefault();
      setLost(true);
    };
    const onRestored = () => setLost(false);

    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    handlersRef.current = { onLost, onRestored };
  }, []);

  const cleanup = useCallback(() => {
    const canvas = canvasRef.current;
    const handlers = handlersRef.current;
    if (canvas && handlers) {
      canvas.removeEventListener('webglcontextlost', handlers.onLost);
      canvas.removeEventListener('webglcontextrestored', handlers.onRestored);
    }
  }, []);

  return { lost, bindCanvas, cleanup };
}
