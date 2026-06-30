import ForceGraph3D from "react-force-graph-3d";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SpriteText from "three-spritetext";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { api } from "../lib/api";
import type { GraphEdge, GraphNode, GraphResponse } from "../types";

type Graph3DEdge = Omit<GraphEdge, "source" | "target"> & {
  source?: string | GraphNode;
  target?: string | GraphNode;
};

type OrbitControlsLike = {
  target?: THREE.Vector3;
  cursor?: THREE.Vector3;
  enablePan?: boolean;
  enableDamping?: boolean;
  dampingFactor?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minTargetRadius?: number;
  maxTargetRadius?: number;
  mouseButtons?: Record<string, number>;
  touches?: Record<string, number>;
  update?: () => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

const ORIGIN = new THREE.Vector3(0, 0, 0);
const CAMERA_DISTANCE = 520;
const CAMERA_MIN_DISTANCE = 150;
const CAMERA_MAX_DISTANCE = 760;
const GRAPH_BOUNDS = 315;

function endpointId(endpoint: Graph3DEdge["source"] | Graph3DEdge["target"]) {
  if (typeof endpoint === "object" && endpoint !== null) return endpoint.id;
  return endpoint || "";
}

function normalizedStrength(edge: Pick<GraphEdge, "strength" | "manualStrength">) {
  return Math.max(0.08, Math.min(1, (edge.strength || edge.manualStrength || 35) / 100));
}

function createContainmentForce(radius: number) {
  let nodes: GraphNode[] = [];
  const force = (alpha: number) => {
    nodes.forEach((node) => {
      if (node.id === "self") return;
      const x = node.x || 0;
      const y = node.y || 0;
      const z = node.z || 0;
      const distance = Math.sqrt(x * x + y * y + z * z) || 1;
      const outerOverflow = Math.max(0, distance - radius);
      const innerOverflow = Math.max(0, 88 - distance);

      if (outerOverflow > 0) {
        const pull = (outerOverflow / distance) * alpha * 0.34;
        node.vx = (node.vx || 0) - x * pull;
        node.vy = (node.vy || 0) - y * pull;
        node.vz = (node.vz || 0) - z * pull;
      }

      if (innerOverflow > 0) {
        const push = (innerOverflow / distance) * alpha * 0.12;
        node.vx = (node.vx || 0) + x * push;
        node.vy = (node.vy || 0) + y * push;
        node.vz = (node.vz || 0) + z * push;
      }
    });
  };
  force.initialize = (nextNodes: GraphNode[]) => {
    nodes = nextNodes;
  };
  return force;
}

export default function GraphPage() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const [size, setSize] = useState({ width: 900, height: 650 });
  const [graph, setGraph] = useState<GraphResponse>({ nodes: [], edges: [] });
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadGraph() {
    setLoading(true);
    try {
      const nextGraph = await api.getGraph();
      setGraph(nextGraph);
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
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(420, Math.floor(entry.contentRect.height))
      });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    bloomPassRef.current?.setSize(size.width, size.height);
  }, [size]);

  const graphData = useMemo(() => {
    const contactNodes = graph.nodes.filter((node) => node.id !== "self");
    const nodeCount = Math.max(1, contactNodes.length);

    return {
      nodes: graph.nodes.map((node, index) => {
        if (node.id === "self") {
          return { ...node, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0 };
        }

        const contactIndex = Math.max(0, index - 1);
        const angle = contactIndex * Math.PI * (3 - Math.sqrt(5));
        const band = contactIndex % 5;
        const radius = 150 + (band % 3) * 34 + Math.min(54, nodeCount * 2.2);

        return {
          ...node,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius * 0.78,
          z: (band - 2) * 42 + Math.sin(angle * 1.7) * 28
        };
      }),
      links: graph.edges.map((edge) => ({ ...edge }))
    };
  }, [graph]);

  const hoverNode = useMemo(() => {
    if (!hoverNodeId) return null;
    return graph.nodes.find((node) => node.id === hoverNodeId) || null;
  }, [graph.nodes, hoverNodeId]);

  const connectedIds = useMemo(() => {
    if (!hoverNodeId) return new Set<string>();
    const ids = new Set<string>([hoverNodeId]);
    graph.edges.forEach((edge) => {
      const source = endpointId(edge.source);
      const target = endpointId(edge.target);
      if (source === hoverNodeId) ids.add(target);
      if (target === hoverNodeId) ids.add(source);
    });
    return ids;
  }, [graph.edges, hoverNodeId]);

  const isHighlightedLink = useCallback(
    (link: Graph3DEdge) => {
      if (!hoverNodeId) return false;
      return endpointId(link.source) === hoverNodeId || endpointId(link.target) === hoverNodeId;
    },
    [hoverNodeId]
  );

  const lockCamera = useCallback((transitionMs = 0) => {
    const instance = graphRef.current;
    if (!instance) return;

    const camera = instance.camera?.() as THREE.PerspectiveCamera | undefined;
    if (camera) {
      const distance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, camera.position.distanceTo(ORIGIN) || CAMERA_DISTANCE));
      if (Math.abs(camera.position.distanceTo(ORIGIN) - distance) > 0.1) {
        camera.position.setLength(distance);
      }
      camera.lookAt(ORIGIN);
    }

    instance.cameraPosition?.({ z: CAMERA_DISTANCE, y: 56 }, { x: 0, y: 0, z: 0 }, transitionMs);

    const controls = instance.controls?.() as OrbitControlsLike | undefined;
    if (!controls) return;
    controls.target?.copy(ORIGIN);
    controls.cursor?.copy(ORIGIN);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.rotateSpeed = 0.42;
    controls.zoomSpeed = 0.54;
    controls.minDistance = CAMERA_MIN_DISTANCE;
    controls.maxDistance = CAMERA_MAX_DISTANCE;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minTargetRadius = 0;
    controls.maxTargetRadius = 0;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_ROTATE
    };
    controls.update?.();
  }, []);

  useEffect(() => {
    const instance = graphRef.current;
    if (!instance) return;

    const scene = instance.scene?.() as THREE.Scene | undefined;
    if (scene && !scene.userData.terminalCoreReady) {
      scene.userData.terminalCoreReady = true;
      scene.fog = new THREE.FogExp2(0x00120c, 0.0022);

      const grid = new THREE.GridHelper(620, 20, 0x43ffad, 0x0b4f37);
      grid.name = "terminal-core-grid";
      grid.position.y = -135;
      const gridMaterial = grid.material as THREE.Material | THREE.Material[];
      (Array.isArray(gridMaterial) ? gridMaterial : [gridMaterial]).forEach((material) => {
        material.transparent = true;
        material.opacity = 0.28;
        material.depthWrite = false;
      });
      scene.add(grid);

      const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(92, 0.42, 8, 128),
        new THREE.MeshBasicMaterial({
          color: 0x57ffb8,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      coreRing.name = "terminal-core-origin-ring";
      coreRing.rotation.x = Math.PI / 2;
      scene.add(coreRing);
    }

    if (!bloomPassRef.current) {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.72, 0.38, 0.24);
      bloomPass.strength = 0.72;
      bloomPass.radius = 0.38;
      bloomPass.threshold = 0.24;
      instance.postProcessingComposer?.().addPass(bloomPass);
      bloomPassRef.current = bloomPass;
    }

    lockCamera(0);
  }, [lockCamera, size.height, size.width]);

  useEffect(() => {
    const instance = graphRef.current;
    if (!instance) return;

    const controls = instance.controls?.() as OrbitControlsLike | undefined;
    if (!controls?.addEventListener) return;

    let frame = 0;
    const enforceBounds = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const camera = instance.camera?.() as THREE.PerspectiveCamera | undefined;
        const controlsNow = instance.controls?.() as OrbitControlsLike | undefined;
        if (!camera || !controlsNow) return;

        const distance = camera.position.distanceTo(ORIGIN);
        const clampedDistance = Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, distance || CAMERA_DISTANCE));
        if (Math.abs(distance - clampedDistance) > 0.1) {
          camera.position.setLength(clampedDistance);
        }
        controlsNow.target?.copy(ORIGIN);
        controlsNow.cursor?.copy(ORIGIN);
        camera.lookAt(ORIGIN);
      });
    };

    controls.addEventListener("change", enforceBounds);
    return () => {
      controls.removeEventListener?.("change", enforceBounds);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [graphData]);

  useEffect(() => {
    const instance = graphRef.current;
    if (!instance || graphData.nodes.length === 0) return;

    const charge = instance.d3Force?.("charge") as any;
    const link = instance.d3Force?.("link") as any;
    charge?.strength?.(-210);
    charge?.distanceMax?.(460);
    link?.distance?.((edge: GraphEdge) => (edge.scope === "self" ? 116 + (1 - normalizedStrength(edge)) * 74 : 96 + (1 - normalizedStrength(edge)) * 54));
    link?.strength?.((edge: GraphEdge) => (edge.scope === "self" ? 0.86 : 0.28 + normalizedStrength(edge) * 0.34));
    instance.d3Force?.("hologramBounds", createContainmentForce(GRAPH_BOUNDS));
    instance.d3ReheatSimulation?.();

    const fitSoon = window.setTimeout(() => lockCamera(450), 260);
    const fitLater = window.setTimeout(() => lockCamera(450), 1500);
    return () => {
      window.clearTimeout(fitSoon);
      window.clearTimeout(fitLater);
    };
  }, [graphData, lockCamera]);

  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const highlighted = !hoverNodeId || connectedIds.has(node.id);
      const hovered = hoverNodeId === node.id;
      const self = node.type === "self";
      const strength = Math.max(0.16, Math.min(1, (node.suggestedStrength || node.strength || 58) / 100));
      const coreRadius = self ? 13.5 : 5.6 + strength * 5.8;
      const group = new THREE.Group();

      const coreColor = self ? 0x9dffd0 : highlighted ? 0x48e89d : 0x0a3125;
      const glowColor = self ? 0x43f79c : 0x25d97c;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(coreRadius, self ? 32 : 20, self ? 24 : 14),
        new THREE.MeshBasicMaterial({
          color: coreColor,
          transparent: true,
          opacity: self ? (hovered ? 0.88 : 0.78) : highlighted ? (hovered ? 0.86 : 0.68) : 0.2,
          blending: THREE.NormalBlending
        })
      );
      group.add(core);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(coreRadius * (hovered ? 2.05 : self ? 1.75 : 1.55), 24, 16),
        new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: hovered ? 0.18 : self ? 0.105 : highlighted ? 0.08 : 0.025,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      group.add(halo);

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(coreRadius * 1.38, 12, 8),
        new THREE.MeshBasicMaterial({
          color: self ? 0xaaffda : 0x74f8b6,
          wireframe: true,
          transparent: true,
          opacity: self ? 0.48 : highlighted ? 0.26 : 0.09,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      group.add(shell);

      if (self) {
        [0, Math.PI / 3, -Math.PI / 3].forEach((rotation, index) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(coreRadius * (1.95 + index * 0.36), 0.32, 8, 96),
            new THREE.MeshBasicMaterial({
              color: index === 0 ? 0x9dffd0 : 0x43f79c,
              transparent: true,
              opacity: hovered ? 0.44 : 0.28 - index * 0.06,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          ring.rotation.x = Math.PI / 2;
          ring.rotation.y = rotation;
          group.add(ring);
        });
      }

      const label = new SpriteText(self ? "SELF // ME" : node.label, self ? 7.2 : 4.8, highlighted ? "#d8fff2" : "#3f8469");
      label.fontFace = "Cascadia Code, Consolas, monospace";
      label.fontWeight = self ? "900" : "800";
      label.backgroundColor = false;
      label.padding = [2, 4];
      label.position.y = -(coreRadius + (self ? 17 : 12));
      label.material.depthWrite = false;
      label.material.transparent = true;
      label.material.opacity = hovered || self ? 0.98 : highlighted ? 0.72 : 0.26;
      group.add(label);

      return group;
    },
    [connectedIds, hoverNodeId]
  );

  const linkMaterial = useCallback(
    (link: Graph3DEdge) => {
      const highlighted = isHighlightedLink(link);
      const unrelated = Boolean(hoverNodeId && !highlighted);
      const strength = normalizedStrength(link as GraphEdge);
      return new THREE.MeshBasicMaterial({
        color: link.scope === "self" ? 0x4dffb2 : 0xb9ff77,
        transparent: true,
        opacity: unrelated ? 0.045 : Math.min(0.92, 0.18 + strength * 0.46 + (highlighted ? 0.26 : 0)),
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    },
    [hoverNodeId, isHighlightedLink]
  );

  return (
    <div className="page graph-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Network</p>
          <h1>Graph Core</h1>
        </div>
        <button className="secondary-button" onClick={loadGraph}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="status-line">Loading graph</div> : null}

      <div className="data-strip">
        <span>Nodes: {graph.nodes.length}</span>
        <span>Edges: {graph.edges.length}</span>
        <span>Self Links: {graph.edges.filter((edge) => edge.scope === "self").length}</span>
        <span>Focus: {hoverNode?.label || "core"}</span>
      </div>

      <div className="graph-shell" ref={wrapRef}>
        <div className="graph-hud" aria-hidden="true">
          <span>Center Lock: Active</span>
          <span>Camera: Bounded Orbit</span>
          <span>Bloom: Linked Signal</span>
        </div>
        <div className="graph-reticle" aria-hidden="true" />
        <ForceGraph3D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          controlType="orbit"
          rendererConfig={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          nodeId="id"
          nodeVal={(node: GraphNode) => (node.type === "self" ? 7 : 2.2)}
          nodeThreeObject={(node) => nodeThreeObject(node as GraphNode)}
          nodeLabel={(node: GraphNode) => node.label}
          nodeOpacity={1}
          nodeResolution={20}
          linkMaterial={(link: Graph3DEdge) => linkMaterial(link)}
          linkWidth={(link: Graph3DEdge) => {
            const edge = link as GraphEdge;
            const highlighted = isHighlightedLink(edge);
            return Math.max(0.5, normalizedStrength(edge) * (edge.scope === "self" ? 4.4 : 2.7)) + (highlighted ? 1.45 : 0);
          }}
          linkDirectionalParticles={(link: Graph3DEdge) => (isHighlightedLink(link) ? 4 : link.scope === "self" ? 1 : 0)}
          linkDirectionalParticleWidth={(link: Graph3DEdge) => (isHighlightedLink(link) ? 2.35 : 1.1)}
          linkDirectionalParticleColor={(link: Graph3DEdge) => (isHighlightedLink(link) ? "#d8fff2" : "#57ffb8")}
          linkDirectionalParticleSpeed={(link: Graph3DEdge) => 0.0026 + normalizedStrength(link as GraphEdge) * 0.006}
          linkHoverPrecision={7}
          warmupTicks={90}
          cooldownTicks={170}
          d3VelocityDecay={0.36}
          enableNodeDrag={false}
          enablePointerInteraction
          enableNavigationControls
          onEngineStop={() => lockCamera(300)}
          onNodeHover={(node) => setHoverNodeId(node?.id ? String(node.id) : null)}
          onNodeClick={(node) => {
            const graphNode = node as GraphNode;
            if (graphNode.contactId) navigate(`/contacts/${graphNode.contactId}`);
          }}
          showPointerCursor={(object) => Boolean((object as GraphNode | undefined)?.contactId)}
        />
      </div>
    </div>
  );
}
