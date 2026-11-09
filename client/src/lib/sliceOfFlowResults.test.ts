import { describe, expect, it } from "vitest";
import type { RoundMetrics } from "@/lib/sliceOfFlowConstants";
import {
  generateShareText,
  getDebriefInsights,
  getResultsComparison,
  hasLeadTime,
} from "@/lib/sliceOfFlowResults";

function round(overrides: Partial<RoundMetrics> = {}): RoundMetrics {
  return {
    served: 5,
    burnt: 2,
    angry: 2,
    avgLeadTime: 120,
    stillInProgress: 3,
    score: 10,
    ...overrides,
  };
}

const zeroRound = round({
  served: 0,
  burnt: 0,
  angry: 0,
  avgLeadTime: 0,
  stillInProgress: 0,
  score: 0,
});
const betterRound = round({
  served: 7,
  burnt: 1,
  angry: 1,
  avgLeadTime: 90,
  score: 15,
});
const missingPairs: [string, RoundMetrics | null, RoundMetrics | null][] = [
  ["both missing", null, null],
  ["Round 1 skipped", null, betterRound],
  ["Round 2 missing", round(), null],
];
const unavailableSamples: [string, Partial<RoundMetrics>][] = [
  ["zero completed orders", { served: 0 }],
  ["negative completed count", { served: -1 }],
  ["NaN completed count", { served: NaN }],
  ["infinite completed count", { served: Infinity }],
  ["negative infinite completed count", { served: -Infinity }],
  ["missing completed count", { served: undefined }],
  ["zero elapsed time", { avgLeadTime: 0 }],
  ["negative elapsed time", { avgLeadTime: -1 }],
  ["NaN elapsed time", { avgLeadTime: NaN }],
  ["infinite elapsed time", { avgLeadTime: Infinity }],
  ["negative infinite elapsed time", { avgLeadTime: -Infinity }],
  ["missing elapsed time", { avgLeadTime: undefined }],
];

function positiveFlags(
  r1: RoundMetrics | null,
  r2: RoundMetrics | null
): boolean[] {
  return getDebriefInsights(r1, r2).map(
    item => !item.title.startsWith("Reflect on")
  );
}

const unsupportedClaims =
  /better flow|less stress|reduc\w* stress|context[- ]switch|queue.{0,30}(?:drop|reduc)|(?:cause|guarantee|proves|beat push)/i;

describe("hasLeadTime", () => {
  it("requires a round record", () => {
    expect(hasLeadTime(null)).toBe(false);
  });

  it.each(unavailableSamples)("rejects %s", (_label, overrides) => {
    expect(hasLeadTime(round(overrides))).toBe(false);
  });

  it("treats measured zero elapsed time as unavailable under the current spec", () => {
    expect(hasLeadTime(round({ served: 1, avgLeadTime: 0 }))).toBe(false);
  });

  it.each([0.25, 1, 60, 123.5])(
    "accepts positive finite elapsed time %s",
    avgLeadTime => {
      expect(hasLeadTime(round({ served: 1, avgLeadTime }))).toBe(true);
    }
  );

  it("does not depend on score, burnt, or angry counts", () => {
    expect(
      hasLeadTime(round({ score: NaN, burnt: Infinity, angry: NaN }))
    ).toBe(true);
  });
});

describe("getResultsComparison", () => {
  it.each(missingPairs)(
    "leaves every comparison unavailable with %s",
    (_label, r1, r2) => {
      expect(getResultsComparison(r1, r2)).toEqual({
        scorePercent: null,
        scoreDelta: null,
        leadTimeDelta: null,
      });
    }
  );

  it("returns Round 2 minus Round 1 deltas for better results", () => {
    expect(getResultsComparison(round(), betterRound)).toEqual({
      scorePercent: 50,
      scoreDelta: 5,
      leadTimeDelta: -30,
    });
  });

  it("returns measured zero changes for equal, available rounds", () => {
    expect(getResultsComparison(round(), round())).toEqual({
      scorePercent: 0,
      scoreDelta: 0,
      leadTimeDelta: 0,
    });
  });

  it("returns negative score change and longer lead time for worse results", () => {
    expect(
      getResultsComparison(round(), round({ score: 5, avgLeadTime: 180 }))
    ).toEqual({
      scorePercent: -50,
      scoreDelta: -5,
      leadTimeDelta: 60,
    });
  });

  it.each(unavailableSamples)(
    "does not compare Round 1 with %s",
    (_label, overrides) => {
      expect(getResultsComparison(round(overrides), betterRound)).toEqual({
        scorePercent: null,
        scoreDelta: 5,
        leadTimeDelta: null,
      });
    }
  );

  it.each(unavailableSamples)(
    "does not compare Round 2 with %s",
    (_label, overrides) => {
      expect(
        getResultsComparison(round(), round({ ...overrides, score: 15 }))
      ).toEqual({
        scorePercent: null,
        scoreDelta: 5,
        leadTimeDelta: null,
      });
    }
  );

  it.each([0, -1, -10])(
    "does not compute percentage from baseline score %s",
    score => {
      expect(getResultsComparison(round({ score }), betterRound)).toEqual({
        scorePercent: null,
        scoreDelta: 15 - score,
        leadTimeDelta: -30,
      });
    }
  );

  it.each([0, -5])(
    "allows finite Round 2 score %s with a complete positive baseline",
    score => {
      expect(getResultsComparison(round(), round({ score }))).toEqual({
        scorePercent: ((score - 10) / 10) * 100,
        scoreDelta: score - 10,
        leadTimeDelta: 0,
      });
    }
  );

  it.each([NaN, Infinity, -Infinity, undefined])(
    "rejects nonfinite or missing Round 1 score %s",
    score => {
      expect(getResultsComparison(round({ score }), betterRound)).toEqual({
        scorePercent: null,
        scoreDelta: null,
        leadTimeDelta: -30,
      });
    }
  );

  it.each([NaN, Infinity, -Infinity, undefined])(
    "rejects nonfinite or missing Round 2 score %s",
    score => {
      expect(getResultsComparison(round(), round({ score }))).toEqual({
        scorePercent: null,
        scoreDelta: null,
        leadTimeDelta: 0,
      });
    }
  );

  it("keeps raw finite score differences independent of completed samples", () => {
    expect(
      getResultsComparison(
        zeroRound,
        round({ served: 0, avgLeadTime: 0, score: 3 })
      )
    ).toEqual({
      scorePercent: null,
      scoreDelta: 3,
      leadTimeDelta: null,
    });
    expect(getResultsComparison(zeroRound, zeroRound)).toEqual({
      scorePercent: null,
      scoreDelta: 0,
      leadTimeDelta: null,
    });
  });

  it("does not round the numeric percentage returned to callers", () => {
    expect(
      getResultsComparison(round({ score: 3 }), round({ score: 4 }))
        .scorePercent
    ).toBeCloseTo(100 / 3, 12);
  });

  it("does not return nonfinite arithmetic overflow", () => {
    expect(
      getResultsComparison(
        round({ score: -Number.MAX_VALUE }),
        round({ score: Number.MAX_VALUE })
      )
    ).toMatchObject({ scorePercent: null, scoreDelta: null });
    expect(
      getResultsComparison(
        round({ score: Number.MIN_VALUE }),
        round({ score: Number.MAX_VALUE })
      )
    ).toMatchObject({ scorePercent: null, scoreDelta: Number.MAX_VALUE });
  });
});

describe("getDebriefInsights", () => {
  it("returns four stable icon/title/desc/metric objects", () => {
    const insights = getDebriefInsights(round(), betterRound);
    expect(insights).toHaveLength(4);
    insights.forEach(item => {
      expect(Object.keys(item).sort()).toEqual([
        "desc",
        "icon",
        "metric",
        "title",
      ]);
      Object.values(item).forEach(value =>
        expect(value.length).toBeGreaterThan(0)
      );
    });
    expect(positiveFlags(round(), betterRound)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(insights.map(item => item.title)).toEqual([
      "Fewer Burnt Pizzas",
      "More Served, Fewer Angry Customers",
      "Lower Completed Lead Time",
      "More Served, Fewer Burnt Pizzas",
    ]);
    expect(insights[0].metric).toBe("Burnt: 2 → 1");
    expect(insights[1].metric).toBe("Served: 5 → 7; Angry: 2 → 1");
    expect(insights[2].metric).toBe("Completed lead time: 2:00 → 1:30");
    expect(insights[3].metric).toBe("Served: 5 → 7; Burnt: 2 → 1");
  });

  it.each(missingPairs)("uses neutral prompts with %s", (_label, r1, r2) => {
    expect(positiveFlags(r1, r2)).toEqual([false, false, false, false]);
    getDebriefInsights(r1, r2).forEach(item =>
      expect(item.metric).toContain("n/a")
    );
  });

  it.each([
    ["equal", round()],
    ["worse", round({ served: 4, burnt: 3, angry: 3, avgLeadTime: 180 })],
    ["score-only increase", round({ score: 100 })],
  ] as const)("has no positive observations for %s outcomes", (_label, r2) => {
    expect(positiveFlags(round(), r2)).toEqual([false, false, false, false]);
  });

  it("keeps all-zero outcomes neutral without hiding observed zero counts", () => {
    expect(positiveFlags(zeroRound, zeroRound)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    const insights = getDebriefInsights(zeroRound, zeroRound);
    expect(insights[0].metric).toBe("Burnt: 0 → 0");
    expect(insights[2].metric).toBe("Completed lead time: n/a → n/a");
  });

  it.each([
    ["fewer burnt only", { burnt: 1 }, [true, false, false, false]],
    ["more served only", { served: 6 }, [false, false, false, false]],
    ["fewer angry only", { angry: 1 }, [false, false, false, false]],
    ["lower lead only", { avgLeadTime: 90 }, [false, false, true, false]],
    [
      "more served and fewer angry",
      { served: 6, angry: 1 },
      [false, true, false, false],
    ],
    [
      "more served and fewer burnt",
      { served: 6, burnt: 1 },
      [true, false, false, true],
    ],
    [
      "fewer served with fewer burnt and angry",
      { served: 4, burnt: 1, angry: 1 },
      [true, false, false, false],
    ],
    [
      "more served with more burnt and angry",
      { served: 6, burnt: 3, angry: 3 },
      [false, false, false, false],
    ],
    [
      "mixed with lower lead",
      { served: 4, burnt: 1, angry: 3, avgLeadTime: 90 },
      [true, false, true, false],
    ],
  ] as [string, Partial<RoundMetrics>, boolean[]][])(
    "only supports the conditional claims for %s",
    (_label, overrides, expected) => {
      expect(positiveFlags(round(), round(overrides))).toEqual(expected);
    }
  );

  it.each(unavailableSamples)(
    "does not claim lower completed lead with unavailable Round 1 %s",
    (_label, overrides) => {
      expect(positiveFlags(round(overrides), betterRound)[2]).toBe(false);
    }
  );

  it.each(unavailableSamples)(
    "does not claim lower completed lead with unavailable Round 2 %s",
    (_label, overrides) => {
      expect(
        positiveFlags(round(), round({ avgLeadTime: 90, ...overrides }))[2]
      ).toBe(false);
    }
  );

  it.each([NaN, Infinity, -Infinity, -1, undefined])(
    "does not use invalid burnt count %s in positive observations",
    burnt => {
      expect(positiveFlags(round({ burnt }), betterRound)[0]).toBe(false);
      expect(positiveFlags(round({ burnt }), betterRound)[3]).toBe(false);
      expect(positiveFlags(round(), round({ served: 6, burnt }))[0]).toBe(
        false
      );
      expect(positiveFlags(round(), round({ served: 6, burnt }))[3]).toBe(
        false
      );
    }
  );

  it.each([NaN, Infinity, -Infinity, -1, undefined])(
    "does not use invalid angry count %s in positive observations",
    angry => {
      expect(positiveFlags(round({ angry }), betterRound)[1]).toBe(false);
      expect(positiveFlags(round(), round({ served: 6, angry }))[1]).toBe(
        false
      );
    }
  );

  it.each([NaN, Infinity, -Infinity, -1, undefined])(
    "does not use invalid served count %s in compound observations",
    served => {
      expect(positiveFlags(round({ served }), betterRound).slice(1)).toEqual([
        false,
        false,
        false,
      ]);
      expect(
        positiveFlags(round(), round({ served, burnt: 1, angry: 1 })).slice(1)
      ).toEqual([false, false, false]);
    }
  );

  it.each([
    ["positive", round(), betterRound],
    ["neutral", round(), round()],
    ["score-only", round(), round({ score: 100 })],
    ...missingPairs,
  ] as [string, RoundMetrics | null, RoundMetrics | null][])(
    "makes no unsupported causal or stress claims for %s",
    (_label, r1, r2) => {
      expect(JSON.stringify(getDebriefInsights(r1, r2))).not.toMatch(
        unsupportedClaims
      );
    }
  );

  it("uses only completed lead time and does not infer changes in unfinished work", () => {
    const insight = getDebriefInsights(
      round(),
      round({ avgLeadTime: 90, stillInProgress: 100 })
    )[2];
    expect(insight.title).toBe("Lower Completed Lead Time");
    expect(insight.desc).toContain("Unfinished orders are not included");
    expect(insight.desc).not.toMatch(/queue|bottleneck/i);
  });
});

describe("generateShareText", () => {
  it("preserves count metrics, time format, difficulty, score label, and the actual source URL", () => {
    const text = generateShareText(round(), betterRound, "Normal");
    expect(text).toContain("Slice of Flow — My Results (Normal Mode)");
    expect(text).toContain("Round 1 (Push) → Round 2 (Pull + WIP Limits)");
    expect(text).toContain("Served:     5 → 7");
    expect(text).toContain("Burnt:      2 → 1");
    expect(text).toContain("Angry:      2 → 1");
    expect(text).toContain("Lead Time:  2:00 → 1:30");
    expect(text).toContain("Score:      10 → 15");
    expect(text).toContain("Score change: +50%");
    expect(text.match(/https?:\/\/\S+/g)).toEqual([
      "https://slice-of-flow.com",
    ]);
    expect(text).toContain("#SliceOfFlow #Kanban #Agile #FlowMetrics");
    expect(text).not.toContain("sliceofflow.com");
    expect(text).not.toMatch(/improvement|(?:by|created by|author)\s/i);
  });

  it("keeps both missing records n/a rather than fabricating zero values", () => {
    const text = generateShareText(null, null, "Easy");
    for (const label of ["Served", "Burnt", "Angry", "Lead Time", "Score"]) {
      expect(text).toMatch(new RegExp(`${label}:\\s+n/a → n/a`));
    }
    expect(text).toContain("Score change: n/a");
    expect(text).not.toMatch(/\b0\b|to spare/);
  });

  it("handles skipped Round 1 with real Round 2 counts and no comparison percentage", () => {
    const text = generateShareText(null, betterRound, "Hard");
    expect(text).toContain("Served:     n/a → 7");
    expect(text).toContain("Burnt:      n/a → 1");
    expect(text).toContain("Angry:      n/a → 1");
    expect(text).toContain("Lead Time:  n/a → 1:30");
    expect(text).toContain("Score:      n/a → 15");
    expect(text).toContain("Score change: n/a");
  });

  it("handles missing Round 2 without hiding Round 1 or fabricating a comparison", () => {
    const text = generateShareText(round(), null, "Normal");
    expect(text).toContain("Served:     5 → n/a");
    expect(text).toContain("Lead Time:  2:00 → n/a");
    expect(text).toContain("Score:      10 → n/a");
    expect(text).toContain("Score change: n/a");
  });

  it("preserves measured zero counts and score but leaves zero lead and percentage unavailable", () => {
    const text = generateShareText(zeroRound, zeroRound, "Normal");
    expect(text).toContain("Served:     0 → 0");
    expect(text).toContain("Burnt:      0 → 0");
    expect(text).toContain("Angry:      0 → 0");
    expect(text).toContain("Score:      0 → 0");
    expect(text).toContain("Lead Time:  n/a → n/a");
    expect(text).toContain("Score change: n/a");
    expect(text).not.toContain("0:00");
  });

  it.each(unavailableSamples)(
    "shares n/a lead and percentage for %s",
    (_label, overrides) => {
      const text = generateShareText(round(overrides), betterRound, "Normal");
      expect(text).toContain("Lead Time:  n/a → 1:30");
      expect(text).toContain("Score change: n/a");
      expect(text).not.toMatch(/NaN|Infinity|undefined/);
      const reversed = generateShareText(
        round(),
        round({ avgLeadTime: 90, ...overrides }),
        "Normal"
      );
      expect(reversed).toContain("Lead Time:  2:00 → n/a");
      expect(reversed).toContain("Score change: n/a");
    }
  );

  it.each([0, -5])(
    "shares baseline score %s as a raw value without an invalid percentage",
    score => {
      const text = generateShareText(round({ score }), betterRound, "Normal");
      expect(text).toContain(`Score:      ${score} → 15`);
      expect(text).toContain("Score change: n/a");
    }
  );

  it.each([NaN, Infinity, -Infinity, undefined])(
    "shares nonfinite or missing score %s as n/a",
    score => {
      expect(
        generateShareText(round({ score }), betterRound, "Normal")
      ).toContain("Score:      n/a → 15");
      expect(generateShareText(round(), round({ score }), "Normal")).toContain(
        "Score:      10 → n/a"
      );
      expect(
        generateShareText(round({ score }), round({ score }), "Normal")
      ).not.toMatch(/NaN|Infinity|undefined/);
    }
  );

  it.each([NaN, Infinity, -Infinity, -1, undefined])(
    "shares invalid count %s as n/a",
    count => {
      const invalid = round({ served: count, burnt: count, angry: count });
      const text = generateShareText(invalid, invalid, "Normal");
      expect(text).toMatch(/Served:\s+n\/a → n\/a/);
      expect(text).toMatch(/Burnt:\s+n\/a → n\/a/);
      expect(text).toMatch(/Angry:\s+n\/a → n\/a/);
      expect(text).not.toMatch(/NaN|Infinity|undefined/);
    }
  );

  it.each([
    ["equal", 10, "0%"],
    ["worse", 5, "-50%"],
    ["zero score", 0, "-100%"],
    ["negative score", -5, "-150%"],
  ] as const)(
    "labels %s percentage as score change, not generic improvement",
    (_label, score, expected) => {
      const text = generateShareText(round(), round({ score }), "Normal");
      expect(text).toContain(`Score change: ${expected}`);
      expect(text).not.toMatch(/improvement/i);
    }
  );

  it("rounds only the displayed percentage to one decimal place", () => {
    expect(
      generateShareText(round({ score: 3 }), round({ score: 4 }), "Normal")
    ).toContain("Score change: +33.3%");
  });

  it("preserves the timeRemaining service-bell message for either recorded round", () => {
    const text = generateShareText(
      round({ timeRemaining: 65 }),
      round({ timeRemaining: 125.9 }),
      "Normal"
    );
    expect(text).toContain("Round 1 finished with 1:05 to spare!");
    expect(text).toContain("Round 2 finished with 2:05 to spare!");
    expect(
      generateShareText(null, round({ timeRemaining: 65 }), "Easy")
    ).toContain("Round 2 finished with 1:05 to spare!");
  });

  it.each([undefined, 0, -1, NaN, Infinity, -Infinity])(
    "does not invent a finished-early message for remaining time %s",
    timeRemaining => {
      expect(
        generateShareText(
          round({ timeRemaining }),
          round({ timeRemaining }),
          "Normal"
        )
      ).not.toContain("to spare");
    }
  );

  it.each([
    ["better", round(), betterRound],
    ["equal", round(), round()],
    ["worse", betterRound, round()],
    ["mixed", round(), round({ served: 7, burnt: 3, angry: 1, score: 15 })],
    ["zero", zeroRound, zeroRound],
    ...missingPairs,
  ] as [string, RoundMetrics | null, RoundMetrics | null][])(
    "keeps the share narrative neutral for %s results",
    (_label, r1, r2) => {
      const text = generateShareText(r1, r2, "Normal");
      expect(text).not.toMatch(unsupportedClaims);
      expect(text).toContain(
        "Compare the recorded outcomes and reflect on what you would try next."
      );
      expect(text).toContain("https://slice-of-flow.com");
      expect(text).not.toMatch(/NaN|Infinity|undefined/);
    }
  );

  it("does not mutate either round record", () => {
    const r1 = Object.freeze(round());
    const r2 = Object.freeze({ ...betterRound });
    expect(() => {
      hasLeadTime(r1);
      getResultsComparison(r1, r2);
      getDebriefInsights(r1, r2);
      generateShareText(r1, r2, "Normal");
    }).not.toThrow();
    expect(r1).toEqual(round());
    expect(r2).toEqual(betterRound);
  });
});
