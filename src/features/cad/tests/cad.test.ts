import { describe, expect, it } from 'vitest';
import { SvgExporter } from '../exporters/svg-exporter.js';
import { toDxf, pathToPoints } from '../exporters/dxf-exporter.js';
import { MasterArtworkRegistry } from '../../arabic-design/master-artwork.js';
import { AuditLog } from '../../../platform/audit/audit-log.js';
import { DesignVersionStore } from '../../design-studio/versioning.js';
import { DesignConcept } from '../../design-studio/models/concept.js';
import { ImmutabilityError } from '../../../platform/kernel.js';

const concept: DesignConcept = {
  conceptName: 'Test',
  designStory: 'test',
  targetCustomer: 'test',
  visualLanguage: 'test',
  materialId: 'MAT-925',
  dimensions: { lengthMm: 200, widthMm: 8, thicknessMm: 1.6, minLineWidthMm: 0.4, minInternalGapMm: 0.4, hasIsolatedArabicDots: false, hasFragileBridges: false },
  estimatedWeightG: 10,
  manufacturingMethod: 'cast + laser',
  personalisationOptions: [],
  complexity: 'LOW',
  estimatedCostBand: 'CORE',
  differentiation: 'x',
  risks: [],
  construction: 'plate',
  personalisationMechanic: 'engraving',
};

function setup() {
  const audit = new AuditLog();
  const artworks = new MasterArtworkRegistry(audit);
  const versions = new DesignVersionStore();
  const version = versions.createInitial('des_cad', concept, 'system');
  const exporter = new SvgExporter(artworks);
  return { artworks, version, exporter };
}

describe('CAD exporters (§16)', () => {
  it('produces mm-unit SVG with the full layer set and a reversed version', () => {
    const { artworks, version, exporter } = setup();
    const artwork = artworks.createPending('خالد', 'DIWANI', 'customer');
    artworks.approve(artwork.artworkId, 'user-arabic-01');
    const file = exporter.export(version, artwork.artworkId);
    expect(file.svg).toContain('width="200mm"');
    for (const layer of ['ENGRAVE', 'CUT', 'KEEP_CLEAR', 'STONE_SETTING', 'REFERENCE', 'DIMENSIONS']) {
      expect(file.svg).toContain(`id="${layer}"`);
    }
    expect(file.reversedSvg).toContain('scale(-1,1)');
  });

  it('all production paths are closed; forbidden constructs rejected', () => {
    const { artworks, version, exporter } = setup();
    const artwork = artworks.createPending('نور', 'NASKH', 'customer');
    artworks.approve(artwork.artworkId, 'user-arabic-01');
    const file = exporter.export(version, artwork.artworkId);
    for (const path of file.paths) expect(path.d.trim()).toMatch(/Z$/i);
    expect(() => exporter.validate('<svg width="10mm"><image href="x.png"/></svg>')).toThrow(/forbidden/);
    expect(() => exporter.validate('<svg width="10mm"><linearGradient/></svg>')).toThrow(/forbidden/);
    expect(() => exporter.validate('<svg width="10"><path d="M 0 0 H 5 Z"/></svg>')).toThrow(/millimetre/);
    expect(() => exporter.validate('<svg width="10mm"><path d="M 0 0 H 5"/></svg>')).toThrow(/Open path/);
  });

  it('refuses to export Arabic from an unapproved artwork (rule 52.2)', () => {
    const { artworks, version, exporter } = setup();
    const pending = artworks.createPending('خالد', 'DIWANI', 'customer');
    expect(() => exporter.export(version, pending.artworkId)).toThrow(/not approved/);
  });

  it('never overwrites an approved production file (rule 52.7)', () => {
    const { artworks, version, exporter } = setup();
    const artwork = artworks.createPending('خالد', 'DIWANI', 'customer');
    artworks.approve(artwork.artworkId, 'user-arabic-01');
    const file = exporter.export(version, artwork.artworkId);
    exporter.lockApproved(file);
    // Same content re-export is fine (idempotent)...
    expect(() => exporter.export(version, artwork.artworkId)).not.toThrow();
    // ...but changed geometry under the same file name must throw.
    version.concept = { ...concept, dimensions: { ...concept.dimensions, lengthMm: 210 } };
    expect(() => exporter.export(version, artwork.artworkId)).toThrow(ImmutabilityError);
  });

  it('DXF uses millimetre units and preserves dimensions', () => {
    const { artworks, version, exporter } = setup();
    const artwork = artworks.createPending('خالد', 'DIWANI', 'customer');
    artworks.approve(artwork.artworkId, 'user-arabic-01');
    const file = exporter.export(version, artwork.artworkId);
    const dxf = toDxf(file);
    expect(dxf).toContain('$INSUNITS');
    const lines = dxf.split('\n');
    expect(lines[lines.indexOf('$INSUNITS') + 2]).toBe('4'); // 4 = millimetres
    // Outline polyline spans the full 200×8 plate.
    const points = pathToPoints({ layer: 'CUT', d: 'M 0 0 H 200 V 8 H 0 Z' });
    expect(points).toContainEqual([200, 8]);
    expect(dxf).toContain('LWPOLYLINE');
  });
});
