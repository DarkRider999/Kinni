// Shared by the browser (photo analysis) and the server (prompt building).

const STANDARD_RATIOS: Array<[string, number]> = [
  ['1:1', 1], ['4:5', 4 / 5], ['2:3', 2 / 3], ['3:4', 3 / 4], ['9:16', 9 / 16],
  ['5:4', 5 / 4], ['3:2', 3 / 2], ['4:3', 4 / 3], ['16:9', 16 / 9], ['21:9', 21 / 9],
];

/** Nearest standard aspect ratio, e.g. 1080x1350 -> "4:5". */
export function nearestAspectRatio(width: number, height: number): string {
  const r = width / height;
  return STANDARD_RATIOS.reduce((best, cur) => (Math.abs(Math.log(cur[1] / r)) < Math.abs(Math.log(best[1] / r)) ? cur : best))[0];
}
