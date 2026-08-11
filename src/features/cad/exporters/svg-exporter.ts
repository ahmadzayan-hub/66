import { AgentIdentity, ImmutabilityError } from '../../../platform/kernel.js';
import { DesignVersion } from '../../design-studio/versioning.js';
import { MasterArtworkRegistry } from '../../arabic-design/master-artwork.js';
import { createHash } from 'node:crypto';

/** Layer names required for laser workflows (§16). */
export const CAD_LAYERS = ['ENGRAVE', 'CUT', 'KEEP_CLEAR', 'STONE_SETTING', 'REFERENCE', 'DIMENSIONS'] as const;
export type CadLayer = (typeof CAD_LAYERS)[number];

export interface VectorPath {
  layer: CadLayer;
  /** SVG path data. Must be a closed path (ends with Z) for CUT/ENGRAVE. */
  d: string;
}

export interface SvgExport {
  fileName: string;
  svg: string;
  reversedSvg: string;
  sha256: string;
  widthMm: number;
  heightMm: number;
  paths: VectorPath[];
}

/**
 * Production SVG rules (§16): text as outlines, closed paths, mm units, clean
 * nodes, no gradients/shadows/raster/masks. Arabic geometry derives ONLY from
 * an approved master artwork (rule 52.2) — this exporter accepts an artwork
 * ID, never free text for Arabic content.
 */
export class SvgExporter implements AgentIdentity {
  agentId = 'agent-10-cad-vector';
  capability = 'export' as const;

  private approvedHashes = new Map<string, string>(); // fileName -> sha256

  constructor(private artworks: MasterArtworkRegistry) {}

  export(version: DesignVersion, arabicArtworkId?: string): SvgExport {
    const c = version.concept;
    const { lengthMm: w, widthMm: h } = c.dimensions;

    if (arabicArtworkId) {
      const artwork = this.artworks.get(arabicArtworkId);
      if (artwork.status !== 'APPROVED') {
        throw new Error(`Arabic artwork ${arabicArtworkId} is not approved; cannot export production files`);
      }
    }

    const paths: VectorPath[] = [
      // Plate outline (CUT)
      { layer: 'CUT', d: `M 0 0 H ${w} V ${h} H 0 Z` },
      // Engraving field derived from approved artwork geometry (outlined; placeholder
      // glyph outlines are generated from the artwork's letterform data in R1 —
      // a font-outline engine plugs in behind this same interface).
      ...this.engraveOutlines(arabicArtworkId, w, h),
      // Keep-clear margins around clasp attachment points
      { layer: 'KEEP_CLEAR', d: `M 2 2 H 12 V ${h - 2} H 2 Z` },
      { layer: 'KEEP_CLEAR', d: `M ${w - 12} 2 H ${w - 2} V ${h - 2} H ${w - 2 - 10} Z` },
      // Reference centerline + dimension box
      { layer: 'REFERENCE', d: `M ${w / 2} 0 V ${h} Z` },
      { layer: 'DIMENSIONS', d: `M 0 ${h + 3} H ${w} Z` },
    ];

    const svg = this.render(paths, w, h, false);
    const reversedSvg = this.render(paths, w, h, true);
    this.validate(svg);
    const fileName = `${version.designId}_${version.versionId}.svg`;
    const sha256 = createHash('sha256').update(svg).digest('hex');

    const existing = this.approvedHashes.get(fileName);
    if (existing && existing !== sha256) {
      throw new ImmutabilityError(`Approved production file ${fileName} may not be overwritten`);
    }

    return { fileName, svg, reversedSvg, sha256, widthMm: w, heightMm: h, paths };
  }

  /** Mark a file as approved: any later export producing a different hash throws. */
  lockApproved(file: SvgExport): void {
    this.approvedHashes.set(file.fileName, file.sha256);
  }

  private engraveOutlines(arabicArtworkId: string | undefined, w: number, h: number): VectorPath[] {
    if (!arabicArtworkId) return [];
    const artwork = this.artworks.get(arabicArtworkId);
    // One closed outline block per letter, RTL: first letter at the right edge.
    const letters = artwork.validation.connectivity;
    const fieldW = w * 0.6;
    const startX = w * 0.8; // right side, flowing left (RTL)
    const glyphW = fieldW / Math.max(letters.length, 1);
    return letters.map((join, i) => {
      const x = startX - (i + 1) * glyphW;
      const y = h * 0.25;
      const gh = h * 0.5;
      // Connected letters extend to touch the neighbour (no gap), preserving connectivity.
      const gw = join.joinsNext ? glyphW : glyphW * 0.8;
      return { layer: 'ENGRAVE' as const, d: `M ${r3(x)} ${r3(y)} H ${r3(x + gw)} V ${r3(y + gh)} H ${r3(x)} Z` };
    });
  }

  private render(paths: VectorPath[], w: number, h: number, reversed: boolean): string {
    const transform = reversed ? ` transform="translate(${w},0) scale(-1,1)"` : '';
    const groups = CAD_LAYERS.map((layer) => {
      const layerPaths = paths.filter((p) => p.layer === layer)
        .map((p) => `    <path d="${p.d}" fill="none" stroke="black" stroke-width="0.1"/>`)
        .join('\n');
      return `  <g id="${layer}"${transform}>\n${layerPaths}\n  </g>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n${groups}\n</svg>\n`;
  }

  /** Deterministic production-readiness validation of the generated SVG. */
  validate(svg: string): void {
    const forbidden = [/<image/i, /<text/i, /gradient/i, /filter/i, /<mask/i, /shadow/i, /data:image/i];
    for (const pattern of forbidden) {
      if (pattern.test(svg)) throw new Error(`Production SVG contains forbidden construct: ${pattern}`);
    }
    if (!/width="[\d.]+mm"/.test(svg)) throw new Error('Production SVG must use millimetre units');
    // All CUT/ENGRAVE paths must be closed.
    const pathData = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]!);
    for (const d of pathData) {
      if (!/Z\s*$/i.test(d.trim())) throw new Error(`Open path in production SVG: ${d}`);
    }
  }
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
