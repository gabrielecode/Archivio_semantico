import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation,
} from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import { Archive, GraphLink, GraphNode } from '../types';
import {
  buildMtcGraph,
  getColorForLink,
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
  normalizeGraphText,
} from '../utils/graph';
import {
  Search,
  Network,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ExternalLink,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { Button, EmptyState } from './ui';

interface GraphTabProps {
  archive: Archive;
  onOpenRec: (id: string) => void;
  onCreateRec?: (title: string) => void;
}

const CANVAS_BG = '#F8F7F4';
const CANVAS_GRID = '#E7E5E0';
const LABEL_INK = '#1C1917';
const GHOST_INK = '#64748B';

export function GraphTab({ archive, onOpenRec, onCreateRec }: GraphTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showExplicit, setShowExplicit] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showSemantic, setShowSemantic] = useState(true);
  const [semanticThreshold, setSemanticThreshold] = useState(0.72);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 960, height: 640 });
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const simNodesRef = useRef<GraphNode[]>([]);
  const simLinksRef = useRef<GraphLink[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const searchMatchesRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const focusAnimRef = useRef<number | null>(null);

  hoveredRef.current = hoveredNodeId;
  selectedRef.current = selectedNodeId;

  const categories = useMemo(() => {
    const set = new Set<string>();
    archive.records.forEach((r) => set.add(r.categoria || r.tipo || 'Generale'));
    set.add('Non risolto');
    return Array.from(set);
  }, [archive.records]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    archive.records.forEach((r) => (r.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [archive.records]);

  const embeddedCount = useMemo(
    () => archive.records.filter((r) => r.chunks.some((c) => c.embedding.length > 0)).length,
    [archive.records]
  );

  const graphData = useMemo(
    () =>
      buildMtcGraph(archive, {
        searchTerm,
        selectedCategory,
        selectedTag,
        showExplicit,
        showMetadata,
        showSemantic,
        semanticThreshold,
        maxSemanticPerNode: 4,
      }),
    [archive, searchTerm, selectedCategory, selectedTag, showExplicit, showMetadata, showSemantic, semanticThreshold]
  );

  const searchMatches = useMemo(() => {
    const norm = normalizeGraphText(searchTerm);
    if (!norm) return new Set<string>();
    return new Set(
      graphData.nodes
        .filter((n) => normalizeGraphText(n.name).includes(norm))
        .map((n) => n.id)
    );
  }, [graphData.nodes, searchTerm]);

  searchMatchesRef.current = searchMatches;

  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    graphData.nodes.forEach((n) => map.set(n.id, new Set([n.id])));
    graphData.links.forEach((l) => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      map.get(s)?.add(t);
      map.get(t)?.add(s);
    });
    return map;
  }, [graphData]);

  const adjacencyRef = useRef(adjacencyMap);
  adjacencyRef.current = adjacencyMap;

  const selectedNode = useMemo(
    () => graphData.nodes.find((n) => n.id === selectedNodeId) || null,
    [graphData.nodes, selectedNodeId]
  );

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
    const items: { node: GraphNode; link: GraphLink }[] = [];

    graphData.links.forEach((l) => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      if (s === selectedNode.id) {
        const peer = nodeById.get(t);
        if (peer) items.push({ node: peer, link: l });
      } else if (t === selectedNode.id) {
        const peer = nodeById.get(s);
        if (peer) items.push({ node: peer, link: l });
      }
    });

    return items.sort((a, b) => (b.link.similarity ?? b.link.weight) - (a.link.similarity ?? a.link.weight));
  }, [graphData, selectedNode]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Warm stone paper background
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, width, height);

    const transform = transformRef.current;
    const k = transform.k;

    // Subtle spatial dot grid in world space
    const gridSpacing = 36;
    const scaledSpacing = gridSpacing * k;
    if (scaledSpacing >= 14) {
      const offsetX = ((transform.x % scaledSpacing) + scaledSpacing) % scaledSpacing;
      const offsetY = ((transform.y % scaledSpacing) + scaledSpacing) % scaledSpacing;
      ctx.fillStyle = CANVAS_GRID;
      for (let gx = offsetX; gx < width; gx += scaledSpacing) {
        for (let gy = offsetY; gy < height; gy += scaledSpacing) {
          ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
        }
      }
    }

    ctx.translate(transform.x, transform.y);
    ctx.scale(k, k);

    const activeFocusId = hoveredRef.current || selectedRef.current;
    const activeNeighbors = activeFocusId ? adjacencyRef.current.get(activeFocusId) : null;
    const matchedSearch = searchMatchesRef.current;
    const hasSearchFilter = matchedSearch.size > 0;

    // 1. Draw edges
    const links = simLinksRef.current;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const src = link.source as GraphNode;
      const tgt = link.target as GraphNode;
      if (typeof src.x !== 'number' || typeof src.y !== 'number' || typeof tgt.x !== 'number' || typeof tgt.y !== 'number') {
        continue;
      }

      const isAdjacent =
        !activeFocusId || src.id === activeFocusId || tgt.id === activeFocusId;
      const isSearchConnected =
        !hasSearchFilter || matchedSearch.has(src.id) || matchedSearch.has(tgt.id);

      let alpha = link.kind === 'metadata' ? 0.45 : link.kind === 'semantic' ? 0.68 : 0.78;
      if (activeFocusId && !isAdjacent) {
        alpha = 0.08;
      } else if (!activeFocusId && hasSearchFilter && !isSearchConnected) {
        alpha = 0.14;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      ctx.strokeStyle = getColorForLink(link);
      const baseWidth =
        link.kind === 'explicit'
          ? 1.8
          : link.kind === 'semantic'
            ? 1.1 + ((link.similarity ?? 0.7) - 0.5) * 2.2
            : 1.0;
      ctx.lineWidth = (isAdjacent && activeFocusId ? baseWidth * 1.35 : baseWidth) / Math.sqrt(k);

      if (link.kind === 'semantic') {
        ctx.setLineDash([5 / Math.sqrt(k), 4 / Math.sqrt(k)]);
      } else if (link.dashed || link.isGhost) {
        ctx.setLineDash([3 / Math.sqrt(k), 4 / Math.sqrt(k)]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();

      // Show similarity or relation micro-label on focused edge
      if (activeFocusId && isAdjacent && k >= 0.85 && (link.kind === 'semantic' || link.tipoRelazione !== 'correlato_a')) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        const edgeText =
          link.kind === 'semantic' && link.similarity !== undefined
            ? `${Math.round(link.similarity * 100)}%`
            : link.tipoRelazione;
        const fontSize = Math.max(8, 10 / k);
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3 / k;
        ctx.strokeStyle = CANVAS_BG;
        ctx.strokeText(edgeText, mx, my);
        ctx.fillStyle = getColorForLink(link);
        ctx.fillText(edgeText, mx, my);
      }

      ctx.restore();
    }

    // 2. Draw nodes
    const nodes = simNodesRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (typeof node.x !== 'number' || typeof node.y !== 'number') continue;

      const isFocus = node.id === activeFocusId;
      const isNeighbor = Boolean(activeNeighbors?.has(node.id));
      const isSearchHit = matchedSearch.has(node.id);

      let alpha = 1;
      if (activeFocusId && !isNeighbor) {
        alpha = 0.14;
      } else if (!activeFocusId && hasSearchFilter && !isSearchHit) {
        alpha = 0.22;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Focus or search outer ring
      if (isFocus || isSearchHit) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val + 4 / Math.sqrt(k), 0, Math.PI * 2);
        ctx.fillStyle = isFocus ? 'rgba(217, 119, 6, 0.18)' : 'rgba(5, 150, 105, 0.16)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, Math.PI * 2);

      if (node.isGhost) {
        ctx.fillStyle = '#F1F5F9';
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5 / Math.sqrt(k);
        ctx.setLineDash([3 / Math.sqrt(k), 2.5 / Math.sqrt(k)]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = isFocus ? '#1C1917' : '#FFFFFF';
        ctx.lineWidth = (isFocus ? 2.4 : 1.5) / Math.sqrt(k);
        ctx.stroke();

        // Subtle inner ring for non-embedded nodes so user knows semantic readiness
        if (!node.hasEmbedding && showSemantic) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(1.8, node.val * 0.32), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fill();
        }
      }

      // Zoom-adaptive labels
      const showLabel =
        isFocus ||
        isSearchHit ||
        (activeFocusId && isNeighbor && k >= 0.65) ||
        (!activeFocusId && (k >= 1.25 || (k >= 0.8 && node.degree >= 2) || (k >= 0.5 && node.degree >= 5)));

      if (showLabel) {
        const fontSize = Math.max(9.5, Math.min(14, 11.5 / Math.pow(k, 0.75)));
        ctx.font = `${node.isGhost ? 'italic ' : isFocus ? '700 ' : '500 '}${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelY = node.y + node.val + 4 / Math.sqrt(k);

        ctx.lineWidth = 3.2 / Math.sqrt(k);
        ctx.strokeStyle = CANVAS_BG;
        ctx.lineJoin = 'round';
        ctx.strokeText(node.name, node.x, labelY);

        ctx.fillStyle = node.isGhost ? GHOST_INK : LABEL_INK;
        ctx.fillText(node.name, node.x, labelY);
      }

      ctx.restore();
    }

    ctx.restore();
  }, [showSemantic]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawCanvas();
    });
  }, [drawCanvas]);

  // Redraw when hover/selection/search highlights change without restarting simulation
  useEffect(() => {
    scheduleDraw();
  }, [hoveredNodeId, selectedNodeId, searchMatches, scheduleDraw]);

  const hitTestNode = useCallback((canvasX: number, canvasY: number): GraphNode | undefined => {
    const transform = transformRef.current;
    const worldX = transform.invertX(canvasX);
    const worldY = transform.invertY(canvasY);
    const hitPad = 6 / Math.sqrt(transform.k);

    const nodes = simNodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (typeof n.x !== 'number' || typeof n.y !== 'number') continue;
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      const r = n.val + hitPad;
      if (dx * dx + dy * dy <= r * r) {
        return n;
      }
    }
    return undefined;
  }, []);

  const focusOnNode = useCallback((targetNode: GraphNode) => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior || typeof targetNode.x !== 'number' || typeof targetNode.y !== 'number') {
      return;
    }

    if (focusAnimRef.current !== null) {
      cancelAnimationFrame(focusAnimRef.current);
      focusAnimRef.current = null;
    }

    const { width, height } = sizeRef.current;
    const targetScale = Math.max(transformRef.current.k, 1.55);
    const targetTransform = zoomIdentity
      .translate(width / 2 - targetNode.x * targetScale, height / 2 - targetNode.y * targetScale)
      .scale(targetScale);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      select(canvas).call(zoomBehavior.transform, targetTransform);
      return;
    }

    const startTransform = transformRef.current;
    const startTime = performance.now();
    const duration = 360;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const k = startTransform.k + (targetTransform.k - startTransform.k) * ease;
      const x = startTransform.x + (targetTransform.x - startTransform.x) * ease;
      const y = startTransform.y + (targetTransform.y - startTransform.y) * ease;
      select(canvas).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(k));
      if (t < 1) {
        focusAnimRef.current = requestAnimationFrame(step);
      } else {
        focusAnimRef.current = null;
      }
    };

    focusAnimRef.current = requestAnimationFrame(step);
  }, []);

  const fitGraphToViewport = useCallback(() => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) return;
    const nodes = simNodesRef.current.filter((n) => typeof n.x === 'number' && typeof n.y === 'number');
    if (nodes.length === 0) {
      select(canvas).call(zoomBehavior.transform, zoomIdentity);
      return;
    }

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x! - n.val);
      maxX = Math.max(maxX, n.x! + n.val);
      minY = Math.min(minY, n.y! - n.val);
      maxY = Math.max(maxY, n.y! + n.val);
    }

    const { width, height } = sizeRef.current;
    const pad = 64;
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const scale = Math.max(0.35, Math.min(2.0, Math.min((width - pad * 2) / gw, (height - pad * 2) / gh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const nextTransform = zoomIdentity.translate(width / 2 - cx * scale, height / 2 - cy * scale).scale(scale);
    select(canvas).call(zoomBehavior.transform, nextTransform);
  }, []);

  const handleZoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) return;
    const { width, height } = sizeRef.current;
    const cur = transformRef.current;
    const nextK = Math.max(0.2, Math.min(4, cur.k * factor));
    const ratio = nextK / cur.k;
    const nextX = width / 2 - (width / 2 - cur.x) * ratio;
    const nextY = height / 2 - (height / 2 - cur.y) * ratio;
    select(canvas).call(zoomBehavior.transform, zoomIdentity.translate(nextX, nextY).scale(nextK));
  };

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sizeRef.current = { width: rect.width, height: rect.height };
        scheduleDraw();
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleDraw]);

  // Setup D3 Zoom & Drag + Hover listeners once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasSel = select(canvas);

    const zoomBeh = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((event) => {
        if (event.type === 'mousedown') {
          const rect = canvas.getBoundingClientRect();
          const hit = hitTestNode(event.clientX - rect.left, event.clientY - rect.top);
          return !hit;
        }
        return !event.ctrlKey || event.type === 'wheel';
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        scheduleDraw();
      });

    zoomBehaviorRef.current = zoomBeh;
    canvasSel.call(zoomBeh);

    let dragStartX = 0;
    let dragStartY = 0;
    let dragged = false;

    const dragBeh = drag<HTMLCanvasElement, unknown>()
      .subject((event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.sourceEvent.clientX - rect.left;
        const y = event.sourceEvent.clientY - rect.top;
        return hitTestNode(x, y);
      })
      .on('start', (event) => {
        const node = event.subject as GraphNode | undefined;
        if (!node) return;
        dragStartX = event.x;
        dragStartY = event.y;
        dragged = false;
        if (!event.active) {
          simulationRef.current?.alphaTarget(0.25).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', (event) => {
        const node = event.subject as GraphNode | undefined;
        if (!node) return;
        if (Math.hypot(event.x - dragStartX, event.y - dragStartY) > 4) {
          dragged = true;
        }
        node.fx = transformRef.current.invertX(event.x);
        node.fy = transformRef.current.invertY(event.y);
        scheduleDraw();
      })
      .on('end', (event) => {
        const node = event.subject as GraphNode | undefined;
        if (!node) return;
        if (!event.active) {
          simulationRef.current?.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
        if (!dragged) {
          setSelectedNodeId(node.id);
        }
      });

    canvasSel.call(dragBeh);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(e.clientX - rect.left, e.clientY - rect.top);
      const nextId = hit ? hit.id : null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hoveredRef.current !== nextId) {
        setHoveredNodeId(nextId);
      }
    };

    const handleMouseLeave = () => {
      if (hoveredRef.current !== null) {
        setHoveredNodeId(null);
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTestNode(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) {
        setSelectedNodeId(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleCanvasClick);
      canvasSel.on('.zoom', null);
      canvasSel.on('.drag', null);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (focusAnimRef.current !== null) cancelAnimationFrame(focusAnimRef.current);
    };
  }, [hitTestNode, scheduleDraw]);

  // Rebuild D3 force simulation when graphData changes
  useEffect(() => {
    const prevPositions = new Map<string, { x: number; y: number }>();
    simNodesRef.current.forEach((n) => {
      if (typeof n.x === 'number' && typeof n.y === 'number') {
        prevPositions.set(n.id, { x: n.x, y: n.y });
      }
    });

    const { width, height } = sizeRef.current;
    const nextNodes: GraphNode[] = graphData.nodes.map((n, idx) => {
      const prev = prevPositions.get(n.id);
      if (prev) {
        return { ...n, x: prev.x, y: prev.y };
      }
      const angle = (idx / Math.max(1, graphData.nodes.length)) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.25;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      };
    });

    const nextLinks: GraphLink[] = graphData.links.map((l) => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
    }));

    simNodesRef.current = nextNodes;
    simLinksRef.current = nextLinks;

    simulationRef.current?.stop();

    const sim = forceSimulation<GraphNode>(nextNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(nextLinks)
          .id((d) => d.id)
          .distance((l) => {
            if (l.kind === 'explicit') return 78;
            if (l.kind === 'semantic') return Math.max(58, 125 - (l.similarity ?? 0.65) * 60);
            return 125;
          })
          .strength((l) => {
            if (l.kind === 'explicit') return 0.55;
            if (l.kind === 'semantic') return 0.35;
            return 0.14;
          })
      )
      .force('charge', forceManyBody<GraphNode>().strength(-185).distanceMax(360))
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX<GraphNode>(width / 2).strength(0.035))
      .force('y', forceY<GraphNode>(height / 2).strength(0.035))
      .force('collide', forceCollide<GraphNode>((d) => d.val + 10).strength(0.7))
      .alphaDecay(0.032)
      .alphaMin(0.005)
      .on('tick', scheduleDraw)
      .on('end', () => {
        scheduleDraw();
      });

    simulationRef.current = sim;
    scheduleDraw();

    return () => {
      sim.stop();
    };
  }, [graphData, scheduleDraw]);

  const handleSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const norm = normalizeGraphText(searchTerm);
    if (!norm) return;
    const hit = simNodesRef.current.find((n) => normalizeGraphText(n.name).includes(norm));
    if (hit) {
      setSelectedNodeId(hit.id);
      focusOnNode(hit);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedTag('all');
    setShowExplicit(true);
    setShowMetadata(true);
    setShowSemantic(true);
    setSemanticThreshold(0.72);
    setSelectedNodeId(null);
  };

  if (archive.records.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="Grafo ancora vuoto"
        text="Aggiungi schede o importa un archivio per esplorare le relazioni semantiche e i collegamenti MTC."
      />
    );
  }

  const hasActiveFilter =
    searchTerm !== '' ||
    selectedCategory !== 'all' ||
    selectedTag !== 'all' ||
    !showExplicit ||
    !showMetadata ||
    !showSemantic;

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-card-bg border border-border-primary rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
              <Network size={20} />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-lg text-text-primary leading-tight">
                Grafo della Conoscenza MTC
              </h2>
              <p className="text-xs text-text-muted tabular-nums">
                {graphData.nodes.length} nodi · {graphData.links.length} archi · {embeddedCount} schede con embedding
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl justify-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                aria-label="Cerca nodo nel grafo"
                placeholder="Cerca nodo e premi Invio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchEnter}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border-primary bg-card-bg text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <select
              aria-label="Filtra per categoria"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-primary text-sm bg-card-bg text-text-primary max-w-[180px]"
            >
              <option value="all">Tutte le categorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtra per tag"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border-primary text-sm bg-card-bg text-text-primary max-w-[160px]"
            >
              <option value="all">Tutti i tag</option>
              {tags.map((tg) => (
                <option key={tg} value={tg}>
                  {tg}
                </option>
              ))}
            </select>

            {hasActiveFilter && (
              <Button variant="secondary" size="sm" onClick={resetFilters} title="Resetta filtri">
                <RotateCcw size={14} /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Layer Toggles & Semantic Similarity Threshold */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border-primary/70 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-muted font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal size={13} /> Livelli archi:
            </span>
            <button
              type="button"
              onClick={() => setShowExplicit((v) => !v)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 border ${
                showExplicit
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-bg-alt border-border-primary text-text-muted hover:text-text-primary'
              }`}
            >
              Link Wiki espliciti
            </button>
            <button
              type="button"
              onClick={() => setShowMetadata((v) => !v)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 border ${
                showMetadata
                  ? 'bg-stone-100 border-stone-300 text-stone-900'
                  : 'bg-bg-alt border-border-primary text-text-muted hover:text-text-primary'
              }`}
            >
              Tag e Metadati
            </button>
            <button
              type="button"
              onClick={() => setShowSemantic((v) => !v)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 border ${
                showSemantic
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-bg-alt border-border-primary text-text-muted hover:text-text-primary'
              }`}
            >
              Similarità semantica
            </button>
          </div>

          {showSemantic && (
            <div className="flex items-center gap-3">
              <label htmlFor="semantic-threshold" className="text-text-muted font-medium whitespace-nowrap">
                Soglia similarità:
              </label>
              <input
                id="semantic-threshold"
                type="range"
                min={0.55}
                max={0.95}
                step={0.02}
                value={semanticThreshold}
                onChange={(e) => setSemanticThreshold(parseFloat(e.target.value))}
                className="w-32 accent-amber-600 cursor-pointer"
              />
              <span className="font-mono font-semibold text-amber-800 tabular-nums w-10 text-right">
                {Math.round(semanticThreshold * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Viewport + Side Preview Drawer */}
      <div
        ref={containerRef}
        className="border border-stone-200 rounded-2xl shadow-sm overflow-hidden relative h-[660px] w-full select-none"
        style={{ backgroundColor: CANVAS_BG }}
      >
        <canvas ref={canvasRef} className="block w-full h-full touch-none" />

        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
            <div className="bg-white/95 border border-stone-200 rounded-2xl p-6 text-center max-w-sm space-y-3 shadow-sm">
              <p className="font-semibold text-stone-900">Nessun nodo corrisponde ai filtri</p>
              <p className="text-xs text-stone-600">Prova a rimuovere la ricerca o ampliare categoria e tag.</p>
              <Button size="sm" variant="secondary" onClick={resetFilters}>
                Ripristina filtri
              </Button>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-1 bg-white/95 border border-stone-200 rounded-xl p-1 shadow-sm">
          <button
            type="button"
            onClick={() => handleZoomBy(1.25)}
            className="p-2 text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title="Zoom avanti"
            aria-label="Zoom avanti"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleZoomBy(0.8)}
            className="p-2 text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title="Zoom indietro"
            aria-label="Zoom indietro"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={fitGraphToViewport}
            className="p-2 text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title="Adatta grafo alla vista"
            aria-label="Adatta grafo alla vista"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Compact Legend (Bottom Left) */}
        <div className="hidden sm:block absolute bottom-4 left-4 bg-white/95 border border-stone-200 rounded-xl px-3.5 py-2.5 shadow-sm text-xs text-stone-700 pointer-events-none space-y-1.5 max-w-[260px]">
          <div className="font-semibold text-stone-900">Tipologie MTC &amp; Archi</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(['acupoint', 'meridian', 'formula', 'symptom', 'syndrome', 'concept'] as const).map((nt) => (
              <div key={nt} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: NODE_TYPE_COLORS[nt] }} />
                <span className="truncate">{NODE_TYPE_LABELS[nt].split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <div className="pt-1 border-t border-stone-200 flex items-center gap-3 text-[11px] text-stone-600">
            <span className="flex items-center gap-1">
              <span className="w-3.5 h-0.5 bg-emerald-600 inline-block" /> Esplicito
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-600 inline-block" /> Semantico
            </span>
          </div>
        </div>

        {/* Side Preview Drawer */}
        {selectedNode && (
          <aside
            aria-label="Dettaglio nodo selezionato"
            className="absolute top-3 right-3 bottom-3 w-[calc(100%-1.5rem)] sm:w-80 bg-white/98 border border-stone-200 rounded-2xl shadow-lg flex flex-col overflow-hidden z-20"
          >
            <div className="px-4 py-3.5 border-b border-stone-200 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  <span className="truncate">{selectedNode.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{selectedNode.degree} archi</span>
                </div>
                <h3 className="font-serif font-bold text-base text-stone-900 mt-1 break-words">
                  {selectedNode.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors shrink-0"
                aria-label="Chiudi anteprima"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {selectedNode.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
                  {selectedNode.tags.map((tg, i) => (
                    <React.Fragment key={tg}>
                      {i > 0 && <span aria-hidden="true">·</span>}
                      <span>#{tg}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {selectedNode.isGhost ? (
                <p className="text-xs text-stone-600 leading-relaxed">
                  Questo concetto è citato nei collegamenti wiki ma non ha ancora una scheda dedicata nell&apos;archivio.
                </p>
              ) : selectedNode.record?.contenuto ? (
                <p className="text-xs text-stone-700 leading-relaxed line-clamp-5 whitespace-pre-line">
                  {selectedNode.record.contenuto}
                </p>
              ) : (
                <p className="text-xs text-stone-500 italic">Nessun testo libero presente in questa scheda.</p>
              )}

              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="text-xs font-semibold text-stone-800 flex items-center justify-between">
                  <span>Nodi connessi</span>
                  <span className="tabular-nums text-stone-500">{selectedNeighbors.length}</span>
                </div>
                {selectedNeighbors.length === 0 ? (
                  <p className="text-xs text-stone-500 italic">Nessuna connessione visibile con i filtri attuali.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedNeighbors.slice(0, 14).map(({ node: peer, link }) => (
                      <li key={link.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const livePeer = simNodesRef.current.find((n) => n.id === peer.id);
                            setSelectedNodeId(peer.id);
                            if (livePeer) focusOnNode(livePeer);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: peer.color }}
                            />
                            <span className="truncate text-stone-900 font-medium">{peer.name}</span>
                          </span>
                          <span className="text-[11px] text-stone-500 tabular-nums shrink-0">
                            {link.kind === 'semantic' && link.similarity !== undefined
                              ? `${Math.round(link.similarity * 100)}%`
                              : link.tipoRelazione}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-stone-200 bg-stone-50/80">
              {selectedNode.isGhost ? (
                onCreateRec && (
                  <Button
                    variant="primary"
                    className="w-full py-2 text-sm"
                    icon={Plus}
                    onClick={() => onCreateRec(selectedNode.name)}
                  >
                    Crea scheda
                  </Button>
                )
              ) : (
                <Button
                  variant="primary"
                  className="w-full py-2 text-sm"
                  icon={ExternalLink}
                  onClick={() => onOpenRec(selectedNode.id)}
                >
                  Apri scheda
                </Button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
