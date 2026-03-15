'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap, Activity, Map, LayoutDashboard, Settings, Bell,
  FileText, Plus, Search, Calendar, Tag, ChevronRight,
  ArrowLeft, Send, Loader2, Trash2, LogIn, LogOut, Key,
  Filter, Copy, Clock, Eye, PencilLine, List, Heading2, Link2, Code2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, BlogPost } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-dynamic';

const DRAFT_KEY = 'mark-web3-blog-draft-v1';
const CATEGORY_OPTIONS = ['行情分析', '技术研究', '项目评测', '链上追踪'];

type NewPostForm = {
  title: string;
  content: string;
  category: string;
  tags: string;
};

const defaultNewPost: NewPostForm = {
  title: '',
  content: '',
  category: '行情分析',
  tags: ''
};

const formatTime = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { hour12: false });

const getTextFromMarkdown = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, '$1')
    .replace(/[#>*_\-\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const estimateMinutes = (text: string) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 220));
};

export default function BlogPage() {
  const pathname = usePathname();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [newPost, setNewPost] = useState<NewPostForm>(defaultNewPost);

  useEffect(() => {
    fetchPosts();
    checkUser();
    if (typeof window !== 'undefined') {
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft) as NewPostForm;
          setNewPost(parsed);
        } catch {
          window.localStorage.removeItem(DRAFT_KEY);
        }
      }
    }
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showModal || !user || typeof window === 'undefined') return;
    const hasContent = newPost.title || newPost.content || newPost.tags;
    if (!hasContent) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(newPost));
    setDraftSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  }, [newPost, showModal, user]);

  useEffect(() => {
    if (!showModal || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(newPost));
        setDraftSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newPost, showModal]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      alert('登录失败: ' + message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchPosts = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMsg(`数据库查询失败: ${error.message || '未知错误'} (${error.code || 'NO_CODE'})`);
        throw error;
      }
      setPosts((data || []) as BlogPost[]);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setErrorMsg('连接数据库时遇到未知错误，请检查网络或 Supabase 配置');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('标题和正文不能为空');
      return;
    }
    setIsPublishing(true);
    try {
      const { error } = await supabase.from('posts').insert([
        {
          title: newPost.title.trim(),
          content: newPost.content,
          category: newPost.category,
          tags: newPost.tags.split(',').map(t => t.trim()).filter(Boolean),
          author: 'Mark'
        }
      ]);
      if (error) throw error;
      setNewPost(defaultNewPost);
      setIsPreviewMode(false);
      setShowModal(false);
      setDraftSavedAt('');
      if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY);
      await fetchPosts();
    } catch (err) {
      console.error('Error publishing post:', err);
      alert('发布失败，请检查数据库配置或网络');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      await fetchPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const insertMarkdown = useCallback((before: string, after = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const nextValue = textarea.value.substring(0, start) + before + selected + after + textarea.value.substring(end);
    setNewPost((prev) => ({ ...prev, content: nextValue }));
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }, []);

  const handleCopyLink = async (postId: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/blog#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 1500);
    } catch {
      alert('复制失败，请手动复制链接');
    }
  };

  const categories = useMemo(() => {
    const dynamicCategories = Array.from(new Set(posts.map((post) => post.category).filter(Boolean)));
    return ['全部', ...Array.from(new Set([...CATEGORY_OPTIONS, ...dynamicCategories]))];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return posts.filter((post) => {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const plain = getTextFromMarkdown(post.content || '');
      const hitKeyword = !keyword || [post.title, plain, post.category, tags.join(' ')].join(' ').toLowerCase().includes(keyword);
      const hitCategory = activeCategory === '全部' || post.category === activeCategory;
      return hitKeyword && hitCategory;
    });
  }, [posts, searchText, activeCategory]);

  const markdownPreview = useMemo(() => {
    const text = getTextFromMarkdown(newPost.content);
    return {
      words: text ? text.split(/\s+/).length : 0,
      minutes: estimateMinutes(text),
    };
  }, [newPost.content]);

  const newestUpdate = filteredPosts[0]?.created_at;

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono selection:bg-cyan-500/30">
      <aside className="fixed left-0 top-0 bottom-0 w-16 border-r border-[#1A1A1A] bg-[#0A0A0A] flex flex-col items-center py-8 z-50">
        <Link href="/" className="mb-12 text-cyan-500 animate-pulse">
          <Zap size={32} />
        </Link>
        <nav className="flex flex-col gap-8">
          <Link
            href="/dashboard"
            title="K线图表"
            className={cn("p-2 transition-all duration-300", pathname === '/dashboard' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <Activity size={24} />
          </Link>
          <Link
            href="/dashboard"
            title="清算地图"
            className="p-2 transition-all duration-300 text-gray-600 hover:text-gray-400"
          >
            <Map size={24} />
          </Link>
          <Link
            href="/blog"
            title="研究报告"
            className={cn("p-2 transition-all duration-300", pathname === '/blog' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <FileText size={24} />
          </Link>
          <button title="仪表盘" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <LayoutDashboard size={24} />
          </button>
        </nav>
        <div className="mt-auto flex flex-col gap-6">
          <button title="通知" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <Bell size={24} />
          </button>
          <button title="设置" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <Settings size={24} />
          </button>
        </div>
      </aside>

      <section className="pl-16 p-8">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-2">
              <span className="bg-cyan-500 text-black px-2 py-0.5 uppercase">Mark</span>
              Web3 研究终端
              {user && (
                <span className="ml-2 px-2 py-0.5 border border-cyan-500 text-cyan-500 text-[10px] animate-pulse">
                  管理者模式
                </span>
              )}
            </h1>
            <p className="text-gray-500 mt-2 text-xs uppercase tracking-widest">
              Markdown 发布 // 全文检索 // 草稿自动保存
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-tighter hover:bg-cyan-500 hover:text-black transition-all duration-300 group"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                  发布新见解
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 text-xs font-bold uppercase tracking-tighter hover:bg-red-500 hover:text-black transition-all duration-300"
                >
                  <LogOut size={16} />
                  退出管理
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 bg-[#111] border border-[#222] text-gray-400 px-4 py-2 text-xs font-bold uppercase tracking-tighter hover:border-cyan-500 hover:text-cyan-400 transition-all duration-300"
              >
                <LogIn size={16} />
                管理者登录
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 border border-[#1A1A1A] bg-[#0A0A0A] rounded-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent animate-shimmer" />
                <Loader2 size={32} className="text-cyan-500 animate-spin mb-4" />
                <p className="text-xs text-gray-500 uppercase tracking-widest">正在接入数据库...</p>
              </div>
            ) : errorMsg ? (
              <div className="py-20 border border-red-500/30 bg-[#0A0A0A] rounded-sm text-center">
                <p className="text-red-500 text-xs uppercase tracking-widest mb-4">{errorMsg}</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={fetchPosts}
                    className="text-cyan-400 text-xs hover:underline uppercase tracking-widest"
                  >
                    重新加载
                  </button>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="text-gray-400 text-xs hover:underline uppercase tracking-widest"
                  >
                    去登录 (管理者模式)
                  </button>
                </div>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-20 border border-[#1A1A1A] bg-[#0A0A0A] rounded-sm text-center">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">暂无匹配的研究报告</p>
                {user && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="text-cyan-400 text-xs hover:underline uppercase tracking-widest"
                  >
                    立即发布第一篇
                  </button>
                )}
              </div>
            ) : (
              filteredPosts.map((post) => {
                const plain = getTextFromMarkdown(post.content || '');
                const tags = Array.isArray(post.tags) ? post.tags : [];
                return (
                  <article
                    id={`post-${post.id}`}
                    key={post.id}
                    className="group relative border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm hover:border-cyan-500/50 transition-all duration-500"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gray-800 group-hover:border-cyan-500 transition-colors" />
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gray-800 group-hover:border-cyan-500 transition-colors" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gray-800 group-hover:border-cyan-500 transition-colors" />
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gray-800 group-hover:border-cyan-500 transition-colors" />

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatTime(post.created_at)}
                        </span>
                        <span className="w-1 h-1 bg-gray-800 rounded-full" />
                        <span className="flex items-center gap-1 text-cyan-500/80">
                          <Tag size={12} />
                          {post.category}
                        </span>
                        <span className="w-1 h-1 bg-gray-800 rounded-full" />
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock size={12} />
                          {estimateMinutes(plain)} 分钟阅读
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopyLink(post.id)}
                          className="text-gray-600 hover:text-cyan-400 transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                        {user && (
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="text-gray-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {post.title}
                    </h2>

                    <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3 font-sans">
                      {plain || '暂无正文内容'}
                    </p>

                    <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] text-cyan-400 font-bold">
                          M
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">{post.author}</span>
                        {copiedPostId === post.id && <span className="text-[10px] text-cyan-400">已复制链接</span>}
                      </div>
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="flex items-center gap-1 text-[10px] text-cyan-400 uppercase tracking-widest font-bold group/btn"
                      >
                        阅读全文
                        <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>

                    {tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tags.slice(0, 4).map((item) => (
                          <span key={`${post.id}-${item}`} className="px-2 py-1 text-[10px] bg-[#151515] border border-[#222] text-gray-400 uppercase tracking-widest">
                            #{item}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="relative group">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索标题 / 正文 / 标签..."
                className="w-full bg-[#0A0A0A] border border-[#1A1A1A] py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-cyan-500 transition-colors" size={16} />
            </div>

            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={14} className="text-cyan-500" />
                终端数据
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">筛选后报告数</span>
                  <span className="text-white font-mono">{filteredPosts.length}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">活跃分类</span>
                  <span className="text-white font-mono">{categories.length - 1}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">最近更新</span>
                  <span className="text-white font-mono">{newestUpdate ? formatTime(newestUpdate) : '--'}</span>
                </div>
              </div>
            </div>

            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Filter size={14} className="text-cyan-500" />
                分类筛选
              </h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-2 py-1 border text-[10px] uppercase tracking-widest transition-colors cursor-pointer",
                      activeCategory === cat
                        ? "bg-cyan-500/15 border-cyan-500 text-cyan-400"
                        : "bg-[#151515] border-[#222] text-gray-500 hover:border-cyan-500/30 hover:text-cyan-400"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

            <div className="p-8 md:p-12">
              <div className="flex justify-between items-center mb-10">
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatTime(selectedPost.created_at)}
                  </span>
                  <span className="w-1 h-1 bg-gray-800 rounded-full" />
                  <span className="text-cyan-500">{selectedPost.category}</span>
                  <span className="w-1 h-1 bg-gray-800 rounded-full" />
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {estimateMinutes(getTextFromMarkdown(selectedPost.content || ''))} 分钟阅读
                  </span>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors group"
                >
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  返回控制台
                </button>
              </div>

              <h1 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tighter leading-tight">
                {selectedPost.title}
              </h1>

              <div className="flex items-center gap-3 mb-12 pb-8 border-b border-[#1A1A1A]">
                <div className="w-10 h-10 rounded-full bg-cyan-500 text-black flex items-center justify-center text-sm font-black">
                  M
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">首席研究员</div>
                  <div className="text-sm font-bold text-white uppercase">{selectedPost.author}</div>
                </div>
              </div>

              <div className="prose prose-invert max-w-none prose-headings:text-white prose-strong:text-cyan-300 prose-a:text-cyan-400 prose-code:text-cyan-300 prose-pre:bg-[#050505] prose-blockquote:border-cyan-500 prose-blockquote:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedPost.content || ''}
                </ReactMarkdown>
              </div>

              <div className="mt-16 pt-8 border-t border-[#1A1A1A] flex flex-wrap gap-3">
                {(Array.isArray(selectedPost.tags) ? selectedPost.tags : []).map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-[#151515] border border-[#222] text-[10px] text-gray-500 uppercase tracking-widest">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500" />

            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <Key size={20} className="text-cyan-500" />
                  管理者身份验证
                </h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    管理员账号 // EMAIL
                  </label>
                  <input
                    required
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    安全访问码 // PASSWORD
                  </label>
                  <input
                    required
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white"
                  />
                </div>

                <button
                  disabled={isLoggingIn}
                  type="submit"
                  className="w-full bg-cyan-500 text-black py-3 text-xs font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      正在验证密钥...
                    </>
                  ) : (
                    <>
                      授权并进入
                      <LogIn size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500" />

            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <Send size={20} className="text-cyan-500" />
                  Markdown 研究见解编辑器
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>

              <form onSubmit={handlePublish} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    报告标题 // REPORT TITLE
                  </label>
                  <input
                    required
                    type="text"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="输入见解标题..."
                    className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                      研究领域 // CATEGORY
                    </label>
                    <select
                      value={newPost.category}
                      onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                      className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white appearance-none"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                      标签 // TAGS (用逗号分隔)
                    </label>
                    <input
                      type="text"
                      value={newPost.tags}
                      onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                      placeholder="BTC, 行情, 分析..."
                      className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border border-[#1A1A1A] bg-[#050505] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => insertMarkdown('## ')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <Heading2 size={12} /> 标题
                    </button>
                    <button type="button" onClick={() => insertMarkdown('**', '**')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors">
                      粗体
                    </button>
                    <button type="button" onClick={() => insertMarkdown('> ')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors">
                      引用
                    </button>
                    <button type="button" onClick={() => insertMarkdown('- ')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <List size={12} /> 列表
                    </button>
                    <button type="button" onClick={() => insertMarkdown('[链接文字](', ')')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <Link2 size={12} /> 链接
                    </button>
                    <button type="button" onClick={() => insertMarkdown('\n```\n', '\n```\n')} className="px-2 py-1 text-[10px] border border-[#222] hover:border-cyan-500/40 text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <Code2 size={12} /> 代码块
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode((value) => !value)}
                    className="px-2 py-1 text-[10px] border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors flex items-center gap-1"
                  >
                    {isPreviewMode ? <PencilLine size={12} /> : <Eye size={12} />}
                    {isPreviewMode ? '返回编辑' : '预览模式'}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    核心内容 // CONTENT BODY (支持 Markdown)
                  </label>
                  {isPreviewMode ? (
                    <div className="min-h-[320px] border border-[#1A1A1A] bg-[#050505] p-4 prose prose-invert max-w-none prose-headings:text-white prose-strong:text-cyan-300 prose-a:text-cyan-400 prose-code:text-cyan-300 prose-pre:bg-[#080808] prose-blockquote:border-cyan-500 prose-blockquote:text-gray-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {newPost.content || '请输入 Markdown 正文内容...'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      ref={editorRef}
                      required
                      rows={14}
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      placeholder="支持 Markdown：## 标题, **粗体**, [链接](url), ```代码块``` ..."
                      className="w-full bg-[#050505] border border-[#1A1A1A] p-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white resize-none font-sans"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Clock size={12} />预计阅读 {markdownPreview.minutes} 分钟</span>
                    <span className="flex items-center gap-1"><FileText size={12} />{markdownPreview.words} 词</span>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-500">
                    {draftSavedAt && <span>草稿已保存 {draftSavedAt}</span>}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    disabled={isPublishing}
                    type="submit"
                    className="bg-cyan-500 text-black px-8 py-3 text-xs font-black uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        正在发布...
                      </>
                    ) : (
                      <>
                        确认发布见解
                        <Send size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </main>
  );
}
