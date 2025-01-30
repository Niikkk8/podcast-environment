import { Environment, OrbitControls, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { AvatarMan } from './AvatarMan';
import { AvatarWoman } from './AvatarWoman';

export const Experience = () => {
  const texture = useTexture("/textures/podcast-interior.jpg");
  const viewport = useThree((state) => state.viewport);

  return (
    <>
      <OrbitControls />
      <AvatarWoman position={[-1.4, -2.75, 3.5]} scale={2} />
      <AvatarMan position={[1.4, -2.75, 3.5]} scale={2} />
      <Environment preset="sunset" />
      <mesh>
        <planeGeometry args={[viewport.width, viewport.height]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </>
  );
};