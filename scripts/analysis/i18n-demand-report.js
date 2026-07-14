/**
 * i18n 需要計測レポート（BOA-128）
 *
 * GA4 Data API から英語版（/en/*）のトラフィックを集計し、
 * 次言語（中国語・韓国語等）への投資判断材料を出力する。
 *
 * 使い方:
 *   node scripts/analysis/i18n-demand-report.js [--days=30]
 *
 * 必要な環境変数（.env.local）:
 *   GA4_PROPERTY_ID              - GA4 プロパティID（数字のみ。GA4 管理 > プロパティ設定）
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL - サービスアカウント（GA4 プロパティに「閲覧者」権限が必要）
 *   GOOGLE_PRIVATE_KEY           - サービスアカウントの秘密鍵
 *
 * セットアップ手順は docs/operation/i18n-demand-report.md を参照
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { google } from "googleapis";

const DAYS = parseInt(
  (process.argv.find((a) => a.startsWith("--days=")) || "--days=30").split(
    "=",
  )[1],
  10,
);
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;

if (
  !PROPERTY_ID ||
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY
) {
  console.error(`❌ 環境変数が不足しています。

必要な設定:
  GA4_PROPERTY_ID=123456789        # GA4 管理 > プロパティ設定 > プロパティID
  GOOGLE_SERVICE_ACCOUNT_EMAIL=... # 既存（Google Sheets 連携と共用）
  GOOGLE_PRIVATE_KEY=...           # 既存

さらに GA4 側で、サービスアカウントをプロパティの「閲覧者」に追加してください:
  GA4 管理 > プロパティのアクセス管理 > 追加 > ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "サービスアカウントのメール"}

詳細: docs/operation/i18n-demand-report.md`);
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
});

const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
const property = `properties/${PROPERTY_ID}`;
const dateRanges = [{ startDate: `${DAYS}daysAgo`, endDate: "today" }];

async function runReport(request) {
  const res = await analyticsdata.properties.runReport({
    property,
    requestBody: { dateRanges, ...request },
  });
  return res.data.rows || [];
}

// 1. 言語別（パスプレフィックス別）の PV / ユーザー数
async function reportByLanguagePath() {
  const rows = await runReport({
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
    limit: 10000,
  });

  const agg = { en: { pv: 0, users: 0 }, ja: { pv: 0, users: 0 } };
  for (const row of rows) {
    const p = row.dimensionValues[0].value;
    const lang = p === "/en" || p.startsWith("/en/") ? "en" : "ja";
    agg[lang].pv += parseInt(row.metricValues[0].value, 10);
    // activeUsers はパス横断で重複するため参考値
    agg[lang].users += parseInt(row.metricValues[1].value, 10);
  }
  return agg;
}

// 2. 英語ページの国別トラフィック（次言語判断の材料）
async function reportEnByCountry() {
  const rows = await runReport({
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "BEGINS_WITH", value: "/en" },
      },
    },
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 20,
  });
  return rows.map((r) => ({
    country: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    pv: parseInt(r.metricValues[1].value, 10),
  }));
}

// 3. 言語切替イベント
async function reportLanguageSwitches() {
  const rows = await runReport({
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "language_change" },
      },
    },
  });
  return rows.length > 0 ? parseInt(rows[0].metricValues[0].value, 10) : 0;
}

// 4. 英語ページの流入元
async function reportEnBySource() {
  const rows = await runReport({
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "BEGINS_WITH", value: "/en" },
      },
    },
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  return rows.map((r) => ({
    channel: r.dimensionValues[0].value,
    sessions: parseInt(r.metricValues[0].value, 10),
  }));
}

async function main() {
  console.log(
    `\n📊 i18n 需要計測レポート（直近${DAYS}日間）\n${"=".repeat(50)}`,
  );

  const [byLang, enCountries, switches, enSources] = await Promise.all([
    reportByLanguagePath(),
    reportEnByCountry(),
    reportLanguageSwitches(),
    reportEnBySource(),
  ]);

  const enShare =
    byLang.en.pv + byLang.ja.pv > 0
      ? ((byLang.en.pv / (byLang.en.pv + byLang.ja.pv)) * 100).toFixed(2)
      : "0.00";

  console.log(`\n## 言語別トラフィック`);
  console.log(`  日本語: ${byLang.ja.pv.toLocaleString()} PV`);
  console.log(
    `  英語:   ${byLang.en.pv.toLocaleString()} PV（全体の ${enShare}%）`,
  );
  console.log(`  言語切替イベント: ${switches.toLocaleString()} 回`);

  console.log(`\n## 英語ページの国別ユーザー（上位）`);
  if (enCountries.length === 0) {
    console.log("  （データなし）");
  } else {
    for (const c of enCountries.slice(0, 10)) {
      console.log(
        `  ${c.country.padEnd(20)} ${String(c.users).padStart(6)} users / ${String(c.pv).padStart(7)} PV`,
      );
    }
  }

  console.log(`\n## 英語ページの流入チャネル`);
  if (enSources.length === 0) {
    console.log("  （データなし）");
  } else {
    for (const s of enSources) {
      console.log(
        `  ${s.channel.padEnd(20)} ${String(s.sessions).padStart(6)} sessions`,
      );
    }
  }

  // JSON 保存（推移比較用）
  const outDir = path.join(process.cwd(), "data", "analysis", "i18n-demand");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `report-${new Date().toISOString().split("T")[0]}.json`,
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        days: DAYS,
        byLanguage: byLang,
        enShareOfPv: parseFloat(enShare),
        languageSwitches: switches,
        enByCountry: enCountries,
        enBySource: enSources,
      },
      null,
      2,
    ),
  );

  console.log(`\n💾 保存: ${outPath}`);
  console.log(
    `\n判断の目安（3ヶ月後）: 英語PVシェア・国別分布から次言語（中国語/韓国語/東南アジア）の優先度を決定`,
  );
}

main().catch((err) => {
  if (err.code === 403 || /permission/i.test(err.message)) {
    console.error(`❌ GA4 へのアクセス権限がありません。

GA4 管理 > プロパティのアクセス管理 で以下を「閲覧者」に追加してください:
  ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
  } else {
    console.error("❌ レポート生成エラー:", err.message);
  }
  process.exit(1);
});
