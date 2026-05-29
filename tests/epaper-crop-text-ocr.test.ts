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

  it('skips masthead noise and prefers the quoted Hindi headline', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'महा/लोकस्वामीपुलिस थाना ;', top: 0, left: 0, height: 24 },
      { text: '_< सुरक्षा, आत्मनिर्भरता व आत्मविश्वास का संदेश', top: 28, left: 0, height: 16 },
      { text: 'बेटियों को मिली ‘उम्मीद’ की ताकत', top: 52, left: 0, height: 16 },
      {
        text: 'किशनगंज द्वारा आयोजित उम्मीद कार्यक्रम में बालिकाओं से खुलकर संवाद किया।',
        top: 78,
        left: 0,
        height: 14,
      },
    ]);

    expect(result.title).toBe('बेटियों को मिली ‘उम्मीद’ की ताकत');
    expect(result.plainText).not.toContain('लोकस्वामी');
    expect(result.plainText.split('\n')[0]).toBe('सुरक्षा, आत्मनिर्भरता व आत्मविश्वास का संदेश');
    expect(result.contentHtml).not.toContain('बेटियों को मिली');
    expect(result.contentHtml).toContain('किशनगंज द्वारा आयोजित');
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

  it('trims noisy punctuation from OCR line edges', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: ' _< बेटियों को मिली ताकत ; ', top: 0, left: 0, height: 20 },
      { text: ' कार्यक्रम में बालिकाओं से संवाद किया गया। ', top: 28, left: 0, height: 14 },
    ]);

    expect(result.plainText.split('\n')[0]).toBe('बेटियों को मिली ताकत');
    expect(result.title).toBe('बेटियों को मिली ताकत');
  });

  it('returns confidence warnings for weak OCR text', () => {
    const result = buildEpaperCropTextOcrResult(
      [{ text: 'Indore OCR draft', top: 0, left: 0, height: 12 }],
      { sourceKind: 'preprocessed' }
    );

    expect(result.confidence).toBeLessThan(70);
    expect(result.warnings).toEqual(
      expect.arrayContaining(['Low line count', 'Hindi script not detected'])
    );
    expect(result.sourceKind).toBe('preprocessed');
  });

  it('drops photo OCR noise and repeated junk before suggesting article text', () => {
    const result = buildEpaperCropTextOcrResult([
      { text: 'व आ _—— HF अर', top: 0, left: 0, height: 16 },
      { text: 'J Fie bay CT g: 4 | # \\ \\ bh', top: 20, left: 0, height: 16 },
      { text: 'Lo ay लि:, “; Sl er ee |। * —— जि Zl', top: 40, left: 0, height: 16 },
      { text: 'TT ISR SE NEN AB Se ie De te Co से', top: 60, left: 0, height: 16 },
      {
        text:
          '‘इंदौर। स्वच्छता में देशभर में AER - TRH बना चुके इंदौर में अब पारंपरिक बाजार भी स्मार्ट सफाई मॉडल की ओर कदम बढ़ा रहे हैं।',
        top: 90,
        left: 0,
        height: 14,
      },
      {
        text:
          'रामनवमी के पावन अवसर पर शहर की चोइथराम फल-सब्जी मंडी में विशेष साफ-सफाई अभियान चलाया गया।',
        top: 112,
        left: 0,
        height: 14,
      },
      { text: 'J Fie bay CT g: 4 | # \\ \\ bh', top: 135, left: 0, height: 16 },
      {
        text:
          'रामनवमी के पावन अवसर पर शहर की चोइथराम फल-सब्जी मंडी में विशेष साफ-सफाई अभियान चलाया गया।',
        top: 160,
        left: 0,
        height: 14,
      },
    ]);

    expect(result.plainText).not.toContain('J Fie');
    expect(result.plainText).not.toContain('HF अर');
    expect(result.title).toContain('इंदौर। स्वच्छता');
    expect(result.title).not.toContain('AER - TRH');
    expect(result.contentHtml).toContain('रामनवमी के पावन अवसर');
    expect(result.contentHtml.match(/रामनवमी/g)?.length).toBe(1);
  });
});
