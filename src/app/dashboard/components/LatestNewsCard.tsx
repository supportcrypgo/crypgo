'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Newspaper } from 'lucide-react';

interface NewsItem {
  id: number | string;
  title: string;
  source: string;
  time: string;
  category: string;
  thumbnail: string;
  url?: string;
}

export default function LatestNewsCard() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async (isBackground = false) => {
    try {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Failed to fetch news');
      const data: NewsItem[] = await response.json();
      setNewsItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching news:', err);
      if (!isBackground) setNewsItems([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();

    // Poll every 3 minutes (180000ms) for fresh news
    const interval = setInterval(() => fetchNews(true), 180000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Latest News</h3>
        <button className="text-xs font-medium text-charcoalGray hover:text-white transition-colors flex items-center gap-1">
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-darkmode/60 border border-white/5 rounded-xl overflow-hidden animate-pulse">
              <div className="h-24 bg-charcoalGray/20" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-charcoalGray/20 rounded w-full" />
                <div className="h-3 bg-charcoalGray/20 rounded w-2/3" />
                <div className="flex justify-between mt-3">
                  <div className="h-2 bg-charcoalGray/20 rounded w-14" />
                  <div className="h-2 bg-charcoalGray/20 rounded w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : newsItems.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-darkmode/60 p-6 text-center">
          <Newspaper className="mx-auto mb-3 h-6 w-6 text-charcoalGray" />
          <p className="text-sm text-white">No news available right now.</p>
          <p className="mt-1 text-xs text-charcoalGray">The feed will appear here when the API returns items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {newsItems.map((item) => (
            <a
              key={item.id}
              href={item.url || '#'}
              target={item.url ? '_blank' : undefined}
              rel={item.url ? 'noopener noreferrer' : undefined}
              className="group bg-darkmode/60 border border-white/5 rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              <div className="relative h-24 overflow-hidden">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <p className="text-xs text-white font-medium leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="flex items-center gap-1 text-[10px] text-charcoalGray">
                    {item.time}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
