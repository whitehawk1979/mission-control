'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Network, Brain, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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

const ITEMS_PER_PAGE = 8; // Even fewer for instant loading

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

// Pre-computed spiral positions (static, no calculation needed)
const SPIRAL_POSITIONS = [
  { x: 400, y: 120 },  // 0
  { x: 300, y: 150 },  // 1
  { x: 500, y: 150 },  // 2
  { x: 250, y: 200 },  // 3
  { x: 400, y: 200 },  // 4
  { x: 550, y: 200 },  // 5
  { x: 200, y: 260 },  // 6
  { x: 350, y: 280 },  // 7
];

// Simple cache
let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 120000; // 2 minutes

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Fetch with aggressive caching
  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      try {
        // Check cache first
        if (page === 0 && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
          if (!cancelled) {
            setMemories(memoryCache.data);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setLoading(true);
        
        const res = await fetch(`http://localhost:3322/memory/recall?limit=${ITEMS_PER_PAGE}&offset=${page * ITEMS_PER_PAGE}`);
        if (!res.ok) throw new Error('Failed to fetch');
        
        const data = await res.json();
        const items = data.memories || [];
        
        if (!cancelled) {
          setMemories(items);
          if (page === 0) {
            memoryCache = { data: items, timestamp: Date.now() };
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load');
          setLoading(false);
        }
      }
    };

    load();
    
    return () => { cancelled = true; };
  }, [page]);

  // Pre-compute node data (no re-computation on render)
  const nodes = useMemo(() => {
    return memories.slice(0, ITEMS_PER_PAGE).map((node, i) => ({
      ...node,
      pos: SPIRAL_POSITIONS[i] || { x: 400, y: 300 },
      color: CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default']
    }));
  }, [memories]);

  const handleRefresh = useCallback(() => {
    memoryCache = null;
    setPage(0);
  }, []);

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
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</span>
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
        <button onClick={handleRefresh} style={{
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
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Memory Graph
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {memories.length} nodes
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              background: page === 0 ? 'var(--bg)' : 'var(--accent)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}>
            Prev
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{page + 1}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={memories.length < ITEMS_PER_PAGE}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              background: memories.length < ITEMS_PER_PAGE ? 'var(--bg)' : 'var(--accent)',
              color: memories.length < ITEMS_PER_PAGE ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: memories.length < ITEMS_PER_PAGE ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}>
            Next
          </button>
          <button onClick={handleRefresh} title="Refresh"
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '12px'
            }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Graph - Pre-computed positions with CSS transforms */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Center node */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg)',
          fontSize: '11px',
          fontWeight: 600,
          zIndex: 10
        }}>
          Brain
        </div>

        {/* Connection lines (static SVG for speed) */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {nodes.map((node) => (
            <line
              key={node.id}
              x1="50%"
              y1="50%"
              x2={`${(node.pos.x / 800) * 100}%`}
              y2={`${(node.pos.y / 500) * 100}%`}
              stroke={node.color}
              strokeWidth="1"
              strokeOpacity="0.3"
            />
          ))}
        </svg>

        {/* Memory nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: `${(node.pos.x / 800) * 100}%`,
              top: `${(node.pos.y / 500) * 100}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer'
            }}
            onClick={() => onSelectMemory?.(node)}
            title={`${node.title} (${node.category})`}
          >
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: node.color,
              boxShadow: '0 0 8px ' + node.color + '40'
            }} />
          </div>
        ))}
      </div>

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