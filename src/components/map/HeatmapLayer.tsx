'use client';

import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import type { RiskCell } from '@/lib/types';

/**
 * HeatmapLayer
 * ------------
 * Renders the Nightly Prediction Engine's risk surface as a canvas
 * gradient overlay.
 *
 * WHY A CUSTOM LAYER: leaflet.heat is the usual choice, but it is
 * unmaintained, ships no TypeScript types, and mutates global Leaflet.
 * A purpose-built L.Layer is ~120 lines, has no dependency risk, and
 * lets us control the exact colour ramp so the heatmap agrees with the
 * severity palette used everywhere else in the console.
 *
 * HOW IT WORKS: each risk cell is painted as a radial alpha gradient
 * into an offscreen greyscale buffer; the accumulated alpha is then
 * mapped through a colour ramp in a single pass. This is the standard
 * two-pass heatmap technique — it makes overlapping cells reinforce each
 * other rather than simply drawing over one another.
 */

const RAMP: Array<[number, string]> = [
  [0.0, 'rgba(34,197,94,0)'],
  [0.25, 'rgba(34,197,94,0.55)'],
  [0.45, 'rgba(234,179,8,0.65)'],
  [0.65, 'rgba(249,115,22,0.75)'],
  [0.85, 'rgba(239,68,68,0.85)'],
  [1.0, 'rgba(190,18,60,0.92)'],
];

function buildRampPixels(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  RAMP.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

interface HeatOptions {
  cells: RiskCell[];
  /** Base radius in pixels at zoom 7; scaled with zoom so the surface keeps its geographic meaning. */
  radius?: number;
  intensity?: number;
  opacity?: number;
}

class HeatCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private ramp: Uint8ClampedArray | null = null;
  private opts: Required<HeatOptions>;

  constructor(options: HeatOptions) {
    super();
    this.opts = {
      cells: options.cells,
      radius: options.radius ?? 34,
      intensity: options.intensity ?? 1,
      opacity: options.opacity ?? 0.75,
    };
  }

  setCells(cells: RiskCell[]) {
    this.opts.cells = cells;
    this.redraw();
  }

  onAdd(map: L.Map): this {
    const canvas = L.DomUtil.create('canvas', 'leaflet-heat-layer leaflet-layer leaflet-zoom-hide');
    canvas.style.pointerEvents = 'none';
    this.canvas = canvas;
    this.ramp = buildRampPixels();

    map.getPanes().overlayPane.appendChild(canvas);
    map.on('moveend zoomend resize', this.reset, this);
    this.reset();
    return this;
  }

  onRemove(map: L.Map): this {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    map.off('moveend zoomend resize', this.reset, this);
    this.canvas = null;
    return this;
  }

  private reset() {
    const map = this._map;
    if (!map || !this.canvas) return;

    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this.canvas, topLeft);

    // Render at device pixel ratio so the gradient is not soft on HiDPI.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = size.x * dpr;
    this.canvas.height = size.y * dpr;
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;

    this.draw(dpr);
  }

  redraw() {
    this.reset();
  }

  private draw(dpr: number) {
    const map = this._map;
    const canvas = this.canvas;
    if (!map || !canvas || !this.ramp) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Radius grows with zoom so a cell covers a constant ground area.
    const zoomFactor = Math.pow(2, map.getZoom() - 7);
    const radius = Math.max(16, Math.min(190, this.opts.radius * zoomFactor));
    const bounds = map.getBounds().pad(0.25);

    // --- Pass 1: accumulate alpha ------------------------------------
    ctx.globalCompositeOperation = 'source-over';
    for (const cell of this.opts.cells) {
      if (!bounds.contains([cell.lat, cell.lng])) continue;
      const point = map.latLngToContainerPoint([cell.lat, cell.lng]);
      const alpha = Math.max(0.05, Math.min(1, cell.weight * this.opts.intensity));

      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Pass 2: map accumulated alpha through the colour ramp -------
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;
    const ramp = this.ramp;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha === 0) continue;
      const offset = alpha * 4;
      pixels[i] = ramp[offset];
      pixels[i + 1] = ramp[offset + 1];
      pixels[i + 2] = ramp[offset + 2];
      pixels[i + 3] = Math.round(alpha * this.opts.opacity);
    }

    ctx.putImageData(image, 0, 0);
  }
}

/** React binding: mounts the layer and keeps its cells in sync. */
export default function HeatmapLayer({ cells, visible }: { cells: RiskCell[]; visible: boolean }) {
  const map = useMap();
  const layer = useMemo(() => new HeatCanvasLayer({ cells }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return undefined;
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, layer, visible]);

  useEffect(() => {
    if (visible) layer.setCells(cells);
  }, [cells, layer, visible]);

  return null;
}
