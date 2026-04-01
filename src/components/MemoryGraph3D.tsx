'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Brain, RefreshCw, Search, X, Calendar, Tag } from 'lucide-react';

interface MemoryNode {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  created_at: string;
  content?: string;
}

interface MemoryGraph3DProps {
  onSelectMemory?: (memory: MemoryNode) => void;
}

const ITEMS_PER_PAGE = 20;

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  'system': '#4a90d9',
  'family': '#e91e63',
  'project': '#ff9800',
  'preference': '#9c27b0',
  'knowledge': '#4caf50',
  'task': '#f44336',
  'devil_critique': '#ff5722',
  'delegation_decision': '#607d8b',
  'default': '#9e9e9e'
};

// Simple cache
let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 120000;

export default function MemoryGraph3D({ onSelectMemory }: MemoryGraph3DProps) {
  const [allMemories, setAllMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(allMemories.length / ITEMS_PER_PAGE);
  const currentPageMemories = allMemories.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  // Fetch memories
  const fetchMemories = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
        setAllMemories(memoryCache.data);
        setLoading(false);
        return;
      }

      const res = await fetch('http://localhost:3322/memory/recall?limit=500&offset=0');
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      const items = data.memories || [];
      setAllMemories(items);
      setPage(0);
      memoryCache = { data: items, timestamp: Date.now() };
      setLoading(false);
    } catch (err) {
      setError('Failed to load memories');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      setIsSearching(false);
      fetchMemories(true);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);
    setLoading(true);
    
    try {
      const res = await fetch(`http://localhost:3322/memory/search?q=${encodeURIComponent(query)}&limit=100`);
      if (!res.ok) throw new Error('Search failed');
      
      const data = await res.json();
      const items = data.memories || data.results || [];
      setAllMemories(items);
      setPage(0);
      setLoading(false);
    } catch (err) {
      console.error('Search error:', err);
      setLoading(false);
    }
  }, [fetchMemories]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    fetchMemories(true);
  }, [fetchMemories]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '12px'
      }}>
        <Brain size={24} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading memories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <span style={{ color: 'var(--negative)' }}>{error}</span>
        <button onClick={() => fetchMemories(true)} style={{
          padding: '8px 16px',
          borderRadius: '6px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          border: 'none',
          cursor: 'pointer'
        }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--card)',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Memory Explorer
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {allMemories.length} memories
          </span>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '300px' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flex: 1
          }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px 6px 28px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                style={{
                  position: 'absolute',
                  right: '4px',
                  padding: '2px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <button onClick={() => fetchMemories(true)} title="Refresh"
          style={{
            padding: '6px',
            borderRadius: '4px',
            background: 'var(--bg)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            cursor: 'pointer'
          }}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Category Filter */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <button
            key={cat}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
            {cat}
          </button>
        ))}
      </div>

      {/* Memory Cards Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {currentPageMemories.map((memory) => (
            <div
              key={memory.id}
              onClick={() => onSelectMemory?.(memory)}
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS['default'];
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[memory.category] || CATEGORY_COLORS['default'],
                  boxShadow: `0 0 8px ${CATEGORY_COLORS[memory.category] || CATEGORY_COLORS['default']}60`
                }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {memory.title}
                </span>
              </div>
              
              <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                marginBottom: '10px',
                height: '42px',
                overflow: 'hidden'
              }}>
                {memory.content?.slice(0, 150)}...
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={10} />
                  {formatDate(memory.created_at)}
                </div>
                <div style={{
                  background: 'var(--surface)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: CATEGORY_COLORS[memory.category] || CATEGORY_COLORS['default']
                }}>
                  {memory.category}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: page === 0 ? 'var(--bg)' : 'var(--accent)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            Previous
          </button>
          
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Page {page + 1} of {totalPages}
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: page >= totalPages - 1 ? 'var(--bg)' : 'var(--accent)',
              color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}