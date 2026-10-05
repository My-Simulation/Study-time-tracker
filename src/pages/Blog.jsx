/**
 * Blog.jsx
 * JeetPrep Study Blog & Strategy Guides Hub.
 * Features:
 * - Search articles by title, category, and keywords
 * - Category filter pills
 * - Featured article hero card
 * - Distraction-free immersive reader with progress indicator
 * - Direct CTAs to Stopwatch timer, Exam Hub, and Mentor Doubt Solver
 */

import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BLOG_POSTS, BLOG_CATEGORIES } from '../utils/blogData'

export default function Blog() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeArticle, setActiveArticle] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // Open article if present in URL query e.g. /blog?article=study-10-hours-without-burnout
  useEffect(() => {
    const articleSlug = searchParams.get('article')
    if (articleSlug) {
      const found = BLOG_POSTS.find((p) => p.slug === articleSlug || p.id === articleSlug)
      if (found) setActiveArticle(found)
    }
  }, [searchParams])

  const openArticle = (post) => {
    setActiveArticle(post)
    setSearchParams({ article: post.slug })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeArticle = () => {
    setActiveArticle(null)
    setSearchParams({})
  }

  // Filtered articles
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchCat = selectedCategory === 'All' || post.category === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      const matchQuery =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.tags.some((t) => t.toLowerCase().includes(query))
      return matchCat && matchQuery
    })
  }, [selectedCategory, searchQuery])

  const featuredPost = useMemo(() => {
    return BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0]
  }, [])

  const handleShare = (post) => {
    const url = `${window.location.origin}/blog?article=${post.slug}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
      showToast('Article link copied to clipboard! 📋')
    } else {
      showToast('Share: ' + url)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white flex flex-col font-sans pb-28">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0d0d12]/85 border-b border-[#222232] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (activeArticle ? closeArticle() : navigate('/'))}
            className="w-9 h-9 rounded-xl bg-[#1b1b26] hover:bg-[#262638] active:scale-95 border border-[#2e2e42] flex items-center justify-center text-gray-300 transition-all cursor-pointer"
            title="Back"
          >
            ←
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>📰</span>
              <span>JeetPrep Guides & Blog</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400">
                Study Tips
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              Proven strategies, memory hacks & exam preparation blueprints
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>⏱️</span>
          <span className="hidden sm:inline">Go to Stopwatch</span>
        </button>
      </header>

      {/* ── Toast Alert ── */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-purple-600 text-white text-xs font-bold shadow-xl border border-purple-400/40 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* ── ARTICLE READER VIEW (If Open) ── */}
      {activeArticle ? (
        <main className="max-w-2xl w-full mx-auto px-4 mt-6 flex-1 flex flex-col gap-6 animate-fadeIn">
          {/* Back button */}
          <button
            onClick={closeArticle}
            className="self-start text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 cursor-pointer bg-[#171724] px-3 py-1.5 rounded-xl border border-[#29293e]"
          >
            ← All Articles
          </button>

          {/* Article Header Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-[#181829] to-[#12121e] border border-purple-500/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {activeArticle.category}
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                ⏱️ {activeArticle.readTime}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-[11px] text-gray-400">{activeArticle.date}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white leading-snug">
              {activeArticle.title}
            </h1>

            <p className="text-sm text-gray-300 mt-3 font-medium leading-relaxed">
              {activeArticle.excerpt}
            </p>

            <div className="mt-4 pt-4 border-t border-[#262638] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-sm">
                  👨‍🏫
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{activeArticle.author}</p>
                  <p className="text-[10px] text-gray-400">{activeArticle.authorRole}</p>
                </div>
              </div>

              <button
                onClick={() => handleShare(activeArticle)}
                className="px-3 py-1.5 rounded-xl bg-[#202032] hover:bg-[#28283e] border border-[#303046] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>📤</span>
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Article Body Content */}
          <div className="p-6 rounded-3xl bg-[#13131e] border border-[#222232] text-gray-200 text-sm leading-relaxed flex flex-col gap-4 font-sans">
            {activeArticle.content.split('\n\n').map((block, idx) => {
              const trimmed = block.trim()
              if (!trimmed) return null

              // H3 Heading
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={idx} className="text-base sm:text-lg font-black text-white mt-4 flex items-center gap-2">
                    <span className="w-1.5 h-4 rounded-full bg-purple-500" />
                    <span>{trimmed.replace('### ', '')}</span>
                  </h3>
                )
              }

              // H4 Heading
              if (trimmed.startsWith('#### ')) {
                return (
                  <h4 key={idx} className="text-sm sm:text-base font-extrabold text-amber-300 mt-2">
                    {trimmed.replace('#### ', '')}
                  </h4>
                )
              }

              // Divider
              if (trimmed === '---') {
                return <hr key={idx} className="border-t border-[#252538] my-2" />
              }

              // Bullet list
              if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                const items = trimmed.split('\n')
                return (
                  <ul key={idx} className="list-disc list-inside space-y-1.5 pl-2 text-gray-300 text-xs sm:text-sm">
                    {items.map((it, i) => (
                      <li key={i} className="leading-relaxed">
                        {it.replace(/^[\*\-]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                      </li>
                    ))}
                  </ul>
                )
              }

              // Numbered list
              if (/^\d+\.\s/.test(trimmed)) {
                const items = trimmed.split('\n')
                return (
                  <ol key={idx} className="list-decimal list-inside space-y-2 pl-2 text-gray-300 text-xs sm:text-sm">
                    {items.map((it, i) => (
                      <li key={i} className="leading-relaxed">
                        {it.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                      </li>
                    ))}
                  </ol>
                )
              }

              // Regular paragraph
              return (
                <p key={idx} className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                  {trimmed}
                </p>
              )
            })}
          </div>

          {/* Call-to-Action Box */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 to-indigo-950/50 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>⚡</span>
                <span>Ready to put this strategy to work?</span>
              </h4>
              <p className="text-xs text-gray-300 mt-1">
                Start your focus timer now and track pure study hours with JeetPrep Stopwatch.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                ⏱️ Start Timer Now
              </button>
              <button
                onClick={() => navigate('/doubts')}
                className="px-3 py-2.5 rounded-xl bg-[#202032] hover:bg-[#28283e] border border-[#303046] text-amber-300 text-xs font-bold transition-all cursor-pointer"
              >
                👨‍🏫 Ask Mentor
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ── BLOG LIST / HUB VIEW ── */
        <main className="max-w-2xl w-full mx-auto px-4 mt-5 flex-1 flex flex-col gap-6">
          {/* Search Box */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search study strategies, revision hacks, exam tips..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#141420] border border-[#252538] focus:border-purple-500/70 focus:outline-none text-xs sm:text-sm text-white placeholder-gray-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {BLOG_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#151522] text-gray-400 hover:text-gray-200 border border-[#252538]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Featured Article Card (When No Search Query) */}
          {!searchQuery && selectedCategory === 'All' && featuredPost && (
            <div
              onClick={() => openArticle(featuredPost)}
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#1c1833] via-[#141422] to-[#101018] border border-purple-500/40 shadow-xl cursor-pointer hover:border-purple-500/70 transition-all group"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                  🔥 Featured Guide
                </span>
                <span className="text-[11px] text-gray-400 font-medium">⏱️ {featuredPost.readTime}</span>
              </div>

              <div className="flex items-start gap-4 mt-2">
                <div className="text-3xl sm:text-4xl p-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex-shrink-0">
                  {featuredPost.coverEmoji}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white group-hover:text-purple-300 transition-colors leading-snug">
                    {featuredPost.title}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#262638] flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-500">{featuredPost.date} • {featuredPost.author}</span>
                <span className="text-purple-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Read Article →
                </span>
              </div>
            </div>
          )}

          {/* Article Grid */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
              {searchQuery ? `Search Results (${filteredPosts.length})` : 'All Articles'}
            </h3>

            {filteredPosts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center">
                <p className="text-xs text-gray-400">No articles found matching your search.</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => openArticle(post)}
                  className="p-4 sm:p-5 rounded-2xl bg-[#141422] border border-[#252538] hover:border-purple-500/40 hover:bg-[#181829] transition-all cursor-pointer flex flex-col gap-2.5 group shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-[#1e1e30] text-purple-300 border border-[#2e2e44]">
                      {post.category}
                    </span>
                    <span className="text-[10px] text-gray-500">{post.readTime}</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-black/30 border border-white/5 flex-shrink-0">
                      {post.coverEmoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#202030] text-[10px] text-gray-500">
                    <span>By {post.author} • {post.date}</span>
                    <span className="text-purple-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                      Read →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}
    </div>
  )
}
