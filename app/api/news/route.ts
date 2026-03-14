import { NextResponse } from 'next/server';

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

const FEEDS = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph' },
  { url: 'https://www.theblock.co/rss.xml', source: 'The Block' },
  { url: 'https://rsshub.app/jinse', source: '金色财经' },
];

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const matchTag = (xml: string, tag: string) => {
  // 1. 尝试匹配标准标签 <tag>content</tag>
  const reg = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const matched = xml.match(reg);
  if (matched) {
    return decodeXml(matched[1].trim());
  }
  
  // 2. 尝试匹配属性标签 <tag href="content" /> (常见于 link 标签)
  const attrReg = new RegExp(`<${tag}[^>]+href=["']([^"']+)["']`, 'i');
  const attrMatched = xml.match(attrReg);
  if (attrMatched) {
    return decodeXml(attrMatched[1].trim());
  }
  
  return '';
};

const parseRss = (xml: string, source: string): NewsItem[] => {
  // 兼容不同平台的 item 标签格式
  const items = xml.match(/<item[\s\S]*?>([\s\S]*?)<\/item>/gi) || [];
  return items
    .map((item) => {
      const title = matchTag(item, 'title');
      let link = matchTag(item, 'link');
      // 有些 RSS 的 link 放在 <guid> 里或者需要清理
      if (!link) link = matchTag(item, 'guid');
      
      const pubDate = matchTag(item, 'pubDate') || matchTag(item, 'dc:date');
      let publishedAt = new Date().toISOString();
      try {
        if (pubDate) {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            publishedAt = d.toISOString();
          }
        }
      } catch (e) {}
      
      return { title, link, source, publishedAt };
    })
    .filter((item) => item.title && item.link);
};

export async function GET() {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

        try {
          const res = await fetch(feed.url, {
            next: { revalidate: 60 },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) return [];
          const xml = await res.text();
          return parseRss(xml, feed.source);
        } catch (err) {
          clearTimeout(timeoutId);
          return [];
        }
      })
    );

    const news = results
      .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
      .map((r) => r.value)
      .flat()
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 40);

    // 如果所有源都失败，返回一些占位数据提示用户（可选，但这里先不加，防止干扰）
    return NextResponse.json({ 
      data: news,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
