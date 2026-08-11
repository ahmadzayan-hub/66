import { SvgExport, VectorPath } from './svg-exporter.js';

/**
 * Minimal DXF (R12 ASCII) writer: LWPOLYLINE per closed path, layers matching
 * the SVG layers, millimetre units ($INSUNITS = 4).
 */
export function toDxf(svgExport: SvgExport): string {
  const lines: string[] = [];
  const push = (...vals: (string | number)[]) => lines.push(...vals.map(String));

  push(0, 'SECTION', 2, 'HEADER');
  push(9, '$INSUNITS', 70, 4); // millimetres
  push(9, '$EXTMAX', 10, svgExport.widthMm, 20, svgExport.heightMm);
  push(0, 'ENDSEC');

  push(0, 'SECTION', 2, 'ENTITIES');
  for (const path of svgExport.paths) {
    const points = pathToPoints(path);
    if (points.length < 2) continue;
    push(0, 'LWPOLYLINE', 8, path.layer, 90, points.length, 70, 1); // 70=1 closed
    for (const [x, y] of points) push(10, x, 20, y);
  }
  push(0, 'ENDSEC', 0, 'EOF');
  return lines.join('\n') + '\n';
}

/** Parse the simple M/H/V path grammar the SVG exporter emits into vertices. */
export function pathToPoints(path: VectorPath): [number, number][] {
  const tokens = path.d.trim().split(/\s+/);
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i]!;
    if (cmd === 'M') {
      x = Number(tokens[i + 1]);
      y = Number(tokens[i + 2]);
      points.push([x, y]);
      i += 3;
    } else if (cmd === 'H') {
      x = Number(tokens[i + 1]);
      points.push([x, y]);
      i += 2;
    } else if (cmd === 'V') {
      y = Number(tokens[i + 1]);
      points.push([x, y]);
      i += 2;
    } else if (cmd === 'Z') {
      i += 1;
    } else {
      i += 1;
    }
  }
  return points;
}
