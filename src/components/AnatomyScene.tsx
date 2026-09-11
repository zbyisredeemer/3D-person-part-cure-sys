import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createAnatomicalMaterial } from "./anatomy/surfaceMaterials";
import { isExcludedEducationalMesh } from "./anatomy/neutralPresentation";
import { organInventory } from "./anatomy/exploration";
import { inventoryOrgans } from "./anatomy/viewPresets";
import {
  anatomyAsset,
  decodeAnatomyResponse,
  INITIAL_ANATOMY_SOURCES,
} from "./anatomy/humanAtlas";
import {
  identifyOrgan,
  organColors,
  organNames,
  organSystems,
} from "./anatomy/organMapping";

export interface AnatomySceneProps {
  selectedOrgan: string;
  onSelectOrgan: (id: string) => void;
  activeSystem: string;
  skinOpacity: number;
  layers: Record<string, boolean>;
  autoRotate: boolean;
  zoom: number;
  resetKey: number;
  focusMode: boolean;
  exploded?: boolean;
  bodyFraming?: "full" | "upper";
  renderStyle?: "detailed" | "soft";
  symptom: string | null;
  showLabels: boolean;
  view: "front" | "back" | "left" | "right";
  onReady?: () => void;
}

type Tissue = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
type Label = {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  left: boolean;
  selected: boolean;
};
type Runtime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  meshes: Tissue[];
  centers: Map<string, THREE.Vector3>;
  load: (source: string) => Promise<void>;
  update: () => void;
  orient: (immediate?: boolean) => void;
};

const labelIds = [
  "brain",
  "lungs",
  "heart",
  "liver",
  "stomach",
  "small-intestine",
];
const transparentRaycast = () => undefined;

export default function AnatomyScene(props: AnatomySceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const runtime = useRef<Runtime | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [layerLoading, setLayerLoading] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    const abort = new AbortController();
    let frame = 0;
    let lastLabelUpdate = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.025, 20);
    const renderer = (() => {
      try {
        return new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        setError("当前浏览器未能启动 3D 显示，请开启硬件加速后重试。");
        return null;
      }
    })();
    if (!renderer) return;
    setError("");
    setLoaded(0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;outline:none;touch-action:none;";
    renderer.domElement.setAttribute(
      "aria-label",
      "可旋转、缩放、点击器官的三维人体解剖模型",
    );
    renderer.domElement.setAttribute("role", "img");
    el.prepend(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = true;
    controls.minDistance = 0.35;
    controls.maxDistance = 5.8;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.autoRotateSpeed = 0.65;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.target.set(0, 0.87, 0);
    camera.position.set(0.025, 0.91, 3.27);
    controls.update();
    const hemisphere = new THREE.HemisphereLight("#edf5fc", "#6a7282", 1.25);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight("#fff5ea", 2.6);
    key.position.set(-1.7, 2.8, 2.5);
    key.target.position.set(0, 1.02, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 8;
    key.shadow.camera.left = -1;
    key.shadow.camera.right = 1;
    key.shadow.camera.top = 1.1;
    key.shadow.camera.bottom = -1.1;
    key.shadow.bias = -0.00008;
    key.shadow.normalBias = 0.0014;
    scene.add(key.target);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#bed8ee", 0.9);
    fill.position.set(3, 1, -2);
    scene.add(fill);
    const front = new THREE.DirectionalLight("#ffffff", 0.28);
    front.position.set(0, 1, 4);
    scene.add(front);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 64),
      new THREE.MeshBasicMaterial({
        color: "#719db8",
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.008;
    ground.scale.set(1.4, 0.6, 1);
    scene.add(ground);
    const symptomHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.125, 0.133, 80),
      new THREE.MeshBasicMaterial({
        color: "#d68a72",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    symptomHalo.visible = false;
    symptomHalo.renderOrder = 6;
    scene.add(symptomHalo);

    const draco = new DRACOLoader();
    draco.setDecoderPath("/models/draco/");
    draco.setWorkerLimit(2);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const meshes: Tissue[] = [];
    const centers = new Map<string, THREE.Vector3>();
    const organBounds = new Map<string, THREE.Box3>();
    const offsets = new Map<string, THREE.Vector3>();
    let inventory = organInventory(organBounds, false);
    const sources = new Map<string, Promise<void>>();
    const targetPosition = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    const orbitOffset = new THREE.Vector3();
    const currentOrbit = new THREE.Spherical();
    const targetOrbit = new THREE.Spherical();
    let transitioning = false;
    let initialReady = false;
    let hoverId = "";

    function orient(immediate = false) {
      const p = latest.current;
      const upper = p.bodyFraming === "upper";
      const center = new THREE.Vector3(0, upper ? 1.265 : 0.87, 0);
      const rawZoom = p.zoom > 8 ? p.zoom / 100 : p.zoom;
      const zoom = Math.max(0.5, Math.min(3.5, rawZoom || 1));
      const field = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Fit the actual body region into the viewport, including narrow screens.
      let baseDistance =
        Math.max(
          (upper ? 1.0 : 1.79) / (2 * field * 0.87),
          (upper ? 0.53 : 0.68) / (2 * field * camera.aspect * 0.8),
        ) + 0.05;
      if (p.focusMode) {
        const bounds = new THREE.Box3();
        for (const mesh of meshes) {
          if (mesh.visible && mesh.userData.organ === p.selectedOrgan)
            bounds.union(mesh.userData.baseBounds as THREE.Box3);
        }
        if (!bounds.isEmpty()) {
          bounds.getCenter(center);
          const size = bounds.getSize(new THREE.Vector3());
          const sideView = p.view === "left" || p.view === "right";
          const width = sideView ? size.z : size.x;
          const depth = sideView ? size.x : size.z;
          const occupancy = ["bones", "muscles", "vessels", "nerves"].includes(
            p.selectedOrgan,
          )
            ? 0.76
            : 0.63;
          const fov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          baseDistance =
            Math.max(
              size.y / (2 * fov * occupancy),
              width / (2 * fov * camera.aspect * occupancy),
            ) +
            depth / 2;
          baseDistance = Math.max(0.16, baseDistance);
        } else if (centers.has(p.selectedOrgan)) {
          center.copy(centers.get(p.selectedOrgan)!);
          baseDistance = 0.6;
        }
      }
      if (p.exploded && !inventory.bounds.isEmpty()) {
        inventory.bounds.getCenter(center);
        const size = inventory.bounds.getSize(new THREE.Vector3());
        const sideView = p.view === "left" || p.view === "right";
        baseDistance =
          Math.max(
            size.y / (2 * field * 0.85),
            (sideView ? size.z : size.x) / (2 * field * camera.aspect * 0.8),
          ) +
          (sideView ? size.x : size.z) / 2;
      }
      controls.minDistance = p.focusMode ? 0.08 : 0.35;
      controls.maxDistance = p.exploded ? 18 : 5.8;
      const distance = Math.max(controls.minDistance, baseDistance / zoom);
      const angle = {
        front: 0,
        back: Math.PI,
        left: Math.PI / 2,
        right: -Math.PI / 2,
      }[p.view];
      targetLook.copy(center);
      targetPosition.set(
        center.x + Math.sin(angle) * distance,
        center.y + (p.focusMode ? 0 : 0.025),
        center.z + Math.cos(angle) * distance,
      );
      if (immediate) {
        transitioning = false;
        camera.position.copy(targetPosition);
        controls.target.copy(targetLook);
        controls.update();
      } else transitioning = true;
    }

    function update() {
      const p = latest.current;
      const detailed = p.renderStyle !== "soft";
      inventory = organInventory(organBounds, el!.clientWidth < 500);
      controls.autoRotate = p.autoRotate;
      hemisphere.intensity = detailed ? 0.8 : 1.8;
      fill.intensity = detailed ? 0.65 : 1.35;
      key.intensity = detailed ? 2.2 : 2;
      key.castShadow = detailed && !p.exploded;
      ground.visible = !p.exploded && !p.focusMode && p.bodyFraming !== "upper";
      for (const mesh of meshes) {
        const { organ, source } = mesh.userData as {
          organ: string;
          source: string;
        };
        const mat = mesh.material;
        const selected = organ === p.selectedOrgan;
        const inSystem =
          p.activeSystem === "all" || organSystems[organ] === p.activeSystem;
        const isSkin = source === "skin";
        const isBone = source === "bones" && organ !== "teeth";
        const isLayer =
          source === "muscular" ||
          source === "cardiovascular" ||
          source === "nervous";
        const requested =
          source === "muscular"
            ? p.layers.muscles
            : source === "cardiovascular"
              ? p.layers.vessels
              : source === "nervous"
                ? p.layers.nerves
                : true;
        mesh.visible = isSkin
          ? p.layers.skin !== false
          : isBone
            ? p.layers.skeleton !== false
            : isLayer
              ? !!requested
              : p.layers.organs !== false;
        // Great vessels are supplied by the vascular layer, not the isolated heart.
        if (source === "heart" && organ === "vessels") mesh.visible = false;
        if (source === "head" && organ === "nerves") mesh.visible = false;
        if (p.focusMode && !isSkin && !selected) mesh.visible = false;
        // Full cardiovascular/nervous layers supplement the central organs already loaded.
        if (source === "nervous" && organ !== "nerves") mesh.visible = false;
        if (source === "cardiovascular" && organ === "heart")
          mesh.visible = false;
        if (p.exploded)
          mesh.visible = inventoryOrgans.includes(organ) && !isLayer;
        const base = organColors[organ] || "#b3c8d5";
        mat.color.set(base);
        if (!detailed && !isSkin)
          mat.color.lerp(new THREE.Color("#c3d8de"), 0.25);
        if (
          organ === "vessels" &&
          (mesh.userData.variant === "venous" ||
            /vein|vena/.test(mesh.name.toLowerCase()))
        )
          mat.color.set("#7496b7");
        let opacity = 1;
        if (isSkin) {
          const skinOpacity =
            p.skinOpacity > 1 ? p.skinOpacity / 100 : p.skinOpacity;
          opacity = Math.max(0, Math.min(1, skinOpacity));
          mat.color.set(detailed ? "#91acb9" : "#a4bdcc");
          if (p.focusMode) opacity *= 0.12;
        } else if (isBone) {
          const y = mesh.userData.centerY as number;
          opacity =
            selected || p.activeSystem === "skeletal"
              ? 1
              : y > 1.08
                ? 0.16
                : 0.42;
        } else if (!inSystem) opacity = 0.1;
        else if (organ === "lungs" && !selected) opacity = 0.65;
        // Reduce overlying context for small/deep organs without moving their surfaces.
        if (
          !p.focusMode &&
          !selected &&
          !isSkin &&
          !isBone &&
          [
            "kidneys",
            "pancreas",
            "gallbladder",
            "ureters",
            "bladder",
            "esophagus",
          ].includes(p.selectedOrgan)
        ) {
          opacity = Math.min(opacity, 0.3);
        }
        if (p.exploded) opacity = 1;
        const wasTransparent = mat.transparent;
        mat.opacity = opacity;
        mat.transparent = opacity < 0.999;
        mat.depthWrite = opacity >= 0.95;
        mat.emissive.copy(mat.color);
        mat.emissiveIntensity = selected && !isSkin ? 0.025 : 0;
        mat.userData.selection.value = selected && !isSkin ? 1 : 0;
        // Static shadow maps update only when visibility changes, not every orbit frame.
        mesh.castShadow =
          detailed &&
          !isSkin &&
          opacity >= 0.95 &&
          (p.focusMode ? selected : !isBone && !isLayer);
        mesh.receiveShadow = detailed && !isSkin && opacity >= 0.95;
        mesh.renderOrder = isSkin ? 5 : isBone ? 1 : mat.transparent ? 3 : 2;
        if (wasTransparent !== mat.transparent) mat.needsUpdate = true;
      }
      renderer!.shadowMap.needsUpdate = true;
      const optional = [
        p.layers.muscles ? "muscular" : "",
        p.layers.vessels ? "cardiovascular" : "",
        p.layers.nerves ? "nervous" : "",
        p.layers.nerves ? "cranial" : "",
      ].filter(Boolean);
      if (optional.some((s) => !sources.has(s))) {
        setLayerLoading(true);
        Promise.all(optional.map(load))
          .then(() => {
            if (!disposed) setLayerLoading(false);
          })
          .catch(() => {
            if (!disposed) {
              setLayerLoading(false);
              setError("此图层暂未加载成功。请检查连接并重试。");
            }
          });
      }
    }

    function load(source: string): Promise<void> {
      if (sources.has(source)) return sources.get(source)!;
      const asset = anatomyAsset(source);
      const promise = fetch(asset.url, { signal: abort.signal })
        .then(decodeAnatomyResponse)
        .then((buffer) => loader.parseAsync(buffer, "/models/"))
        .then((gltf) => {
          if (disposed) {
            gltf.scene.traverse((o) => {
              if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(
                  (m) => m.dispose(),
                );
              }
            });
            return;
          }
          // Match the existing BodyParts3D skin origin; no internal mesh resculpting.
          if (asset.atlas) gltf.scene.position.z = -0.013;
          gltf.scene.updateMatrixWorld(true);
          const boxes = new Map<string, THREE.Box3>();
          const retainedSource =
            source === "lungs"
              ? "organs"
              : source === "cranial"
                ? "nervous"
                : source;
          const removed: THREE.Mesh[] = [];
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const organ = asset.atlas
              ? (object.userData.organ as string)
              : identifyOrgan(object.name, retainedSource);
            const bounds = new THREE.Box3().setFromObject(object);
            if (
              /\.g\.|systemg001|systemsg001|organsg001/i.test(object.name) ||
              isExcludedEducationalMesh(object.name, retainedSource) ||
              (source === "lungs" && organ !== "lungs") ||
              (source === "nervous" &&
                (organ !== "nerves" || bounds.min.y >= 1.535))
            ) {
              removed.push(object);
              object.geometry.dispose();
              (Array.isArray(object.material)
                ? object.material
                : [object.material]
              ).forEach((m) => m.dispose());
              return;
            }
            const oldMaterial = object.material;
            (Array.isArray(oldMaterial) ? oldMaterial : [oldMaterial]).forEach(
              (m) => m.dispose(),
            );
            if (!object.geometry.attributes.normal)
              object.geometry.computeVertexNormals();
            const material = createAnatomicalMaterial(organ, retainedSource);
            object.material = material;
            const mesh = object as Tissue;
            const box = new THREE.Box3().setFromObject(mesh);
            const center = box.getCenter(new THREE.Vector3());
            mesh.userData = {
              ...mesh.userData,
              source: retainedSource,
              organ,
              centerY: center.y,
              basePosition: mesh.position.clone(),
              baseWorldPosition: mesh.getWorldPosition(new THREE.Vector3()),
              baseBounds: box.clone(),
              baseScale: mesh.scale.clone(),
            };
            if (source === "skin") mesh.raycast = transparentRaycast;
            meshes.push(mesh);
            const organBox = boxes.get(organ) || new THREE.Box3();
            organBox.union(box);
            boxes.set(organ, organBox);
          });
          removed.forEach((object) => object.removeFromParent());
          for (const [id, box] of boxes) {
            const combined = organBounds.get(id) || new THREE.Box3();
            combined.union(box);
            organBounds.set(id, combined);
            centers.set(id, combined.getCenter(new THREE.Vector3()));
            if (!offsets.has(id)) offsets.set(id, new THREE.Vector3());
          }
          scene.add(gltf.scene);
          update();
          if (
            initialReady &&
            latest.current.focusMode &&
            boxes.has(latest.current.selectedOrgan)
          )
            orient();
        })
        .catch((error) => {
          sources.delete(source);
          throw error;
        });
      sources.set(source, promise);
      return promise;
    }

    runtime.current = {
      scene,
      camera,
      controls,
      renderer,
      meshes,
      centers,
      load,
      update,
      orient,
    };
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      inventory = organInventory(organBounds, width < 500);
      if (initialReady) orient(true);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = { x: 0, y: 0 };
    function hit(event: PointerEvent) {
      const p = latest.current;
      if (p.layers.skin && p.skinOpacity >= 0.95 && !p.focusMode && !p.exploded)
        return undefined;
      const rect = renderer!.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        meshes.filter(
          (m) =>
            m.visible &&
            m.userData.source !== "skin" &&
            (m.userData.organ !== "bones" ||
              p.selectedOrgan === "bones" ||
              p.activeSystem === "skeletal"),
        ),
        false,
      );
      // Subdued context bones should not intercept clicks on visible organs beneath them.
      return hits.find((h) => (h.object as Tissue).material.opacity > 0.5)
        ?.object.userData.organ as string | undefined;
    }
    const onDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
      transitioning = false;
    };
    const onUp = (event: PointerEvent) => {
      if (
        Math.hypot(
          event.clientX - pointerDown.x,
          event.clientY - pointerDown.y,
        ) > 5
      )
        return;
      const id = hit(event);
      if (id) latest.current.onSelectOrgan(id);
    };
    let lastHover = 0;
    const onMove = (event: PointerEvent) => {
      if (event.buttons) return;
      if (performance.now() - lastHover < 80) return;
      lastHover = performance.now();
      hoverId = hit(event) || "";
      renderer!.domElement.style.cursor = hoverId ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    const clock = new THREE.Clock();
    const zeroOffset = new THREE.Vector3();
    const localPosition = new THREE.Vector3();
    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      if (transitioning) {
        // Orbit around the target instead of crossing it on opposite view changes.
        // Cartesian interpolation can get stuck against OrbitControls.minDistance.
        const blend = 1 - Math.exp(-8 * dt);
        currentOrbit.setFromVector3(
          orbitOffset.copy(camera.position).sub(controls.target),
        );
        targetOrbit.setFromVector3(
          orbitOffset.copy(targetPosition).sub(targetLook),
        );
        const angle =
          THREE.MathUtils.euclideanModulo(
            targetOrbit.theta - currentOrbit.theta + Math.PI,
            Math.PI * 2,
          ) - Math.PI;
        currentOrbit.theta += angle * blend;
        currentOrbit.phi = THREE.MathUtils.lerp(
          currentOrbit.phi,
          targetOrbit.phi,
          blend,
        );
        currentOrbit.radius = THREE.MathUtils.lerp(
          currentOrbit.radius,
          targetOrbit.radius,
          blend,
        );
        controls.target.lerp(targetLook, blend);
        camera.position
          .copy(controls.target)
          .add(orbitOffset.setFromSpherical(currentOrbit));
        if (
          camera.position.distanceTo(targetPosition) < 0.001 &&
          controls.target.distanceTo(targetLook) < 0.001
        ) {
          camera.position.copy(targetPosition);
          controls.target.copy(targetLook);
          transitioning = false;
        }
      }
      controls.update(dt);
      const p = latest.current;
      let moved = false;
      for (const [id, offset] of offsets) {
        const target = p.exploded
          ? inventory.offsets.get(id) || zeroOffset
          : zeroOffset;
        if (offset.distanceToSquared(target) > 1e-12) {
          offset.lerp(target, 1 - Math.exp(-9 * dt));
          if (offset.distanceToSquared(target) < 1e-8) offset.copy(target);
          moved = true;
        }
      }
      if (moved) {
        for (const mesh of meshes) {
          const offset = offsets.get(mesh.userData.organ) || zeroOffset;
          if (offset.lengthSq() === 0) {
            mesh.position.copy(mesh.userData.basePosition);
            continue;
          }
          localPosition.copy(mesh.userData.baseWorldPosition).add(offset);
          mesh.position.copy(mesh.parent!.worldToLocal(localPosition));
        }
        renderer!.shadowMap.needsUpdate = true;
      }
      symptomHalo.visible = !!p.symptom && !p.exploded;
      if (p.symptom) {
        const headSymptom = /head|头/.test(p.symptom);
        const abdominal = /abdom|stomach|腹|胃/.test(p.symptom);
        symptomHalo.position.set(
          0,
          headSymptom ? 1.63 : abdominal ? 1.04 : 1.29,
          0.15,
        );
        symptomHalo.quaternion.copy(camera.quaternion);
        const pulse = (Math.sin(t * 2.5) + 1) / 2;
        symptomHalo.scale.setScalar(
          (headSymptom ? 0.7 : 1) * (1 + pulse * 0.14),
        );
        symptomHalo.material.opacity = 0.12 + (1 - pulse) * 0.28;
      }
      for (const mesh of meshes) {
        if (!mesh.visible) continue;
        const organ = mesh.userData.organ as string;
        if (organ === p.selectedOrgan) {
          const breathing =
            organ === "heart"
              ? Math.pow(Math.max(0, Math.sin(t * 6)), 6)
              : (Math.sin(t * 1.5) + 1) / 2;
          mesh.material.emissiveIntensity = 0.02 + breathing * 0.025;
          // Color pulses communicate the selected region without moving accurate mesh positions.
          if (
            p.symptom &&
            ["heart", "lungs", "stomach", "brain"].includes(organ)
          ) {
            mesh.material.emissive.set("#c77942");
            mesh.material.emissiveIntensity = 0.13 + Math.sin(t * 3) * 0.08;
          }
        }
      }
      renderer!.render(scene, camera);
      if (initialReady && t - lastLabelUpdate > 0.09) {
        lastLabelUpdate = t;
        const rect = el!.getBoundingClientRect();
        const compact = rect.width < 500;
        const ids = Array.from(
          new Set(
            p.exploded
              ? inventoryOrgans
              : compact
                ? [p.selectedOrgan, "brain", "liver"]
                : [...labelIds, p.selectedOrgan],
          ),
        );
        const projected: Label[] = [];
        if (p.showLabels)
          for (const id of ids) {
            const point = centers.get(id);
            if (!point || (p.focusMode && id !== p.selectedOrgan)) continue;
            if (
              !meshes.some((mesh) => mesh.visible && mesh.userData.organ === id)
            )
              continue;
            if (p.activeSystem !== "all" && organSystems[id] !== p.activeSystem)
              continue;
            const v = point.clone().add(offsets.get(id) || zeroOffset);
            // The actual projected 3D point stays attached in back and side views.
            v.project(camera);
            if (v.z > 1 || Math.abs(v.y) > 1) continue;
            if (p.exploded && Math.abs(v.x) > 1) continue;
            const anchorX = ((v.x + 1) / 2) * rect.width;
            const anchorY = ((1 - v.y) / 2) * rect.height;
            if (p.exploded) {
              const below = point.clone().add(offsets.get(id) || zeroOffset);
              below.y -=
                (organBounds.get(id)?.getSize(new THREE.Vector3()).y || 0) / 2 +
                0.035;
              below.project(camera);
              projected.push({
                id,
                x: Math.max(8, Math.min(rect.width - 56, anchorX - 24)),
                y: Math.max(
                  16,
                  Math.min(
                    rect.height - 18,
                    ((1 - below.y) / 2) * rect.height + 8,
                  ),
                ),
                anchorX,
                anchorY,
                left: false,
                selected: id === p.selectedOrgan,
              });
              continue;
            }
            const left = ["liver", "small-intestine"].includes(id);
            const labelX = left
              ? Math.max(14, rect.width / 2 - 194)
              : compact
                ? Math.max(14, rect.width - 140)
                : Math.min(rect.width - 84, rect.width / 2 + 125);
            projected.push({
              id,
              x: labelX,
              y: p.focusMode
                ? 35
                : Math.max(90, Math.min(rect.height - 45, anchorY)),
              anchorX,
              anchorY,
              left,
              selected: id === p.selectedOrgan,
            });
          }
        for (const side of [true, false]) {
          if (p.exploded) break;
          const sideLabels = projected
            .filter((l) => l.left === side)
            .sort((a, b) => a.y - b.y);
          for (let i = 1; i < sideLabels.length; i++)
            sideLabels[i].y = Math.max(
              sideLabels[i].y,
              sideLabels[i - 1].y + 35,
            );
          for (let i = sideLabels.length - 1; i >= 0; i--)
            sideLabels[i].y = Math.min(
              sideLabels[i].y,
              i === sideLabels.length - 1
                ? rect.height - 45
                : sideLabels[i + 1].y - 35,
            );
        }
        if (p.exploded) {
          // Oblique/side views can project different grid columns onto each other.
          const visible: Label[] = [];
          for (const label of [...projected].sort(
            (a, b) => Number(b.selected) - Number(a.selected),
          )) {
            if (
              !visible.some(
                (other) =>
                  Math.abs(label.x - other.x) < 52 &&
                  Math.abs(label.y - other.y) < 30,
              )
            )
              visible.push(label);
          }
          setLabels(projected.filter((label) => visible.includes(label)));
        } else setLabels(projected);
      }
    }
    animate();
    let finished = 0;
    Promise.all(
      INITIAL_ANATOMY_SOURCES.map((source) =>
        load(source).then(() => {
          finished++;
          if (!disposed)
            setLoaded(
              Math.round((finished / INITIAL_ANATOMY_SOURCES.length) * 100),
            );
        }),
      ),
    )
      .then(() => {
        if (disposed) return;
        initialReady = true;
        orient(true);
        latest.current.onReady?.();
      })
      .catch((e) => {
        if (!disposed) {
          console.error("Anatomy model loading failed", e);
          setError("解剖模型加载失败，请点击重新加载。");
        }
      });
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      draco.dispose();
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [retry]);

  useEffect(() => {
    runtime.current?.update();
  }, [
    props.selectedOrgan,
    props.activeSystem,
    props.skinOpacity,
    props.layers,
    props.autoRotate,
    props.focusMode,
    props.symptom,
    props.bodyFraming,
    props.renderStyle,
    props.exploded,
  ]);
  useEffect(() => {
    runtime.current?.orient();
  }, [
    props.view,
    props.zoom,
    props.resetKey,
    props.focusMode,
    props.bodyFraming,
    props.exploded,
  ]);
  useEffect(() => {
    if (props.focusMode) runtime.current?.orient();
  }, [props.selectedOrgan, props.focusMode]);

  return (
    <div
      ref={host}
      className="anatomy-canvas"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      {loaded < 100 && !error && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 90,
            transform: "translateX(-50%)",
            zIndex: 2,
            padding: "9px 16px",
            background: "rgba(255,255,255,.86)",
            border: "1px solid #e1eaf0",
            borderRadius: 8,
            color: "#70929e",
            fontSize: 11,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          正在构建人体图谱 · {loaded}%
        </div>
      )}
      {layerLoading && !error && (
        <div
          style={{
            position: "absolute",
            bottom: 91,
            right: 25,
            color: "#6b8597",
            fontSize: 11,
          }}
        >
          正在加载解剖图层…
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            background: "rgba(246,250,253,.8)",
            color: "#5a7183",
            zIndex: 10,
            padding: 35,
            textAlign: "center",
            fontSize: 13,
          }}
        >
          <p>{error}</p>
          <button
            onClick={() => setRetry((v) => v + 1)}
            style={{
              margin: "8px auto",
              border: "1px solid #d1e0e9",
              background: "#fff",
              color: "#337f98",
              borderRadius: 8,
              padding: "9px 18px",
              cursor: "pointer",
            }}
          >
            重新加载
          </button>
        </div>
      )}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 2,
          display: props.exploded ? "none" : undefined,
        }}
      >
        {labels.map((label) => (
          <g key={label.id}>
            <path
              d={`M ${label.anchorX} ${label.anchorY} L ${label.left ? label.x + 87 : label.x - 20} ${label.y} L ${label.left ? label.x + 68 : label.x} ${label.y}`}
              fill="none"
              stroke={label.selected ? "#7eb7c1" : "#bdcdd7"}
              strokeWidth="1"
            />
            <circle
              cx={label.anchorX}
              cy={label.anchorY}
              r="3"
              fill={label.selected ? "#4aabb6" : "#adbfcc"}
              stroke="rgba(255,255,255,.7)"
              strokeWidth="2"
            />
          </g>
        ))}
      </svg>
      {labels.map((label) => (
        <button
          key={label.id}
          className={`anatomy-label${label.selected ? " is-selected" : ""}`}
          onClick={() => props.onSelectOrgan(label.id)}
          aria-label={`查看${organNames[label.id]}`}
          style={{
            position: "absolute",
            left: label.x,
            top: label.y - 13,
            minWidth: props.exploded ? 48 : 68,
            height: 26,
            padding: props.exploded ? "3px 5px" : "3px 11px",
            color: label.selected ? "#2b8c94" : "#738694",
            border: label.selected
              ? "1px solid #a1d2d8"
              : "1px solid rgba(207,222,231,.74)",
            background: label.selected
              ? "rgba(234,249,249,.96)"
              : "rgba(255,255,255,.8)",
            boxShadow: label.selected
              ? "0 3px 12px rgba(60,141,154,.08)"
              : "none",
            borderRadius: 5,
            fontSize: 11,
            letterSpacing: 0,
            cursor: "pointer",
            whiteSpace: "nowrap",
            zIndex: 3,
            transition: "color .2s, background .2s",
          }}
        >
          {organNames[label.id]}
        </button>
      ))}
    </div>
  );
}
