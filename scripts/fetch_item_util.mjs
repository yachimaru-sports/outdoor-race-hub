import fs from 'node:fs';

// 文字コード自動判定デコード
function decodeHtml(buffer, contentType = '') {
  let encoding = 'utf-8';
  const headStr = buffer.slice(0, 2000).toString('latin1');
  const charsetMatch = headStr.match(/charset=["']?([a-zA-Z0-9_\-]+)/i) || contentType.match(/charset=([a-zA-Z0-9_\-]+)/i);
  if (charsetMatch) {
    const cs = charsetMatch[1].toLowerCase();
    if (cs.includes('euc')) encoding = 'euc-jp';
    else if (cs.includes('shift') || cs.includes('sjis') || cs.includes('cp932')) encoding = 'shift_jis';
  }
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  } catch (e) {
    return buffer.toString('utf-8');
  }
}

export async function fetchItemPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const html = decodeHtml(buffer, res.headers.get('content-type') || '');

    let title = '';
    let price = 0;
    let originalPrice = 0;
    let discountRate = 0;
    let imageUrl = '';

    // JSON スクリプト解析
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/(json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of scripts) {
      try {
        const parsed = JSON.parse(s[2]);
        if (parsed.api?.data?.itemInfoSku) {
          const skuInfo = parsed.api.data.itemInfoSku;
          if (skuInfo.title) title = skuInfo.title;
          if (skuInfo.sku && skuInfo.sku[0]) {
            const firstSku = skuInfo.sku[0];
            price = firstSku.taxIncludedPrice || 0;
            if (firstSku.images && firstSku.images[0]) {
              imageUrl = firstSku.images[0].location || '';
            }
          }
        }
      } catch (e) {}
    }

    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].split('【楽天市場】')[0].split('：')[0].trim();
    }

    if (!imageUrl) {
      const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogMatch && !ogMatch[1].includes('noimage')) imageUrl = ogMatch[1];
    }

    // 定価 / メーカー希望小売価格
    const makerMatch = html.match(/メーカー希望小売価格[^\d]{0,30}([0-9,]+)\s*円/i) ||
                       html.match(/希望小売価格[^\d]{0,30}([0-9,]+)\s*円/i) ||
                       html.match(/定価[^\d]{0,30}([0-9,]+)\s*円/i) ||
                       html.match(/参考価格[^\d]{0,30}([0-9,]+)\s*円/i);
    if (makerMatch) {
      originalPrice = Number(makerMatch[1].replace(/,/g, ''));
    }

    // %OFF 表記
    const offMatch = html.match(/([1-9][0-9])\s*%\s*OFF/i);
    if (offMatch) {
      discountRate = Number(offMatch[1]);
    }

    // 計算
    if (originalPrice > 0 && price > 0 && price < originalPrice) {
      const calc = Math.round((1 - price / originalPrice) * 100);
      if (!discountRate || calc > discountRate) discountRate = calc;
    } else if (discountRate >= 25 && price > 0 && (!originalPrice || originalPrice <= price)) {
      originalPrice = Math.round(price / (1 - discountRate / 100));
    }

    // クリーンアップ
    title = title
      .replace(/【[^】]*】/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      url,
      title,
      price,
      originalPrice,
      discountRate,
      imageUrl
    };
  } catch (err) {
    return null;
  }
}

async function testSingle() {
  const item = await fetchItemPage('https://item.rakuten.co.jp/sakaiya/10132293');
  console.log(item);
}
testSingle();
