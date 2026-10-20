
import TerrainScene from './components/TerrainScene';
import './App.css';

function App() {
  return (
    <main className="silt-app">
      <header className="silt-header">
        <h1>SILT</h1>
        <span>Terrain Simulator</span>
      </header>

      <section className="viewport">
        <TerrainScene />
      </section>

      <footer className="silt-footer">
        <span>3D Viewport</span>
        <span>Scene initialized</span>
      </footer>
    </main>
  );
}

export default App;
