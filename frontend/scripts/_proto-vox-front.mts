// 一次性：把体素 JSON 投成正面的平面图（每列取最靠前的那一块），放大看脸。
import { readFileSync } from "node:fs";
import sharp from "sharp";
const [dir, out] = [process.argv[2], process.argv[3]];
const tiles: Buffer[] = [];
for (const id of ["mano", "kaho", "fuyuko", "kiriko"]) {
  const v = JSON.parse(readFileSync(`public/prototype-memory/${dir}/${id}.json`, "utf8"));
  const [W, H] = v.size;
  const best = new Map<number, [number, number]>();
  for (let i = 0; i < v.voxels.length; i += 4) {
    const [x, y, z, c] = v.voxels.slice(i, i + 4);
    const k = y * W + x;
    const zz = process.env.BACK ? -z : z;
    if (!best.has(k) || best.get(k)![0] < zz) best.set(k, [zz, c]);
  }
  const buf = Buffer.alloc(W * H * 3, 40);
  for (const [k, [, c]] of best) {
    const x = k % W, y = Math.floor(k / W);
    const hex = v.palette[c];
    const o = ((H - 1 - y) * W + x) * 3;
    buf[o] = parseInt(hex.slice(1, 3), 16); buf[o + 1] = parseInt(hex.slice(3, 5), 16); buf[o + 2] = parseInt(hex.slice(5, 7), 16);
  }
  tiles.push(await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize({ height: 480, kernel: "nearest" }).png().toBuffer());
}
await sharp({ create: { width: 1600, height: 480, channels: 3, background: "#282828" } }).composite(tiles.map((t, i) => ({ input: t, left: i * 400, top: 0 }))).png().toFile(out);
