import React from 'react';
import { capitalize } from '../utils/helpers.js';

interface UserCardProps {
  name: string;
  email: string;
  role: string;
}

export function UserCard({ name, email, role }: UserCardProps) {
  return (
    <div className="user-card">
      <h2>{capitalize(name)}</h2>
      <p>{email}</p>
      <span>{capitalize(role)}</span>
    </div>
  );
}

// Duplicated card layout — same structure as PostCard below
export function PostCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="post-card">
      <h2>{capitalize(title)}</h2>
      <p>{body}</p>
    </div>
  );
}
