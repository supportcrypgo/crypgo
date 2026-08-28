import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  category: string;
  thumbnail: string;
  url: string;
}

const RSS_FEEDS = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  { url: 'https://www.theblock.co/rss.xml', source: 'The Block' },
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
];

// Negative/crime-related keywords to filter out scam, fraud, and sensational news
const BLOCKED_PATTERNS: RegExp[] = [
  /\bscam(s|mer|ming|ped)?\b/i,
  /\bfraud\b/i,
  /\barrest(ed|s)?\b/i,
  /\bsentence(d)?\b/i,
  /\bjail(ed)?\b/i,
  /\bprison(er)?\b/i,
  /\btheft\b/i,
  /\bstolen\b/i,
  /\bsteal(ing|s)?\b/i,
  /\bhack(ed|ing|er|ers)?\b/i,
  /\bransomware\b/i,
  /\blaunder(ing|ed|s)?\b/i,
  /\blawsuit\b/i,
  /\bsue(d|s)?\b/i,
  /\bfine(d|s)?\b/i,
  /\bpenalt(y|ies)\b/i,
  /\bcriminal(s)?\b/i,
  /\bindict(ed|ment|s)?\b/i,
  /\bromance\b/i,
  /\bponzi\b/i,
  /\bpyramid scheme\b/i,
  /\brug[- ]?pull(s|ed)?\b/i,
  /\bphishing\b/i,
  /\bpolice\b/i,
  /\bpig\b/i,
  /\binvestigat(ion|e|ed|ing|or|ors)?\b/i,
  /\bbankrupt(cy)?\b/i,
  /\binsolven(t|cy)\b/i,
  /\bclass[- ]?action\b/i,
];

function isBlockedNews(title: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(title));
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  BTC: ['bitcoin', 'btc'],
  ETH: ['ethereum', 'eth', 'ether'],
  SOL: ['solana', 'sol'],
  BNB: ['bnb', 'binance'],
  XRP: ['xrp', 'ripple'],
  ADA: ['cardano', 'ada'],
  DOGE: ['dogecoin', 'doge'],
  Regulation: ['sec', 'regulation', 'regulatory', 'law', 'legal', 'bill', 'congress', 'etf approval', 'greenlight'],
  DeFi: ['defi', 'decentralized finance', 'yield', 'lending', 'borrowing', 'amm', 'dex'],
  NFT: ['nft', 'non-fungible', 'opensea', 'blur', 'collectible'],
};

const CATEGORY_THUMBNAILS: Record<string, string> = {
  BTC: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200&h=120&fit=crop&auto=format',
  ETH: 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=200&h=120&fit=crop&auto=format',
  SOL: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=200&h=120&fit=crop&auto=format',
  BNB: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&h=120&fit=crop&auto=format',
  XRP: 'https://images.unsplash.com/photo-1642790216863-5e1a8b8f8b8e?w=200&h=120&fit=crop&auto=format',
  ADA: 'https://images.unsplash.com/photo-1639762681057-408e52192e55?w=200&h=120&fit=crop&auto=format',
  DOGE: 'https://images.unsplash.com/photo-1605327132920-080a7e5d4b5f?w=200&h=120&fit=crop&auto=format',
  Regulation: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=200&h=120&fit=crop&auto=format',
  DeFi: 'https://images.unsplash.com/photo-1642790216863-5e1a8b8f8b8e?w=200&h=120&fit=crop&auto=format',
  NFT: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=200&h=120&fit=crop&auto=format',
  default: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200&h=120&fit=crop&auto=format',
};

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#8216;|&#x2018;/g, "'")
    .replace(/&#8217;|&#x2019;/g, "'")
    .replace(/&#8220;|&#x201C;/g, '"')
    .replace(/&#8221;|&#x201D;/g, '"')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/"/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&#x2013;/g, '–')
    .replace(/&#8212;|&#x2014;/g, '—');
}

function categorizeArticle(title: string): string {
  const lowerTitle = title.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerTitle.includes(kw))) {
      return category;
    }
  }
  return 'Crypto';
}

function getThumbnail(category: string): string {
  return CATEGORY_THUMBNAILS[category] || CATEGORY_THUMBNAILS.default;
}

function parseRSS(xmlText: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  
  // Simple regex-based RSS parsing (works for standard RSS 2.0)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const descriptionMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    
    const title = titleMatch?.[1] || titleMatch?.[2] || '';
    const link = linkMatch?.[1] || '';
    const pubDate = pubDateMatch?.[1] || '';
    const description = descriptionMatch?.[1] || descriptionMatch?.[2] || '';
    
    if (!title || !link) continue;
    
    // Skip blocked/crime-related news
    if (isBlockedNews(title)) continue;
    
    const category = categorizeArticle(title);
    const thumbnail = getThumbnail(category);
    const timeAgo = formatTimeAgo(pubDate);
    
    items.push({
      id: `${source}-${link}`,
      title: decodeHTMLEntities(title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()),
      source,
      time: timeAgo,
      category,
      thumbnail,
      url: decodeHTMLEntities(link),
    });
  }
  
  return items;
}

function formatTimeAgo(pubDateStr: string): string {
  try {
    const pubDate = new Date(pubDateStr);
    const now = new Date();
    const diffMs = now.getTime() - pubDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export async function GET() {
  try {
    const allItems: NewsItem[] = [];
    
    // Fetch all RSS feeds in parallel
    const feedPromises = RSS_FEEDS.map(async ({ url, source }) => {
      try {
        const response = await fetch(url, {
          next: { revalidate: 60 }, // Cache for 1 minute
          headers: {
            'User-Agent': 'Crypgo/1.0 (+https://crypgo.app)',
          },
        });
        
        if (!response.ok) {
          console.warn(`Failed to fetch ${source}: ${response.status}`);
          return [];
        }
        
        const xmlText = await response.text();
        return parseRSS(xmlText, source);
      } catch (error) {
        console.warn(`Error fetching ${source}:`, error);
        return [];
      }
    });
    
    const results = await Promise.allSettled(feedPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }
    
    // Sort by time (most recent first) - approximate since we only have timeAgo strings
    // For better sorting, we could parse pubDate properly, but this works for display
    allItems.sort((a, b) => {
      // Prioritize items with "m ago" or "h ago" over "d ago"
      const timeA = a.time.toLowerCase();
      const timeB = b.time.toLowerCase();
      if (timeA.includes('m ago') && !timeB.includes('m ago')) return -1;
      if (timeB.includes('m ago') && !timeA.includes('m ago')) return 1;
      if (timeA.includes('h ago') && !timeB.includes('h ago')) return -1;
      if (timeB.includes('h ago') && !timeA.includes('h ago')) return 1;
      return 0;
    });
    
    // Return top 4 items (latest only)
    return NextResponse.json(allItems.slice(0, 4));
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}