
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GridVisualizer } from '../terrain/GridVisualizer';
import { TerrainGenerator } from '../terrain/TerrainGenerator';

export default function TerrainScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const regenerateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    

    // Create the 3D world.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171b22');

    // Set up the camera.
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    camera.position.set(15, 12, 18);

    // Create the renderer.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    // Allow the user to orbit around the scene.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.update();

    // Lighting.
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // Terrain generation
    const generator = new TerrainGenerator();
    const visualizer = new GridVisualizer(scene);

    const regenerate = () => {
        const matrix = generator.generate(20, 10, 20);
        visualizer.rebuild(matrix);
    };

    // Let the button trigger regeneration.
    regenerateRef.current = regenerate;

    // Generate the initial terrain.
    regenerate();

    // // Convert the matrix into a 3D visualization.
    // const visualizer = new GridVisualizer(scene);
    // visualizer.rebuild(matrix);


    // Reference grid.
    const grid = new THREE.GridHelper(20, 20, 0x8b9bb4, 0x394352);
    grid.position.y = -0.5;
    scene.add(grid);

    // Coordinate axes: X, Y, Z.
    const axes = new THREE.AxesHelper(3);
    scene.add(axes);

    // Keep the canvas responsive.
    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    // Render continuously.
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    // Clean up when React removes the component.
    return () => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    controls.dispose();

    visualizer.dispose();

    regenerateRef.current = null;

    renderer.dispose();
    renderer.domElement.remove();
    };
  }, []);

  return (
  <div className="terrain-viewport">
    <div ref={containerRef} className="terrain-scene" />

    <button
      className="regenerate-button"
      onClick={() => regenerateRef.current?.()}
    >
      Regenerate terrain
    </button>
  </div>
);
}
