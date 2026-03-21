import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

interface PostCardProps {
  post: Post;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PostCard({ post }: PostCardProps) {
  const queryClient = useQueryClient();
  const [optimisticHearts, setOptimisticHearts] = useState(post.hearts);

  const heartMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_URL}/v1/events/${post.eventId}/feed/${post.id}/heart`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (!res.ok) throw new Error('Failed to heart post');
      return res.json() as Promise<Post>;
    },
    onMutate: () => {
      setOptimisticHearts((h) => h + 1);
    },
    onError: () => {
      setOptimisticHearts(post.hearts);
    },
    onSuccess: (updated) => {
      setOptimisticHearts(updated.hearts);
      void queryClient.invalidateQueries({ queryKey: ['feed', post.eventId] });
    },
  });

  return (
    <div className="bg-racing-gray rounded-xl p-4 border border-racing-dark">
      {post.car && (
        <div className="text-xs text-neon-green font-medium mb-2">
          🏎 Car #{post.car.number} – {post.car.name}
        </div>
      )}
      <p className="text-white text-sm leading-relaxed">{post.content}</p>
      {post.mediaUrl && (
        <img
          src={post.mediaUrl}
          alt="Post media"
          className="mt-3 rounded-lg w-full object-cover max-h-48"
        />
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-gray-500 text-xs">{timeAgo(post.createdAt)}</span>
        <button
          onClick={() => heartMutation.mutate()}
          disabled={heartMutation.isPending}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-neon-red transition-colors disabled:opacity-50"
        >
          ❤️ {optimisticHearts}
        </button>
      </div>
    </div>
  );
}
