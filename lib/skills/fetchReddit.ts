/**
 * Skill: fetchReddit
 *
 * Searches Reddit's public JSON endpoint for posts mentioning a professor.
 * No auth required, but a descriptive User-Agent is mandatory or Reddit
 * returns 429s. Returns null on any failure; wrap with withTimeout() at
 * the call site.
 */
import { withTimeout } from "./_shared/timeout";

const REDDIT_ENDPOINT = "https://old.reddit.com/search.json";
const USER_AGENT = "course-marco/0.1 (course tracker prototype)";
const REDDIT_TIMEOUT_MS = 5000;
const POST_LIMIT = 15;

export interface RedditInput {
  professorName: string;
  universityName: string;
}

export interface RedditPost {
  title: string;
  body: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  permalink: string;
  createdUtc: number;
}

export interface RedditOutput {
  posts: RedditPost[];
  totalSeen: number;
}

interface RedditApiResponse {
  data?: {
    children?: {
      data?: {
        title?: string;
        selftext?: string;
        subreddit?: string;
        score?: number;
        num_comments?: number;
        url?: string;
        permalink?: string;
        created_utc?: number;
      };
    }[];
  };
}

async function fetchRedditInner(input: RedditInput): Promise<RedditOutput | null> {
  const query = `"${input.professorName}" ${input.universityName}`;
  const url = `${REDDIT_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${POST_LIMIT}&sort=relevance`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);

  const json = (await res.json()) as RedditApiResponse;
  const children = json.data?.children ?? [];

  const posts: RedditPost[] = children
    .map((c) => c.data)
    .filter((d): d is NonNullable<typeof d> => !!d && !!d.title)
    .map((d) => ({
      title: d.title ?? "",
      body: (d.selftext ?? "").slice(0, 1500),
      subreddit: d.subreddit ?? "",
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      url: d.url ?? "",
      permalink: d.permalink ? `https://reddit.com${d.permalink}` : "",
      createdUtc: d.created_utc ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { posts, totalSeen: children.length };
}

export async function fetchReddit(input: RedditInput): Promise<RedditOutput | null> {
  return withTimeout(fetchRedditInner(input), REDDIT_TIMEOUT_MS);
}
