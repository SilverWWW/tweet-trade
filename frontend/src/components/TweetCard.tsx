"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
} from "lucide-react";
import type { TweetProcess, Author, Trade } from "@/lib/api";
import { fetchAuthor, fetchTrades } from "@/lib/api";

interface TweetCardProps {
  tweet: TweetProcess;
}

export default function TweetCard({ tweet }: TweetCardProps) {
  const [author, setAuthor] = useState<Author | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const tradesContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [authorData, tradesData] = await Promise.all([
          tweet.author_id
            ? fetchAuthor(tweet.author_id)
            : Promise.resolve(null),
          fetchTrades(tweet.tweet_process_id),
        ]);

        setAuthor(authorData?.data || null);
        setTrades(tradesData.trades || []);
      } catch (error) {
        console.error("Error fetching tweet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tweet.tweet_process_id, tweet.author_id]);

  const allTrades = trades;

  // Measure container width and update CSS custom property
  useEffect(() => {
    const updateContainerWidth = () => {
      if (tradesContainerRef.current) {
        const width = tradesContainerRef.current.offsetWidth;
        setContainerWidth(width);
        tradesContainerRef.current.style.setProperty(
          "--container-width",
          `${width}px`
        );

        // Calculate animation duration based on number of cards
        const baseDuration = 10; // base duration in seconds
        const cardCount = allTrades.length;
        const duration = Math.max(baseDuration, baseDuration + (cardCount - 1));
        tradesContainerRef.current.style.setProperty(
          "--animation-duration",
          `${duration}s`
        );
      }
    };

    updateContainerWidth();
    window.addEventListener("resize", updateContainerWidth);

    return () => window.removeEventListener("resize", updateContainerWidth);
  }, [allTrades]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-twitter-100 p-6 animate-pulse shadow-sm">
        <div className="h-4 bg-twitter-100 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-twitter-100 rounded w-full mb-2"></div>
        <div className="h-3 bg-twitter-100 rounded w-5/6"></div>
      </div>
    );
  }

  return (
    <div className="bg-twitter-25 rounded-xl border border-gray-200 pt-6 pb-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Profile picture */}
      <div className="flex items-top gap-3 pl-6 pr-6">
        <div className="w-12 h-12 bg-twitter-500 rounded-full flex shrink-0 items-center justify-center text-white font-semibold shadow-sm">
          {author?.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex flex-col flex-grow gap-2">
          {/* Author Name */}
          <div className="flex flex-row items-center gap-2">
            <h3 className="font-semibold text-xl text-gray-900">
              {author?.name || "Unknown Author"}
            </h3>
            <h1 className="bg-twitter-100 rounded-full border border-twitter-200 px-3 py-1">
              <p className="text-twitter-800 text-xs">
                {(author?.platform.charAt(0).toUpperCase() ?? "") +
                  author?.platform.slice(1)}
              </p>
            </h1>
          </div>
          {/* Tweet Content */}
          <div className="mb-4">
            <div className="flex flex-col bg-white rounded-xl p-4 border border-gray-100 shadow-sm gap-2">
              <p className="text-lg font-medium text-gray-800 leading-relaxed">
                {tweet.tweet_content}
              </p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                {formatDate(tweet.submitted_at)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trades Section */}
      {allTrades.length > 0 && (
        <div className="border-t border-twitter-100 pt-2">
          <div className="flex items-center justify-between mb-3 pl-6 pr-6">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-twitter-500" />
              Trades ({allTrades.length})
            </h4>
          </div>

          <div
            ref={tradesContainerRef}
            className="relative overflow-hidden rounded-lg"
          >
            <div
              className="floating-train flex gap-4"
              style={{ width: "max-content" }}
            >
              {allTrades.map((trade, index) => (
                <div
                  key={`${trade.id}-${index}`}
                  className="flex-shrink-0 bg-white rounded-xl p-5 border border-gray-100 shadow-sm"
                  style={{
                    width: "500px",
                    minHeight: "300px",
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-6 h-6 text-twitter-500" />
                    <span className="font-mono font-bold text-xl text-twitter-900">
                      ${trade.ticker}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        trade.executed
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : "bg-twitter-100 text-twitter-800 border border-twitter-200"
                      }`}
                    >
                      {trade.executed ? "Executed" : "Queued"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-twitter-500" />
                      <div>
                        <div className="text-xs text-twitter-500 font-medium">
                          Amount
                        </div>
                        <div className="font-bold text-twitter-900">
                          {formatCurrency(trade.dollar_amount)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-twitter-500" />
                      <div>
                        <div className="text-xs text-twitter-500 font-medium">
                          Hold
                        </div>
                        <div className="font-bold text-twitter-900">
                          {trade.days_to_hold}d
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-twitter-500" />
                      <div>
                        <div className="text-xs text-twitter-500 font-medium">
                          Time
                        </div>
                        <div className="font-bold text-twitter-900 text-sm">
                          {formatDate(
                            trade.executed && trade.executed_at
                              ? trade.executed_at
                              : trade.queued_at
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-twitter-25 rounded-lg p-3 border border-gray-100">
                    <div className="text-sm font-semibold text-twitter-900 mb-2">
                      Trading Reasoning:
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                      {trade.reasoning}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
