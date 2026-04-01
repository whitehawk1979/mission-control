'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Brain, RefreshCw, Search, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MemoryNode {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  created_at: string;
  content?: string;
}

interface ObsidianGraph2DProps {
  onSelectMemory?: (memory: MemoryNode) => void;
}

const MAX_NODES = 100;

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

let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 120000;

function computePositions(nodes: MemoryNode[]): Map<number, { x: number; y: number }> {
  const positions = new Map<number, { x: number; y: number }>();
  const centerX = 400;
  const centerY = 250;
  
  const categoryGroups: Record<string, MemoryNode[]> = {};
  nodes.forEach(node => {
    const cat = node.category || 'default';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(node);
  });
  
  const categories = Object.keys(categoryGroups);
  const categoryAngle = (2 * Math.PI) / Math.max(categories.length, 1);
  
  categories.forEach((cat, catIndex) => {
    const groupNodes = categoryGroups[cat];
    const groupAngle = catIndex * categoryAngle;
    const groupRadius = 150 + groupNodes.length * 3;
    const groupCenterX = centerX + Math.cos(groupAngle) * groupRadius;
    const groupCenterY = centerY + Math.sin(groupAngle) * groupRadius;
    
    groupNodes.forEach((node, nodeIndex) => {
      const nodeAngle = (nodeIndex / groupNodes.length) * 2 * Math.PI;
      const nodeRadius = 20 + Math.sqrt(nodeIndex) * 8;
      positions.set(node.id, {
        x: groupCenterX + Math.cos(nodeAngle) * nodeRadius,
        y: groupCenterY + Math.sin(nodeAngle) * nodeRadius
      });
    });
  });
  
  return positions;
}

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [allMemories, setAllMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const fetchMemories = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
        setAllMemories(memoryCache.data.slice(0, MAX_NODES));
        setLoading(false);
        return;
      }

      const res = await fetch(`http://localhost:3322/memory/recall?limit=${MAX_NODES}&offset=0`);
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      const items = (data.memories || []).slice(0, MAX_NODES);
      setAllMemories(items);
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

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchQuery('');
      fetchMemories(true);
      return;
    }

    setSearchQuery(query);
    setLoading(true);
    
    try {
      const res = await fetch(`http://localhost:3322/memory/search?q=${encodeURIComponent(query)}&limit=${MAX_NODES}`);
      if (!res.ok) throw new Error('Search failed');
      
      const data = await res.json();
      const items = (data.memories || data.results || []).slice(0, MAX_NODES);
      setAllMemories(items);
      setLoading(false);
    } catch (err) {
      console.error('Search error:', err);
      setLoading(false);
    }
  }, [fetchMemories]);

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
    fetchMemories(true);
  }, [fetchMemories]);

  useEffect(() => {
    if (allMemories.length > 0) {
      positionsRef.current = computePositions(allMemories);
    }
  }, [allMemories]);

  // Draw on canvas with GPU acceleration
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true 
    });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Draw center node (Brain)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${12 * zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Brain', centerX, centerY);
    
    // Draw connections and nodes
    allMemories.forEach((node) => {
      const pos = positionsRef.current.get(node.id);
      if (!pos) return;
      
      const x = centerX + (pos.x - 400) * zoom;
      const y = centerY + (pos.y - 250) * zoom;
      const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
      const isHovered = hoveredNode === node.id;
      const radius = isHovered ? 10 : 6;
      
      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = isHovered ? 0.5 : 0.2;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, radius * zoom, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw label on hover
      if (isHovered) {
        ctx.fillStyle = '#fff';
        ctx.font = `${11 * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.title.slice(0, 25) + (node.title.length > 25 ? '…' : ''), x, y - 15 * zoom);
        ctx.fillStyle = '#888';
        ctx.font = `${9 * zoom}px sans-serif`;
        ctx.fillText(node.category, x, y - 5 * zoom);
      }
    });
  }, [allMemories, zoom, hoveredNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let foundNode: number | null = null;
    for (const [id, pos] of positionsRef.current.entries()) {
      const nodeX = centerX + (pos.x - 400) * zoom;
      const nodeY = centerY + (pos.y - 250) * zoom;
      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < 15 * zoom) {
        foundNode = id;
        break;
      }
    }
    
    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? 'pointer' : 'default';
  }, [zoom]);

  const handleClick = useCallback(() => {
    if (hoveredNode !== null) {
      const node = allMemories.find(n => n.id === hoveredNode);
      if (node && onSelectMemory) {
        onSelectMemory(node);
      }
    }
  }, [hoveredNode, allMemories, onSelectMemory]);

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
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading graph...</span>
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
            Memory Graph
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {allMemories.length} nodes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '250px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search..."
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
              <button onClick={handleClearSearch} style={{
                position: 'absolute', right: '4px', padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
              }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out" style={{ padding: '4px', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} title="Zoom in" style={{ padding: '4px', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setZoom(1)} title="Reset zoom" style={{ padding: '4px', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <Maximize2 size={14} />
          </button>
          <button onClick={() => fetchMemories(true)} title="Refresh" style={{ padding: '4px', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          style={{ 
            display: 'block',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        {Object.entries(CATEGORY_COLORS).slice(0, 8).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}