import { useState, useEffect } from "react";
import {
  getMoriartyStats,
  getMoriartyROIHistory,
  getMoriartyVenueBreakdown,
  getMoriartyCalibrationData,
} from "../../services/moriartyService";

export function useMoriartyData() {
  const [stats, setStats] = useState({});
  const [roiHistory, setRoiHistory] = useState([]);
  const [venueBreakdown, setVenueBreakdown] = useState([]);
  const [calibrationData, setCalibrationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      getMoriartyStats(),
      getMoriartyROIHistory(30),
      getMoriartyVenueBreakdown(30),
      getMoriartyCalibrationData(),
    ])
      .then(([s, roi, venue, cal]) => {
        setStats(s || {});
        setRoiHistory(roi || []);
        setVenueBreakdown(venue || []);
        setCalibrationData(cal || []);
      })
      .catch((err) => {
        console.error("[HolmesMoriarty] fetch error:", err);
        setError("データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    stats,
    roiHistory,
    venueBreakdown,
    calibrationData,
    loading,
    error,
  };
}
