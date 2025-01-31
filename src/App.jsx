import { PodcastProvider } from './context/PodcastContext';
import { PodcastControls } from './components/PodcastControls';
import { AnimationProvider } from './context/AnimationContext';
import { Canvas } from '@react-three/fiber';
import { Experience } from './components/Experience';
import { AnimationControls } from './components/AnimationControls';

function App() {
  return (
    <AnimationProvider>
      <PodcastProvider>
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
          <Canvas shadows camera={{ position: [0, 0, 8], fov: 42 }}>
            <color attach="background" args={["#ececec"]} />
            <Experience />
          </Canvas>
          <AnimationControls />
          <PodcastControls />
        </div>
      </PodcastProvider>
    </AnimationProvider>
  );
}

export default App;
