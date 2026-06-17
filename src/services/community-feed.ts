import { extractHashtags, splitCommunityPostBodyAndLink } from "../shared/index.js";

export type CommunityPostRow = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: Date;
  likes: Array<{ userId: string }>;
  comments: Array<{ id: string }>;
  author?: {
    email?: string;
    profile?: { fullName?: string | null } | null;
  } | null;
};

export type TrendingTag = { tag: string; count: number; posts: number };

export function postEngagementScore(post: CommunityPostRow): number {
  const likes = post.likes?.length ?? 0;
  const comments = post.comments?.length ?? 0;
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const recency = Math.max(0, 48 - ageHours);
  return likes * 3 + comments * 2 + recency;
}

export function sortPostsByTrending<T extends CommunityPostRow>(posts: T[]): T[] {
  return [...posts].sort((a, b) => postEngagementScore(b) - postEngagementScore(a));
}

export function sortPostsByComments<T extends CommunityPostRow>(posts: T[]): T[] {
  return [...posts].sort((a, b) => (b.comments?.length ?? 0) - (a.comments?.length ?? 0));
}

export function filterPostsByHashtag<T extends CommunityPostRow>(posts: T[], hashtag?: string): T[] {
  if (!hashtag?.trim()) return posts;
  const tag = hashtag.replace(/^#/, "").toLowerCase();
  return posts.filter((p) => {
    const { body } = splitCommunityPostBodyAndLink(p.content);
    return extractHashtags(body).includes(tag) || body.toLowerCase().includes(`#${tag}`);
  });
}

export function computeTrendingHashtags(posts: CommunityPostRow[], limit = 12): TrendingTag[] {
  const counts = new Map<string, { count: number; posts: number }>();
  for (const post of posts) {
    const { body } = splitCommunityPostBodyAndLink(post.content);
    const tags = extractHashtags(body);
    const weight = 1 + (post.likes?.length ?? 0) + (post.comments?.length ?? 0) * 0.5;
    for (const tag of tags) {
      const cur = counts.get(tag) ?? { count: 0, posts: 0 };
      counts.set(tag, { count: cur.count + weight, posts: cur.posts + 1 });
    }
  }
  return [...counts.entries()]
    .map(([tag, v]) => ({ tag, count: Math.round(v.count), posts: v.posts }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
