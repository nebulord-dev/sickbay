import { useState, useEffect } from 'react';
import { fetchPosts, type Post } from '../services/api.js';

export function useData() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPosts()
      .then(setPosts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // Missing dependency: nothing here is stale, but this pattern is common
  }, []);

  return { posts, loading, error };
}
