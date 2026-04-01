'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
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

// Node component
function Node({ node, position }: { node: GraphNode; position: [number, number, number] }) {
  const isFile = node.type === 'file';
  const color = isFile ? '#ff3b30' : '#4a90d9';
  
  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={position}>
        {/* Sphere */}
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={0.2}
          />
        </mesh>
        
        {/* Label */}
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.15}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          maxWidth={2}
        >
          {node.name.length > 15 ? node.name.slice(0, 14) + '...' : node.name}
        </Text>
      </group>
    </Float>
  );
}

// Scene component
function Scene({ nodes }: { nodes: GraphNode[] }) {
  // Calculate positions using simple tree layout
  const { positions, edges } = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map();
    const edges: Array<{ from: [number, number, number]; to: [number, number, number] }> = [];
    
    const nodeWidth = 2;
    const levelHeight = 3;
    
    const positionNode = (node: GraphNode, x: number, z: number) => {
      positions.set(node.id, [x, -node.depth * levelHeight, z]);
      
      if (node.children.length > 0) {
        const startX = x - ((node.children.length - 1) * nodeWidth) / 2;
        node.children.forEach((child, i) => {
          const childPos: [number, number, number] = [startX + i * nodeWidth, -child.depth * levelHeight, z + 2];
          positions.set(child.id, childPos);
          edges.push({ 
            from: [x, -node.depth * levelHeight, z], 
            to: childPos 
          });
          positionNode(child, startX + i * nodeWidth, z + 2);
        });
      }
    };
    
    // Position root nodes
    const roots = nodes.filter(n => n.depth === 0);
    roots.forEach((node, i) => {
      positionNode(node, i * nodeWidth * 2, 0);
    });
    
    return { positions, edges };
  }, [nodes]);
  
  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />
      
      {/* Nodes */}
      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return <Node key={node.id} node={node} position={pos} />;
      })}
      
      {/* Controls */}
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
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
        <div style={{ fontSize: '48px' }}>📂</div>
        <div>No files to visualize</div>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 20], fov: 50 }}
        style={{ background: '#111' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene nodes={nodes} />
        </Suspense>
      </Canvas>
    </div>
  );
}