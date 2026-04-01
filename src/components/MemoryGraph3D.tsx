'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Suspense, useMemo, memo, useState, useEffect, useCallback, useRef } from 'react';
import { Network, Brain, RefreshCw, Search, X } from 'lucide-react';

interface MemoryNode {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  created_at: string;
}

interface MemoryGraph3DProps {
  onSelectMemory?: (memory: MemoryNode) => void;
}

const CHUNK_SIZE = 20;
const DISPLAY_LIMIT = 100;

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

// Pre-computed 3D positions using sphere distribution
function generate3DPositions(count: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const radius = 5 + Math.sqrt(i) * 0.5;
    
    positions.push([
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    ]);
  }
  
  return positions;
}

const POSITIONS_3D = generate3DPositions(DISPLAY_LIMIT);

// Memoized 3D node
const MemoryNode3D = memo(({ 
  node, 
  position,
  color 
}: { 
  node: MemoryNode;
  position: [number, number, number];
  color: string;
}) => {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.08}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        maxWidth={1}
      >
        {node.title.length > 15 ? node.title.slice(0, 14) + '…' : node.title}
      </Text>
    </group>
  );
});

MemoryNode3D.displayName = 'MemoryNode3D';

// 3D Scene
function Scene3D({ nodes }: { nodes: MemoryNode[] }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />
      
      {/* Center brain node */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial 
          color="#4a90d9" 
          emissive="#4a90d9"
          emissiveIntensity={0.5}
        />
      </mesh>
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.15}
        color="#fff"
        anchorX="center"
      >
        Brain
      </Text>

      {/* Memory nodes */}
      {nodes.slice(0, POSITIONS_3D.length).map((node, i) => {
        const pos = POSITIONS_3D[i];
        const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['default'];
        
        return (
          <MemoryNode3D
            key={node.id}
            node={node}
            position={pos}
            color={color}
          />
        );
      })}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        maxDistance={20}
        minDistance={2}
      />
    </>
  );
}

export default function MemoryGraph3D({ onSelectMemory }: MemoryGraph3DProps) {
  const [allMemories, setAllMemories] = useState<MemoryNode[]>([]);
  const [displayedCount, setDisplayedCount] = useState(CHUNK_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch memories
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3322/memory/recall?limit=100&offset=0');
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

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Search
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

  const displayedMemories = allMemories.slice(0, displayedCount);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || displayedCount >= allMemories.length) return;
    
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + CHUNK_SIZE, allMemories.length));
      setLoadingMore(false);
    }, 100);
  }, [loadingMore, displayedCount, allMemories.length]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    fetchMemories();
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
        <button onClick={fetchMemories} style={{
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

        <button onClick={fetchMemories} title="Refresh"
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

      {/* 3D Canvas */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
          <Suspense fallback={null}>
            <Scene3D nodes={displayedMemories} />
          </Suspense>
        </Canvas>
      </div>

      {/* Load More */}
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