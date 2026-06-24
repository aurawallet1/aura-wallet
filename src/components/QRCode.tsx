import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path, Rect } from 'react-native-svg';
import { RADIUS } from '../theme';

const BRAND_LOGO = require('../../img/qr-logo.png');

const MODULE_COLOR = '#000000';
const CANVAS_COLOR = '#FFFFFF';
const LOGO_PLATE_COLOR = '#FFFFFF';

type CorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRCodeProps {
  value: string;
  size: number;
  isLogoRendered?: boolean;
  logoSize?: number;
  ecl?: CorrectionLevel;
}

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let acc = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = acc;
    GF_LOG[acc] = i;
    acc <<= 1;
    if (acc & 0x100) {
      acc ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

const gfMul = (a: number, b: number): number => {
  if (a === 0 || b === 0) {
    return 0;
  }
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
};

const buildGenerator = (degree: number): number[] => {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
};

const reedSolomon = (data: number[], eccCount: number): number[] => {
  const generator = buildGenerator(eccCount);
  const remainder = new Array(eccCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let j = 0; j < generator.length - 1; j++) {
      remainder[j] ^= gfMul(generator[j + 1], factor);
    }
  }
  return remainder;
};

const LEVEL_INDEX: Record<CorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

const TOTAL_CODEWORDS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085, 1156, 1258, 1364,
  1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
];

const ECC_PER_BLOCK = [
  [7, 10, 13, 17],
  [10, 16, 22, 28],
  [15, 26, 18, 22],
  [20, 18, 26, 16],
  [26, 24, 18, 22],
  [18, 16, 24, 28],
  [20, 18, 18, 26],
  [24, 22, 22, 26],
  [30, 22, 20, 24],
  [18, 26, 24, 28],
  [20, 30, 28, 24],
  [24, 22, 26, 28],
  [26, 22, 24, 22],
  [30, 24, 20, 24],
  [22, 24, 30, 24],
  [24, 28, 24, 30],
  [28, 28, 28, 28],
  [30, 26, 28, 28],
  [28, 26, 26, 26],
  [28, 26, 30, 28],
  [28, 26, 28, 30],
  [28, 28, 30, 24],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [26, 28, 30, 30],
  [28, 28, 28, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
];

const BLOCK_COUNT = [
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 2, 2],
  [1, 2, 2, 4],
  [1, 2, 4, 4],
  [2, 4, 4, 4],
  [2, 4, 6, 5],
  [2, 4, 6, 6],
  [2, 5, 8, 8],
  [4, 5, 8, 8],
  [4, 5, 8, 11],
  [4, 8, 10, 11],
  [4, 9, 12, 16],
  [4, 9, 16, 16],
  [6, 10, 12, 18],
  [6, 10, 17, 16],
  [6, 11, 16, 19],
  [6, 13, 18, 21],
  [7, 14, 21, 25],
  [8, 16, 20, 25],
  [8, 17, 23, 25],
  [9, 17, 23, 34],
  [9, 18, 25, 30],
  [10, 20, 27, 32],
  [12, 21, 29, 35],
  [12, 23, 34, 37],
  [12, 25, 34, 40],
  [13, 26, 35, 42],
  [14, 28, 38, 45],
  [15, 29, 40, 48],
  [16, 31, 43, 51],
  [17, 33, 45, 54],
  [18, 35, 48, 57],
  [19, 37, 51, 60],
  [19, 38, 53, 63],
  [20, 40, 56, 66],
  [21, 43, 59, 70],
  [22, 45, 62, 74],
  [24, 47, 65, 77],
  [25, 49, 68, 81],
];

const ALIGNMENT_CENTERS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

const dataCapacityBits = (version: number, level: CorrectionLevel): number => {
  const levelIdx = LEVEL_INDEX[level];
  const total = TOTAL_CODEWORDS[version - 1];
  const eccPer = ECC_PER_BLOCK[version - 1][levelIdx];
  const blocks = BLOCK_COUNT[version - 1][levelIdx];
  return (total - eccPer * blocks) * 8;
};

const toByteSegment = (text: string): number[] => {
  const encoded = new TextEncoder().encode(text);
  return Array.from(encoded);
};

const charCountBits = (version: number): number => {
  if (version <= 9) {
    return 8;
  }
  return 16;
};

const headerBitCount = (version: number, byteLength: number): number => {
  return 4 + charCountBits(version) + byteLength * 8;
};

const pickVersion = (byteLength: number, level: CorrectionLevel): number => {
  for (let version = 1; version <= 40; version++) {
    if (headerBitCount(version, byteLength) <= dataCapacityBits(version, level)) {
      return version;
    }
  }
  throw new Error('payload exceeds QR capacity');
};

class BitWriter {
  bits: number[] = [];

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  toCodewords(): number[] {
    const words: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (this.bits[i + j] || 0);
      }
      words.push(byte);
    }
    return words;
  }
}

const assembleCodewords = (segment: number[], version: number, level: CorrectionLevel): number[] => {
  const writer = new BitWriter();
  writer.push(0b0100, 4);
  writer.push(segment.length, charCountBits(version));
  for (const byte of segment) {
    writer.push(byte, 8);
  }

  const capacity = dataCapacityBits(version, level);
  const terminator = Math.min(4, capacity - writer.bits.length);
  writer.push(0, terminator);
  while (writer.bits.length % 8 !== 0) {
    writer.bits.push(0);
  }

  const dataWords = writer.toCodewords();
  const totalDataWords = capacity / 8;
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (dataWords.length < totalDataWords) {
    dataWords.push(padBytes[padIndex % 2]);
    padIndex++;
  }

  const levelIdx = LEVEL_INDEX[level];
  const blocks = BLOCK_COUNT[version - 1][levelIdx];
  const eccLength = ECC_PER_BLOCK[version - 1][levelIdx];
  const shortLen = Math.floor(totalDataWords / blocks);
  const longCount = totalDataWords % blocks;

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const len = shortLen + (b >= blocks - longCount ? 1 : 0);
    const chunk = dataWords.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(chunk);
    eccBlocks.push(reedSolomon(chunk, eccLength));
  }

  const interleaved: number[] = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let col = 0; col < maxData; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) {
        interleaved.push(block[col]);
      }
    }
  }
  for (let col = 0; col < eccLength; col++) {
    for (const block of eccBlocks) {
      interleaved.push(block[col]);
    }
  }
  return interleaved;
};

type Grid = Int8Array[];

const makeGrid = (dimension: number): Grid => {
  const grid: Grid = [];
  for (let r = 0; r < dimension; r++) {
    grid.push(new Int8Array(dimension).fill(-1));
  }
  return grid;
};

const stampFinder = (grid: Grid, reserved: boolean[][], row: number, col: number): void => {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= grid.length || c >= grid.length) {
        continue;
      }
      reserved[r][c] = true;
      const isSeparator = dr === -1 || dr === 7 || dc === -1 || dc === 7;
      const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      grid[r][c] = !isSeparator && (onRing || inCore) ? 1 : 0;
    }
  }
};

const stampAlignment = (grid: Grid, reserved: boolean[][], cr: number, cc: number): void => {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = cr + dr;
      const c = cc + dc;
      reserved[r][c] = true;
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      grid[r][c] = ring === 1 ? 0 : 1;
    }
  }
};

const placeStructures = (grid: Grid, reserved: boolean[][], version: number): void => {
  const dim = grid.length;
  stampFinder(grid, reserved, 0, 0);
  stampFinder(grid, reserved, 0, dim - 7);
  stampFinder(grid, reserved, dim - 7, 0);

  for (let i = 8; i < dim - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (grid[6][i] === -1) {
      grid[6][i] = bit;
      reserved[6][i] = true;
    }
    if (grid[i][6] === -1) {
      grid[i][6] = bit;
      reserved[i][6] = true;
    }
  }

  const centers = ALIGNMENT_CENTERS[version - 1];
  const last = dim - 7;
  const collidesWithFinder = (cr: number, cc: number): boolean => {
    const tl = cr === 6 && cc === 6;
    const tr = cr === 6 && cc === last;
    const bl = cr === last && cc === 6;
    return tl || tr || bl;
  };
  for (const cr of centers) {
    for (const cc of centers) {
      if (collidesWithFinder(cr, cc)) {
        continue;
      }
      stampAlignment(grid, reserved, cr, cc);
    }
  }

  grid[dim - 8][8] = 1;
  reserved[dim - 8][8] = true;

  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) {
      reserved[8][i] = true;
    }
    if (!reserved[i][8]) {
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][dim - 1 - i] = true;
    reserved[dim - 1 - i][8] = true;
  }

  if (version >= 7) {
    let remainder = version << 12;
    for (let bit = 17; bit >= 12; bit--) {
      if ((remainder >>> bit) & 1) {
        remainder ^= 0x1f25 << (bit - 12);
      }
    }
    const versionBits = ((version << 12) | (remainder & 0xfff)) >>> 0;
    for (let i = 0; i < 18; i++) {
      const bit = (versionBits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + dim - 11;
      grid[a][b] = bit as 0 | 1;
      grid[b][a] = bit as 0 | 1;
      reserved[a][b] = true;
      reserved[b][a] = true;
    }
  }
};

const placePayload = (grid: Grid, reserved: boolean[][], codewords: number[]): void => {
  const dim = grid.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let col = dim - 1; col > 0; col -= 2) {
    if (col === 6) {
      col = 5;
    }
    for (let step = 0; step < dim; step++) {
      const row = upward ? dim - 1 - step : step;
      for (let lane = 0; lane < 2; lane++) {
        const c = col - lane;
        if (reserved[row][c]) {
          continue;
        }
        let bit = 0;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >>> 3];
          bit = (byte >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        grid[row][c] = bit as 0 | 1;
      }
    }
    upward = !upward;
  }
};

const maskRule = (pattern: number, row: number, col: number): boolean => {
  switch (pattern) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
};

const applyFormatInfo = (grid: Grid, level: CorrectionLevel, pattern: number): void => {
  const dim = grid.length;
  const levelBits: Record<CorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };
  const data = (levelBits[level] << 3) | pattern;
  let value = data << 10;
  for (let i = 0; i < 10; i++) {
    if ((value >>> (14 - i)) & 1) {
      value ^= 0x537 << (4 - i);
    }
  }
  const format = ((data << 10) | (value & 0x3ff)) ^ 0x5412;

  for (let i = 0; i <= 5; i++) {
    grid[i][8] = ((format >>> i) & 1) as 0 | 1;
  }
  grid[7][8] = ((format >>> 6) & 1) as 0 | 1;
  grid[8][8] = ((format >>> 7) & 1) as 0 | 1;
  grid[8][7] = ((format >>> 8) & 1) as 0 | 1;
  for (let i = 9; i < 15; i++) {
    grid[8][14 - i] = ((format >>> i) & 1) as 0 | 1;
  }

  for (let i = 0; i < 8; i++) {
    grid[8][dim - 1 - i] = ((format >>> i) & 1) as 0 | 1;
  }
  for (let i = 8; i < 15; i++) {
    grid[dim - 15 + i][8] = ((format >>> i) & 1) as 0 | 1;
  }
};

const scorePenalty = (grid: Grid): number => {
  const dim = grid.length;
  let penalty = 0;

  for (let r = 0; r < dim; r++) {
    let runColor = grid[r][0];
    let runLen = 1;
    for (let c = 1; c < dim; c++) {
      if (grid[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) {
          penalty += 3 + (runLen - 5);
        }
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) {
      penalty += 3 + (runLen - 5);
    }
  }

  for (let c = 0; c < dim; c++) {
    let runColor = grid[0][c];
    let runLen = 1;
    for (let r = 1; r < dim; r++) {
      if (grid[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) {
          penalty += 3 + (runLen - 5);
        }
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) {
      penalty += 3 + (runLen - 5);
    }
  }

  for (let r = 0; r < dim - 1; r++) {
    for (let c = 0; c < dim - 1; c++) {
      const cell = grid[r][c];
      if (cell === grid[r][c + 1] && cell === grid[r + 1][c] && cell === grid[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  let dark = 0;
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (grid[r][c] === 1) {
        dark++;
      }
    }
  }
  const ratio = (dark * 100) / (dim * dim);
  penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return penalty;
};

const cloneGrid = (grid: Grid): Grid => grid.map((row) => Int8Array.from(row));

const renderMatrix = (text: string, level: CorrectionLevel): boolean[][] => {
  const segment = toByteSegment(text);
  const version = pickVersion(segment.length, level);
  const codewords = assembleCodewords(segment, version, level);
  const dim = version * 4 + 17;

  const baseGrid = makeGrid(dim);
  const reserved: boolean[][] = [];
  for (let r = 0; r < dim; r++) {
    reserved.push(new Array(dim).fill(false));
  }
  placeStructures(baseGrid, reserved, version);
  placePayload(baseGrid, reserved, codewords);

  let bestGrid: Grid | null = null;
  let bestScore = Infinity;
  for (let pattern = 0; pattern < 8; pattern++) {
    const candidate = cloneGrid(baseGrid);
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        if (!reserved[r][c] && maskRule(pattern, r, c)) {
          candidate[r][c] = (candidate[r][c] ^ 1) as 0 | 1;
        }
      }
    }
    applyFormatInfo(candidate, level, pattern);
    const score = scorePenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestGrid = candidate;
    }
  }

  const result: boolean[][] = [];
  const chosen = bestGrid as Grid;
  for (let r = 0; r < dim; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < dim; c++) {
      row.push(chosen[r][c] === 1);
    }
    result.push(row);
  }
  return result;
};

const nearestOdd = (n: number): number => {
  const ceiled = Math.ceil(n);
  return ceiled % 2 === 0 ? ceiled + 1 : ceiled;
};

const QRCode: React.FC<QRCodeProps> = ({ value = '', size, isLogoRendered = true, logoSize = 80, ecl = 'H' }) => {
  const layout = useMemo(() => {
    const matrix = renderMatrix(value, ecl);
    const count = matrix.length;
    const unit = size / (count + 2);

    let clearance = 0;
    let clearStart = 0;
    if (isLogoRendered) {
      const wanted = (logoSize + unit) / unit;
      clearance = Math.min(nearestOdd(wanted), count);
      clearStart = Math.floor((count - clearance) / 2);
    }
    const clearEnd = clearStart + clearance;

    const eyeAnchors: Array<[number, number]> =
      count >= 7
        ? [
            [0, 0],
            [0, count - 7],
            [count - 7, 0],
          ]
        : [];
    const withinEye = (r: number, c: number): boolean =>
      eyeAnchors.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);

    let modulePath = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) {
          continue;
        }
        if (isLogoRendered && r >= clearStart && r < clearEnd && c >= clearStart && c < clearEnd) {
          continue;
        }
        if (withinEye(r, c)) {
          continue;
        }
        const px = (c + 1) * unit;
        const py = (r + 1) * unit;
        modulePath += `M${px} ${py}h${unit}v${unit}h-${unit}z`;
      }
    }
    return { unit, modulePath, eyeAnchors, clearance, clearStart };
  }, [value, ecl, size, isLogoRendered, logoSize]);

  const { unit, modulePath, eyeAnchors, clearance, clearStart } = layout;

  const eyeShapes: React.ReactElement[] = [];
  const frameRadius = 2 * unit;
  const gapRadius = 1.25 * unit;
  const pupilRadius = 0.9 * unit;
  eyeAnchors.forEach(([er, ec], i) => {
    const x = (ec + 1) * unit;
    const y = (er + 1) * unit;
    eyeShapes.push(
      <Rect key={`frame-${i}`} x={x} y={y} width={7 * unit} height={7 * unit} rx={frameRadius} ry={frameRadius} fill={MODULE_COLOR} />,
      <Rect
        key={`gap-${i}`}
        x={x + unit}
        y={y + unit}
        width={5 * unit}
        height={5 * unit}
        rx={gapRadius}
        ry={gapRadius}
        fill={CANVAS_COLOR}
      />,
      <Rect
        key={`pupil-${i}`}
        x={x + 2 * unit}
        y={y + 2 * unit}
        width={3 * unit}
        height={3 * unit}
        rx={pupilRadius}
        ry={pupilRadius}
        fill={MODULE_COLOR}
      />,
    );
  });

  const plateX = (clearStart + 1) * unit;
  const plateY = (clearStart + 1) * unit;
  const plateSize = clearance * unit;
  const center = size / 2;
  const logoCornerRadius = Math.min(logoSize * 0.2, RADIUS.card);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id="brandlogoclip">
            <Rect
              x={center - logoSize / 2}
              y={center - logoSize / 2}
              width={logoSize}
              height={logoSize}
              rx={logoCornerRadius}
              ry={logoCornerRadius}
            />
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={CANVAS_COLOR} />
        {modulePath ? <Path d={modulePath} fill={MODULE_COLOR} /> : null}
        {eyeShapes}
        {isLogoRendered && clearance > 0 && (
          <>
            <Rect
              x={plateX}
              y={plateY}
              width={plateSize}
              height={plateSize}
              rx={unit * 0.5}
              ry={unit * 0.5}
              fill={LOGO_PLATE_COLOR}
            />
            <SvgImage
              href={BRAND_LOGO}
              x={center - logoSize / 2}
              y={center - logoSize / 2}
              width={logoSize}
              height={logoSize}
              preserveAspectRatio="xMidYMid meet"
              clipPath="url(#brandlogoclip)"
            />
          </>
        )}
      </Svg>
    </View>
  );
};

export default QRCode;

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
