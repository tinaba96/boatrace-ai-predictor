import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UpdateStatus from "./UpdateStatus";
import LoadingScreen from "./LoadingScreen";
import { dataService } from "../services/dataService";
import { STADIUM_NAMES } from "../constants";
import { formatDateShort } from "../utils/formatters";
import { getJSTDateInfo, getDateListJST } from "../utils/dateUtils";
import { HitRaceCard, HitStats, VenueStatsTable } from "./hits";
import "./HitRaces.css";

/**
 * 予測データから的中レースを抽出する
 */
function extractHitRaces(predictions, modelKey) {
  return predictions
    .filter((race) => {
      if (!race.result || !race.result.finished) return false;
      const prediction = race.predictions?.[modelKey] || race.prediction;
      if (!prediction) return false;

      const topPick = prediction.topPick;
      const top3 = prediction.top3;
      const result = race.result;

      const isWinHit = topPick === result.rank1;
      const isPlaceHit = topPick === result.rank1 || topPick === result.rank2;
      const is3FukuHit =
        top3.includes(result.rank1) &&
        top3.includes(result.rank2) &&
        top3.includes(result.rank3);
      const is3TanHit =
        top3[0] === result.rank1 &&
        top3[1] === result.rank2 &&
        top3[2] === result.rank3;

      return isWinHit || isPlaceHit || is3FukuHit || is3TanHit;
    })
    .map((race) => {
      const prediction = race.predictions?.[modelKey] || race.prediction;
      const topPick = prediction.topPick;
      const top3 = prediction.top3;
      const result = race.result;
      const payouts = result.payouts || {};

      const hitTypes = [];
      let totalPayout = 0;

      if (topPick === result.rank1) {
        const payout = payouts.win?.[topPick] || 0;
        hitTypes.push({ type: "単勝", payout });
        totalPayout += payout;
      }

      if (topPick === result.rank1 || topPick === result.rank2) {
        const payout = payouts.place?.[topPick] || 0;
        hitTypes.push({ type: "複勝", payout });
        totalPayout += payout;
      }

      if (
        top3.includes(result.rank1) &&
        top3.includes(result.rank2) &&
        top3.includes(result.rank3)
      ) {
        const sorted = [result.rank1, result.rank2, result.rank3].sort(
          (a, b) => a - b,
        );
        const key = sorted.join("-");
        const payout = payouts.trifecta?.[key] || 0;
        hitTypes.push({ type: "3連複", payout });
        totalPayout += payout;
      }

      if (
        top3[0] === result.rank1 &&
        top3[1] === result.rank2 &&
        top3[2] === result.rank3
      ) {
        const key = `${result.rank1}-${result.rank2}-${result.rank3}`;
        const payout = payouts.trio?.[key] || 0;
        hitTypes.push({ type: "3連単", payout });
        totalPayout += payout;
      }

      const parts = race.raceId.split("-");
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
      const placeCode = parts[3];
      const raceNo = parts[4];

      return {
        raceId: race.raceId,
        venue: STADIUM_NAMES[parseInt(placeCode)] || `${placeCode}番`,
        raceNumber: parseInt(raceNo),
        date,
        placeCode: parseInt(placeCode),
        hitTypes,
        totalPayout,
        prediction,
        result: race.result,
        modelKey,
      };
    })
    .sort((a, b) => b.totalPayout - a.totalPayout);
}

function HitRaces({
  allVenuesData,
  analyzeRace,
  fetchWithRetry,
  lastUpdated,
  onRefresh,
  isRefreshing,
}) {
  const navigate = useNavigate();
  const [rawToday, setRawToday] = useState([]);
  const [rawYesterday, setRawYesterday] = useState([]);
  const [rawAll, setRawAll] = useState([]);
  const [showAllToday, setShowAllToday] = useState(false);
  const [showAllYesterday, setShowAllYesterday] = useState(false);
  const [showAllPeriod, setShowAllPeriod] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [selectedModel, setSelectedModel] = useState("standard");

  const { todayStr, yesterdayStr } = getJSTDateInfo();

  // ステップ1: 今日+昨日を取得（即表示用）
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        setInitialLoading(true);

        const loadDayPredictions = async (dateStr) => {
          try {
            const data = await dataService.getPredictions(dateStr);
            return data.races || [];
          } catch (error) {
            console.warn(`予想データ読み込みエラー (${dateStr}):`, error);
            return [];
          }
        };

        const [todayPredictions, yesterdayPredictions] = await Promise.all([
          loadDayPredictions(todayStr),
          loadDayPredictions(yesterdayStr),
        ]);

        setRawToday(todayPredictions);
        setRawYesterday(yesterdayPredictions);
        setInitialLoading(false);

        // ステップ2: 残りをバックグラウンドで取得
        const dateList = getDateListJST(14);
        const remainingDates = dateList.filter(
          (d) => d !== todayStr && d !== yesterdayStr,
        );

        const remainingPredictions = await Promise.all(
          remainingDates.map((dateStr) => loadDayPredictions(dateStr)),
        );

        // 全14日分を統合（今日+昨日+残り）
        const allPredictions = [
          todayPredictions,
          yesterdayPredictions,
          ...remainingPredictions,
        ].flat();
        setRawAll(allPredictions);
      } catch (error) {
        console.error("的中レース読み込みエラー:", error);
      } finally {
        setInitialLoading(false);
        setBackgroundLoading(false);
      }
    };

    fetchInitial();
  }, [todayStr, yesterdayStr]);

  // selectedModel変更時はuseMemoで再計算（再取得なし）
  const hitRacesToday = useMemo(
    () => extractHitRaces(rawToday, selectedModel),
    [rawToday, selectedModel],
  );

  const hitRacesYesterday = useMemo(
    () => extractHitRaces(rawYesterday, selectedModel),
    [rawYesterday, selectedModel],
  );

  const hitRacesAll = useMemo(
    () => extractHitRaces(rawAll, selectedModel),
    [rawAll, selectedModel],
  );

  const handleCardClick = useCallback(
    (hitRace) => {
      const venueData = (allVenuesData || []).find(
        (v) => v.placeCd === hitRace.placeCode,
      );
      if (venueData && venueData.races) {
        const race = venueData.races.find(
          (r) => r.raceNo === hitRace.raceNumber,
        );
        if (race) {
          const formattedRace = {
            id: `${race.date}-${race.placeCd}-${race.raceNo}`,
            venue: venueData.placeName,
            raceNumber: race.raceNo,
            startTime: race.startTime || "未定",
            weather: race.weather || "不明",
            wave: race.waveHeight || 0,
            wind: race.windVelocity || 0,
            rawData: race,
          };
          analyzeRace(formattedRace);
          navigate("/");
        }
      }
    },
    [allVenuesData, analyzeRace, navigate],
  );

  // ボートレース場別の統計を計算
  const venueStats = useMemo(() => {
    const hitRaces =
      selectedPeriod === "today"
        ? hitRacesToday
        : selectedPeriod === "yesterday"
          ? hitRacesYesterday
          : hitRacesAll;

    const stats = {};
    hitRaces.forEach((race) => {
      const venue = race.venue;
      if (!stats[venue]) {
        stats[venue] = { venue, hitCount: 0, totalPayout: 0 };
      }
      stats[venue].hitCount++;
      stats[venue].totalPayout += race.totalPayout;
    });

    return Object.values(stats).sort((a, b) => b.hitCount - a.hitCount);
  }, [selectedPeriod, hitRacesToday, hitRacesYesterday, hitRacesAll]);

  if (initialLoading) {
    return (
      <LoadingScreen
        title="的中レースを読み込み中..."
        description="データを取得しています"
      />
    );
  }

  if (hitRacesToday.length === 0 && hitRacesYesterday.length === 0) {
    return (
      <div className="no-data-container">
        <div className="icon">&#x1F3AF;</div>
        <h2>的中レースはまだありません</h2>
        <p>レース結果が確定すると、ここに的中レースが表示されます。</p>
      </div>
    );
  }

  const getDisplayRaces = () => {
    if (selectedPeriod === "today")
      return showAllToday ? hitRacesToday : hitRacesToday.slice(0, 8);
    if (selectedPeriod === "yesterday")
      return showAllYesterday
        ? hitRacesYesterday
        : hitRacesYesterday.slice(0, 8);
    return showAllPeriod ? hitRacesAll : hitRacesAll.slice(0, 12);
  };

  const getCurrentHitRaces = () => {
    if (selectedPeriod === "today") return hitRacesToday;
    if (selectedPeriod === "yesterday") return hitRacesYesterday;
    return hitRacesAll;
  };

  const toggleShowAll = () => {
    if (selectedPeriod === "today") setShowAllToday(!showAllToday);
    else if (selectedPeriod === "yesterday")
      setShowAllYesterday(!showAllYesterday);
    else setShowAllPeriod(!showAllPeriod);
  };

  const isShowingAll = () => {
    if (selectedPeriod === "today") return showAllToday;
    if (selectedPeriod === "yesterday") return showAllYesterday;
    return showAllPeriod;
  };

  const getMaxDisplay = () => (selectedPeriod === "all" ? 12 : 8);
  const currentHitRaces = getCurrentHitRaces();
  const displayRaces = getDisplayRaces();

  return (
    <>
        <title>的中レース一覧 | BoatAI</title>
        <meta
          name="description"
          content="BoatAIのAI予測が的中したレース一覧。今日・昨日・過去14日間の的中レースと会場別的中実績を公開。"
        />
        <link rel="canonical" href="https://www.boat-ai.jp/hit-races" />
      <div>
        <section className="venue-stats-section">
          <h2>&#x1F4CA; ボートレース場別の的中実績</h2>
          <UpdateStatus
            lastUpdated={lastUpdated}
            dataType="予想データ"
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
          />

          {/* 期間選択タブ */}
          <div className="period-selector" role="group" aria-label="期間選択">
            <button
              onClick={() => setSelectedPeriod("today")}
              className={selectedPeriod === "today" ? "active" : ""}
            >
              今日
            </button>
            <button
              onClick={() => setSelectedPeriod("yesterday")}
              className={selectedPeriod === "yesterday" ? "active" : ""}
            >
              昨日
            </button>
            <button
              onClick={() => setSelectedPeriod("all")}
              className={selectedPeriod === "all" ? "active" : ""}
            >
              全期間（14日間）
              {backgroundLoading && " ..."}
            </button>
          </div>

          {/* モデル選択タブ */}
          <div
            className="model-selector"
            role="group"
            aria-label="予想モデル選択"
          >
            <button
              onClick={() => setSelectedModel("standard")}
              className={selectedModel === "standard" ? "active standard" : ""}
            >
              スタンダード
            </button>
            <button
              onClick={() => setSelectedModel("safeBet")}
              className={selectedModel === "safeBet" ? "active safe-bet" : ""}
            >
              本命狙い
            </button>
            <button
              onClick={() => setSelectedModel("upsetFocus")}
              className={
                selectedModel === "upsetFocus" ? "active upset-focus" : ""
              }
            >
              穴狙い
            </button>
          </div>

          <VenueStatsTable venueStats={venueStats} />
        </section>

        {/* 的中レースセクション */}
        {currentHitRaces.length > 0 && (
          <section className={`hit-races-section ${selectedPeriod}`}>
            <h2>
              &#x1F4C5;{" "}
              {selectedPeriod === "today"
                ? `今日の的中レース ${formatDateShort(todayStr)}`
                : selectedPeriod === "yesterday"
                  ? `昨日の的中レース ${formatDateShort(yesterdayStr)}`
                  : "過去14日間の的中レース"}
              {` (${currentHitRaces.length}レース)`}
            </h2>
            <div className="race-cards-grid">
              {displayRaces.map((hitRace) => (
                <HitRaceCard
                  key={hitRace.raceId}
                  hitRace={hitRace}
                  selectedModel={selectedModel}
                  variant={
                    selectedPeriod === "all"
                      ? hitRace.date === todayStr
                        ? "today"
                        : "yesterday"
                      : selectedPeriod
                  }
                  showDate={selectedPeriod === "all"}
                  onClick={
                    selectedPeriod !== "yesterday" ? handleCardClick : undefined
                  }
                />
              ))}
            </div>

            {currentHitRaces.length > getMaxDisplay() && (
              <button
                onClick={toggleShowAll}
                className={`show-more-button ${selectedPeriod}`}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f8fafc")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "white")
                }
              >
                {isShowingAll()
                  ? "閉じる ▲"
                  : `もっと見る (残り${currentHitRaces.length - getMaxDisplay()}レース) ▼`}
              </button>
            )}

            <HitStats hitRaces={currentHitRaces} />
          </section>
        )}
      </div>
    </>
  );
}

export default HitRaces;
