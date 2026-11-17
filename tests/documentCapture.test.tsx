import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DocumentCapture } from '../src/components/DocumentCapture';
import { getTranslations } from '../src/i18n';
import type { DocumentImageSlot } from '../src/types/guest';

describe('DocumentCapture optional second side availability', () => {
  it('renders the optional second-side capture buttons even before any front photo or after front photo purge', () => {
    const t = getTranslations('ar');

    const initialHtml = renderToStaticMarkup(
      <DocumentCapture
        frontImage={null}
        backImage={null}
        geminiConsent={false}
        isReading={false}
        readSucceeded={false}
        readError={null}
        warnings={[]}
        unreadableFields={[]}
        onSelectImage={vi.fn()}
        onRemoveImage={vi.fn()}
        onToggleConsent={vi.fn()}
        onAnalyzeNow={vi.fn()}
        t={t}
      />
    );

    expect(initialHtml).toContain(t.backSideLabel);
    expect(initialHtml).toContain(t.backSideOptionalTag);
    expect(initialHtml).toContain(t.addBackSide);
    expect(initialHtml).not.toContain(t.analyzeNowButton);

    const afterPurgeHtml = renderToStaticMarkup(
      <DocumentCapture
        frontImage={null}
        backImage={null}
        geminiConsent={true}
        isReading={false}
        readSucceeded={true}
        readError={null}
        warnings={[]}
        unreadableFields={[]}
        onSelectImage={vi.fn()}
        onRemoveImage={vi.fn()}
        onToggleConsent={vi.fn()}
        onAnalyzeNow={vi.fn()}
        t={t}
      />
    );

    expect(afterPurgeHtml).toContain(t.addBackSide);
    expect(afterPurgeHtml).toContain(t.readingComplete);
  });

  it('shows the manual extract button when only the second-side image is staged before consent', () => {
    const t = getTranslations('ar');
    const mockBackSlot = {
      id: 'back',
      file: {} as File,
      previewUrl: '',
      base64: 'AAAA',
      mimeType: 'image/jpeg',
    } satisfies DocumentImageSlot;

    const html = renderToStaticMarkup(
      <DocumentCapture
        frontImage={null}
        backImage={mockBackSlot}
        geminiConsent={false}
        isReading={false}
        readSucceeded={false}
        readError={null}
        warnings={[]}
        unreadableFields={[]}
        onSelectImage={vi.fn()}
        onRemoveImage={vi.fn()}
        onToggleConsent={vi.fn()}
        onAnalyzeNow={vi.fn()}
        t={t}
      />
    );

    expect(html).toContain(t.analyzeNowButton);
    expect(html).toContain(t.docLoadedHiddenTitle);
  });
});
