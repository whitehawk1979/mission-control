'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Network, Brain, RefreshCw, Search, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

const MAX_NODES = 80;

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

// 3D sphere positions
function compute3DPositions(nodes: MemoryNode[]): Map<number, { x: number; y: number; z: number }> {
  const positions = new Map<number, { x: number; y: number; z: number }>();
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  
  nodes.forEach((node, i) => {
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / nodes.length);
    const radius = 200 + Math.sqrt(i) * 10;
    
    positions.set(node.id, {
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.sin(phi) * Math.sin(theta),
      z: radius * Math.cos(phi)
    });
  });
  
  return positions;
}

export default function MemoryGraph3D({ onSelectMemory }: MemoryGraph3DProps) {
  const [allMemories, setAllMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rotationY, setRotationY] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<number, { x: number; y: number; z: number }>>(new Map());
  const animationRef = useRef<number | null>(null);

  // Fetch memories
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

  // Search
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

  // Compute positions
  useEffect(() => {
    if (allMemories.length > 0) {
      positionsRef.current = compute3DPositions(allMemories);
    }
  }, [allMemories]);

  // 3D to 2D projection
  const project3D = useCallback((x: number, y: number, z: number, centerX: number, centerY: number) => {
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX);
    const sinX = Math.sin(rotationX);
    
    // Rotate around Y axis
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    
    // Rotate around X axis
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    
    // Perspective projection
    const scale = 500 / (500 + z2);
    
    return {
      x: centerX + x1 * scale,
      y: centerY + y1 * scale,
      scale
    };
  }, [rotationY, rotationX]);

  // Draw on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
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
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Brain', centerX, centerY);
    
    // Sort nodes by Z depth for proper layering
    const nodesWithDepth = allMemories.map(node => {
      const pos = positionsRef.current.get(node.id);
      if (!pos) return null;
      
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const z = pos.x * sinY + pos.z * cosY;
      
      return { node, pos, z };
    }).filter(Boolean) as { node: MemoryNode; pos: { x: number; y: number; z: number }; z: number }[];
    
    nodesWithDepth.sort((a, b) => b.z - a.z);
    
    // Draw connections first
    nodesWithDepth.forEach(({ node, pos }) => {
      const projected = project3D(pos.x, pos.y, pos.z, centerX, centerY);
      const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(projected.x, projected.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    
    // Draw nodes
    nodesWithDepth.forEach(({ node, pos }) => {
      const projected = project3D(pos.x, pos.y, pos.z, centerX, centerY);
      const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
      const isHovered = hoveredNode === node.id;
      const radius = isHovered ? 8 : 5 * projected.scale;
      
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3 + projected.scale * 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      
      if (isHovered) {
        ctx.fillStyle = 'var(--text-primary)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title.slice(0, 20), projected.x, projected.y - 12);
      }
    });
  }, [allMemories, rotationY, rotationX, hoveredNode, project3D]);

  // Animation loop
  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let foundNode: number | null = null;
    for (const [id, pos] of positionsRef.current.entries()) {
      const projected = project3D(pos.x, pos.y, pos.z, centerX, centerY);
      const dist = Math.sqrt((mouseX - projected.x) ** 2 + (mouseY - projected.y) ** 2);
      if (dist < 15) {
        foundNode = id;
        break;
      }
    }
    
    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? 'pointer' : 'default';
  }, [project3D]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode !== null) {
      const node = allMemories.find(n => n.id === hoveredNode);
      if (node && onSelectMemory) {
        onSelectMemory(node);
      }
    }
  }, [hoveredNode, allMemories, onSelectMemory]);

  const handleDrag = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
    
    setRotationY(r => r + movementX * 0.01);
    setRotationX(r => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, r + movementY * 0.01)));
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
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading 3D graph...</span>
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
            3D Memory Graph
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {allMemories.length} nodes
          </span>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '250px' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flex: 1
          }}>
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

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setRotationY(r => r - 0.3)}
            title="Rotate left"
            style={{
              padding: '4px',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setRotationY(r => r + 0.3)}
            title="Rotate right"
            style={{
              padding: '4px',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => { setRotationY(0); setRotationX(0); }}
            title="Reset view"
            style={{
              padding: '4px',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => fetchMemories(true)}
            title="Refresh"
            style={{
              padding: '4px',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
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
          onMouseDown={handleDrag}
          style={{ display: 'block' }}
        />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)'
      }}>
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