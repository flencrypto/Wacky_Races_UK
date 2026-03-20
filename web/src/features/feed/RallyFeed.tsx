import React, { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PostCard } from './PostCard';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

interface Post {
  id: string;
  content: string;
  mediaUrl?: string;
  hearts: number;
  createdAt: string;
  authorId: string;
  carId?: string;
  car?: { name: string; number: number } | null;
  eventId: string;
}

interface FeedPage {
  posts: Post[];
  nextCursor: string | null;
}

async function fetchFeed(eventId: string, cursor?: string): Promise<FeedPage> {
  const url = new URL(`${API_URL}/v1/events/${eventId}/feed`);
  url.searchParams.set('limit', '20');
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json() as Promise<FeedPage>;
}

interface RallyFeedProps {
  eventId: string;
}

export function RallyFeed({ eventId }: RallyFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: ['feed', eventId],
      queryFn: ({ pageParam }) => fetchFeed(eventId, pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neon-green animate-pulse font-bold">Loading feed…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neon-red font-bold">Failed to load feed</div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-[calc(100vh-4rem)]">
      <h2 className="text-lg font-bold text-white mb-4 neon-text-green">📡 Rally Feed</h2>
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {allPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {allPosts.length === 0 && (
          <div className="text-center text-gray-400 mt-12">No posts yet. Be the first!</div>
        )}
        <div ref={bottomRef} className="h-4" />
        {isFetchingNextPage && (
          <div className="text-center text-gray-400 text-sm py-4">Loading more…</div>
        )}
      </div>
    </div>
  );
}
