
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GridVisualizer } from '../terrain/GridVisualizer';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

const SIZE_X = 20;
const SIZE_Y = 10;
const SIZE_Z = 20;
const RAVINE_WIDTH = 1.8;
const RAVINE_SPEED = 2;
const RAVINE_INTERVAL = 50;
const TERRAIN_BOTTOM = 0.1;

type TerrainPoint = {
  x: number;
  z: number;
  index: number;
};

export default function TerrainScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const regenerateRef = useRef<(() => void) | null>(null);
  const pinchEnabledRef = useRef(false);
  const highlightRef = useRef<THREE.Mesh | null>(null);
  const ravineModeRef = useRef(false);
  const ravineMarkersRef = useRef<THREE.Mesh[]>([]);
  const ravineLineRef = useRef<THREE.Line | null>(null);
  const ravinePointsRef = useRef<TerrainPoint[]>([]);
  const ravineRunningRef = useRef(false);

  const [pinchEnabled, setPinchEnabled] = useState(false);
  const [ravineOpen, setRavineOpen] = useState(false);
  const [ravineRunning, setRavineRunning] = useState(false);
  const [selectedRavinePoints, setSelectedRavinePoints] = useState<
    { x: number; z: number; index: number }[]
  >([]);

  const openRavine = () => {
    pinchEnabledRef.current = false;
    setPinchEnabled(false);

    ravineModeRef.current = true;
    setRavineOpen(true);
  };

  const closeRavine = () => {
    ravineModeRef.current = false;
    ravineRunningRef.current = false;

    setRavineRunning(false);
    setRavineOpen(false);

    ravinePointsRef.current = [];
    setSelectedRavinePoints([]);

    for (const marker of ravineMarkersRef.current) {
      marker.visible = false;
    }

    if (ravineLineRef.current) {
      ravineLineRef.current.visible = false;
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171b22');

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    camera.position.set(15, 12, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const grid = new THREE.GridHelper(20, 20, 0x8b9bb4, 0x394352);
    grid.position.y = -0.5;
    scene.add(grid);

    const axes = new THREE.AxesHelper(3);
    scene.add(axes);

    const generator = new TerrainGenerator();
    const visualizer = new GridVisualizer(scene);

    let terrain = generator.generate(SIZE_X, SIZE_Y, SIZE_Z);
    visualizer.rebuild(terrain);

    // A small gold sphere marks the selected terrain vertex.
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        depthTest: false,
      })
    );

    highlight.visible = false;
    highlight.renderOrder = 999;
    scene.add(highlight);
    highlightRef.current = highlight;

    const ravineMarkers: THREE.Mesh[] = [];

    const ravineLineGeometry = new THREE.BufferGeometry();

    const ravineLine = new THREE.Line(
      ravineLineGeometry,
      new THREE.LineBasicMaterial({
        color: 0xffd166,
        depthTest: false,
      })
    );

    ravineLine.visible = false;
    ravineLine.renderOrder = 1000;
    scene.add(ravineLine);

    ravineMarkersRef.current = ravineMarkers;
    ravineLineRef.current = ravineLine;

    const updateRavineVisuals = () => {
      // Remove old markers.
      for (const marker of ravineMarkers) {
        scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
      }

      ravineMarkers.length = 0;

      const points = ravinePointsRef.current;

      // Create a marker for every selected point.
      for (const point of points) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 12, 8),
          new THREE.MeshBasicMaterial({
            color: 0xffd166,
            depthTest: false,
          })
        );

        marker.position.set(
          point.x - (SIZE_X - 1) / 2,
          terrain.surfaceHeights[point.index] + 0.2,
          point.z - (SIZE_Z - 1) / 2
        );

        marker.renderOrder = 1000;
        scene.add(marker);
        ravineMarkers.push(marker);
      }

      // Update the line connecting the selected points.
      const positions: number[] = [];

      for (const point of points) {
        positions.push(
          point.x - (SIZE_X - 1) / 2,
          terrain.surfaceHeights[point.index] + 0.2,
          point.z - (SIZE_Z - 1) / 2
        );
      }

      ravineLine.geometry.dispose();

      ravineLine.geometry = new THREE.BufferGeometry();

      ravineLine.geometry.setFromPoints(
        points.map((point) => new THREE.Vector3(
          point.x - (SIZE_X - 1) / 2,
          terrain.surfaceHeights[point.index] + 0.2,
          point.z - (SIZE_Z - 1) / 2
        ))
      );

      ravineLine.visible = points.length >= 2;
};

    const regenerate = () => {
      terrain = generator.generate(SIZE_X, SIZE_Y, SIZE_Z);
      visualizer.rebuild(terrain);
      highlight.visible = false;
    };

    regenerateRef.current = regenerate;

    // Distance from a 2D point to a line segment.
    const distanceToSegment = (
      px: number,
      pz: number,
      ax: number,
      az: number,
      bx: number,
      bz: number
    ): number => {
      const dx = bx - ax;
      const dz = bz - az;

      const lengthSquared = dx * dx + dz * dz;

      if (lengthSquared === 0) {
        return Math.hypot(px - ax, pz - az);
      }

      const t = THREE.MathUtils.clamp(
        ((px - ax) * dx + (pz - az) * dz) / lengthSquared,
        0,
        1
      );

      const closestX = ax + t * dx;
      const closestZ = az + t * dz;

      return Math.hypot(px - closestX, pz - closestZ);
    };


const erodeRavine = (deltaSeconds: number) => {
  const selectedPoints = ravinePointsRef.current;

  // A ravine needs at least two selected points.
  if (selectedPoints.length < 2) return;

  // Use the same smooth curve as the visible ravine path.
  const curvePoints = selectedPoints.map((point) =>
    new THREE.Vector3(point.x, 0, point.z)
  );

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const pathPoints = curve.getPoints(
    (selectedPoints.length - 1) * 20
  );

  let terrainChanged = false;
  let changedVertices = 0;  

  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      // Find the shortest distance from this grid point to the path.
      let shortestDistance = Infinity;

      for (let i = 0; i < pathPoints.length - 1; i++) {
        const distance = distanceToSegment(
          x,
          z,
          pathPoints[i].x,
          pathPoints[i].z,
          pathPoints[i + 1].x,
          pathPoints[i + 1].z
        );

        shortestDistance = Math.min(shortestDistance, distance);
      }

      if (shortestDistance >= RAVINE_WIDTH) continue;

      // The center erodes fastest; the edges erode more gently.
      const falloff = 1 - shortestDistance / RAVINE_WIDTH;
      const weight = falloff * falloff;

      const index = z * SIZE_X + x;
      const erosionAmount = RAVINE_SPEED * deltaSeconds * weight;

      const stoneHeight = terrain.stoneHeights[index];
      const surfaceHeight = terrain.surfaceHeights[index];

      // First remove the green surface coating.
      const coatingThickness = Math.max(
        0,
        surfaceHeight - stoneHeight
      );

      if (coatingThickness > 0) {
        const surfaceDrop = Math.min(
          coatingThickness,
          erosionAmount
        );

        terrain.surfaceHeights[index] -= surfaceDrop;

        // If the coating was exhausted, any remaining erosion
        // starts lowering the exposed stone.
        const remainingErosion = erosionAmount - surfaceDrop;

        if (remainingErosion > 0) {
          const stoneDrop = Math.min(
            remainingErosion,
            Math.max(0, stoneHeight - TERRAIN_BOTTOM)
          );

          terrain.stoneHeights[index] -= stoneDrop;
          terrain.surfaceHeights[index] -= stoneDrop;
        }
      } else {
        // No coating remains: erode the stone and its exposed top.
        const stoneDrop = Math.min(
          erosionAmount,
          Math.max(0, stoneHeight - TERRAIN_BOTTOM)
        );

        terrain.stoneHeights[index] -= stoneDrop;
        terrain.surfaceHeights[index] -= stoneDrop;
      }

      if (
        terrain.stoneHeights[index] !== stoneHeight ||
        terrain.surfaceHeights[index] !== surfaceHeight
      ) {
        terrainChanged = true;
        changedVertices++;
      }
    }
  }

  if (terrainChanged) {
    console.log('Ravine erosion changed vertices:', changedVertices);
    visualizer.rebuild(terrain);
  } else {
    console.log('Ravine erosion: no terrain changes');
  }
};

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let hoveredPoint: TerrainPoint | null = null;
    let dragging = false;
    let lastPointerY = 0;

    const getTerrainPoint = (
      event: PointerEvent
    ): TerrainPoint | null => {
      const rect = renderer.domElement.getBoundingClientRect();

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const surfaceMesh = visualizer.getSurfaceMesh();
      if (!surfaceMesh) return null;

      const intersections = raycaster.intersectObject(surfaceMesh, false);
      const hit = intersections[0];

      if (!hit) return null;

      // Find the grid vertex nearest to the cursor in the X/Z plane.
      const gridX = hit.point.x + (SIZE_X - 1) / 2;
      const gridZ = hit.point.z + (SIZE_Z - 1) / 2;

      const x = THREE.MathUtils.clamp(
        Math.round(gridX), 0, SIZE_X - 1
      );

      const z = THREE.MathUtils.clamp(
        Math.round(gridZ), 0, SIZE_Z - 1
      );

      return {
        x,
        z,
        index: z * SIZE_X + x,
      };
    };

    const moveHighlight = (point: TerrainPoint) => {
      highlight.position.set(
        point.x - (SIZE_X - 1) / 2,
        terrain.surfaceHeights[point.index] + 0.12,
        point.z - (SIZE_Z - 1) / 2
      );

      highlight.visible = true;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pinchEnabledRef.current) {
        highlight.visible = false;
        hoveredPoint = null;
        renderer.domElement.style.cursor = 'default';
        return;
      }

      if (dragging && hoveredPoint) {
        // Dragging upward raises the terrain; downward lowers it.
        const deltaPixels = lastPointerY - event.clientY;
        lastPointerY = event.clientY;

        const distance = camera.position.distanceTo(controls.target);
        const visibleWorldHeight =
          2 *
          distance *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

        const heightChange =
          deltaPixels * visibleWorldHeight / container.clientHeight;

        if (Math.abs(heightChange) > 0.0001) {
          const centerX = hoveredPoint.x;
          const centerZ = hoveredPoint.z;
          const radius = 4;

          for (
            let z = Math.max(0, centerZ - radius);
            z <= Math.min(SIZE_Z - 1, centerZ + radius);
            z++
          ) {
            for (
              let x = Math.max(0, centerX - radius);
              x <= Math.min(SIZE_X - 1, centerX + radius);
              x++
            ) {
              const dx = x - centerX;
              const dz = z - centerZ;
              const gridDistance = Math.sqrt(dx * dx + dz * dz);

              if (gridDistance > radius) continue;

              // Each grid step away receives roughly one-third
              // of the displacement of the previous step.
              const weight = Math.pow(1 / 3, gridDistance);
              const index = z * SIZE_X + x;

              // Apply the same offset to both layers.
              // Clamping preserves a valid foundation and coating.
              const minChange = Math.max(
                0.1 - terrain.stoneHeights[index],
                0.1 - terrain.surfaceHeights[index]
              );

              const maxChange = Math.min(
                SIZE_Y - 0.1 - terrain.stoneHeights[index],
                SIZE_Y - 0.1 - terrain.surfaceHeights[index]
              );

              const change = THREE.MathUtils.clamp(
                heightChange * weight,
                minChange,
                maxChange
              );

              terrain.stoneHeights[index] += change;
              terrain.surfaceHeights[index] += change;
            }
          }

          // Rebuild the meshes from the modified height maps.
          visualizer.rebuild(terrain);
        }

        moveHighlight(hoveredPoint);
        renderer.domElement.style.cursor = 'ns-resize';
        return;
      }

      hoveredPoint = getTerrainPoint(event);

      if (hoveredPoint) {
        moveHighlight(hoveredPoint);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        highlight.visible = false;
        renderer.domElement.style.cursor = 'crosshair';
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      // Ravine mode: add points instead of starting Pinch.
      if (ravineModeRef.current) {
        if (ravineRunningRef.current) return;

        const point = getTerrainPoint(event);
        if (!point) return;

        // Avoid selecting the same point twice.
        const alreadySelected = ravinePointsRef.current.some(
          (selected) => selected.index === point.index
        );

        if (alreadySelected) return;

        ravinePointsRef.current.push(point);

        updateRavineVisuals();

        setSelectedRavinePoints([...ravinePointsRef.current]);

        event.preventDefault();
        event.stopImmediatePropagation();

        return;
      }

      // Existing Pinch behavior.
      if (!pinchEnabledRef.current || !hoveredPoint) return;

      dragging = true;
      lastPointerY = event.clientY;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = 'ns-resize';
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const finishDragging = (event: PointerEvent) => {
      if (!dragging) return;

      dragging = false;
      controls.enabled = true;

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerLeave = () => {
      if (!dragging) {
        highlight.visible = false;
        hoveredPoint = null;
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('pointerup', finishDragging);
    renderer.domElement.addEventListener('pointercancel', finishDragging);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    let lastFrameTime: number | null = null;
    let erosionAccumulator = 0;

    renderer.setAnimationLoop((time) => {
      controls.update();

      if (
        ravineRunningRef.current &&
        ravinePointsRef.current.length >= 2
      ) {
        if (lastFrameTime === null) {
          lastFrameTime = time;
        }

        const deltaSeconds = Math.min(
          (time - lastFrameTime) / 1000,
          0.1
        );

        lastFrameTime = time;
        erosionAccumulator += deltaSeconds;

        if (erosionAccumulator >= RAVINE_INTERVAL / 1000) {
          erodeRavine(erosionAccumulator);
          erosionAccumulator = 0;
        }
      } else {
        lastFrameTime = null;
        erosionAccumulator = 0;
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('pointerup', finishDragging);
      renderer.domElement.removeEventListener('pointercancel', finishDragging);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);

      controls.dispose();
      visualizer.dispose();

      scene.remove(highlight);
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
      highlightRef.current = null;

      regenerateRef.current = null;

      for (const marker of ravineMarkers) {
        scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
      }

      scene.remove(ravineLine);
      ravineLine.geometry.dispose();
      (ravineLine.material as THREE.Material).dispose();

      ravineMarkersRef.current = [];
      ravineLineRef.current = null;
      ravinePointsRef.current = [];
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    ravineRunningRef.current = ravineRunning;
  }, [ravineRunning]);

  const togglePinch = () => {
    const next = !pinchEnabledRef.current;
    pinchEnabledRef.current = next;
    setPinchEnabled(next);

    if (!next && highlightRef.current) {
      highlightRef.current.visible = false;
    }
  };

  return (
    <div className="terrain-viewport">
      <div ref={containerRef} className="terrain-scene" />

      <div className="terrain-tools">
        <button
          className="regenerate-button"
          onClick={() => regenerateRef.current?.()}
        >
          Regenerate terrain
        </button>

        <button
          className="regenerate-button"
          onClick={openRavine}
        >
          Ravine
        </button>

        <button
          className={`regenerate-button ${pinchEnabled ? 'active' : ''}`}
          onClick={togglePinch}
          aria-pressed={pinchEnabled}
        >
          {pinchEnabled ? 'Pinch: ON' : 'Pinch'}
        </button>
      </div>

      {ravineOpen && (
  <div className="ravine-panel">
    <h3>Ravine tool</h3>

    <div className="ravine-buttons">
      <button
        className="ravine-start"
        onClick={() => {
          ravineRunningRef.current = true;
          setRavineRunning(true);
        }}
        disabled={ravineRunning || selectedRavinePoints.length < 2}
      >
        Start
      </button>

      <button
        onClick={() => {
          ravineRunningRef.current = false;
          setRavineRunning(false);
        }}
        disabled={!ravineRunning}
      >
        Stop
      </button>

      <button
        onClick={() => {
          ravinePointsRef.current = [];
          setSelectedRavinePoints([]);

          for (const marker of ravineMarkersRef.current) {
            marker.visible = false;
          }

          if (ravineLineRef.current) {
            ravineLineRef.current.visible = false;
          }
        }}
      >
        Deselect
      </button>

      <button onClick={closeRavine}>
        Close
      </button>
    </div>

    <p>
      {ravineRunning
        ? 'Erosion running...'
        : `Selected points: ${selectedRavinePoints.length}`}
    </p>
  </div>
)}
    </div>
  );
}
