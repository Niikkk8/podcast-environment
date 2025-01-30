import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { AnimationProvider } from "./context/AnimationContext";
import { AnimationControls } from "./components/AnimationControls";

function App() {
  return (
    <AnimationProvider>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas shadows camera={{ position: [0, 0, 8], fov: 42 }}>
          <color attach="background" args={["#ececec"]} />
          <Experience />
        </Canvas>
        <AnimationControls />
      </div>
    </AnimationProvider>
  );
}

export default App;
