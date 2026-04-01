'use client';

import { useState, useEffect, useCallback } from 'react';
import { Network, Brain, Folder, FileText, RefreshCw } from 'lucide-react';

interface MemoryNode {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  created_at: string;
}

interface MemoryGraph2DProps {
  onSelectMemory?: (memory: MemoryNode) => void;
}

export function ObsidianGraph2D({ onSelectMemory }: MemoryGraph2DProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Fetch memories from Brain V2
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3322/memory/recall?limit=50');
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      setError('Failed to load memories');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Calculate node positions using force-directed layout simulation
  const calculatePositions = (nodes: MemoryNode[]) => {
    const positions: Record<number, { x: number; y: number; vx: number; vy: number }> = {};
    const centerX = 400;
    const centerY = 300;
    const radius = 200;

    // Group by category
    const categories: Record<string, MemoryNode[]> = {};
    nodes.forEach(node => {
      if (!categories[node.category]) categories[node.category] = [];
      categories[node.category].push(node);
    });

    // Position nodes by category (circular layout)
    const categoryKeys = Object.keys(categories);
    const angleStep = (2 * Math.PI) / categoryKeys.length;

    categoryKeys.forEach((cat, catIndex) => {
      const catNodes = categories[cat];
      const catAngle = catIndex * angleStep;
      const catCenterX = centerX + Math.cos(catAngle) * radius;
      const catCenterY = centerY + Math.sin(catAngle) * radius;

      catNodes.forEach((node, nodeIndex) => {
        const nodeAngle = (nodeIndex / catNodes.length) * 2 * Math.PI;
        const nodeRadius = 60 + (catNodes.length * 10);
        positions[node.id] = {
          x: catCenterX + Math.cos(nodeAngle) * nodeRadius,
          y: catCenterY + Math.sin(nodeAngle) * nodeRadius,
          vx: 0,
          vy: 0
        };
      });
    });

    return positions;
  };

  // Category colors
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

  const getCategoryColor = (category: string) => {
    return categoryColors[category] || categoryColors['default'];
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
          width: '48px',
          height: '48px',
          border: '3px solid rgba(255, 59, 48, 0.3)',
          borderTopColor: '#ff3b30',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading Obsidian memories...</div>
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
          onClick={fetchMemories}
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
        <Brain size={48} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No memories found</div>
      </div>
    );
  }

  const positions = calculatePositions(memories);

  // Calculate SVG dimensions
  const nodePositions = Object.values(positions);
  const minX = Math.min(...nodePositions.map(p => p.x));
  const maxX = Math.max(...nodePositions.map(p => p.x));
  const minY = Math.min(...nodePositions.map(p => p.y));
  const maxY = Math.max(...nodePositions.map(p => p.y));
  const padding = 100;
  const svgWidth = Math.max(800, maxX - minX + padding * 2 + 150);
  const svgHeight = Math.max(600, maxY - minY + padding * 2 + 60);
  const offsetX = padding - minX + 50;
  const offsetY = padding - minY + 30;

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
            Obsidian Memory Graph
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {memories.length} nodes
          </span>
        </div>
        <button
          onClick={fetchMemories}
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
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
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
          width={svgWidth}
          height={svgHeight}
          viewBox={`${-padding} ${-padding} ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
        >
          {/* Nodes */}
          {memories.map((memory) => {
            const pos = positions[memory.id];
            if (!pos) return null;
            
            const isHovered = hoveredNode === memory.id;
            const color = getCategoryColor(memory.category);
            
            return (
              <g
                key={memory.id}
                transform={`translate(${pos.x + offsetX}, ${pos.y + offsetY})`}
                onMouseEnter={() => setHoveredNode(memory.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onSelectMemory?.(memory)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node circle */}
                <circle
                  r={isHovered ? 28 : 24}
                  fill={isHovered ? `${color}22` : 'var(--card)'}
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.2s' }}
                />
                
                {/* Center dot */}
                <circle
                  r={6}
                  fill={color}
                />
                
                {/* Title */}
                <text
                  y={38}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={isHovered ? 11 : 10}
                  fontWeight={isHovered ? 600 : 400}
                  style={{
                    fontFamily: 'var(--font-heading, sans-serif)',
                    pointerEvents: 'none'
                  }}
                >
                  {memory.title.length > 20 
                    ? memory.title.slice(0, 19) + '...' 
                    : memory.title}
                </text>

                {/* Category badge */}
                <text
                  y={52}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize={8}
                  style={{ pointerEvents: 'none' }}
                >
                  {memory.category}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}