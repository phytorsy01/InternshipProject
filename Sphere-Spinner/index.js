import * as THREE from "three";
import { GUI } from "lil-gui";
import { OrbitControls } from "jsm/controls/OrbitControls.js";

class ColorGUIHelper {
  constructor(object, prop) {
    this.object = object;
    this.prop = prop;
  }
  get value() {
    return `#${this.object[this.prop].getHexString()}`;
  }
  set value(hexString) {
    this.object[this.prop].set(hexString);
  }
}

const w = window.innerWidth;
const h = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const fov = 75;
const aspect = w / h;
const near = 0.1;
const far = 10;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 2;
const scene = new THREE.Scene();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;

const geo = new THREE.IcosahedronGeometry(1.0, 2);
const mat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  flatShading: true,
});
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

const wireMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
});
const wireMesh = new THREE.Mesh(geo, wireMat);
wireMesh.scale.setScalar(1.001);
mesh.add(wireMesh);

const hemiLight = new THREE.HemisphereLight(0x0099ff, 0xaa5500);
scene.add(hemiLight);

const color = 0xffffff;
const intensity = 1;
const light = new THREE.DirectionalLight(color, intensity);
light.position.set(0, 10, 0);
light.target.position.set(-5, 0, 0);
scene.add(light);
scene.add(light.target);

const gui = new GUI();
gui.addColor(new ColorGUIHelper(light, "color"), "value").name("color");
gui.addColor(new ColorGUIHelper(hemiLight, "color"), "value").name("skyColor");
gui
  .addColor(new ColorGUIHelper(hemiLight, "groundColor"), "value")
  .name("groundColor");
gui.add(light, "intensity", 0, 5, 0.01);
gui.add(light.target.position, "x", -10, 10);
gui.add(light.target.position, "z", -10, 10);
gui.add(light.target.position, "y", 0, 10);

let rotationSpeed = 0.0001;

const rotationControls = {
  speed: rotationSpeed,
};

gui.add(rotationControls, "speed", -0.01, 0.01).name("Rotation Speed").onChange((value) => {
    rotationSpeed = value;
  });

function animate(t = 0) {
  requestAnimationFrame(animate);
  mesh.rotation.y = t * rotationSpeed;
  renderer.render(scene, camera);
  controls.update();
}
animate();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", handleWindowResize, false);
