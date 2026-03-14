'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Zap, Activity, Map, LayoutDashboard, Settings, Bell, 
  FileText, Plus, Search, Calendar, User, Tag, ChevronRight,
  ArrowLeft, Send, Loader2, Trash2, LogIn, LogOut, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, BlogPost } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

export default function BlogPage() {
  const pathname = usePathname();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  
  // Auth state
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // New post form state
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: '行情分析',
    tags: ''
  });

  useEffect(() => {
    fetchPosts();
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
    } catch (err: any) {
      alert('登录失败: ' + (err.message || '未知错误'));
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
        console.error('Supabase fetch error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          full_error: error
        });
        setErrorMsg(`数据库查询失败: ${error.message || '未知错误'} (${error.code || 'NO_CODE'})`);
        throw error;
      }
      setPosts(data || []);
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      if (!errorMsg) setErrorMsg('连接数据库时遇到未知错误，请检查网络或 Supabase 配置');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      const { error } = await supabase.from('posts').insert([
        {
          title: newPost.title,
          content: newPost.content,
          category: newPost.category,
          tags: newPost.tags.split(',').map(t => t.trim()).filter(t => t),
          author: 'Mark'
        }
      ]);

      if (error) throw error;
      
      setNewPost({ title: '', content: '', category: '行情分析', tags: '' });
      setShowModal(false);
      fetchPosts();
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
      fetchPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono selection:bg-cyan-500/30">
      {/* 侧边栏 */}
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
            className={cn("p-2 transition-all duration-300 text-gray-600 hover:text-gray-400")}
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

      {/* 主内容区 */}
      <section className="pl-16 p-8">
        {/* 页眉 */}
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
              行情见解 // 深度分析 // 链上追踪
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

        {/* 博客内容 */}
        <div className="grid grid-cols-12 gap-8">
          {/* 左侧文章列表 */}
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
                    onClick={() => fetchPosts()}
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
            ) : posts.length === 0 ? (
              <div className="py-20 border border-[#1A1A1A] bg-[#0A0A0A] rounded-sm text-center">
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">暂无已发布的见解</p>
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
              posts.map((post) => (
                <article 
                  key={post.id}
                  className="group relative border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm hover:border-cyan-500/50 transition-all duration-500"
                >
                  {/* 角部装饰 */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-gray-800 group-hover:border-cyan-500 transition-colors" />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-gray-800 group-hover:border-cyan-500 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-gray-800 group-hover:border-cyan-500 transition-colors" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-gray-800 group-hover:border-cyan-500 transition-colors" />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <span className="w-1 h-1 bg-gray-800 rounded-full" />
                      <span className="flex items-center gap-1 text-cyan-500/80">
                        <Tag size={12} />
                        {post.category}
                      </span>
                    </div>
                    {user && (
                      <button 
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  
                  <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3 font-sans">
                    {post.content}
                  </p>

                  <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] text-cyan-400 font-bold">
                        M
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{post.author}</span>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedPost(post)}
                      className="flex items-center gap-1 text-[10px] text-cyan-400 uppercase tracking-widest font-bold group/btn"
                    >
                      阅读全文
                      <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* 右侧侧边栏 */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            {/* 搜索框 */}
            <div className="relative group">
              <input 
                type="text" 
                placeholder="搜索研究报告..."
                className="w-full bg-[#0A0A0A] border border-[#1A1A1A] py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-cyan-500 transition-colors" size={16} />
            </div>

            {/* 统计信息 */}
            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={14} className="text-cyan-500" />
                终端数据
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">总报告数</span>
                  <span className="text-white font-mono">{posts.length}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">活跃分类</span>
                  <span className="text-white font-mono">3</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 uppercase tracking-widest">最近更新</span>
                  <span className="text-white font-mono">
                    {posts.length > 0 ? new Date(posts[0].created_at).toLocaleDateString() : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* 热门分类 */}
            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Tag size={14} className="text-cyan-500" />
                研究领域
              </h3>
              <div className="flex flex-wrap gap-2">
                {['行情分析', '技术研究', '项目评测', '链上追踪'].map((cat) => (
                  <span key={cat} className="px-2 py-1 bg-[#151515] border border-[#222] text-[10px] text-gray-500 hover:border-cyan-500/30 hover:text-cyan-400 cursor-pointer transition-colors">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 文章详情弹窗 */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl overflow-y-auto custom-scrollbar animate-in fade-in zoom-in duration-300">
            {/* 角部装饰 */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-500" />

            <div className="p-8 md:p-12">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(selectedPost.created_at).toLocaleDateString()}
                  </span>
                  <span className="w-1 h-1 bg-gray-800 rounded-full" />
                  <span className="text-cyan-500">{selectedPost.category}</span>
                </div>
                <button 
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2 text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-bold transition-colors group"
                >
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  返回控制台
                </button>
              </div>

              <h1 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tighter leading-tight uppercase">
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

              <div className="prose prose-invert max-w-none">
                <div className="text-gray-300 text-lg leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedPost.content}
                </div>
              </div>

              <div className="mt-16 pt-8 border-t border-[#1A1A1A] flex flex-wrap gap-3">
                {selectedPost.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-[#151515] border border-[#222] text-[10px] text-gray-500 uppercase tracking-widest">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 登录弹窗 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* 角部装饰 */}
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

      {/* 发布弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#1A1A1A] relative shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* 角部装饰 */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500" />

            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <Send size={20} className="text-cyan-500" />
                  上传研究见解
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
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
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
                      onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                      className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white appearance-none"
                    >
                      <option>行情分析</option>
                      <option>技术研究</option>
                      <option>项目评测</option>
                      <option>链上追踪</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                      标签 // TAGS (用逗号分隔)
                    </label>
                    <input 
                      type="text" 
                      value={newPost.tags}
                      onChange={(e) => setNewPost({...newPost, tags: e.target.value})}
                      placeholder="BTC, 行情, 分析..."
                      className="w-full bg-[#050505] border border-[#1A1A1A] py-3 px-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-mono">
                    核心内容 // CONTENT BODY
                  </label>
                  <textarea 
                    required
                    rows={8}
                    value={newPost.content}
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                    placeholder="撰写你的深度见解..."
                    className="w-full bg-[#050505] border border-[#1A1A1A] p-4 text-sm focus:outline-none focus:border-cyan-500/50 text-white resize-none font-sans"
                  />
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
                        正在同步至区块链...
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

      {/* 动画效果 */}
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
