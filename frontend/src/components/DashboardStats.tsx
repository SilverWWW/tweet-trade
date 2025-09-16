"use client";

import {
  TrendingUp,
  MessageSquare,
  DollarSign,
  CheckCircle,
} from "lucide-react";

const formatPrice = (num: number, precision = 1) => {
  const magnitudes = [
    { value: 1e12, symbol: 'T' }, // Trillion
    { value: 1e9,  symbol: 'B' }, // Billion
    { value: 1e6,  symbol: 'M' }, // Million
    { value: 1e3,  symbol: 'K' }, // Thousand
  ];
  if (num === 0) {
    return '0';
  }
  const item = magnitudes.find(item => Math.abs(num) >= item.value);
  if (item) {
    const value = num / item.value;
    return `${value.toFixed(precision)}${item.symbol}`;
  }
  return String(Math.floor(num));
};

interface DashboardStatsProps {
  tweetsCount: number;
  tweetsMarketEffectCount: number;
  totalTradesCount: number;
  totalVolume: number;
}

export default function DashboardStats({
  tweetsCount,
  tweetsMarketEffectCount,
  totalTradesCount,
  totalVolume,
}: DashboardStatsProps) {
  const stats = [
    {
      label: "All Posts",
      value: tweetsCount,
      icon: MessageSquare,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Relevant Posts",
      value: tweetsMarketEffectCount,
      icon: CheckCircle,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Total Trades",
      value: totalTradesCount,
      icon: TrendingUp,
      color: "bg-twitter-500",
      bgColor: "bg-white",
      textColor: "text-twitter-500",
    },
    {
      label: "Total Volume",
      value: formatPrice(totalVolume),
      icon: DollarSign,
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
