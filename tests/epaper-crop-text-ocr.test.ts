import { describe, expect, it } from 'vitest';
import { buildEpaperCropTextOcrResult } from '@/lib/utils/epaperLocalOcrClient';

describe('e-paper crop OCR text cleanup', () => {
  it('removes empty lines and isolated page number noise', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: '   ', top: 0, left: 0, height: 12 },
      { text: '2', top: 5, left: 0, height: 12 },
      { text: ' हजार फीट ऊंचाई से रोशनी में नहाया इंदौर ', top: 20, left: 0, height: 28 },
      { text: ' बिजली मांग पहुंची 750 मेगावाट ', top: 60, left: 0, height: 14 },
    ]);

    expect(result.lineCount).toBe(2);
    expect(result.plainText.split('\n')).toEqual([
      'हजार फीट ऊंचाई से रोशनी में नहाया इंदौर',
      'बिजली मांग पहुंची 750 मेगावाट',
    ]);
  });

  it('keeps Hindi and English mixed text in visual order', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'Indore Power Update', top: 0, left: 0, height: 20 },
      { text: 'इंदौर में बिजली मांग बढ़ी', top: 30, left: 0, height: 14 },
      { text: 'Peak demand reached 750 MW', top: 52, left: 0, height: 14 },
    ]);

    expect(result.plainText.split('\n')).toEqual([
      'Indore Power Update',
      'इंदौर में बिजली मांग बढ़ी',
      'Peak demand reached 750 MW',
    ]);
  });

  it('chooses a strong upper headline line over a small label', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'इंदौर', top: 0, left: 0, height: 10 },
      { text: 'हजार फीट ऊंचाई से रोशनी में नहाया इंदौर', top: 18, left: 0, height: 32 },
      { text: 'रात के समय शहर का नजारा अलग दिखाई दिया।', top: 58, left: 0, height: 14 },
      { text: 'बिजली मांग भी रिकॉर्ड स्तर पर पहुंची।', top: 78, left: 0, height: 14 },
    ]);

    expect(result.title).toBe('हजार फीट ऊंचाई से रोशनी में नहाया इंदौर');
    expect(result.contentHtml).toContain('रात के समय शहर का नजारा');
  });

  it('falls back to the first readable line when no headline line is larger', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'जल्द प्रमाण पत्र के लिए भटक रहे परिजन', top: 0, left: 0, height: 16 },
      { text: 'लोगों ने व्यवस्था सुधारने की मांग की।', top: 24, left: 0, height: 15 },
      { text: 'अधिकारियों ने जल्द समाधान का आश्वासन दिया।', top: 46, left: 0, height: 15 },
    ]);

    expect(result.title).toBe('जल्द प्रमाण पत्र के लिए भटक रहे परिजन');
    expect(result.contentHtml).not.toContain('जल्द प्रमाण पत्र के लिए भटक रहे परिजन');
  });

  it('creates an excerpt from readable body text', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'बैरिकेड्स से बचने के प्रयास में युवक घायल', top: 0, left: 0, height: 26 },
      {
        text:
          'शहर में यातायात व्यवस्था के दौरान बाइक अनियंत्रित होने से युवक गंभीर रूप से घायल हो गया।',
        top: 36,
        left: 0,
        height: 14,
      },
      {
        text:
          'प्रत्यक्षदर्शियों ने बताया कि सड़क पर अचानक भीड़ बढ़ने से वाहन संभालना मुश्किल हो गया था।',
        top: 58,
        left: 0,
        height: 14,
      },
    ]);

    expect(result.excerpt).toContain('शहर में यातायात व्यवस्था');
    expect(result.excerpt.length).toBeLessThanOrEqual(180);
    expect(result.engine).toBe('local');
  });
});
