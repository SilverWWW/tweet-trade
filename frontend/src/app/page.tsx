"use client";

import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, TrendingUp } from "lucide-react";
import TweetCard from "@/components/TweetCard";
import DashboardStats from "@/components/DashboardStats";
import {
  fetchTweetsWithMarketEffect,
  fetchAllQueuedTrades,
  fetchAllExecutedTrades,
  fetchAllTweetsWithMarketEffect,
  type TweetProcess,
  type QueuedTrade,
  type ExecutedTrade,
} from "@/lib/api";

export default function Home() {
  const [tweets, setTweets] = useState<TweetProcess[]>([]);
  const [allTweets, setAllTweets] = useState<TweetProcess[]>([]);
  const [allQueuedTrades, setAllQueuedTrades] = useState<QueuedTrade[]>([]);
  const [allExecutedTrades, setAllExecutedTrades] = useState<ExecutedTrade[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTweets = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch data in parallel for better performance
      const [
        displayTweetsResponse,
        allTweetsResponse,
        queuedTradesResponse,
        executedTradesResponse,
      ] = await Promise.all([
        fetchTweetsWithMarketEffect(20), // For display
        fetchAllTweetsWithMarketEffect(), // For total count
        fetchAllQueuedTrades(), // For dashboard stats
        fetchAllExecutedTrades(), // For dashboard stats
      ]);

      setTweets(displayTweetsResponse.data || []);
      setAllTweets(allTweetsResponse.data || []);
      setAllQueuedTrades(queuedTradesResponse.trades || []);
      setAllExecutedTrades(executedTradesResponse.trades || []);
    } catch (err) {
      console.error("Error fetching tweets:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tweets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTweets();
  }, []);

  const handleRefresh = () => {
    fetchTweets(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-twitter-500"></div>
            <span className="ml-3 text-twitter-500 font-medium">
              Loading tweets...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-red-800">
                  Error Loading Tweets
                </h2>
              </div>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-twitter-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 bg-[#26a7de] rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-twitter-500">
                  Tweet Trade 🐤
                </h1>
                <p className="text-sm text-muted-foreground font-medium">
                  Social Media Trading Dashboard
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-twitter-500 text-white px-4 py-2 rounded-lg hover:bg-twitter-600 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Stats */}
        <DashboardStats
          tweets={allTweets}
          queuedTrades={allQueuedTrades}
          executedTrades={allExecutedTrades}
        />

        {tweets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-twitter-600 mb-4 font-medium">
              No tweets with market impact found
            </div>
            <button
              onClick={handleRefresh}
              className="bg-twitter-500 text-white px-4 py-2 rounded-lg hover:bg-twitter-600 transition-colors shadow-sm"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.tweet_process_id} tweet={tweet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
