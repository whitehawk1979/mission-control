'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

const ITEMS_PER_PAGE = 10; // Even fewer nodes for better performance

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

// Simple in-memory cache
let memoryCache: { data: MemoryNode[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

export function ObsidianGraph2D({ onSelectMemory }: ObsidianGraph2DProps) {
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodePositions = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Fetch memories with caching
  const fetchMemories = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (!forceRefresh && page === 0 && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
        setMemories(memoryCache.data);
        setLoading(false);
        return;
      }
      
      const res = await fetch(`http://localhost:3322/memory/recall?limit=${ITEMS_PER_PAGE}&offset=${page * ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      const fetchedMemories = data.memories || [];
      
      if (page === 0) {
        memoryCache = { data: fetchedMemories, timestamp: Date.now() };
      }
      
      setMemories(fetchedMemories);
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

  // Calculate node positions (simple spiral)
  useEffect(() => {
    const positions = new Map<number, { x: number; y: number }>();
    const centerX = 400;
    const centerY = 250;
    
    memories.forEach((node, i) => {
      const angle = i * 2.4; // Golden angle
      const radius = 30 + Math.sqrt(i) * 40;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
    
    nodePositions.current = positions;
  }, [memories]);

  // Draw canvas
  useEffect(() => {
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
    
    // Clear
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1a1a2e';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Draw center node
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4a90d9';
    ctx.fill();
    
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1a1a2e';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Brain', centerX, centerY);
    
    // Draw nodes
    memories.forEach((node, i) => {
      const pos = nodePositions.current.get(node.id);
      if (!pos) return;
      
      const x = pos.x - 400 + centerX; // Offset from center
      const y = pos.y - 250 + centerY;
      
      const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
      const isHovered = hoveredNode === node.id;
      
      // Draw connection line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw label on hover
      if (isHovered) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title.slice(0, 20) + (node.title.length > 20 ? '…' : ''), x, y - 15);
        
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
        ctx.font = '8px sans-serif';
        ctx.fillText(node.category, x, y - 5);
      }
    });
  }, [memories, hoveredNode]);

  // Handle mouse move for hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Check if hovering over any node
    let foundNode: number | null = null;
    for (const [id, pos] of nodePositions.current.entries()) {
      const nodeX = pos.x - 400 + centerX;
      const nodeY = pos.y - 250 + centerY;
      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < 10) {
        foundNode = id;
        break;
      }
    }
    
    setHoveredNode(foundNode);
    canvas.style.cursor = foundNode ? 'pointer' : 'default';
  }, []);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode !== null) {
      const node = memories.find(n => n.id === hoveredNode);
      if (node && onSelectMemory) {
        onSelectMemory(node);
      }
    }
  }, [hoveredNode, memories, onSelectMemory]);

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
          onClick={() => {
            memoryCache = null;
            fetchMemories(true);
          }}
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

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
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
        backgroundColor: 'var(--bg)'
      }}>
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
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