"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
} from "lucide-react";
import type {
  TweetProcess,
  Author,
  QueuedTrade,
  ExecutedTrade,
} from "@/lib/api";
import { fetchAuthor, fetchQueuedTrades, fetchExecutedTrades } from "@/lib/api";

interface TweetCardProps {
  tweet: TweetProcess;
}

export default function TweetCard({ tweet }: TweetCardProps) {
  const [author, setAuthor] = useState<Author | null>(null);
  const [queuedTrades, setQueuedTrades] = useState<QueuedTrade[]>([]);
  const [executedTrades, setExecutedTrades] = useState<ExecutedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [authorData, queuedData, executedData] = await Promise.all([
          tweet.author_id
            ? fetchAuthor(tweet.author_id)
            : Promise.resolve(null),
          fetchQueuedTrades(tweet.tweet_process_id),
          fetchExecutedTrades(tweet.tweet_process_id),
        ]);

        setAuthor(authorData?.data || null);
        setQueuedTrades(queuedData.trades || []);
        setExecutedTrades(executedData.trades || []);
      } catch (error) {
        console.error("Error fetching tweet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tweet.tweet_process_id, tweet.author_id]);

  const allTrades = [...queuedTrades, ...executedTrades];
  const currentTrade = allTrades[currentTradeIndex];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  const nextTrade = () => {
    setCurrentTradeIndex((prev) => (prev + 1) % allTrades.length);
  };

  const prevTrade = () => {
    setCurrentTradeIndex(
      (prev) => (prev - 1 + allTrades.length) % allTrades.length
    );
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
    <div className="bg-twitter-25 rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Profile picture */}
      <div className="flex items-top gap-3">
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
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-twitter-500" />
              Trades ({allTrades.length})
            </h4>
            {allTrades.length > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={prevTrade}
                  className="p-2 rounded-lg hover:bg-twitter-50 text-twitter-500 hover:text-twitter-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextTrade}
                  className="p-2 rounded-lg hover:bg-twitter-50 text-twitter-500 hover:text-twitter-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {currentTrade && (
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-twitter-500" />
                <span className="font-mono font-bold text-xl text-twitter-900">
                  ${currentTrade.ticker}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    "executed_at" in currentTrade
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-twitter-100 text-twitter-800 border border-twitter-200"
                  }`}
                >
                  {"executed_at" in currentTrade ? "Executed" : "Queued"}
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
                      {formatCurrency(currentTrade.dollar_amount)}
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
                      {currentTrade.days_to_hold}d
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
                        "executed_at" in currentTrade
                          ? currentTrade.executed_at
                          : currentTrade.queued_at
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-twitter-25 rounded-lg p-3 border border-gray-100 shadow-sm">
                <div className="text-xs font-semibold text-twitter-900 mb-1">
                  Reasoning:
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {currentTrade.reasoning}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
