"use client";

import {
  TrendingUp,
  MessageSquare,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import type { TweetProcess, QueuedTrade, ExecutedTrade } from "@/lib/api";

interface DashboardStatsProps {
  tweets: TweetProcess[];
  queuedTrades: QueuedTrade[];
  executedTrades: ExecutedTrade[];
}

export default function DashboardStats({
  tweets,
  queuedTrades,
  executedTrades,
}: DashboardStatsProps) {
  const totalTrades = queuedTrades.length + executedTrades.length;

  const totalVolume = [...queuedTrades, ...executedTrades].reduce(
    (sum, trade) => {
      return sum + parseFloat(trade.dollar_amount);
    },
    0
  );

  const stats = [
    {
      label: "Total Posts",
      value: tweets.length,
      icon: MessageSquare,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Total Trades",
      value: totalTrades,
      icon: TrendingUp,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Total Volume",
      value: `$${totalVolume.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Executed Trades",
      value: `${executedTrades.length}/${queuedTrades.length}`,
      icon: CheckCircle,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`${stat.bgColor} rounded-xl p-6 border border-twitter-100 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${stat.textColor}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
