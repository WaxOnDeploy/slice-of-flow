export interface PngSummary {
  title: string;
  subtitle: string;
  author: string;
  site: string;
  note: string;
  headers: readonly string[];
  rows: readonly { label: string; values: readonly string[] }[];
  footer: string;
}

const WIDTH = 1600;
const MARGIN = 72;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const DEFAULT_FILENAME = "slice-of-flow-results.png";
const REVOKE_DELAY_MS = 1_000;
const SANS =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const COLORS = {
  background: "#f2e4cf",
  paper: "#fffaf0",
  ink: "#382921",
  muted: "#685347",
  red: "#863e35",
  rule: "#ddcbb4",
  note: "#f8ecd5",
  row: "#f6efdf",
};

interface TextBlock {
  lines: string[];
  font: string;
  lineHeight: number;
  height: number;
}

/** Wrap supplied copy without ellipses, including unusually long single tokens. */
function textBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  size: number,
  weight = 400,
  family = SANS
): TextBlock {
  const font = `${weight} ${size}px ${family}`;
  ctx.font = font;
  const lines: string[] = [];
  if (text) {
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const character of Array.from(word)) {
          if (line && ctx.measureText(line + character).width > width) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
  }
  const lineHeight = Math.ceil(size * 1.3);
  return { lines, font, lineHeight, height: lines.length * lineHeight };
}

function drawText(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign = "left"
): void {
  ctx.font = block.font;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  block.lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * block.lineHeight);
  });
}

function roundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Render only normalized public summary strings, never the page or game state.
 * Headers name the value columns; a leading label header is also accepted when
 * headers.length is one greater than the largest row's values.length.
 * Values (including n/a, measured zeros and signed changes) are not recalculated.
 * No images, font loading, SVG, clipboard, network, or DOM capture is involved.
 */
export async function renderResultsPng(summary: PngSummary): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("PNG export requires a browser with canvas support.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("PNG export requires a supported 2D canvas context.");
  if (typeof canvas.toBlob !== "function") {
    throw new Error("PNG export is not supported in this browser.");
  }

  // System font stacks are deliberate: do not inspect document.fonts.ready or
  // request the site's hosted fonts, even if the page is still loading them.
  const title = textBlock(ctx, summary.title, CONTENT_WIDTH, 64, 700, SERIF);
  const subtitle = textBlock(ctx, summary.subtitle, CONTENT_WIDTH, 26);
  const note = textBlock(ctx, summary.note, CONTENT_WIDTH - 56, 25);
  const footer = textBlock(ctx, summary.footer, CONTENT_WIDTH, 23);
  const author = textBlock(ctx, summary.author, CONTENT_WIDTH, 27, 600);
  const site = textBlock(ctx, summary.site, CONTENT_WIDTH, 26, 600);

  const largestRow = summary.rows.reduce(
    (largest, row) => Math.max(largest, row.values.length),
    0
  );
  const hasLabelHeader =
    summary.rows.length > 0 && summary.headers.length === largestRow + 1;
  const valueHeaders = hasLabelHeader
    ? summary.headers.slice(1)
    : summary.headers;
  const labelHeader = hasLabelHeader ? summary.headers[0] : "Metric";
  const valueCount = Math.max(valueHeaders.length, largestRow);
  const labelWidth = valueCount ? CONTENT_WIDTH * 0.34 : CONTENT_WIDTH;
  const valueWidth = valueCount ? (CONTENT_WIDTH - labelWidth) / valueCount : 0;
  const cellPadding = 24;
  const headingBlocks = [
    textBlock(ctx, labelHeader, labelWidth - cellPadding * 2, 24, 700),
    ...Array.from({ length: valueCount }, (_, index) =>
      textBlock(
        ctx,
        valueHeaders[index] ?? "",
        valueWidth - cellPadding * 2,
        24,
        700
      )
    ),
  ];
  const headerHeight = Math.max(
    72,
    ...headingBlocks.map(block => block.height + 32)
  );
  const rows = summary.rows.map(row => {
    const label = textBlock(
      ctx,
      row.label,
      labelWidth - cellPadding * 2,
      29,
      600
    );
    const values = Array.from({ length: valueCount }, (_, index) =>
      textBlock(
        ctx,
        row.values[index] ?? "n/a",
        valueWidth - cellPadding * 2,
        32,
        600
      )
    );
    return {
      label,
      values,
      height: Math.max(
        68,
        label.height + 26,
        ...values.map(block => block.height + 26)
      ),
    };
  });

  // Measure first, then size the canvas. No fixed-height clipping or tiny type.
  const titleY = MARGIN;
  const subtitleY = titleY + title.height + 10;
  const noteY = subtitleY + subtitle.height + 24;
  const noteHeight = note.height ? note.height + 36 : 0;
  const tableY = noteY + noteHeight + (noteHeight ? 24 : 0);
  const tableHeight =
    headerHeight + rows.reduce((height, row) => height + row.height, 0);
  const footerY = tableY + tableHeight + 24;
  const authorY = footerY + footer.height + 30;
  const siteY = authorY + author.height + 8;
  canvas.height = Math.ceil(siteY + site.height + MARGIN);

  // Resizing resets canvas state; drawText assigns all text state again below.
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  roundedBox(ctx, 32, 32, WIDTH - 64, canvas.height - 64, 24, COLORS.paper);
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, WIDTH, 12);
  // A small diner-check border, made only from native rectangles.
  for (let x = 0; x < WIDTH; x += 32) {
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x, canvas.height - 12, 16, 12);
  }
  drawText(ctx, title, MARGIN, titleY, COLORS.red);
  drawText(ctx, subtitle, MARGIN, subtitleY, COLORS.muted);

  if (noteHeight) {
    roundedBox(ctx, MARGIN, noteY, CONTENT_WIDTH, noteHeight, 12, COLORS.note);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(MARGIN, noteY + 12, 4, noteHeight - 24);
    drawText(ctx, note, MARGIN + 28, noteY + 18, COLORS.ink);
  }

  roundedBox(ctx, MARGIN, tableY, CONTENT_WIDTH, tableHeight, 12, COLORS.row);
  roundedBox(ctx, MARGIN, tableY, CONTENT_WIDTH, headerHeight, 12, COLORS.red);
  headingBlocks.forEach((block, index) => {
    const x =
      index === 0
        ? MARGIN + cellPadding
        : MARGIN + labelWidth + (index - 0.5) * valueWidth;
    drawText(
      ctx,
      block,
      x,
      tableY + (headerHeight - block.height) / 2,
      COLORS.paper,
      index === 0 ? "left" : "center"
    );
  });

  let rowY = tableY + headerHeight;
  rows.forEach((row, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(MARGIN, rowY, CONTENT_WIDTH, row.height);
    }
    if (index > 0) {
      ctx.fillStyle = COLORS.rule;
      ctx.fillRect(
        MARGIN + cellPadding,
        rowY,
        CONTENT_WIDTH - cellPadding * 2,
        1
      );
    }
    drawText(
      ctx,
      row.label,
      MARGIN + cellPadding,
      rowY + (row.height - row.label.height) / 2,
      COLORS.ink
    );
    row.values.forEach((block, column) => {
      drawText(
        ctx,
        block,
        MARGIN + labelWidth + (column + 0.5) * valueWidth,
        rowY + (row.height - block.height) / 2,
        COLORS.ink,
        "center"
      );
    });
    rowY += row.height;
  });

  drawText(ctx, footer, MARGIN, footerY, COLORS.muted);
  ctx.fillStyle = COLORS.rule;
  ctx.fillRect(MARGIN, authorY - 16, CONTENT_WIDTH, 1);
  drawText(ctx, author, MARGIN, authorY, COLORS.ink);
  drawText(ctx, site, MARGIN, siteY, COLORS.red);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else
        reject(
          new Error("The browser could not create the PNG. Please try again.")
        );
    }, "image/png");
  });
}

/** Local, transient download; the object URL is never sent to a server. */
export function downloadResultsPng(
  blob: Blob,
  filename = DEFAULT_FILENAME
): void {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;
  const revoke = () => {
    // Avoid an unhandled exception from asynchronous cleanup in a host/browser.
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* Best-effort host cleanup. */
    }
  };
  try {
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || DEFAULT_FILENAME;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor) {
      try {
        anchor.remove();
      } catch {
        // A failed remove must not skip URL cleanup; try the parent DOM API too.
        try {
          anchor.parentNode?.removeChild(anchor);
        } catch {
          /* Host DOM failure. */
        }
      }
    }
    try {
      // Let the browser consume the URL before revoking it, even on click error.
      setTimeout(revoke, REVOKE_DELAY_MS);
    } catch {
      // If scheduling itself fails there must not be a live URL left behind.
      revoke();
    }
  }
}

/** Native file sharing when supported; cancellation never starts a download. */
export async function shareResultsPng(
  blob: Blob,
  filename: string
): Promise<"shared" | "downloaded" | "cancelled"> {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      typeof navigator.share === "function" &&
      typeof File === "function"
    ) {
      const file = new File([blob], filename || DEFAULT_FILENAME, {
        type: "image/png",
      });
      const data: ShareData = { files: [file] };
      if (navigator.canShare(data)) {
        await navigator.share(data);
        return "shared";
      }
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      return "cancelled";
    }
    // Permission, activation, unsupported-file, and other native failures fall
    // back to the same local download, never clipboard or text-only sharing.
  }
  downloadResultsPng(blob, filename);
  return "downloaded";
}
