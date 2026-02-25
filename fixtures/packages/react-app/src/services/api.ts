// Uses axios (we already have fetch, axios adds 40KB)
import axios from 'axios';

const BASE_URL = 'https://jsonplaceholder.typicode.com';

export interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export async function fetchPosts(): Promise<Post[]> {
  const { data } = await axios.get(`${BASE_URL}/posts`);
  return data;
}

export async function fetchUser(id: number): Promise<User> {
  const { data } = await axios.get(`${BASE_URL}/users/${id}`);
  return data;
}

// Dead function - never used
export async function deletePost(id: number): Promise<void> {
  await axios.delete(`${BASE_URL}/posts/${id}`);
}
