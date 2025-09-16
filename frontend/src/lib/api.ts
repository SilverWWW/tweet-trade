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

export interface Trade {
  id: number;
  tweet_process_id: string;
  ticker: string;
  dollar_amount: string;
  reasoning: string;
  queued_at: string;
  executed: boolean;
  executed_at?: string;
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

export async function fetchTrades(tweetProcessId: string) {
  return fetchWithAuth(`${API_BASE_URL}/trades/${tweetProcessId}`);
}

export async function fetchAuthor(authorId: string) {
  return fetchWithAuth(`${API_BASE_URL}/authors/${authorId}`);
}

export async function fetchTweetsCount(marketEffect?: boolean, status?: string) {
  const params = new URLSearchParams();
  if (marketEffect !== undefined) {
    params.append('market_effect', marketEffect.toString());
  }
  if (status) {
    params.append('status', status);
  }
  const queryString = params.toString();
  return fetchWithAuth(`${API_BASE_URL}/tweets/processes/count${queryString ? `?${queryString}` : ''}`);
}

export async function fetchTradesCount(executed?: boolean, ticker?: string) {
  const params = new URLSearchParams();
  if (executed !== undefined) {
    params.append('executed', executed.toString());
  }
  if (ticker) {
    params.append('ticker', ticker);
  }
  const queryString = params.toString();
  return fetchWithAuth(`${API_BASE_URL}/trades/count${queryString ? `?${queryString}` : ''}`);
}

export async function fetchTradesVolume(executed?: boolean, ticker?: string) {
  const params = new URLSearchParams();
  if (executed !== undefined) {
    params.append('executed', executed.toString());
  }
  if (ticker) {
    params.append('ticker', ticker);
  }
  const queryString = params.toString();
  return fetchWithAuth(`${API_BASE_URL}/trades/volume${queryString ? `?${queryString}` : ''}`);
}
