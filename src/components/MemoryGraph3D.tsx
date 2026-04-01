'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Suspense, useMemo, memo } from 'react';
import { FileNode } from './FileTree';

interface MemoryGraph3DProps {
  files: FileNode[];
}

interface GraphNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  depth: number;
  children: GraphNode[];
}

// Memoized node component
const NodeComponent = memo(({ 
  node, 
  position 
}: { 
  node: GraphNode; 
  position: [number, number, number];
}) => {
  const isFile = node.type === 'file';
  const color = isFile ? '#ff3b30' : '#4a90d9';
  
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.12}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.8}
      >
        {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
      </Text>
    </group>
  );
});

NodeComponent.displayName = 'NodeComponent';

// Flatten file tree to nodes
function flattenFiles(nodes: FileNode[], depth: number = 0, parentPath: string = ""): GraphNode[] {
  const result: GraphNode[] = [];
  
  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    
    const children = node.children 
      ? flattenFiles(node.children, depth + 1, path) 
      : [];
    
    result.push({
      id: path,
      name: node.name,
      type: node.type,
      path,
      depth,
      children,
    });
  }
  
  return result;
}

// Scene component with LOD
function Scene({ nodes }: { nodes: GraphNode[] }) {
  // Calculate positions using simple tree layout (optimized)
  const { positions, maxDepth } = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map();
    const nodeWidth = 1.8;
    const levelHeight = 2.5;
    let maxDepth = 0;
    
    const positionNode = (node: GraphNode, x: number, z: number) => {
      positions.set(node.id, [x, -node.depth * levelHeight, z]);
      maxDepth = Math.max(maxDepth, node.depth);
      
      if (node.children.length > 0) {
        const startX = x - ((node.children.length - 1) * nodeWidth) / 2;
        node.children.forEach((child, i) => {
          positionNode(child, startX + i * nodeWidth, z + 1.5);
        });
      }
    };
    
    // Position root nodes
    const roots = nodes.filter(n => n.depth === 0);
    roots.forEach((node, i) => {
      positionNode(node, i * nodeWidth * 2, 0);
    });
    
    return { positions, maxDepth };
  }, [nodes]);
  
  // Limit nodes for performance
  const visibleNodes = nodes.slice(0, 100);
  
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      
      {/* Nodes */}
      {visibleNodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return <NodeComponent key={node.id} node={node} position={pos} />;
      })}
      
      {/* Controls */}
      <OrbitControls 
        enableDamping 
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#ff3b30" />
    </mesh>
  );
}

export default function MemoryGraph3D({ files }: MemoryGraph3DProps) {
  const nodes = useMemo(() => flattenFiles(files), [files]);
  
  if (nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        color: 'var(--text-muted)',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ fontSize: '40px' }}>📂</div>
        <div style={{ fontSize: '14px' }}>No files to visualize</div>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 15], fov: 50 }}
        style={{ background: '#111' }}
        dpr={[1, 1.5]} // Limit pixel ratio for performance
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene nodes={nodes} />
        </Suspense>
      </Canvas>
    </div>
  );
}