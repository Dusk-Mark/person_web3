import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing! Check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type BlogPost = {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  category: string;
  tags: string[];
};
