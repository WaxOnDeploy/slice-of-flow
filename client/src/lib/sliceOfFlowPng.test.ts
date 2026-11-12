import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadResultsPng,
  renderResultsPng,
  shareResultsPng,
  type PngSummary,
} from "./sliceOfFlowPng";

class TestBlob extends NodeBlob {}
class TestFile extends TestBlob {
  readonly name: string;
  constructor(
    parts: ConstructorParameters<typeof NodeBlob>[0],
    name: string,
    options: BlobPropertyBag
  ) {
    super(parts, options);
    this.name = name;
  }
}

const summary: PngSummary = {
  title: "Slice of Flow — My Results",
  subtitle: "Normal Mode · Round 1 (Push) / Round 2 (Pull + WIP Limits)",
  author: "Built by Jeff Bourke, MHA, PMP, SAFe RTE",
  site: "Slice of Flow, slice-of-flow.com",
  note: "Compare the recorded outcomes and reflect on what you would try next.",
  headers: ["Round 1 (Push)", "Round 2 (Pull + WIP Limits)", "Change"],
  rows: [
    { label: "Served", values: ["5", "7", "+2"] },
    { label: "Burnt", values: ["2", "1", "−1"] },
    { label: "Angry", values: ["2", "1", "−1"] },
    { label: "Completed lead time", values: ["2:00", "1:30", "−0:30"] },
    { label: "Score", values: ["10", "15", "+5"] },
    { label: "Score change", values: ["n/a", "n/a", "+50%"] },
  ],
  footer:
    "Lead time covers completed orders only; unfinished orders are excluded. Missing or unavailable results stay n/a.",
};

function makeContext() {
  const ctx = {
    font: "",
    fillStyle: "",
    textBaseline: "",
    textAlign: "",
    measureText: vi.fn((text: string) => ({
      width:
        Array.from(text).length *
        (Number(ctx.font.match(/(\d+)px/)?.[1]) || 24) *
        0.55,
    })),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  };
  return ctx;
}

function makeBrowser() {
  // Node and DOM stream typings differ; this fixture deliberately stands in
  // for the browser Blob constructor stubbed below.
  const blob = new TestBlob(["mock PNG bytes"], {
    type: "image/png",
  }) as unknown as Blob;
  const ctx = makeContext();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((callback: BlobCallback, _type?: string) => callback(blob)),
  };
  const attached = new Set<unknown>();
  const body = {
    appendChild: vi.fn((element: typeof anchor) => {
      attached.add(element);
      element.parentNode = body;
      return element;
    }),
    removeChild: vi.fn((element: typeof anchor) => {
      attached.delete(element);
      element.parentNode = null;
      return element;
    }),
  };
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    parentNode: null as typeof body | null,
    click: vi.fn(),
    remove: vi.fn(() => {
      attached.delete(anchor);
      anchor.parentNode = null;
    }),
  };
  const createElement = vi.fn((tag: string) => {
    if (tag === "canvas") return canvas;
    if (tag === "a") return anchor;
    throw new Error(`Unexpected DOM access: ${tag}`);
  });
  const fontAccess = vi.fn(() => {
    throw new Error("Hosted fonts must not be used");
  });
  const documentMock = {
    createElement,
    body,
    get fonts() {
      return fontAccess();
    },
    querySelector: vi.fn(() => {
      throw new Error("No DOM capture");
    }),
  };
  const createObjectURL = vi.fn(() => "blob:local-png-test");
  const revokeObjectURL = vi.fn();
  const forbidden = vi.fn(() => {
    throw new Error("No capture, clipboard, or network");
  });
  vi.stubGlobal("Blob", TestBlob);
  vi.stubGlobal("File", TestFile);
  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("navigator", {
    clipboard: { write: forbidden, writeText: forbidden },
  });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("Image", forbidden);
  vi.stubGlobal("fetch", forbidden);
  return {
    blob,
    ctx,
    canvas,
    attached,
    body,
    anchor,
    createElement,
    documentMock,
    fontAccess,
    createObjectURL,
    revokeObjectURL,
    forbidden,
  };
}

let browser: ReturnType<typeof makeBrowser>;

beforeEach(() => {
  vi.useFakeTimers();
  browser = makeBrowser();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function drawnLines(): string[] {
  return browser.ctx.fillText.mock.calls.map(call => call[0] as string);
}

function frozenSummary(input: PngSummary): PngSummary {
  return Object.freeze({
    ...input,
    headers: Object.freeze([...input.headers]),
    rows: Object.freeze(
      input.rows.map(row =>
        Object.freeze({
          label: row.label,
          values: Object.freeze([...row.values]),
        })
      )
    ),
  });
}

describe("renderResultsPng", () => {
  it("returns the canvas PNG Blob at 1600-wide with natural summary height", async () => {
    const result = await renderResultsPng(summary);
    expect(result).toBe(browser.blob);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("image/png");
    expect(browser.canvas.width).toBe(1600);
    expect(browser.canvas.height).toBeGreaterThanOrEqual(800);
    expect(browser.canvas.height).toBeLessThanOrEqual(1150);
    expect(browser.canvas.getContext).toHaveBeenCalledWith("2d");
    expect(browser.canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/png"
    );
    expect(browser.ctx.fillRect).toHaveBeenCalledWith(
      0,
      0,
      1600,
      browser.canvas.height
    );
  });

  it("draws exact approved author and site, truthful note, and sample-boundary footer", async () => {
    await renderResultsPng(summary);
    expect(drawnLines()).toContain(summary.author);
    expect(drawnLines()).toContain(summary.site);
    expect(drawnLines()).toContain(summary.title);
    expect(drawnLines()).toContain(summary.note);
    const text = drawnLines().join(" ");
    expect(text).toContain(summary.footer);
    expect(text).not.toMatch(/proves|guarantees|less stress|better flow/i);
    for (const required of [summary.author, summary.site]) {
      const call = browser.ctx.fillText.mock.calls.find(
        call => call[0] === required
      )!;
      expect(call[1]).toBeGreaterThanOrEqual(72);
      expect(call[2]).toBeLessThan(browser.canvas.height - 50);
    }
  });

  it("uses only native paths/system fonts and never requests fonts, images, or page capture", async () => {
    await renderResultsPng(summary);
    expect(browser.createElement.mock.calls).toEqual([["canvas"]]);
    expect(browser.body.appendChild).not.toHaveBeenCalled();
    expect(browser.documentMock.querySelector).not.toHaveBeenCalled();
    expect(browser.fontAccess).not.toHaveBeenCalled();
    expect(browser.forbidden).not.toHaveBeenCalled();
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(browser.ctx.font).toContain("system-ui");
    expect(browser.ctx.quadraticCurveTo).toHaveBeenCalled();
  });

  it("leaves per-header n/a, measured zero, signed changes and custom copy unchanged", async () => {
    await renderResultsPng({
      ...summary,
      headers: ["Recorded round", "Skipped round", "Difference"],
      rows: [{ label: "Supplied metric", values: ["0", "n/a", "−12.75%"] }],
    });
    for (const text of [
      "Recorded round",
      "Skipped round",
      "Difference",
      "Supplied metric",
      "0",
      "n/a",
      "−12.75%",
    ]) {
      expect(drawnLines()).toContain(text);
    }
    const values = browser.ctx.fillText.mock.calls.filter(call =>
      ["0", "n/a", "−12.75%"].includes(call[0] as string)
    );
    expect(values).toHaveLength(3);
    expect(values[0][1]).toBeLessThan(values[1][1]);
    expect(values[1][1]).toBeLessThan(values[2][1]);
  });

  it("also accepts an explicit leading label-column header", async () => {
    await renderResultsPng({
      ...summary,
      headers: ["Result", "First round", "Second round"],
      rows: [{ label: "Served", values: ["n/a", "0"] }],
    });
    expect(drawnLines()).toContain("Result");
    expect(drawnLines()).not.toContain("Metric");
    expect(drawnLines().filter(text => text === "n/a")).toHaveLength(1);
    const result = browser.ctx.fillText.mock.calls.find(
      call => call[0] === "Result"
    )!;
    const served = browser.ctx.fillText.mock.calls.find(
      call => call[0] === "Served"
    )!;
    expect(result[1]).toBe(served[1]);
  });

  it("keeps unavailable slots n/a rather than fabricating zero", async () => {
    await renderResultsPng({
      ...summary,
      headers: ["First", "Second", "Change"],
      rows: [{ label: "Served", values: ["7"] }],
    });
    expect(drawnLines().filter(text => text === "n/a")).toHaveLength(2);
    expect(drawnLines()).not.toContain("0");
  });

  it("sizes long titles, multi-line notes, footers and rows without clipping or ellipses", async () => {
    await renderResultsPng({
      ...summary,
      title: "A longer public workshop title ".repeat(5),
      note: "First reflection paragraph.\n\nSecond reflection paragraph.",
      footer: "Completed-order sample boundary. ".repeat(12),
      rows: Array.from({ length: 12 }, (_, index) => ({
        label: `Long metric label for public comparison ${index}`,
        values: [
          "n/a",
          `Supplied multi-word value with details ${index}`,
          "a".repeat(70),
        ],
      })),
    });
    expect(browser.canvas.height).toBeGreaterThan(1150);
    expect(drawnLines()).toContain("First reflection paragraph.");
    expect(drawnLines()).toContain("Second reflection paragraph.");
    expect(drawnLines().join(" ")).toContain(summary.author);
    expect(drawnLines().join(" ")).not.toContain("…");
    for (const [text, x, y] of browser.ctx.fillText.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(72);
      expect(x).toBeLessThan(1600 - 72);
      expect(y).toBeGreaterThanOrEqual(72);
      expect(y).toBeLessThan(browser.canvas.height - 50);
      expect(text).not.toBeUndefined();
    }
  });

  it("does not mutate the supplied immutable summary or inspect game state", async () => {
    const input = frozenSummary(summary);
    const before = JSON.stringify(input);
    await renderResultsPng(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("supports empty summaries and empty tables without invalid coordinates", async () => {
    await renderResultsPng({
      title: "",
      subtitle: "",
      author: "",
      site: "",
      note: "",
      headers: [],
      rows: [],
      footer: "",
    });
    expect(browser.canvas.height).toBeGreaterThan(0);
    expect(drawnLines()).toEqual(["Metric"]);
    expect(
      browser.ctx.fillRect.mock.calls
        .flat()
        .filter(value => typeof value === "number")
        .every(Number.isFinite)
    ).toBe(true);
  });

  it("rejects clearly outside a browser", async () => {
    vi.stubGlobal("document", undefined);
    await expect(renderResultsPng(summary)).rejects.toThrow(
      "requires a browser"
    );
  });

  it("rejects an unsupported 2D canvas context", async () => {
    browser.canvas.getContext.mockReturnValueOnce(null as never);
    await expect(renderResultsPng(summary)).rejects.toThrow(
      "2D canvas context"
    );
    expect(browser.canvas.toBlob).not.toHaveBeenCalled();
  });

  it("rejects browsers without canvas.toBlob", async () => {
    Object.assign(browser.canvas, { toBlob: undefined });
    await expect(renderResultsPng(summary)).rejects.toThrow("not supported");
  });

  it("rejects a null toBlob result instead of downloading an empty file", async () => {
    browser.canvas.toBlob.mockImplementationOnce(callback => callback(null));
    await expect(renderResultsPng(summary)).rejects.toThrow(
      "could not create the PNG"
    );
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });

  it("propagates synchronous encoding errors", async () => {
    browser.canvas.toBlob.mockImplementationOnce(() => {
      throw new Error("encoder failed");
    });
    await expect(renderResultsPng(summary)).rejects.toThrow("encoder failed");
  });
});

describe("downloadResultsPng", () => {
  it("clicks a transient local anchor with the default filename and revokes only after the delay", () => {
    downloadResultsPng(browser.blob);
    expect(browser.createObjectURL).toHaveBeenCalledWith(browser.blob);
    expect(browser.anchor.href).toBe("blob:local-png-test");
    expect(browser.anchor.download).toBe("slice-of-flow-results.png");
    expect(browser.anchor.hidden).toBe(true);
    expect(browser.body.appendChild).toHaveBeenCalledWith(browser.anchor);
    expect(browser.anchor.click).toHaveBeenCalledOnce();
    expect(browser.anchor.remove).toHaveBeenCalledOnce();
    expect(browser.attached.size).toBe(0);
    expect(browser.revokeObjectURL).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(browser.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:local-png-test");
  });

  it("uses the supplied filename without changing the Blob", () => {
    downloadResultsPng(browser.blob, "my-workshop.png");
    expect(browser.anchor.download).toBe("my-workshop.png");
    expect(browser.createObjectURL).toHaveBeenCalledOnce();
    expect(browser.createObjectURL).toHaveBeenCalledWith(browser.blob);
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("uses the default filename for an empty supplied name", () => {
    downloadResultsPng(browser.blob, "");
    expect(browser.anchor.download).toBe("slice-of-flow-results.png");
  });

  it("still removes the anchor and schedules revocation when clicking throws", () => {
    browser.anchor.click.mockImplementationOnce(() => {
      throw new Error("click failed");
    });
    expect(() => downloadResultsPng(browser.blob)).toThrow("click failed");
    expect(browser.anchor.remove).toHaveBeenCalledOnce();
    expect(browser.attached.size).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("cleans up if anchor setup or append fails", () => {
    browser.body.appendChild.mockImplementationOnce(() => {
      throw new Error("append failed");
    });
    expect(() => downloadResultsPng(browser.blob)).toThrow("append failed");
    expect(browser.anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes even if anchor creation throws before there is an anchor", () => {
    browser.createElement.mockImplementationOnce(() => {
      throw new Error("DOM unavailable");
    });
    expect(() => downloadResultsPng(browser.blob)).toThrow("DOM unavailable");
    expect(browser.anchor.click).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("falls back to parent removal if anchor.remove throws and still revokes", () => {
    browser.anchor.remove.mockImplementationOnce(() => {
      throw new Error("remove failed");
    });
    expect(() => downloadResultsPng(browser.blob)).not.toThrow();
    expect(browser.body.removeChild).toHaveBeenCalledWith(browser.anchor);
    expect(browser.attached.size).toBe(0);
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("does not let a host removal failure skip URL cleanup or mask a click exception", () => {
    browser.anchor.click.mockImplementationOnce(() => {
      throw new Error("click failed");
    });
    browser.anchor.remove.mockImplementationOnce(() => {
      throw new Error("remove failed");
    });
    browser.body.removeChild.mockImplementationOnce(() => {
      throw new Error("host DOM failed");
    });
    expect(() => downloadResultsPng(browser.blob)).toThrow("click failed");
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes immediately if timeout scheduling throws", () => {
    vi.stubGlobal(
      "setTimeout",
      vi.fn(() => {
        throw new Error("timer unavailable");
      })
    );
    expect(() => downloadResultsPng(browser.blob)).not.toThrow();
    expect(browser.attached.size).toBe(0);
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:local-png-test");
  });

  it("does not leave an asynchronous cleanup exception unhandled", () => {
    browser.revokeObjectURL.mockImplementationOnce(() => {
      throw new Error("host URL cleanup failed");
    });
    downloadResultsPng(browser.blob);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("does not create anchors or timers if URL creation fails", () => {
    browser.createObjectURL.mockImplementationOnce(() => {
      throw new Error("URL unavailable");
    });
    expect(() => downloadResultsPng(browser.blob)).toThrow("URL unavailable");
    expect(browser.createElement).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("shareResultsPng", () => {
  it("shares a single PNG File only when native file sharing is supported", async () => {
    const canShare = vi.fn((_data: ShareData) => true);
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { canShare, share });
    await expect(shareResultsPng(browser.blob, "workshop.png")).resolves.toBe(
      "shared"
    );
    expect(canShare).toHaveBeenCalledOnce();
    const data = canShare.mock.calls[0][0] as unknown as { files: TestFile[] };
    expect(data.files).toHaveLength(1);
    expect(data.files[0]).toBeInstanceOf(File);
    expect(data.files[0].name).toBe("workshop.png");
    expect(data.files[0].type).toBe("image/png");
    expect(await data.files[0].text()).toBe(await browser.blob.text());
    expect(share).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledWith(data);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["no navigator", undefined],
    ["no file share APIs", {}],
    ["no canShare", { share: vi.fn() }],
    ["no share", { canShare: vi.fn() }],
  ])(
    "downloads locally with %s without probing unsupported APIs",
    async (_label, navigatorMock) => {
      vi.stubGlobal("navigator", navigatorMock);
      await expect(shareResultsPng(browser.blob, "local.png")).resolves.toBe(
        "downloaded"
      );
      expect(browser.anchor.download).toBe("local.png");
      expect(browser.anchor.click).toHaveBeenCalledOnce();
      expect(browser.attached.size).toBe(0);
      if (navigatorMock && "canShare" in navigatorMock)
        expect(navigatorMock.canShare).not.toHaveBeenCalled();
      if (navigatorMock && "share" in navigatorMock)
        expect(navigatorMock.share).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
    }
  );

  it("does not call canShare without a File constructor", async () => {
    const canShare = vi.fn(() => true);
    const share = vi.fn();
    vi.stubGlobal("navigator", { canShare, share });
    vi.stubGlobal("File", undefined);
    await expect(shareResultsPng(browser.blob, "local.png")).resolves.toBe(
      "downloaded"
    );
    expect(canShare).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it("downloads when canShare rejects file sharing", async () => {
    const canShare = vi.fn(() => false);
    const share = vi.fn();
    vi.stubGlobal("navigator", { canShare, share });
    await expect(shareResultsPng(browser.blob, "local.png")).resolves.toBe(
      "downloaded"
    );
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(TestFile)] });
    expect(share).not.toHaveBeenCalled();
    expect(browser.anchor.click).toHaveBeenCalledOnce();
  });

  it("does not download after the user cancels native sharing", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("User cancelled", "AbortError"));
    vi.stubGlobal("navigator", { canShare: vi.fn(() => true), share });
    await expect(shareResultsPng(browser.blob, "private.png")).resolves.toBe(
      "cancelled"
    );
    expect(share).toHaveBeenCalledOnce();
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(browser.anchor.click).not.toHaveBeenCalled();
    expect(browser.createElement).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recognizes a cross-realm AbortError by name without surprise download", async () => {
    vi.stubGlobal("navigator", {
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue({ name: "AbortError" }),
    });
    await expect(shareResultsPng(browser.blob, "private.png")).resolves.toBe(
      "cancelled"
    );
    expect(browser.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    new Error("native failure"),
    new DOMException("Not allowed", "NotAllowedError"),
    null,
    "failed",
  ])(
    "falls back locally after a non-cancellation native share failure (%s)",
    async error => {
      vi.stubGlobal("navigator", {
        canShare: vi.fn(() => true),
        share: vi.fn().mockRejectedValue(error),
      });
      await expect(shareResultsPng(browser.blob, "fallback.png")).resolves.toBe(
        "downloaded"
      );
      expect(browser.anchor.download).toBe("fallback.png");
      expect(browser.attached.size).toBe(0);
      vi.runAllTimers();
      expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
      expect(browser.forbidden).not.toHaveBeenCalled();
    }
  );

  it("downloads locally if canShare or File construction throws", async () => {
    const share = vi.fn();
    vi.stubGlobal("navigator", {
      canShare: vi.fn(() => {
        throw new Error("canShare failed");
      }),
      share,
    });
    await expect(shareResultsPng(browser.blob, "fallback.png")).resolves.toBe(
      "downloaded"
    );
    expect(share).not.toHaveBeenCalled();
    vi.stubGlobal(
      "File",
      vi.fn(() => {
        throw new Error("File unsupported");
      })
    );
    await expect(shareResultsPng(browser.blob, "fallback.png")).resolves.toBe(
      "downloaded"
    );
    expect(browser.anchor.click).toHaveBeenCalledTimes(2);
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("propagates local download failure after cleaning up rather than claiming success", async () => {
    browser.anchor.click.mockImplementationOnce(() => {
      throw new Error("download failed");
    });
    await expect(shareResultsPng(browser.blob, "local.png")).rejects.toThrow(
      "download failed"
    );
    expect(browser.attached.size).toBe(0);
    vi.runAllTimers();
    expect(browser.revokeObjectURL).toHaveBeenCalledOnce();
  });
});
