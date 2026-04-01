'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
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

// Global cache for memory data
let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 120000;

// Spatial index for fast hover detection
class SpatialIndex {
  private nodes: Map<number, { x: number; y: number; radius: number; id: number }> = new Map();
  
  set(id: number, x: number, y: number, radius: number) {
    this.nodes.set(id, { id, x, y, radius });
  }
  
  findNearest(x: number, y: number, threshold: number): number | null {
    let nearest: number | null = null;
    let minDist = Infinity;
    
    for (const node of this.nodes.values()) {
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (dist < threshold && dist < minDist) {
        minDist = dist;
        nearest = node.id;
      }
    }
    
    return nearest;
  }
  
  clear() {
    this.nodes.clear();
  }
}

// Optimized position computation with caching
const positionCache = new Map<string, Map<number, { x: number; y: number }>>();

function computePositions(nodes: MemoryNode[], width: number, height: number): Map<number, { x: number; y: number }> {
  const cacheKey = `${nodes.length}-${width}-${height}`;
  if (positionCache.has(cacheKey)) {
    return positionCache.get(cacheKey)!;
  }
  
  const positions = new Map<number, { x: number; y: number }>();
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Group by category
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
    const groupRadius = Math.min(width, height) * 0.25 + groupNodes.length * 2;
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
  
  // Cache it (limit cache size)
  if (positionCache.size > 10) {
    positionCache.clear();
  }
  positionCache.set(cacheKey, positions);
  
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
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        positionsRef.current = computePositions(allMemories, rect.width, rect.height);
      }
    }
  }, [allMemories]);

  // Memoized filtered nodes
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return allMemories;
    const query = searchQuery.toLowerCase();
    return allMemories.filter(node => 
      node.title.toLowerCase().includes(query) ||
      node.keywords?.some(k => k.toLowerCase().includes(query))
    );
  }, [allMemories, searchQuery]);

  // Optimized canvas drawing with RAF
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationId: number;
    let needsRedraw = true;

    const draw = () => {
      if (!needsRedraw) return;
      needsRedraw = false;

      const ctx = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true 
      });
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
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
      ctx.arc(centerX, centerY, Math.max(20, 30 * zoom), 0, Math.PI * 2);
      ctx.fillStyle = '#4a90d9';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Brain', centerX, centerY);
      
      // Batch draw connections
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      
      filteredNodes.forEach((node) => {
        const pos = positionsRef.current.get(node.id);
        if (!pos) return;
        
        const x = centerX + (pos.x - centerX) * zoom;
        const y = centerY + (pos.y - centerY) * zoom;
        const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
        const isHovered = hoveredNode === node.id;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.globalAlpha = isHovered ? 0.5 : 0.2;
        ctx.stroke();
      });
      
      ctx.globalAlpha = 1;
      
      // Draw nodes
      filteredNodes.forEach((node) => {
        const pos = positionsRef.current.get(node.id);
        if (!pos) return;
        
        const x = centerX + (pos.x - centerX) * zoom;
        const y = centerY + (pos.y - centerY) * zoom;
        const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
        const isHovered = hoveredNode === node.id;
        const radius = isHovered ? 10 : 6;
        
        // Draw node
        ctx.beginPath();
        ctx.arc(x, y, Math.max(4, radius * zoom), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        if (isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.title.slice(0, 25) + (node.title.length > 25 ? '...' : ''), x, y - 14);
        }
      });
    };

    const loop = () => {
      if (needsRedraw) draw();
      animationId = requestAnimationFrame(loop);
    };
    
    loop();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [filteredNodes, zoom, hoveredNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Optimized hover detection with early exit
    let foundNode: number | null = null;
    const threshold = 15 * zoom;
    
    for (const [id, pos] of positionsRef.current.entries()) {
      const nodeX = centerX + (pos.x - centerX) * zoom;
      const nodeY = centerY + (pos.y - centerY) * zoom;
      const dx = x - nodeX;
      const dy = y - nodeY;
      const distSq = dx * dx + dy * dy; // Avoid sqrt for performance
      
      if (distSq < threshold * threshold) {
        foundNode = id;
        break;
      }
    }
    
    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? 'pointer' : 'default';
  }, [zoom]);

  // Touch support for mobile
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let foundNode: number | null = null;
    const threshold = 25 * zoom;
    
    for (const [id, pos] of positionsRef.current.entries()) {
      const nodeX = centerX + (pos.x - centerX) * zoom;
      const nodeY = centerY + (pos.y - centerY) * zoom;
      const dx = x - nodeX;
      const dy = y - nodeY;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < threshold * threshold) {
        foundNode = id;
        break;
      }
    }
    
    setHoveredNode(foundNode);
  }, [zoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let foundNode: number | null = null;
    const threshold = 30 * zoom;
    
    for (const [id, pos] of positionsRef.current.entries()) {
      const nodeX = centerX + (pos.x - centerX) * zoom;
      const nodeY = centerY + (pos.y - centerY) * zoom;
      const dx = x - nodeX;
      const dy = y - nodeY;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < threshold * threshold) {
        foundNode = id;
        break;
      }
    }
    
    if (foundNode !== null) {
      const node = allMemories.find(n => n.id === foundNode);
      if (node && onSelectMemory) {
        onSelectMemory(node);
      }
    }
  }, [zoom, allMemories, onSelectMemory]);

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
      {/* Header - Mobile friendly */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px',
        gap: '8px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: '150px' }}>
          <Network size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Memory Graph
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {allMemories.length} nodes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', maxWidth: '250px', minWidth: '120px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 8px 8px 28px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
            {searchQuery && (
              <button onClick={handleClearSearch} style={{
                position: 'absolute', right: '4px', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
              }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out" style={{ padding: '6px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} title="Zoom in" style={{ padding: '6px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setZoom(1)} title="Reset zoom" style={{ padding: '6px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <Maximize2 size={14} />
          </button>
          <button onClick={() => fetchMemories(true)} title="Refresh" style={{ padding: '6px', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          style={{ 
            display: 'block',
            transform: 'translateZ(0)',
            willChange: 'transform',
            touchAction: 'none'
          }}
        />
      </div>

      {/* Legend - Mobile friendly */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto' }}>
        {Object.entries(CATEGORY_COLORS).slice(0, 8).map(([cat, color]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}