import { Crosshair, Minus, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { GraphEdge, GraphNode, GraphResponse } from "../types";

type PositionedNode = GraphNode & {
  px: number;
  py: number;
};

type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
};

const DEFAULT_VIEW: ViewTransform = { x: 0, y: 0, scale: 1 };
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.4;

function endpointId(endpoint: GraphEdge["source"] | GraphEdge["target"]) {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

function edgeStrength(edge: Pick<GraphEdge, "strength" | "manualStrength">) {
  return Math.max(8, Math.min(100, edge.strength || edge.manualStrength || 35));
}

function strengthClass(strength: number) {
  if (strength >= 75) return "strong";
  if (strength >= 40) return "moderate";
  return "weak";
}

function strengthColor(strength: number) {
  if (strength >= 75) return "#62ff9d";
  if (strength >= 40) return "#ffd65a";
  return "#ff3347";
}

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export default function GraphPage() {
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState({ width: 900, height: 650 });
  const [graph, setGraph] = useState<GraphResponse>({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState("self");
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW);
  const [isPanning, setIsPanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadGraph() {
    setLoading(true);
    try {
      const nextGraph = await api.getGraph();
      setGraph(nextGraph);
      setSelectedNodeId(current => nextGraph.nodes.some(node => node.id === current) ? current : "self");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load graph.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraph();
  }, []);

  useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(300, Math.floor(entry.contentRect.width)),
        height: Math.max(420, Math.floor(entry.contentRect.height))
      });
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const centerX = size.width / 2;
    const centerY = size.height / 2 + Math.min(20, size.height * 0.025);
    const contacts = graph.nodes.filter(node => node.id !== "self");
    const count = Math.max(1, contacts.length);
    const radiusX = Math.max(78, Math.min((size.width - 148) / 2, 385));
    const radiusY = size.width < 600
      ? Math.max(112, Math.min(size.height * 0.26, 135))
      : Math.max(135, Math.min(size.height * 0.31, 235));
    const order = new Map(contacts.map((node, index) => [node.id, index]));

    return graph.nodes.map(node => {
      if (node.id === "self") return { ...node, px: centerX, py: centerY };
      const index = order.get(node.id) || 0;
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const alternatingRadius = index % 2 ? 0.92 : 1;
      return {
        ...node,
        px: centerX + Math.cos(angle) * radiusX * alternatingRadius,
        py: centerY + Math.sin(angle) * radiusY * alternatingRadius
      };
    });
  }, [graph.nodes, size]);

  const nodeById = useMemo(
    () => new Map(positionedNodes.map(node => [node.id, node])),
    [positionedNodes]
  );

  const selectedNode = nodeById.get(selectedNodeId) || nodeById.get("self") || null;
  const focusedNodeId = hoverNodeId || selectedNode?.id || "self";

  const connectedIds = useMemo(() => {
    const ids = new Set<string>([focusedNodeId]);
    graph.edges.forEach(edge => {
      const source = endpointId(edge.source);
      const target = endpointId(edge.target);
      if (source === focusedNodeId) ids.add(target);
      if (target === focusedNodeId) ids.add(source);
    });
    return ids;
  }, [focusedNodeId, graph.edges]);

  const strengthSummary = useMemo(() => {
    return graph.edges.reduce(
      (summary, edge) => {
        const strength = edgeStrength(edge);
        if (strength >= 75) summary.strong += 1;
        else if (strength >= 40) summary.moderate += 1;
        else summary.weak += 1;
        return summary;
      },
      { strong: 0, moderate: 0, weak: 0 }
    );
  }, [graph.edges]);

  function fitNetwork() {
    setView(DEFAULT_VIEW);
  }

  function resetView() {
    setSelectedNodeId("self");
    setHoverNodeId(null);
    setView(DEFAULT_VIEW);
  }

  function centerSelected() {
    if (!selectedNode) return;
    const nextScale = Math.max(1.15, view.scale);
    setView({
      scale: nextScale,
      x: size.width / 2 - selectedNode.px * nextScale,
      y: size.height / 2 - selectedNode.py * nextScale
    });
  }

  function zoomAt(nextScale: number, originX = size.width / 2, originY = size.height / 2) {
    setView(current => {
      const scale = clampZoom(nextScale);
      const ratio = scale / current.scale;
      return {
        scale,
        x: originX - (originX - current.x) * ratio,
        y: originY - (originY - current.y) * ratio
      };
    });
  }

  function zoomBy(factor: number) {
    zoomAt(view.scale * factor);
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = (event.clientX - rect.left) * (size.width / rect.width);
    const originY = (event.clientY - rect.top) * (size.height / rect.height);
    zoomAt(view.scale * (event.deltaY < 0 ? 1.12 : 0.89), originX, originY);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: view.x,
      y: view.y
    };
    setIsPanning(true);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratioX = size.width / rect.width;
    const ratioY = size.height / rect.height;
    const limitX = size.width * 0.8;
    const limitY = size.height * 0.8;
    setView(current => ({
      ...current,
      x: Math.max(-limitX, Math.min(limitX, drag.x + (event.clientX - drag.clientX) * ratioX)),
      y: Math.max(-limitY, Math.min(limitY, drag.y + (event.clientY - drag.clientY) * ratioY))
    }));
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleViewportKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const panStep = event.shiftKey ? 42 : 22;
    if (event.key === "+" || event.key === "=") zoomBy(1.12);
    else if (event.key === "-") zoomBy(0.89);
    else if (event.key === "0") fitNetwork();
    else if (event.key === "ArrowLeft") setView(current => ({ ...current, x: current.x + panStep }));
    else if (event.key === "ArrowRight") setView(current => ({ ...current, x: current.x - panStep }));
    else if (event.key === "ArrowUp") setView(current => ({ ...current, y: current.y + panStep }));
    else if (event.key === "ArrowDown") setView(current => ({ ...current, y: current.y - panStep }));
    else return;
    event.preventDefault();
  }

  const viewportStyle = {
    "--viewport-x": `${Math.round(view.x / Math.max(1, size.width) * 16)}px`,
    "--viewport-y": `${Math.round(view.y / Math.max(1, size.height) * 16)}px`
  } as CSSProperties;

  return (
    <div className="page graph-page">
      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="status-line">Loading graph</div> : null}

      <div className="graph-console-layout">
        <aside className="graph-rail graph-rail-left">
          <section className="rail-panel">
            <h2>Network Summary</h2>
            <dl>
              <div><dt>Nodes</dt><dd>{String(graph.nodes.length).padStart(2, "0")}</dd></div>
              <div><dt>Edges</dt><dd>{String(graph.edges.length).padStart(2, "0")}</dd></div>
              <div><dt>Self links</dt><dd>{String(graph.edges.filter(edge => edge.scope === "self").length).padStart(2, "0")}</dd></div>
              <div><dt>Core state</dt><dd>LOCKED</dd></div>
            </dl>
          </section>
          <section className="rail-panel">
            <h2>Strength Distribution</h2>
            <div className="strength-distribution">
              <div><span>Strong</span><i className="strong" style={{ width: `${Math.max(8, strengthSummary.strong * 18)}%` }} /><b>{strengthSummary.strong}</b></div>
              <div><span>Moderate</span><i className="moderate" style={{ width: `${Math.max(8, strengthSummary.moderate * 18)}%` }} /><b>{strengthSummary.moderate}</b></div>
              <div><span>Weak</span><i className="weak" style={{ width: `${Math.max(8, strengthSummary.weak * 18)}%` }} /><b>{strengthSummary.weak}</b></div>
            </div>
          </section>
          <section className="rail-panel selected-record-panel" aria-live="polite">
            <h2>Selected Record</h2>
            <Crosshair size={24} />
            <strong>{selectedNode?.type === "self" ? "SELF // CORE" : selectedNode?.label || "No selection"}</strong>
            <span>{selectedNode?.relationshipType || "System anchor"}</span>
            <small>
              {selectedNode?.type === "contact"
                ? `Signal strength ${Math.round(selectedNode.suggestedStrength || selectedNode.strength || 0)}%`
                : "Select a node to inspect"}
            </small>
            {selectedNode?.contactId ? (
              <button className="secondary-button graph-record-action" onClick={() => navigate(`/contacts/${selectedNode.contactId}`)}>
                Open Dossier
              </button>
            ) : null}
          </section>
        </aside>

        <div className="graph-shell graph-shell-2d" ref={shellRef}>
          <header className="graph-title-overlay">
            <p className="eyebrow">Local Social Topology</p>
            <h1>Relationship Network</h1>
            <div className="graph-view-controls">
              <button className="icon-button" onClick={() => zoomBy(0.89)} aria-label="Zoom out" title="Zoom out">
                <Minus size={15} />
              </button>
              <button className="icon-button" onClick={loadGraph} aria-label="Refresh network" title="Refresh network">
                <RefreshCw size={15} />
              </button>
              <button className="icon-button" onClick={() => zoomBy(1.12)} aria-label="Zoom in" title="Zoom in">
                <Plus size={15} />
              </button>
            </div>
          </header>
          <div className="graph-hud" aria-hidden="true">
            <span>View: 2D Pan / Zoom</span>
            <span>Zoom: {Math.round(view.scale * 100)}%</span>
            <span>Focus: {selectedNode?.type === "self" ? "core" : selectedNode?.label || "core"}</span>
          </div>
          <p className="sr-only" id="graph-interaction-help">
            Use drag or arrow keys to pan. Use the mouse wheel, plus and minus keys, or zoom buttons to zoom. Press zero to fit the network.
          </p>
          <svg
            className={`relationship-map ${isPanning ? "is-panning" : ""}`}
            viewBox={`0 0 ${size.width} ${size.height}`}
            role="group"
            aria-label="Interactive relationship network"
            aria-describedby="graph-interaction-help"
            tabIndex={0}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleViewportKeyDown}
          >
            <defs>
              <filter id="graph-glow-green" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="graph-glow-warm" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="graph-glow-danger" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
              <g className="graph-orbit-rings" aria-hidden="true">
                {[64, 112, 172, 235].map(radius => (
                  <circle key={radius} cx={size.width / 2} cy={size.height / 2 + Math.min(20, size.height * 0.025)} r={radius} />
                ))}
              </g>

              <g className="graph-links" aria-hidden="true">
                {graph.edges.map(edge => {
                  const source = nodeById.get(endpointId(edge.source));
                  const target = nodeById.get(endpointId(edge.target));
                  if (!source || !target) return null;
                  const strength = edgeStrength(edge);
                  const connected = source.id === focusedNodeId || target.id === focusedNodeId;
                  const unrelated = focusedNodeId && !connected;
                  return (
                    <line
                      key={edge.id}
                      className={`graph-link ${strengthClass(strength)} ${connected ? "is-focused" : ""}`}
                      x1={source.px}
                      y1={source.py}
                      x2={target.px}
                      y2={target.py}
                      stroke={strengthColor(strength)}
                      strokeWidth={1 + (strength / 100) * (edge.scope === "self" ? 4.5 : 2.5)}
                      opacity={unrelated ? 0.1 : Math.min(0.92, 0.3 + strength / 120 + (connected ? 0.12 : 0))}
                    />
                  );
                })}
              </g>

              <g className="graph-nodes">
                {positionedNodes.map(node => {
                  const self = node.type === "self";
                  const strength = Math.round(node.suggestedStrength || node.strength || 58);
                  const className = strengthClass(strength);
                  const radius = self ? 22 : 10 + strength / 18;
                  const selected = selectedNode?.id === node.id;
                  const related = connectedIds.has(node.id);
                  const muted = Boolean(focusedNodeId && !related);
                  const label = self ? "SELF // CORE" : node.label;
                  return (
                    <g
                      key={node.id}
                      className={`graph-node ${self ? "self" : className} ${selected ? "is-selected" : ""} ${muted ? "is-muted" : ""}`}
                      transform={`translate(${node.px} ${node.py})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${label}${self ? "" : `, ${node.relationshipType || "contact"}, ${strength} percent strength`}`}
                      aria-pressed={selected}
                      onPointerDown={event => event.stopPropagation()}
                      onClick={() => setSelectedNodeId(node.id)}
                      onMouseEnter={() => setHoverNodeId(node.id)}
                      onMouseLeave={() => setHoverNodeId(null)}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedNodeId(node.id);
                        }
                      }}
                    >
                      <circle className="graph-node-field" r={radius + (self ? 28 : 18)} />
                      {[0, 8, 16].map(offset => <circle className="graph-node-ring" key={offset} r={radius + offset} />)}
                      {selected ? <circle className="graph-node-focus" r={radius + 23} /> : null}
                      <line className="graph-node-crosshair" x1={-(radius + 22)} x2={radius + 22} y1="0" y2="0" />
                      <line className="graph-node-crosshair" x1="0" x2="0" y1={-(radius + 22)} y2={radius + 22} />
                      <circle className="graph-node-core" r={Math.max(5, radius * 0.45)} />
                      <text className="graph-node-label" y={radius + 31} textAnchor="middle">
                        <tspan x="0">{label}</tspan>
                        {!self ? <tspan className="graph-node-meta" x="0" dy="15">{strength}% // {node.relationshipType || "CONTACT"}</tspan> : null}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>

        <aside className="graph-rail graph-rail-right">
          <section className="rail-panel graph-legend">
            <h2>Graph Legend</h2>
            <p><i className="legend-line strong" /> Strong <span>≥ 75%</span></p>
            <p><i className="legend-line moderate" /> Moderate <span>40–74%</span></p>
            <p><i className="legend-line weak" /> Weak <span>&lt; 40%</span></p>
            <p><i className="legend-dot focus" /> Selected</p>
          </section>
          <section className="rail-panel camera-panel viewport-panel">
            <h2>Viewport State</h2>
            <div className="viewport-map" style={viewportStyle} aria-hidden="true"><span /></div>
            <dl>
              <div><dt>Mode</dt><dd>2D Pan / Zoom</dd></div>
              <div><dt>Selection</dt><dd>{selectedNode?.type === "contact" ? "Contact" : "Core"}</dd></div>
              <div><dt>Zoom</dt><dd>{view.scale.toFixed(2)}×</dd></div>
              <div><dt>Bloom</dt><dd>Linked Signal</dd></div>
            </dl>
          </section>
          <section className="rail-panel">
            <h2>Network Metrics</h2>
            <dl>
              <div><dt>Visible nodes</dt><dd>{String(graph.nodes.length).padStart(2, "0")}</dd></div>
              <div><dt>Visible edges</dt><dd>{String(graph.edges.length).padStart(2, "0")}</dd></div>
              <div><dt>Focus</dt><dd>{selectedNode?.type === "contact" ? "CONTACT" : "CORE"}</dd></div>
              <div><dt>Health</dt><dd>98%</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <div className="graph-command-bar">
        <button className="secondary-button" onClick={fitNetwork}>Fit Network</button>
        <button className="secondary-button" onClick={centerSelected} disabled={!selectedNode}>Center Selected</button>
        <button className="secondary-button" onClick={resetView}>Reset View</button>
        <span>Operator: User-01</span>
        <span>Clearance: Level 3</span>
        <span>Core Anchor Online // Signal Decay Nominal</span>
      </div>
    </div>
  );
}
