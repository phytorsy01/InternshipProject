import * as THREE from "three";
import { FBXLoader } from "jsm/loaders/FBXLoader.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.set(0, 5, 15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(w, h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 10, 0);
controls.update();

const manager = new THREE.LoadingManager();
const loader = new FBXLoader(manager);
const textureLoader = new THREE.TextureLoader();
const path = "./assets/ninja-model.fbx";
let character;
const sceneData = {
  character: null,
  animations: [],
};
loader.load(path, (fbx) => {
  function initCharacter(fbx) {
    const char = fbx;
    char.scale.setScalar(0.12);
    char.position.set(0, -1, 0);
    char.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
      }
    });
    const mixer = new THREE.AnimationMixer(char);
    char.userData = { mixer };
    return char;
  }

  character = initCharacter(fbx);
  sceneData.character = character;
});

const animations = [
  "Idle",
  "NeutralIdle",
  "NinjaIdle1",
  "NinjaIdle2",
  "NinjaIdle3",
  "NinjaIdle4",
  "Run",
  "SneakWalk",
  "Crouch",
  "StandardWalk",
  "Waving",
];
const apath = "./assets/animations/";
manager.onLoad = () => initScene(sceneData);
animations.forEach((name) => {
  const filePath = `${apath}${name}.fbx`;
  loader.load(filePath, (fbx) => {
    let anim = fbx.animations[0];
    anim.name = name;
    sceneData.animations.push(anim);
  });
});

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
  c: false,
  space: false,
};

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === " ") {
    keys.space = true;
  }
  if (keys[key] !== undefined) {
    keys[key] = true;
  }
});

document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === " ") {
    keys.space = false;
  }
  if (keys[key] !== undefined) {
    keys[key] = false;
  }
});

class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;

    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
}

class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

  _Init() {
    this._AddState("Idle", IdleState);
    this._AddState("StandardWalk", WalkState);
    this._AddState("Run", RunState);
    this._AddState("Waving", WavingState);
    this._AddState("Crouch", CrouchState);
    this._AddState("SneakWalk", SneakWalkState);
  }
}

class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
}

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "Idle";
  }

  Enter(prevState) {
    this._parent._proxy.character.position.y = this._parent._proxy.initialY;
    const idleAction = this._parent._proxy.actions["Idle"];
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {}

  Update(_, input) {
    if (input.w) {
      this._parent.SetState("StandardWalk");
    } else if (input.s) {
      this._parent.SetState("SneakWalk");
    } else if (input.space) {
      this._parent.SetState("Waving");
    } else if (input.c) {
      this._parent.SetState("Crouch");
    }
  }
}

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "StandardWalk";
  }

  Enter(prevState) {
    this._parent._proxy.character.position.y = 0;
    const curAction = this._parent._proxy.actions["StandardWalk"];
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      curAction.enabled = true;
      if (prevState.Name == "Run") {
        const ratio =
          curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {}

  Update(_, input) {
    if (input.w) {
      if (input.shift) {
        this._parent.SetState("Run");
      }
      return;
    }
    this._parent.SetState("Idle");
  }
}

class SneakWalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "SneakWalk";
  }

  Enter(prevState) {
    const curAction = this._parent._proxy.actions["SneakWalk"];
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      curAction.enabled = true;
      curAction.time = 0.0;
      curAction.setEffectiveTimeScale(1.0);
      curAction.setEffectiveWeight(1.0);
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {}

  Update(_, input) {
    if (input.s) {
      return;
    }
    this._parent.SetState("Idle");
  }
}

class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "Run";
  }

  Enter(prevState) {
    this._parent._proxy.character.position.y = 0;
    const curAction = this._parent._proxy.actions["Run"];
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      curAction.enabled = true;
      if (prevState.Name == "StandardWalk") {
        const ratio =
          curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {}

  Update(_, input) {
    if (input.w && input.shift) {
      return;
    }
    this._parent.SetState("StandardWalk");
  }
}

class WavingState extends State {
  constructor(parent) {
    super(parent);
    this._finishedCallback = () => {
      this._Finished();
    };
  }

  get Name() {
    return "Waving";
  }

  Enter(prevState) {
    const curAction = this._parent._proxy.actions["Waving"];
    const mixer = curAction.getMixer();
    mixer.addEventListener("finished", this._finishedCallback);
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      curAction.reset();
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState("Idle");
  }

  _Cleanup() {
    const action = this._parent._proxy.actions["Waving"];
    action.getMixer().removeEventListener("finished", this._finishedCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(_, input) {
    if (!input.space) {
      this._parent.SetState("Idle");
    }
  }
}

class CrouchState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return "Crouch";
  }

  Enter(prevState) {
    this._parent._proxy.character.position.y = 0;
    const curAction = this._parent._proxy.actions["Crouch"];
    if (prevState) {
      const prevAction = this._parent._proxy.actions[prevState.Name];
      curAction.enabled = true;
      curAction.time = 0.0;
      curAction.setEffectiveTimeScale(1.0);
      curAction.setEffectiveWeight(1.0);
      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {}

  Update(_, input) {
    if (input.c) {
      return;
    }
    this._parent.SetState("Idle");
  }
}

class CharacterControllerProxy {
  constructor(animations, character, initialY) {
    this.actions = animations;
    this.character = character;
    this.initialY = initialY;
  }
}

class CharacterController {
  constructor(character, animations) {
    this.character = character;
    this.mixer = character.userData.mixer;
    this.actions = {};
    this.moveSpeed = 0.2;
    this.runSpeed = 0.35;
    this.initialY = character.position.y;

    animations.forEach((anim) => {
      this.actions[anim.name] = this.mixer.clipAction(anim);
    });

    this._stateMachine = new CharacterFSM(
      new CharacterControllerProxy(this.actions, this.character, this.initialY)
    );
    this._stateMachine.SetState("Idle");
  }

  update(timeElapsedS) {
    let speed = 0;
    if (keys.w) {
      speed = keys.shift ? this.runSpeed : this.moveSpeed;
    } else if (keys.s) {
      speed = -this.moveSpeed;
    }

    if (keys.a) {
      this.character.rotation.y += 4.0 * Math.PI * timeElapsedS;
    }
    if (keys.d) {
      this.character.rotation.y -= 4.0 * Math.PI * timeElapsedS;
    }

    if (speed !== 0) {
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.character.quaternion);
      forward.normalize();
      forward.multiplyScalar(speed * timeElapsedS * 100);
      this.character.position.add(forward);
    }

    this._stateMachine.Update(timeElapsedS, keys);
    this.mixer.update(timeElapsedS);
  }
}

function setupActions(character, animations) {
  return new CharacterController(character, animations);
}

function initScene(sceneData) {
  const { character, animations } = sceneData;
  const controller = setupActions(character, animations);
  scene.add(character);

  const grassTexture = textureLoader.load(
    "https://threejs.org/examples/textures/terrain/grasslight-big.jpg"
  );
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(100, 100);

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500, 10, 10),
    new THREE.MeshStandardMaterial({
      map: grassTexture,
    })
  );
  plane.castShadow = false;
  plane.receiveShadow = true;
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  const loader = new THREE.CubeTextureLoader();
  const texture = loader.load([
    "./assets/posx.jpg",
    "./assets/negx.jpg",
    "./assets/posy.jpg",
    "./assets/negy.jpg",
    "./assets/posz.jpg",
    "./assets/negz.jpg",
  ]);
  texture.encoding = THREE.sRGBEncoding;
  scene.background = texture;

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  sunLight.position.set(-100, 100, 100);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.bias = -0.001;
  sunLight.shadow.mapSize.width = 4096;
  sunLight.shadow.mapSize.height = 4096;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 500.0;
  sunLight.shadow.camera.left = 50;
  sunLight.shadow.camera.right = -50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  scene.add(sunLight);

  let timeElapsed = 0;
  function animate(t = 0) {
    const timeElapsedS = (t - timeElapsed) * 0.001;
    requestAnimationFrame(animate);

    controller.update(timeElapsedS);

    

    renderer.render(scene, camera);
    controls.update();
    timeElapsed = t;
  }
  animate();

  function handleWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", handleWindowResize, false);
}
