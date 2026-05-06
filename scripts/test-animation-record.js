/**
 * アニメーション録画テストスクリプト（BOA-66 事前検証用）
 *
 * 動作確認後に削除する一時スクリプト。
 * 実行: node scripts/test-animation-record.js
 *
 * 録画内容:
 *   スタンダード → 本命狙い → 穴狙い の順で各モデルを流す
 *   各モデル: アニメーション × 3回（リプレイ2回）→ 1秒待機 → 注目データ 3秒表示
 */

import { chromium } from "playwright";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const OUT_DIR = "/tmp/pw-video-test";
const TARGET_URL = "https://www.boat-ai.jp/";
const VIEWPORT = { width: 375, height: 900 };
const FLASH_DISPLAY_SEC = 3;
const AFTER_ANIM_WAIT_SEC = 1;
const ANIM_TIMEOUT_MS = 15000;

const MODELS = [
  { key: "standard", label: "スタンダード", btnText: "スタンダード" },
  { key: "safe-bet", label: "本命狙い", btnText: "本命狙い" },
  { key: "upset-focus", label: "穴狙い", btnText: "穴狙い" },
];

async function waitReplay(replayBtn) {
  await replayBtn.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  await replayBtn.waitFor({ state: "visible", timeout: ANIM_TIMEOUT_MS });
}

async function playModel(page, model, index) {
  console.log(`\n===== [モデル ${index + 1}/3] ${model.label} =====`);

  // モデル切替（クリック後アニメーションが再スタートする）
  const modelBtn = page.locator(`button:has-text('${model.btnText}')`).first();
  await modelBtn.click();
  console.log(`  モデル切替: ${model.label}`);

  // key={selectedModel} による再マウントを待つ: 一度 detached → visible の順で待つ
  const animEl = page.locator(".first-mark-animation").first();
  await animEl.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  await animEl.waitFor({ state: "visible", timeout: 20000 });
  await animEl.scrollIntoViewIfNeeded();

  const animBbox = await animEl.boundingBox();
  console.log(
    `  animBbox: x=${animBbox?.x?.toFixed(0)}, y=${animBbox?.y?.toFixed(0)}, w=${animBbox?.width?.toFixed(0)}, h=${animBbox?.height?.toFixed(0)}`,
  );

  // 自動再生の完了を待つ（スキップ扱い）
  const replayBtn = page.locator(".first-mark-animation__replay-btn").first();
  await replayBtn.waitFor({ state: "visible", timeout: ANIM_TIMEOUT_MS });
  console.log("  自動再生完了（スキップ）");

  // リプレイ × 3
  for (let i = 1; i <= 3; i++) {
    await replayBtn.click();
    const startMs = Date.now();
    await waitReplay(replayBtn);
    console.log(
      `  リプレイ ${i}/3 完了 (${((Date.now() - startMs) / 1000).toFixed(2)}秒)`,
    );
  }

  // 3回目完了後 1秒待機
  console.log(`  ${AFTER_ANIM_WAIT_SEC}秒待機...`);
  await page.waitForTimeout(AFTER_ANIM_WAIT_SEC * 1000);

  // 注目データへスクロール
  const flashEl = page.locator(".prediction-flash").first();
  const flashVisible = await flashEl
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  let flashBbox = null;
  if (flashVisible) {
    const flashHandle = await flashEl.elementHandle();
    const cardAbsoluteTop = await page.evaluate(
      (el) => el.getBoundingClientRect().top + window.pageYOffset,
      flashHandle,
    );
    await page.evaluate(
      (scrollY) => window.scrollTo({ top: scrollY, behavior: "instant" }),
      cardAbsoluteTop - 60,
    );
    await page.waitForTimeout(300);

    flashBbox = await flashEl.boundingBox();
    console.log(
      `  注目データ (x=${flashBbox?.x?.toFixed(0)}, y=${flashBbox?.y?.toFixed(0)}, w=${flashBbox?.width?.toFixed(0)}, h=${flashBbox?.height?.toFixed(0)})`,
    );
    await page.waitForTimeout(FLASH_DISPLAY_SEC * 1000);
    console.log(`  ${FLASH_DISPLAY_SEC}秒間表示完了`);
  } else {
    console.log("  ⚠️  注目データが見つかりません");
    await page.waitForTimeout(FLASH_DISPLAY_SEC * 1000);
  }

  return { animBbox, flashBbox };
}

async function main() {
  console.log("=== アニメーション録画テスト開始（3モデル） ===");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    reducedMotion: "no-preference",
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();

  // 広告リクエストをブロック
  await page.route(
    /\/(googlesyndication|doubleclick|adservice|googletagmanager|googletagservices|googlea[dp]services|amazon-adsystem|adsystem|adnxs|adzerk|outbrain|taboola|criteo|pubmatic|openx|rubiconproject|appnexus|smartadserver)\./,
    (route) => route.abort(),
  );

  const contextStartMs = Date.now();

  // [1] ページ読み込み
  console.log(`\n[1] ${TARGET_URL} を開いています...`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30000 });

  // 広告・オーバーレイをCSS注入で非表示
  await page.addStyleTag({
    content: `
      iframe[src*="ad"], iframe[id*="ad"], iframe[class*="ad"],
      div[id*="ad-"], div[class*="ad-"], div[id*="-ad"], div[class*="-ad"],
      div[id*="banner"], div[class*="banner"],
      div[id*="overlay"], div[class*="overlay"],
      ins.adsbygoogle,
      [data-ad], [data-ads],
      .adsbygoogle, .ad-container, .ad-wrapper, .advertisement,
      #google_ads_iframe, .google-ad,
      div[class*="plaza"], div[id*="plaza"],
      div[class*="ticker"], div[id*="ticker"],
      div[class*="marquee"], div[id*="marquee"]
      { display: none !important; }
    `,
  });

  console.log("    ページ読み込み完了（広告ブロック適用済み）");

  // Cookieバナーを閉じる（あれば）
  const cookieBtn = page.locator("button:has-text('同意する')").first();
  const hasCookie = await cookieBtn
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (hasCookie) {
    await cookieBtn.click();
    console.log("    Cookie同意済み");
  }

  // [2] 「AI予想を見る」クリック
  console.log('\n[2] "AI予想を見る" ボタンを探しています...');
  const predictBtn = page.locator(".predict-btn").first();
  const btnVisible = await predictBtn
    .isVisible({ timeout: 10000 })
    .catch(() => false);
  if (!btnVisible) {
    console.log("    ⚠️  レースカードが見つかりません（本日開催なし？）");
    await page.screenshot({ path: path.join(OUT_DIR, "no-race.png") });
    await browser.close();
    return;
  }
  console.log("    ✅ ボタン発見 → クリック");
  await predictBtn.click();

  // [3] 最初のアニメーション出現待ち（デフォルトモデルの自動再生）
  console.log("\n[3] 最初のアニメーション出現待ち...");
  const animElFirst = page.locator(".first-mark-animation").first();
  await animElFirst.waitFor({ state: "visible", timeout: 20000 });
  const firstAppearMs = Date.now();
  console.log(
    `    ✅ 出現 (${((firstAppearMs - contextStartMs) / 1000).toFixed(2)}秒後)`,
  );

  // [4] 3モデルをループ
  let firstReplayStartMs = null;
  let cropAnimBbox = null;
  let cropFlashBbox = null;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const { animBbox, flashBbox } = await playModel(page, model, i);

    if (i === 0) {
      // 最初のモデルのbboxをffmpegクロップ基準に使う
      cropAnimBbox = animBbox;
      cropFlashBbox = flashBbox;
    }
  }

  // ffmpeg用: 録画開始〜ページ内容が落ち着くまでの時間 + モデル1の自動再生分をスキップ
  // ここでは contextStartMs から firstAppearMs + ANIM_TIMEOUT相当 をスキップするのが難しいので
  // firstAppearMs（アニメーション出現時刻）から -0.1秒をトリム開始とする
  firstReplayStartMs = firstAppearMs;

  // [5] スクリーンショット保存
  await page.screenshot({ path: path.join(OUT_DIR, "final-frame.png") });

  // [6] ブラウザを閉じる
  console.log("\n[6] ブラウザを閉じています...");
  const video = page.video();
  await browser.close();

  const rawWebm = await video.path();
  const endMs = Date.now();
  console.log(`    生録画: ${rawWebm}`);
  console.log(
    `    サイズ: ${(fs.statSync(rawWebm).size / 1024).toFixed(0)} KB`,
  );

  // [7] ffmpegでクロップ
  try {
    execSync("which ffmpeg", { stdio: "ignore" });
    console.log("\n[7] ffmpegでクロップ中...");

    // トリム開始: アニメーション出現直前
    const ss = Math.max(
      0,
      (firstReplayStartMs - contextStartMs) / 1000 - 0.1,
    ).toFixed(2);

    // トリム時間: 出現〜録画終了
    const trimDuration = ((endMs - firstReplayStartMs) / 1000 + 0.5).toFixed(2);

    // 横クロップ: アニメーション幅
    const cropX = cropAnimBbox ? Math.round(cropAnimBbox.x) : 0;
    const cropW = cropAnimBbox
      ? Math.round(cropAnimBbox.width)
      : VIEWPORT.width;

    // 縦クロップ: 注目データの下端まで
    const flashBottom = cropFlashBbox
      ? Math.min(
          Math.round(cropFlashBbox.y + cropFlashBbox.height + 10),
          VIEWPORT.height,
        )
      : VIEWPORT.height;
    const cropH = flashBottom;

    const cropFilter = `crop=${cropW}:${cropH}:${cropX}:0`;
    const outMp4 = path.join(OUT_DIR, "animation-crop.mp4");
    const cmd = [
      "ffmpeg -y",
      `-i "${rawWebm}"`,
      `-ss ${ss}`,
      `-t ${trimDuration}`,
      `-vf "${cropFilter}"`,
      `-c:v libx264 -pix_fmt yuv420p`,
      `"${outMp4}"`,
    ].join(" ");

    console.log(`    コマンド: ${cmd}`);
    execSync(cmd, { stdio: "pipe" });

    const duration = Math.round(trimDuration);
    console.log(`    ✅ クロップ完了: ${outMp4}`);
    console.log(
      `    サイズ: ${(fs.statSync(outMp4).size / 1024).toFixed(0)} KB`,
    );
    console.log(`    長さ: 約${duration}秒 / クロップ: ${cropFilter}`);
  } catch {
    console.log("\n[7] ffmpeg が見つかりません。スキップ");
  }

  console.log("\n=== テスト完了 ===");
  console.log(`  - 最終フレーム: ${OUT_DIR}/final-frame.png`);
  console.log(`  - クロップMP4: ${OUT_DIR}/animation-crop.mp4`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
