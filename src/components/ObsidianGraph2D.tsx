'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Network, Brain, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMemoryCache, setMemoryCache, debounce } from '@/lib/cache';

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
      <circle
        r={isHovered ? 20 : 16}
        fill={isHovered ? `${color}22` : 'var(--card)'}
        stroke={color}
        strokeWidth={isHovered ? 2 : 1}
        style={{ transition: 'all 0.15s ease' }}
      />
      <circle r={4} fill={color} />
      <text
        y={28}
        textAnchor="middle"
        fill="var(--text-primary)"
        fontSize={isHovered ? 10 : 9}
        fontWeight={isHovered ? 600 : 400}
        style={{ pointerEvents: 'none' }}
      >
        {node.title.length > 18 ? node.title.slice(0, 17) + '…' : node.title}
      </text>
      <text
        y={40}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={7}
        style={{ pointerEvents: 'none' }}
      >
        {node.category}
      </text>
    </g>
  );
});

MemoryNodeComponent.displayName = 'MemoryNodeComponent';

const ITEMS_PER_PAGE = 30;

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  // Fetch memories with pagination and caching
  const fetchMemories = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Check cache first
      if (!forceRefresh) {
        const cached = getMemoryCache();
        if (cached) {
          setMemories(cached);
          setLoading(false);
          return;
        }
      }
      
      const res = await fetch(`http://localhost:3322/memory/recall?limit=${ITEMS_PER_PAGE}&offset=${page * ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      const memories = data.memories || [];
      
      // Cache the result
      setMemoryCache(memories, 30000); // 30 seconds TTL
      
      setMemories(memories);
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

  // Calculate positions using simple circular layout (optimized)
  const { positions, svgDimensions } = useMemo(() => {
    if (memories.length === 0) return { positions: new Map(), svgDimensions: { width: 800, height: 600 } };

    const positions = new Map<number, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(250, 50 + memories.length * 5);
    
    // Group by category
    const categories: Record<string, MemoryNode[]> = {};
    memories.forEach(node => {
      if (!categories[node.category]) categories[node.category] = [];
      categories[node.category].push(node);
    });

    const categoryKeys = Object.keys(categories);
    const angleStep = (2 * Math.PI) / Math.max(categoryKeys.length, 1);

    // Position nodes by category
    categoryKeys.forEach((cat, catIndex) => {
      const catNodes = categories[cat];
      const catAngle = catIndex * angleStep;
      const catCenterX = centerX + Math.cos(catAngle) * radius;
      const catCenterY = centerY + Math.sin(catAngle) * radius;
      const nodeRadius = 30 + catNodes.length * 8;

      catNodes.forEach((node, nodeIndex) => {
        const nodeAngle = (nodeIndex / catNodes.length) * 2 * Math.PI;
        positions.set(node.id, {
          x: catCenterX + Math.cos(nodeAngle) * nodeRadius,
          y: catCenterY + Math.sin(nodeAngle) * nodeRadius
        });
      });
    });

    // Calculate SVG dimensions
    const posArray = Array.from(positions.values());
    const minX = Math.min(...posArray.map(p => p.x));
    const maxX = Math.max(...posArray.map(p => p.x));
    const minY = Math.min(...posArray.map(p => p.y));
    const maxY = Math.max(...posArray.map(p => p.y));
    const padding = 80;
    const width = Math.max(800, maxX - minX + padding * 2 + 100);
    const height = Math.max(600, maxY - minY + padding * 2 + 60);

    return { positions, svgDimensions: { width, height } };
  }, [memories]);

  // Category legend
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

  if (loading) {
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
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255, 59, 48, 0.3)',
          borderTopColor: '#ff3b30',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading memories...</div>
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

  if (memories.length === 0) {
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
        <Brain size={40} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No memories found</div>
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
      borderRadius: '12px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Memory Graph
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {memories.length} nodes
          </span>
        </div>
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
              opacity: page === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        {Object.entries(categoryColors).slice(0, 8).map(([cat, color]) => (
          <div key={cat} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: 'var(--text-muted)'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: color
            }} />
            {cat}
          </div>
        ))}
      </div>

      {/* Graph */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
        >
          {memories.map((memory) => {
            const pos = positions.get(memory.id);
            if (!pos) return null;
            
            return (
              <MemoryNodeComponent
                key={memory.id}
                node={memory}
                x={pos.x}
                y={pos.y}
                isHovered={hoveredNode === memory.id}
                onHover={setHoveredNode}
                onClick={onSelectMemory || (() => {})}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}