import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GridVisualizer } from '../terrain/GridVisualizer';
import type { TerrainBiome } from '../terrain/TerrainData';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import type { TerrainPoint } from '../terrain/TerrainPoint';
import { PinchTool } from '../terrain/tools/PinchTool';
import { RavineTool } from '../terrain/tools/RavineTool';

const SIZE_X = 20;
const SIZE_Y = 10;
const SIZE_Z = 20;
const RAVINE_INTERVAL = 50;

type TerrainViewportProps = {
  pinchEnabled: boolean;
  ravineMode: boolean;
  ravineRunning: boolean;
  onRavinePointsChange: (points: TerrainPoint[]) => void;
  onRegenerateReady: (
    regenerate: ((biome: TerrainBiome) => void) | null
  ) => void;
  onClearRavineReady: (clearRavine: (() => void) | null) => void;
};

export default function TerrainViewport({
  pinchEnabled,
  ravineMode,
  ravineRunning,
  onRavinePointsChange,
  onRegenerateReady,
  onClearRavineReady,
}: TerrainViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchToolRef = useRef<PinchTool | null>(null);
  const propsRef = useRef({
    pinchEnabled,
    ravineMode,
    ravineRunning,
    onRavinePointsChange,
    onRegenerateReady,
    onClearRavineReady,
  });

  useLayoutEffect(() => {
    propsRef.current = {
      pinchEnabled,
      ravineMode,
      ravineRunning,
      onRavinePointsChange,
      onRegenerateReady,
      onClearRavineReady,
    };
  }, [
    pinchEnabled,
    ravineMode,
    ravineRunning,
    onRavinePointsChange,
    onRegenerateReady,
    onClearRavineReady,
  ]);

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
    scene.add(new THREE.AxesHelper(3));

    const generator = new TerrainGenerator();
    const visualizer = new GridVisualizer(scene);
    let terrain = generator.generate(SIZE_X, SIZE_Y, SIZE_Z);
    visualizer.rebuild(terrain);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getTerrainPoint = (event: PointerEvent): TerrainPoint | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const topMeshes = visualizer.getTopMeshes();
      if (topMeshes.length === 0) return null;

      const hit = raycaster.intersectObjects(topMeshes, false)[0];
      if (!hit) return null;

      const gridX = hit.point.x + (SIZE_X - 1) / 2;
      const gridZ = hit.point.z + (SIZE_Z - 1) / 2;
      const x = THREE.MathUtils.clamp(Math.round(gridX), 0, SIZE_X - 1);
      const z = THREE.MathUtils.clamp(Math.round(gridZ), 0, SIZE_Z - 1);

      return { x, z, index: z * SIZE_X + x };
    };

    const pinchTool = new PinchTool({
      scene,
      camera,
      renderer,
      controls,
      visualizer,
      getTerrain: () => terrain,
      getTerrainPoint,
      isEnabled: () => propsRef.current.pinchEnabled,
      getViewportHeight: () => container.clientHeight,
    });
    pinchToolRef.current = pinchTool;

    const ravineTool = new RavineTool({
      scene,
      visualizer,
      getTerrain: () => terrain,
      onPointsChange: (points) => propsRef.current.onRavinePointsChange(points),
    });

    const regenerate = (biome: TerrainBiome) => {
      terrain = generator.generate(SIZE_X, SIZE_Y, SIZE_Z, biome);
      visualizer.rebuild(terrain);
      pinchTool.hideHighlight();
    };
    const clearRavine = () => ravineTool.clear();
    propsRef.current.onRegenerateReady(regenerate);
    propsRef.current.onClearRavineReady(clearRavine);

    const onPointerDown = (event: PointerEvent) => {
      if (propsRef.current.ravineMode) {
        if (propsRef.current.ravineRunning) return;

        const point = getTerrainPoint(event);
        if (!point) return;

        if (ravineTool.addPoint(point)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }

      pinchTool.onPointerDown(event);
    };

    renderer.domElement.addEventListener('pointermove', pinchTool.onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('pointerup', pinchTool.onPointerUp);
    renderer.domElement.addEventListener('pointercancel', pinchTool.onPointerUp);
    renderer.domElement.addEventListener('pointerleave', pinchTool.onPointerLeave);

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
        propsRef.current.ravineRunning &&
        ravineTool.selectedPoints.length >= 2
      ) {
        if (lastFrameTime === null) lastFrameTime = time;

        const deltaSeconds = Math.min((time - lastFrameTime) / 1000, 0.1);
        lastFrameTime = time;
        erosionAccumulator += deltaSeconds;

        if (erosionAccumulator >= RAVINE_INTERVAL / 1000) {
          ravineTool.erode(erosionAccumulator);
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
      renderer.domElement.removeEventListener('pointermove', pinchTool.onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('pointerup', pinchTool.onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', pinchTool.onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', pinchTool.onPointerLeave);

      controls.dispose();
      visualizer.dispose();
      pinchTool.dispose();
      pinchToolRef.current = null;
      ravineTool.dispose();
      propsRef.current.onRegenerateReady(null);
      propsRef.current.onClearRavineReady(null);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useLayoutEffect(() => {
    if (!pinchEnabled) {
      pinchToolRef.current?.hideHighlight();
    }
  }, [pinchEnabled]);

  return <div ref={containerRef} className="terrain-scene" />;
}
