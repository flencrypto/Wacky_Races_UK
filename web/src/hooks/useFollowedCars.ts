import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FollowedCarsStore {
  followedIds: Set<string>;
  follow: (id: string) => void;
  unfollow: (id: string) => void;
  toggle: (id: string) => void;
  isFollowed: (id: string) => boolean;
}

export const useFollowedCars = create<FollowedCarsStore>()(
  persist(
    (set, get) => ({
      followedIds: new Set<string>(),
      follow: (id) =>
        set((state) => ({ followedIds: new Set([...state.followedIds, id]) })),
      unfollow: (id) =>
        set((state) => {
          const next = new Set(state.followedIds);
          next.delete(id);
          return { followedIds: next };
        }),
      toggle: (id) => {
        const { followedIds } = get();
        if (followedIds.has(id)) {
          get().unfollow(id);
        } else {
          get().follow(id);
        }
      },
      isFollowed: (id) => get().followedIds.has(id),
    }),
    {
      name: 'wacky-followed-cars',
      storage: {
        getItem: (name) => {
          const val = localStorage.getItem(name);
          if (!val) return null;
          const parsed = JSON.parse(val) as { state: { followedIds: string[] } };
          return {
            state: {
              followedIds: new Set(parsed.state.followedIds),
            },
          };
        },
        setItem: (name, value) => {
          const serialized = {
            state: {
              followedIds: [...value.state.followedIds],
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
