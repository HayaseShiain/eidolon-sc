"use client";

// PROTOTYPE：落地页第 5 幕「记忆」的 3D 纪念碑谷式场景。只在 prototype/landing-memory-3d 分支，不进 main。
// 第一轮的问题：角色用哪种做法 → 定了方块小人。第二轮：方块小人做精细、场景加料（AI 的梗只作点缀，闪彩的东西）。
// 一页、几个变体（?variant=），场景、镜头、叙事共用，只换角色。页面钉住一个舞台，滚过 9 屏走完整段。

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { PrototypeSwitcher } from "./PrototypeSwitcher";
import { buildFigure, type Figure, type Style } from "./figures";
import { buildWorld, IDOLS, pedTop, smooth, STORED_AT } from "./world";

const VARIANTS: { key: Style; name: string }[] = [
  { key: "hunyuan", name: "体素·混元 3D·96 格" },
  { key: "hunyuan-80", name: "体素·混元 3D·80 格" },
  { key: "hunyuan-64", name: "体素·混元 3D·64 格" },
  { key: "sculpt", name: "体素·手捏（真乃）" },
  { key: "carved", name: "体素·三视图雕刻" },
  { key: "voxel", name: "方块小人·精细" },
  { key: "voxel-lo", name: "方块小人·第一轮" },
  { key: "pixel", name: "像素立牌" },
  { key: "paper", name: "面片立牌" },
];

const BEATS = [
  { at: 0, name: "0 全景" },
  { at: 0.08, name: "1 你给真乃发了条消息" },
  { at: 0.18, name: "2 真乃想了想，收进记忆" },
  { at: 0.3, name: "3 转台转动，桥接上" },
  { at: 0.42, name: "4 记忆沿桥传给果穗" },
  { at: 0.53, name: "5 果穗想起它、说起它" },
  { at: 0.64, name: "6 台阶升起" },
  { at: 0.74, name: "7 传给冬优子和雾子" },
  { at: 0.86, name: "8 全景：都是真乃的颜色" },
];

/** 镜头关键帧：注视点、取景半径（世界单位）、方位角（度）。 */
const CAMERA: { p: number; target: [number, number, number]; r: number; az: number }[] = [
  { p: 0, target: [3.6, 0.2, 0.6], r: 9.0, az: 45 },
  { p: 0.07, target: [2.6, 1.2, 0.6], r: 7.4, az: 42 },
  { p: 0.17, target: [0, 1.0, 0.1], r: 3.2, az: 38 },
  { p: 0.29, target: [0.2, 0.7, -0.1], r: 3.0, az: 52 },
  { p: 0.4, target: [2.5, 0.4, 0.2], r: 5.0, az: 28 },
  { p: 0.53, target: [5, 0.8, 0], r: 3.4, az: 36 },
  { p: 0.62, target: [5.1, 0.6, 0.3], r: 3.6, az: 48 },
  { p: 0.72, target: [7, 0, 2.2], r: 7.0, az: 62 },
  { p: 0.84, target: [7.2, 0, 2.2], r: 6.6, az: 50 },
  { p: 1, target: [4.2, -0.2, 1.2], r: 8.8, az: 45 },
];
const ELEVATION = THREE.MathUtils.degToRad(35.264);
const LINEUP_Y = 30;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function cameraAt(p: number) {
  let k = 0;
  while (k < CAMERA.length - 2 && p > CAMERA[k + 1].p) k++;
  const a = CAMERA[k];
  const b = CAMERA[k + 1];
  const t = smooth(a.p, b.p, p);
  return {
    target: new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), t),
    r: lerp(a.r, b.r, t),
    az: THREE.MathUtils.degToRad(lerp(a.az, b.az, t)),
  };
}

type Bubble = { key: string; x: number; y: number; o: number; ja?: string; zh: string; kind: "you" | "her" | "thinking" | "chip" };
type Overlay = { hud: string; copy: number; final: number; bubbles: Bubble[] };

export function MemoryPrototype({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const style = (VARIANTS.find((v) => v.key === params.get("variant"))?.key ?? "hunyuan") as Style;
  /** ?lineup=1：四个人排成一排，滚动转镜头看正面、侧面、背面。 */
  const lineup = params.get("lineup") === "1";
  /** ?lineup=1&only=mano：只看一个人，放大。 */
  const only = IDOLS.findIndex((i) => i.id === params.get("only"));
  const host = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<Overlay>({ hud: "", copy: 1, final: 0, bubbles: [] });

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);

    scene.add(new THREE.HemisphereLight(0xc9c2ff, 0x2a1f3d, 1.5));
    const sun = new THREE.DirectionalLight(0xffe2cc, 2.2);
    sun.position.set(2, 10, 7);
    sun.target.position.set(5, 0, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 0.5, far: 50 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x8a7cff, 0.6);
    fill.position.set(8, 2, -2);
    scene.add(fill);

    const world = buildWorld(scene);
    if (lineup) {
      const stage = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 2), new THREE.MeshLambertMaterial({ color: "#d9cbe8" }));
      stage.position.set(0, LINEUP_Y - 0.15, 0);
      scene.add(stage);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.94);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // —— 角色。
    const figures: Figure[] = [];
    let alive = true;
    Promise.all(IDOLS.map((idol) => buildFigure(style, idol.id))).then((fs) => {
      if (!alive) return fs.forEach((f) => f.dispose());
      fs.forEach((f, k) => {
        if (lineup) {
          f.group.position.set(only >= 0 ? 0 : (k - 1.5) * 1.25, LINEUP_Y, 0);
          f.group.visible = only < 0 || only === k;
        }
        else f.group.position.copy(IDOLS[k].at);
        f.group.traverse((o) => (o.castShadow = o instanceof THREE.Mesh && !(o.material as THREE.MeshBasicMaterial).transparent));
        scene.add(f.group);
        figures[k] = f;
      });
    });

    let w = 1;
    let h = 1;
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const progressOf = () => {
      const r = section.current!.getBoundingClientRect();
      return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
    };
    let shown = progressOf();
    let raf = 0;
    let lastKey = "";
    const project = (v: THREE.Vector3) => {
      const q = v.clone().project(camera);
      return { x: (q.x * 0.5 + 0.5) * w, y: (-q.y * 0.5 + 0.5) * h };
    };
    const headOf = (k: number) => IDOLS[k].at.clone().add(new THREE.Vector3(0, 1.95, 0));
    const face = (k: number, toward: THREE.Vector3 | null, camAz: number, weight: number) => {
      const f = figures[k];
      if (!f) return;
      const to = toward ? Math.atan2(toward.x - IDOLS[k].at.x, toward.z - IDOLS[k].at.z) : camAz;
      const delta = Math.atan2(Math.sin(to - camAz), Math.cos(to - camAz));
      f.aim(camAz, camAz + delta * weight);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const time = now / 1000;
      // 看人的时候不平滑：镜头直接到滚动的位置，截图才准。
      shown = lineup ? progressOf() : shown + (progressOf() - shown) * 0.1;
      const p = shown;

      if (lineup) {
        const az = Math.PI / 4 + p * Math.PI * 2;
        const half = (only >= 0 ? 0.95 : 1.25) * Math.max(1, 1.1 / (w / h));
        Object.assign(camera, { left: (-half * w) / h, right: (half * w) / h, top: half, bottom: -half });
        const el2 = THREE.MathUtils.degToRad(14);
        const target = new THREE.Vector3(0, LINEUP_Y + 0.8, 0);
        camera.position.copy(target).add(new THREE.Vector3(Math.sin(az) * Math.cos(el2), Math.sin(el2), Math.cos(az) * Math.cos(el2)).multiplyScalar(40));
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        world.update(0, time, az);
        figures.forEach((f) => {
          if (!f) return;
          f.aim(0, 0);
          f.update(time, 0, 0);
        });
        composer.render();
        const hud = `lineup · ${style} · 镜头 ${Math.round(45 + p * 360) % 360}°`;
        if (hud !== lastKey) {
          lastKey = hud;
          setOverlay({ hud, copy: 0, final: 0, bubbles: [] });
        }
        return;
      }
      const cam = cameraAt(p);
      const aspect = w / h;
      const half = aspect >= 1 ? cam.r : cam.r * Math.max(1, 0.9 / aspect);
      Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
      const dir = new THREE.Vector3(Math.sin(cam.az) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(cam.az) * Math.cos(ELEVATION));
      camera.position.copy(cam.target).addScaledVector(dir, 40);
      camera.lookAt(cam.target);
      camera.updateProjectionMatrix();

      world.update(p, time, cam.az);

      // 角色：收到时跳一下，真乃举手接住，传出去时转向对方。
      const hop = (a: number) => (p > a && p < a + 0.035 ? Math.sin(((p - a) / 0.035) * Math.PI) : 0);
      const hops = [hop(0.165), hop(STORED_AT[1]), hop(STORED_AT[2] - 0.005), hop(STORED_AT[3] - 0.005)];
      figures.forEach((f, k) => {
        if (!f) return;
        f.group.position.y = IDOLS[k].at.y + hops[k] * 0.3;
        f.update(time, hops[k], k === 0 ? smooth(0.13, 0.17, p) * (1 - smooth(0.2, 0.23, p)) : 0);
      });
      const mid = IDOLS[2].at.clone().lerp(IDOLS[3].at, 0.5);
      face(0, IDOLS[1].at, cam.az, smooth(0.4, 0.44, p) * (1 - smooth(0.54, 0.58, p)));
      face(1, p < 0.6 ? IDOLS[0].at : mid, cam.az, p < 0.6 ? smooth(0.48, 0.52, p) * (1 - smooth(0.56, 0.6, p)) : smooth(0.72, 0.75, p) * (1 - smooth(0.86, 0.9, p)));
      face(2, IDOLS[1].at, cam.az, smooth(0.72, 0.76, p) * (1 - smooth(0.85, 0.88, p)));
      face(3, IDOLS[1].at, cam.az, smooth(0.72, 0.76, p) * (1 - smooth(0.86, 0.89, p)));

      composer.render();

      // 文字层：气泡跟着角色的头，「想起」的小标签在记忆柱上。
      const beat = [...BEATS].reverse().find((b) => p >= b.at)!;
      const win = (a: number, b: number) => smooth(a, a + 0.012, p) * (1 - smooth(b - 0.012, b, p));
      const b = (key: string, at: THREE.Vector3, o: number, kind: Bubble["kind"], zh: string, ja?: string): Bubble => ({ key, ...project(at), o, kind, zh, ja });
      const above = (v: THREE.Vector3, dy: number) => v.clone().add(new THREE.Vector3(0, dy, 0));
      const next: Overlay = {
        hud: `${style} · ${(p * 100).toFixed(1)}% · ${beat.name}`,
        copy: 1 - smooth(0.05, 0.08, p),
        final: smooth(0.9, 0.95, p),
        bubbles: [
          b("you", above(world.message, 0.3), win(0.1, 0.19), "you", "下周要考试了，有点紧张。"),
          b("think", headOf(0), win(0.185, 0.225), "thinking", "思考中"),
          b("mano", headOf(0), win(0.225, 0.3), "her", "我记住了。", "うん、覚えておきますね"),
          b("chip-kaho", above(pedTop(1), 0.25), win(0.535, 0.6), "chip", "想起 1 条记忆 · 来自真乃"),
          b("kaho", headOf(1), win(0.56, 0.66), "her", "听真乃说你要考试了，加油！", "真乃さんから聞きました！ファイトです！"),
          b("chip-fuyuko", above(pedTop(2), 0.25), win(0.845, 0.89), "chip", "想起 1 条记忆 · 来自真乃"),
          b("chip-kiriko", above(pedTop(3), 0.25), win(0.855, 0.9), "chip", "想起 1 条记忆 · 来自真乃"),
          b("fuyuko", headOf(2), win(0.875, 0.985), "her", "考试？真乃跟我说了。", "テストでしょ？真乃から聞いたわよ"),
          b("kiriko", headOf(3), win(0.885, 0.985), "her", "听真乃说了……别太勉强……", "真乃ちゃんから……聞きました……"),
        ],
      };
      const key = JSON.stringify(next);
      if (key !== lastKey) {
        lastKey = key;
        setOverlay(next);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      figures.forEach((f) => f?.dispose());
      world.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [style, lineup, only]);

  return (
    <div className="lp-root" style={{ background: "#0b0918", color: "#eeecf2", minHeight: "100vh" }}>
      <div style={{ height: "70vh", display: "grid", placeItems: "center", fontFamily: "var(--lp-zh)", opacity: 0.6 }}>（前面是第 4 幕「来电」）往下滚 ↓</div>
      <div ref={section} style={{ height: "900vh", position: "relative" }}>
        <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
          <div ref={host} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", left: "max(24px, 6vw)", top: "14vh", maxWidth: "26rem", opacity: overlay.copy, pointerEvents: "none" }}>
            <h2 style={{ fontFamily: "var(--lp-zh-title)", fontSize: "clamp(1.6rem, 3.4vw, 2.6rem)", lineHeight: 1.3, margin: 0 }}>{title}</h2>
            <p style={{ fontFamily: "var(--lp-zh)", opacity: 0.75, lineHeight: 1.8, marginTop: "1rem" }}>{body}</p>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "22vh", textAlign: "center", opacity: overlay.final, fontFamily: "var(--lp-zh-title)", fontSize: "clamp(1.1rem, 2.4vw, 1.6rem)", pointerEvents: "none", textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}>
            她们会记住你的事情，然后在所有人之间传开。
          </div>
          {overlay.bubbles.map((b) => (b.o > 0.01 ? <BubbleView key={b.key} b={b} /> : null))}
          <div style={{ position: "absolute", right: 12, top: 12, font: "12px ui-monospace, monospace", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: 6, color: "#ffe680" }}>
            PROTOTYPE · {overlay.hud}
          </div>
        </div>
      </div>
      <div style={{ height: "80vh", display: "grid", placeItems: "center", fontFamily: "var(--lp-zh)", opacity: 0.6 }}>（后面是第 6 幕「使用须知」）</div>
      <PrototypeSwitcher variants={VARIANTS} current={style} onChange={(key) => router.replace(`?variant=${key}${lineup ? "&lineup=1" : ""}${only >= 0 ? `&only=${IDOLS[only].id}` : ""}`, { scroll: false })} />
    </div>
  );
}

function BubbleView({ b }: { b: Bubble }) {
  const chip = b.kind === "chip";
  const thinking = b.kind === "thinking";
  return (
    <div
      style={{
        position: "absolute",
        left: b.x,
        top: b.y,
        transform: `translate(-50%, calc(-100% - ${chip ? 4 : 10}px)) translateY(${(1 - b.o) * 8}px)`,
        opacity: b.o,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        padding: chip ? "0.2rem 0.6rem" : "0.45rem 0.8rem",
        borderRadius: chip ? 999 : 16,
        background: b.kind === "you" ? "#1c2a4a" : chip ? "rgba(24,18,46,0.72)" : thinking ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.94)",
        border: chip ? "1px solid rgba(255,186,214,0.45)" : undefined,
        color: b.kind === "you" || chip ? "#fbfcfe" : "#1a1626",
        boxShadow: chip ? undefined : "0 6px 24px rgba(0,0,0,0.35)",
        fontFamily: "var(--lp-zh)",
        fontSize: chip ? 11 : 14,
        lineHeight: 1.45,
        textAlign: "center",
      }}
    >
      {chip && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: "#ffbad6", marginRight: 6, verticalAlign: "middle" }} />}
      {thinking ? (
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          {b.zh}
          <span className="mp-dots">…</span>
        </span>
      ) : (
        <>
          {b.ja && (
            <div lang="ja" style={{ fontSize: 15 }}>
              {b.ja}
            </div>
          )}
          <div style={{ fontSize: b.ja ? 12 : chip ? 11 : 14, opacity: b.ja ? 0.65 : chip ? 0.85 : 1, display: chip ? "inline" : "block" }}>{b.zh}</div>
        </>
      )}
    </div>
  );
}
