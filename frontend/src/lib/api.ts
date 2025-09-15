const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY

export interface TweetProcess {
  tweet_process_id: string;
  tweet_content: string;
  submitted_at: string;
  status: "submitted" | "completed" | "error";
  error?: string;
  market_effect: boolean;
  completed_at?: string;
  author_id: string;
}

export interface QueuedTrade {
  id: number;
  tweet_process_id: string;
  ticker: string;
  dollar_amount: string;
  reasoning: string;
  queued_at: string;
  days_to_hold: number;
}

export interface ExecutedTrade {
  id: number;
  tweet_process_id: string;
  ticker: string;
  dollar_amount: string;
  reasoning: string;
  executed_at: string;
  days_to_hold: number;
}

export interface Author {
  id: string;
  platform_id: string;
  name: string;
  author_context: string;
  created_at: string;
  platform: string;
}

const fetchWithAuth = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${ADMIN_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export async function fetchTweetsWithMarketEffect(limit = 20) {
  return fetchWithAuth(`${API_BASE_URL}/tweets/processes?market_effect=true&limit=${limit}`);
}

export async function fetchQueuedTrades(tweetProcessId: string) {
  return fetchWithAuth(`${API_BASE_URL}/trading/trades/queued/${tweetProcessId}`);
}

export async function fetchExecutedTrades(tweetProcessId: string) {
  return fetchWithAuth(`${API_BASE_URL}/trading/trades/executed/${tweetProcessId}`);
}

export async function fetchAuthor(authorId: string) {
  return fetchWithAuth(`${API_BASE_URL}/authors/${authorId}`);
}

export async function fetchAllQueuedTrades() {
  return fetchWithAuth(`${API_BASE_URL}/trading/trades/queued`);
}

export async function fetchAllExecutedTrades() {
  return fetchWithAuth(`${API_BASE_URL}/trading/trades/executed`);
}

export async function fetchAllTweetsWithMarketEffect() {
  return fetchWithAuth(`${API_BASE_URL}/tweets/processes?market_effect=true`);
}
