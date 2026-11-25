import * as THREE from 'three';
import { canvasMaterial, piece } from './art.js';

// Bounds in the original transparent 1280 × 720 images from the official
// Rilakkuma anime site. The same pixels and linework are used in the game.
const poses = {
  run: { file: 'rilakkuma-run.png', bounds: [403, 59, 877, 660], height: 2.08 },
  wave: { file: 'rilakkuma-wave.png', bounds: [386, 0, 895, 720], height: 2.10 },
  slide: { file: 'rilakkuma-slide.png', bounds: [229, 106, 1052, 615], height: .94 },
};

async function makePose(loader, { file, bounds, height }) {
  const texture = await loader.loadAsync(new URL(`../assets/${file}`, import.meta.url).href);
  const [left, top, right, bottom] = bounds;
  const { width: imageWidth, height: imageHeight } = texture.image;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.offset.set(left / imageWidth, 1 - bottom / imageHeight);
  texture.repeat.set((right - left) / imageWidth, (bottom - top) / imageHeight);
  texture.anisotropy = 4;
  const width = height * (right - left) / (bottom - top);
  const geometry = new THREE.PlaneGeometry(width, height, 18, 24);
  geometry.translate(0, height / 2, 0);
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: .015, depthWrite: false, toneMapped: false, fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

export async function makeRunner(scene) {
  const root = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const [run, wave, slide] = await Promise.all(Object.values(poses).map((pose) => makePose(loader, pose)));
  const feet = run.geometry.attributes.position;
  const rest = feet.array.slice();
  root.add(run, wave, slide);
  scene.add(root);
  const shadowTexture = canvasMaterial(96, 96, (context) => {
    const gradient = context.createRadialGradient(48, 48, 4, 48, 48, 46);
    gradient.addColorStop(0, 'rgba(69,35,30,.43)');
    gradient.addColorStop(.6, 'rgba(69,35,30,.24)');
    gradient.addColorStop(1, 'rgba(69,35,30,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const shadow = piece(scene, new THREE.PlaneGeometry(1.75, 1.18).rotateX(-Math.PI / 2), shadowTexture, 0, .027, 0, 1, 1, 1, false);
  const lean = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);

  return {
    draw(camera, { x, y, z, scale, time, stride, mode, turn, crash, reduced }) {
      run.visible = mode === 'run';
      wave.visible = mode === 'wave';
      slide.visible = mode === 'slide' || mode === 'crash';
      slide.scale.x = mode === 'crash' ? 1.12 : 1;
      const bounce = reduced ? 0 : mode === 'run' ? Math.abs(Math.sin(stride)) * .09 : mode === 'wave' ? Math.sin(time * 2) * .045 : 0;
      const tilt = mode === 'run' ? -turn * .15 + Math.cos(stride) * .042 : mode === 'crash' ? -.10 * crash : mode === 'slide' ? .08 : 0;
      root.position.set(x, y + Math.max(0, bounce), z);
      root.scale.setScalar(scale);
      root.quaternion.copy(camera.quaternion).multiply(lean.setFromAxisAngle(axis, reduced ? 0 : tilt));
      if (run.visible) {
        // Give each foot its own stride while leaving the official face and
        // upper silhouette intact. The deformation is limited to the feet.
        for (let i = 0; i < feet.count; i++) {
          const offset = i * 3;
          const baseX = rest[offset];
          const baseY = rest[offset + 1];
          const weight = Math.max(0, 1 - baseY / .56) ** 1.3;
          const direction = baseX >= 0 ? 1 : -1;
          const swing = reduced ? 0 : direction * Math.sin(stride);
          feet.setXY(i, baseX + weight * swing * .055, baseY + weight * (.10 + swing * .09));
        }
        feet.needsUpdate = true;
      }
      shadow.position.set(x, .027, z);
      shadow.scale.setScalar(scale * (1 + y * .13));
      shadow.material.opacity = 1 - Math.min(.58, y * .24);
    },
  };
}
