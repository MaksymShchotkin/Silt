
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GridVisualizer } from '../terrain/GridVisualizer';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

const SIZE_X = 20;
const SIZE_Y = 10;
const SIZE_Z = 20;

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

  const [pinchEnabled, setPinchEnabled] = useState(false);

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

    const regenerate = () => {
      terrain = generator.generate(SIZE_X, SIZE_Y, SIZE_Z);
      visualizer.rebuild(terrain);
      highlight.visible = false;
    };

    regenerateRef.current = regenerate;

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
      if (!pinchEnabledRef.current || !hoveredPoint) return;

      dragging = true;
      lastPointerY = event.clientY;

      // Prevent OrbitControls from treating this as a camera drag.
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

    renderer.setAnimationLoop(() => {
      controls.update();
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
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

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
          className={`regenerate-button ${pinchEnabled ? 'active' : ''}`}
          onClick={togglePinch}
          aria-pressed={pinchEnabled}
        >
          {pinchEnabled ? 'Pinch: ON' : 'Pinch'}
        </button>
      </div>
    </div>
  );
}
