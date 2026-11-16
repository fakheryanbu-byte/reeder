import type { Language } from '../types/guest';
import { formatCurrencyPrice, toAsciiDigits } from './documentRules';

export interface ApprovalImageParams {
  hotelName: string;
  guestName: string;
  roomNumber: string;
  welcomeMessage: string;
  guestVisiblePrice: number | null;
  sessionId: string;
  approvedAt: Date | null;
  lang: Language;
  labels: {
    approvedTitle: string;
    approvedRoomLabel: string;
    approvedPriceLabel: string;
    approvedWelcomeLabel: string;
    guestLabel: string;
    sessionLabel: string;
  };
}

export function buildApprovalImageFilename(roomNumber: string, sessionId: string): string {
  const cleanRoom = toAsciiDigits(roomNumber)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const shortId = sessionId
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 8);
  const parts = ['checkin-approval'];
  if (cleanRoom) parts.push(`room-${cleanRoom}`);
  if (shortId) parts.push(shortId);
  return `${parts.join('-')}.png`;
}

export function wrapTextToLines(
  text: string,
  maxWidth: number,
  measureWidth: (candidate: string) => number
): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measureWidth(candidate) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Handle extremely long unbroken token by character slicing
        if (measureWidth(word) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            const nextChunk = chunk + ch;
            if (measureWidth(nextChunk) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = nextChunk;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
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
}

export async function renderApprovalCardPng(
  params: ApprovalImageParams
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas rendering requires a browser environment.');
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const fontFamily =
    params.lang === 'ar'
      ? '"Tajawal", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      : '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const cardWidth = 860;
  const outerPad = 32;
  const canvasWidth = cardWidth + outerPad * 2;
  const cardPadX = 48;
  const innerWidth = cardWidth - cardPadX * 2;

  // Measure welcome text wrapping on an offscreen probe canvas first
  const probeCanvas = document.createElement('canvas');
  const probeCtx = probeCanvas.getContext('2d');
  if (!probeCtx) {
    throw new Error('Could not initialize canvas context.');
  }
  probeCtx.font = `600 22px ${fontFamily}`;
  const welcomeBoxPadX = 28;
  const welcomeMaxTextWidth = innerWidth - welcomeBoxPadX * 2;
  const welcomeLines = wrapTextToLines(
    params.welcomeMessage,
    welcomeMaxTextWidth,
    (candidate) => probeCtx.measureText(candidate).width
  );

  const welcomeLineHeight = 36;
  const welcomeBoxHeight = Math.max(
    118,
    66 + welcomeLines.length * welcomeLineHeight + 24
  );

  const hasHotel = Boolean(params.hotelName.trim());
  const hasGuest = Boolean(params.guestName.trim());
  const cardTop = outerPad;
  const headerBlockHeight =
    44 + // top pad
    76 + // icon
    20 + // gap
    32 + // title
    (hasHotel ? 34 : 0) +
    (hasGuest ? 34 : 0) +
    28; // gap before KPI boxes
  const kpiHeight = 128;
  const gapAfterKpi = 26;
  const gapBeforeFooter = 28;
  const footerHeight = 46;
  const cardBottomPad = 34;

  const cardHeight =
    headerBlockHeight +
    kpiHeight +
    gapAfterKpi +
    welcomeBoxHeight +
    gapBeforeFooter +
    footerHeight +
    cardBottomPad;
  const canvasHeight = cardHeight + outerPad * 2;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas context.');
  }

  ctx.scale(scale, scale);

  // Outer warm background
  ctx.fillStyle = '#F4EFEA';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Card surface
  drawRoundedRect(ctx, outerPad, cardTop, cardWidth, cardHeight, 28);
  ctx.fillStyle = '#FAF7F2';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(46, 107, 71, 0.35)';
  ctx.stroke();

  const centerX = canvasWidth / 2;
  let y = cardTop + 44;

  // Checkmark badge
  drawRoundedRect(ctx, centerX - 38, y, 76, 76, 20);
  ctx.fillStyle = 'rgba(46, 107, 71, 0.12)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(46, 107, 71, 0.28)';
  ctx.stroke();

  // Checkmark circle + stroke
  ctx.beginPath();
  ctx.arc(centerX, y + 38, 20, 0, Math.PI * 2);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#2E6B47';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX - 9, y + 38);
  ctx.lineTo(centerX - 2, y + 45);
  ctx.lineTo(centerX + 10, y + 31);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2E6B47';
  ctx.stroke();

  y += 76 + 24;

  // Approved title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = params.lang === 'ar' ? 'rtl' : 'ltr';
  ctx.fillStyle = '#2E6B47';
  ctx.font = `700 22px ${fontFamily}`;
  ctx.fillText(params.labels.approvedTitle, centerX, y + 12);
  y += 34;

  if (hasHotel) {
    ctx.fillStyle = '#2C2C2C';
    ctx.font = `700 24px ${fontFamily}`;
    ctx.fillText(params.hotelName.trim(), centerX, y + 14, innerWidth);
    y += 34;
  }

  if (hasGuest) {
    ctx.fillStyle = '#685F58';
    ctx.font = `600 18px ${fontFamily}`;
    ctx.fillText(
      `${params.labels.guestLabel}: ${params.guestName.trim()}`,
      centerX,
      y + 14,
      innerWidth
    );
    y += 34;
  }

  y += 24;

  // KPI Boxes: Assigned Room (+ optional Room Price)
  const cardLeft = outerPad + cardPadX;
  const hasPrice = params.guestVisiblePrice !== null;

  if (hasPrice && params.guestVisiblePrice !== null) {
    const gap = 20;
    const boxWidth = (innerWidth - gap) / 2;
    const rightBoxX = params.lang === 'ar' ? cardLeft + boxWidth + gap : cardLeft;
    const leftBoxX = params.lang === 'ar' ? cardLeft : cardLeft + boxWidth + gap;

    // Room box
    drawRoundedRect(ctx, rightBoxX, y, boxWidth, kpiHeight, 20);
    ctx.fillStyle = 'rgba(46, 107, 71, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(46, 107, 71, 0.25)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#685F58';
    ctx.font = `600 16px ${fontFamily}`;
    ctx.fillText(params.labels.approvedRoomLabel, rightBoxX + boxWidth / 2, y + 34);

    ctx.direction = 'ltr';
    ctx.fillStyle = '#2C2C2C';
    ctx.font = `700 40px ${fontFamily}`;
    ctx.fillText(params.roomNumber.trim(), rightBoxX + boxWidth / 2, y + 84, boxWidth - 32);

    // Price box
    drawRoundedRect(ctx, leftBoxX, y, boxWidth, kpiHeight, 20);
    ctx.fillStyle = 'rgba(232, 165, 136, 0.16)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(197, 139, 109, 0.38)';
    ctx.stroke();

    ctx.direction = params.lang === 'ar' ? 'rtl' : 'ltr';
    ctx.fillStyle = '#685F58';
    ctx.font = `600 16px ${fontFamily}`;
    ctx.fillText(params.labels.approvedPriceLabel, leftBoxX + boxWidth / 2, y + 34, boxWidth - 32);

    ctx.fillStyle = '#2C2C2C';
    ctx.font = `700 30px ${fontFamily}`;
    ctx.fillText(
      formatCurrencyPrice(params.guestVisiblePrice, params.lang),
      leftBoxX + boxWidth / 2,
      y + 84,
      boxWidth - 32
    );
  } else {
    const boxWidth = 420;
    const boxX = centerX - boxWidth / 2;
    drawRoundedRect(ctx, boxX, y, boxWidth, kpiHeight, 20);
    ctx.fillStyle = 'rgba(46, 107, 71, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(46, 107, 71, 0.25)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#685F58';
    ctx.font = `600 16px ${fontFamily}`;
    ctx.fillText(params.labels.approvedRoomLabel, centerX, y + 34, boxWidth - 32);

    ctx.direction = 'ltr';
    ctx.fillStyle = '#2C2C2C';
    ctx.font = `700 42px ${fontFamily}`;
    ctx.fillText(params.roomNumber.trim(), centerX, y + 84, boxWidth - 32);
  }

  y += kpiHeight + gapAfterKpi;

  // Welcome message card
  drawRoundedRect(ctx, cardLeft, y, innerWidth, welcomeBoxHeight, 20);
  ctx.fillStyle = '#F4EFEA';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(44, 44, 44, 0.1)';
  ctx.stroke();

  const textAnchorX =
    params.lang === 'ar'
      ? cardLeft + innerWidth - welcomeBoxPadX
      : cardLeft + welcomeBoxPadX;
  ctx.textAlign = params.lang === 'ar' ? 'right' : 'left';
  ctx.direction = params.lang === 'ar' ? 'rtl' : 'ltr';

  ctx.fillStyle = '#8C5338';
  ctx.font = `700 16px ${fontFamily}`;
  ctx.fillText(params.labels.approvedWelcomeLabel, textAnchorX, y + 30);

  ctx.fillStyle = '#2C2C2C';
  ctx.font = `600 22px ${fontFamily}`;
  let lineY = y + 70;
  for (const line of welcomeLines) {
    if (line) {
      ctx.fillText(line, textAnchorX, lineY);
    }
    lineY += welcomeLineHeight;
  }

  y += welcomeBoxHeight + gapBeforeFooter;

  // Hairline divider
  ctx.beginPath();
  ctx.moveTo(cardLeft, y);
  ctx.lineTo(cardLeft + innerWidth, y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(44, 44, 44, 0.1)';
  ctx.stroke();

  // Footer metadata: date + session code
  const dateObj = params.approvedAt ?? new Date();
  const formattedDate = dateObj.toLocaleString(
    params.lang === 'ar' ? 'ar-SA' : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
  const shortCode = params.sessionId.slice(0, 8).toUpperCase();

  ctx.fillStyle = '#685F58';
  ctx.font = `500 14px ${fontFamily}`;
  ctx.textAlign = params.lang === 'ar' ? 'right' : 'left';
  ctx.direction = params.lang === 'ar' ? 'rtl' : 'ltr';
  ctx.fillText(formattedDate, textAnchorX, y + 26);

  const oppAnchorX =
    params.lang === 'ar'
      ? cardLeft + welcomeBoxPadX
      : cardLeft + innerWidth - welcomeBoxPadX;
  ctx.textAlign = params.lang === 'ar' ? 'left' : 'right';
  ctx.fillText(`${params.labels.sessionLabel}: ${shortCode}`, oppAnchorX, y + 26);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG image.'));
      },
      'image/png',
      1
    );
  });
}

function triggerDirectDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function saveApprovalImageToDevice(
  params: ApprovalImageParams
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await renderApprovalCardPng(params);
  const filename = buildApprovalImageFilename(params.roomNumber, params.sessionId);

  const isMobileBrowser =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (
    isMobileBrowser &&
    typeof File !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    const file = new File([blob], filename, { type: 'image/png' });
    const canShareFiles =
      typeof navigator.canShare === 'function'
        ? navigator.canShare({ files: [file] })
        : false;

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: params.labels.approvedTitle,
        });
        return 'shared';
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'cancelled';
        }
        // Fallback to direct download if share fails for non-cancellation reasons
      }
    }
  }

  triggerDirectDownload(blob, filename);
  return 'downloaded';
}
