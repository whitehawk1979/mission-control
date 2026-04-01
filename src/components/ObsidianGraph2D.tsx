'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Brain, RefreshCw, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

interface MemoryNode {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  created_at: string;
}

interface ObsidianGraph2DProps {
  onSelectMemory?: (memory: MemoryNode) => void;
}

const CHUNK_SIZE = 20; // Load in chunks
const DISPLAY_LIMIT = 50; // Max nodes to display

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

// Pre-computed spiral positions
function generatePositions(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const centerX = 400;
  const centerY = 250;
  
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4; // Golden angle
    const radius = 30 + Math.sqrt(i) * 25;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }
  
  return positions;
}

const POSITIONS = generatePositions(DISPLAY_LIMIT);

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [allMemories, setAllMemories] = useState<MemoryNode[]>([]);
  const [displayedCount, setDisplayedCount] = useState(CHUNK_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all memories at once
  const fetchMemories = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3322/memory/recall?limit=100&offset=${pageNum * 100}`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      const items = data.memories || [];
      setAllMemories(items);
      setDisplayedCount(CHUNK_SIZE);
      setLoading(false);
    } catch (err) {
      setError('Failed to load memories');
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMemories(0);
  }, [fetchMemories]);

  // Search function
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      setIsSearching(false);
      setDisplayedCount(CHUNK_SIZE);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);
    
    try {
      const res = await fetch(`http://localhost:3322/memory/search?q=${encodeURIComponent(query)}&limit=50`);
      if (!res.ok) throw new Error('Search failed');
      
      const data = await res.json();
      const items = data.memories || data.results || [];
      setAllMemories(items);
      setDisplayedCount(items.length);
    } catch (err) {
      console.error('Search error:', err);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Filtered and displayed memories
  const displayedMemories = allMemories.slice(0, displayedCount);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (loadingMore || displayedCount >= allMemories.length) return;
    
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + CHUNK_SIZE, allMemories.length));
      setLoadingMore(false);
    }, 100);
  }, [loadingMore, displayedCount, allMemories.length]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    fetchMemories(0);
  }, [fetchMemories]);

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
        <button onClick={() => fetchMemories(0)} style={{
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
            Memory Graph
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {isSearching ? `${allMemories.length} found` : `${displayedCount}/${allMemories.length}`}
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

        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => fetchMemories(0)} title="Refresh"
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
      </div>

      {/* Graph */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Center node */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg)',
          fontSize: '10px',
          fontWeight: 600,
          zIndex: 10
        }}>
          Brain
        </div>

        {/* Connection lines */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {displayedMemories.map((node, i) => {
            const pos = POSITIONS[i] || { x: 400, y: 250 };
            return (
              <line
                key={node.id}
                x1="50%"
                y1="50%"
                x2={`${(pos.x / 800) * 100}%`}
                y2={`${(pos.y / 500) * 100}%`}
                stroke={CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default']}
                strokeWidth="1"
                strokeOpacity="0.2"
              />
            );
          })}
        </svg>

        {/* Memory nodes */}
        {displayedMemories.map((node, i) => {
          const pos = POSITIONS[i] || { x: 400, y: 250 };
          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${(pos.x / 800) * 100}%`,
                top: `${(pos.y / 500) * 100}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => onSelectMemory?.(node)}
              title={node.title}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'],
                boxShadow: `0 0 6px ${CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default']}60`
              }} />
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {!isSearching && displayedCount < allMemories.length && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '12px',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              cursor: loadingMore ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              opacity: loadingMore ? 0.7 : 1
            }}
          >
            {loadingMore ? 'Loading...' : `Load More (${allMemories.length - displayedCount} remaining)`}
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)'
      }}>
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}