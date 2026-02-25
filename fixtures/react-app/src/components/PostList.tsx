import React from 'react';
import { useData } from '../hooks/useData.js';
import { truncate } from '../utils/helpers.js';

export function PostList() {
  const { posts, loading, error } = useData();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {posts.slice(0, 10).map((post) => (
        <li key={post.id}>
          <strong>{post.title}</strong>
          <p>{truncate(post.body, 100)}</p>
        </li>
      ))}
    </ul>
  );
}
