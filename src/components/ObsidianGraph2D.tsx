'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
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

// Memoized node component for better performance
const MemoryNodeComponent = memo(({ 
  node, 
  x, 
  y, 
  isHovered, 
  onHover, 
  onClick 
}: { 
  node: MemoryNode; 
  x: number; 
  y: number; 
  isHovered: boolean;
  onHover: (id: number | null) => void;
  onClick: (node: MemoryNode) => void;
}) => {
  const categoryColors: Record<string, string> = {
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

  const color = categoryColors[node.category] || categoryColors['default'];

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Connection line to center */}
      <line
        x1={-x}
        y1={-y}
        x2={0}
        y2={0}
        stroke={color}
        strokeWidth={isHovered ? 2 : 1}
        strokeOpacity={0.3}
        style={{ transition: 'stroke-width 0.15s ease' }}
      />
      <circle r={isHovered ? 8 : 6} fill={color} style={{ transition: 'r 0.15s ease' }} />
      {isHovered && (
        <>
          <text
            y={-15}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize={11}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {node.title.length > 25 ? node.title.slice(0, 24) + '…' : node.title}
          </text>
          <text
            y={-3}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={8}
            style={{ pointerEvents: 'none' }}
          >
            {node.category}
          </text>
        </>
      )}
    </g>
  );
});

MemoryNodeComponent.displayName = 'MemoryNodeComponent';

const ITEMS_PER_PAGE = 15; // Reduced from 30 for better performance

// Simple in-memory cache
let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch memories with pagination and caching
  const fetchMemories = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Check cache first (only for first page)
      if (!forceRefresh && page === 0 && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
        setMemories(memoryCache.data);
        setLoading(false);
        return;
      }
      
      const res = await fetch(`http://localhost:3322/memory/recall?limit=${ITEMS_PER_PAGE}&offset=${page * ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      const fetchedMemories = data.memories || [];
      
      // Cache only first page
      if (page === 0) {
        memoryCache = { data: fetchedMemories, timestamp: Date.now() };
      }
      
      setMemories(fetchedMemories);
      setTotalCount(data.total || fetchedMemories.length);
    } catch (err) {
      setError('Failed to load memories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Calculate positions using simple spiral layout (optimized)
  const { positions, svgDimensions } = useMemo(() => {
    if (memories.length === 0) return { positions: new Map(), svgDimensions: { width: 800, height: 500 } };

    const positions = new Map<number, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 250;
    
    // Simple spiral layout - no category grouping
    memories.forEach((node, i) => {
      const angle = i * 2.4; // Golden angle
      const radius = 20 + Math.sqrt(i) * 35; // Spiral radius
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    return { 
      positions, 
      svgDimensions: { width: 800, height: 500 } 
    };
  }, [memories]);

  // Category colors for legend
  const categoryColors: Record<string, string> = {
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

  const handleNodeClick = useCallback((node: MemoryNode) => {
    if (onSelectMemory) {
      onSelectMemory(node);
    }
  }, [onSelectMemory]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <Brain size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading memory graph...</span>
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
        width: '100%',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: 'var(--card)',
        borderRadius: '12px'
      }}>
        <div style={{ color: 'var(--negative)', fontSize: '14px' }}>{error}</div>
        <button
          onClick={() => fetchMemories(true)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} />
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
      width: '100%',
      backgroundColor: 'var(--card)',
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
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            {memories.length} nodes
          </span>
        </div>
        
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: page === 0 ? 'var(--bg)' : 'var(--accent)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {page + 1}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={memories.length < ITEMS_PER_PAGE}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: memories.length < ITEMS_PER_PAGE ? 'var(--bg)' : 'var(--accent)',
              color: memories.length < ITEMS_PER_PAGE ? 'var(--text-muted)' : 'var(--bg)',
              border: 'none',
              cursor: memories.length < ITEMS_PER_PAGE ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => {
              memoryCache = null;
              fetchMemories(true);
            }}
            title="Refresh"
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Graph */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          style={{ backgroundColor: 'var(--bg)' }}
        >
          {/* Center node */}
          <circle cx={400} cy={250} r={20} fill="var(--accent)" opacity={0.8} />
          <text x={400} y={254} textAnchor="middle" fill="var(--bg)" fontSize={10} fontWeight={600}>
            Brain
          </text>

          {/* Memory nodes */}
          {memories.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            return (
              <MemoryNodeComponent
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                isHovered={hoveredNode === node.id}
                onHover={setHoveredNode}
                onClick={handleNodeClick}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg)'
      }}>
        {Object.entries(categoryColors).slice(0, 6).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: color
            }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {cat}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}