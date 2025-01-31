import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AvatarMan } from "./AvatarMan";
import { AvatarWoman } from "./AvatarWoman";

export const Experience = () => {
  const texture = useTexture("/textures/podcast-interior.jpg");
  const viewport = useThree((state) => state.viewport);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2, 8); // Fixed camera position
    camera.lookAt(0, 0, 0); // Lock focus
  }, [camera]);

  return (
    <>
      
      {/* Characters */}
      <AvatarWoman position={[-1.5, -1.8, 4]} scale={2} />
      <AvatarMan position={[1.5, -1.8, 4]} scale={2} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />

      {/* Background Plane */}
      <mesh position={[0, 0, 1]}>
        <planeGeometry args={[viewport.width, viewport.height]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </>
  );
};
