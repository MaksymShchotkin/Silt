import { useCallback, useRef, useState } from 'react';

import type { TerrainBiome } from '../terrain/TerrainData';
import type { TerrainPoint } from '../terrain/TerrainPoint';
import TerrainViewport from './TerrainViewport';

export default function TerrainScene() {
  const regenerateRef = useRef<((biome: TerrainBiome) => void) | null>(null);
  const clearRavineRef = useRef<(() => void) | null>(null);

  const [biomePickerOpen, setBiomePickerOpen] = useState(false);
  const [pinchEnabled, setPinchEnabled] = useState(false);
  const [ravineOpen, setRavineOpen] = useState(false);
  const [ravineRunning, setRavineRunning] = useState(false);
  const [selectedRavinePoints, setSelectedRavinePoints] = useState<
    TerrainPoint[]
  >([]);

  const setRegenerate = useCallback(
    (regenerate: ((biome: TerrainBiome) => void) | null) => {
      regenerateRef.current = regenerate;
    },
    []
  );

  const setClearRavine = useCallback((clear: (() => void) | null) => {
    clearRavineRef.current = clear;
  }, []);

  const openRavine = () => {
    setPinchEnabled(false);
    setRavineOpen(true);
  };

  const closeRavine = () => {
    setRavineRunning(false);
    setRavineOpen(false);
    clearRavineRef.current?.();
  };

  const togglePinch = () => {
    setPinchEnabled((enabled) => !enabled);
  };

  const regenerate = (biome: TerrainBiome) => {
    regenerateRef.current?.(biome);
    setBiomePickerOpen(false);
  };

  return (
    <div className="terrain-viewport">
      <TerrainViewport
        pinchEnabled={pinchEnabled}
        ravineMode={ravineOpen}
        ravineRunning={ravineRunning}
        onRavinePointsChange={setSelectedRavinePoints}
        onRegenerateReady={setRegenerate}
        onClearRavineReady={setClearRavine}
      />

      <div className="terrain-tools">
        <button
          className="regenerate-button"
          onClick={() => setBiomePickerOpen(true)}
          aria-expanded={biomePickerOpen}
          aria-controls="biome-picker"
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

      {biomePickerOpen && (
        <div
          id="biome-picker"
          className="biome-panel"
          role="dialog"
          aria-labelledby="biome-panel-title"
        >
          <h3 id="biome-panel-title">Choose a biome</h3>
          <div className="biome-options">
            <button
              className="biome-choice hills"
              onClick={() => regenerate('hills')}
            >
              Hills
            </button>
            <button
              className="biome-choice desert"
              onClick={() => regenerate('desert')}
            >
              Desert
            </button>
          </div>
          <button
            className="biome-cancel"
            onClick={() => setBiomePickerOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {ravineOpen && (
        <div className="ravine-panel">
          <h3>Ravine tool</h3>

          <div className="ravine-buttons">
            <button
              className="ravine-start"
              onClick={() => setRavineRunning(true)}
              disabled={ravineRunning || selectedRavinePoints.length < 2}
            >
              Start
            </button>

            <button
              onClick={() => setRavineRunning(false)}
              disabled={!ravineRunning}
            >
              Stop
            </button>

            <button onClick={() => clearRavineRef.current?.()}>
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
