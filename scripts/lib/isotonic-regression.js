// Pool Adjacent Violators (PAV) algorithm for isotonic regression calibration

export class IsotonicCalibrator {
  constructor() {
    this._trainedX = null;
    this._trainedY = null;
  }

  // Fit the calibrator using raw scores and binary outcomes (0/1)
  fit(scores, outcomes) {
    if (scores.length !== outcomes.length || scores.length === 0) {
      throw new Error(
        "scores and outcomes must be non-empty arrays of equal length",
      );
    }

    // Sort by score ascending
    const indices = scores
      .map((_, i) => i)
      .sort((a, b) => scores[a] - scores[b]);
    const sortedX = indices.map((i) => scores[i]);
    const sortedY = indices.map((i) => outcomes[i]);

    // PAV algorithm: merge adjacent violating blocks
    // Each block tracks sum of outcomes and count
    const blocks = sortedY.map((y, i) => ({ sum: y, count: 1, x: sortedX[i] }));

    let i = 0;
    while (i < blocks.length - 1) {
      const cur = blocks[i];
      const next = blocks[i + 1];
      const curMean = cur.sum / cur.count;
      const nextMean = next.sum / next.count;

      if (curMean > nextMean) {
        // Merge: pool the two blocks
        cur.sum += next.sum;
        cur.count += next.count;
        cur.x = next.x; // use the rightmost x as representative
        blocks.splice(i + 1, 1);
        // Back up to re-check the merged block with its predecessor
        if (i > 0) i--;
      } else {
        i++;
      }
    }

    // Expand blocks back into per-point calibrated probabilities
    // For prediction we store representative (x, prob) pairs
    const xs = [];
    const ys = [];
    let blockIdx = 0;
    let countUsed = 0;
    for (let j = 0; j < sortedX.length; j++) {
      if (countUsed >= blocks[blockIdx].count) {
        blockIdx++;
        countUsed = 0;
      }
      xs.push(sortedX[j]);
      ys.push(blocks[blockIdx].sum / blocks[blockIdx].count);
      countUsed++;
    }

    this._trainedX = xs;
    this._trainedY = ys;
  }

  // Predict calibrated probability for a score or array of scores
  predict(scores) {
    const single = !Array.isArray(scores);
    const arr = single ? [scores] : scores;

    if (!this._trainedX) {
      throw new Error("Calibrator has not been fitted yet");
    }

    const result = arr.map((s) => this._interpolate(s));
    return single ? result[0] : result;
  }

  _interpolate(s) {
    const xs = this._trainedX;
    const ys = this._trainedY;

    if (s <= xs[0]) return ys[0];
    if (s >= xs[xs.length - 1]) return ys[ys.length - 1];

    // Binary search for position
    let lo = 0;
    let hi = xs.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= s) lo = mid;
      else hi = mid;
    }

    // Linear interpolation between lo and hi
    const t = (s - xs[lo]) / (xs[hi] - xs[lo]);
    return ys[lo] + t * (ys[hi] - ys[lo]);
  }

  toJSON() {
    return {
      trainedX: this._trainedX,
      trainedY: this._trainedY,
    };
  }

  static fromJSON(obj) {
    const cal = new IsotonicCalibrator();
    cal._trainedX = obj.trainedX;
    cal._trainedY = obj.trainedY;
    return cal;
  }
}

// CLI self-test
if (process.argv[1] && process.argv[1].endsWith("isotonic-regression.js")) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
  };

  const cal = new IsotonicCalibrator();
  // Perfectly monotone: prob should equal outcome means at each score
  cal.fit([1, 2, 3, 4, 5], [0, 0, 1, 1, 1]);

  const p = cal.predict(3);
  assert(p >= 0 && p <= 1, "probability in [0,1]");

  // Boundary clamp
  assert(cal.predict(0) >= 0, "clamp low");
  assert(cal.predict(100) <= 1, "clamp high");

  // Serialization round-trip
  const restored = IsotonicCalibrator.fromJSON(cal.toJSON());
  assert(Math.abs(restored.predict(3) - p) < 1e-9, "round-trip serialize");

  // Non-monotone input: PAV must produce non-decreasing output
  const cal2 = new IsotonicCalibrator();
  cal2.fit([10, 20, 30, 40, 50, 60], [1, 0, 1, 0, 1, 1]);
  const preds = cal2.predict([10, 20, 30, 40, 50, 60]);
  for (let i = 1; i < preds.length; i++) {
    assert(preds[i] >= preds[i - 1] - 1e-9, "monotone non-decreasing");
  }

  console.log("isotonic-regression: all assertions passed");
}
