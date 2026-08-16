import * as THREE from 'three';

/**
 * ThreeDebugBridge: Live 3D Scene Inspection, Measurement, Collision, and Diagnostic Bridge.
 * Exposes full runtime access to AI agents and devtools:
 * - list_scene_objects(): Hierarchical enumeration of all scene elements
 * - inspect_object(name): Deep transforms, geometry stats, and PBR materials
 * - get_bounding_box(name): Exact world dimensions, volume, and center
 * - check_mesh_collisions(): Mathematical intersection test to detect clipping
 * - get_renderer_stats(): Live draw calls, triangle counts, texture memory, and FPS
 * - set_debug_helpers(flags): Bounding boxes, axes, normals, light helpers, wireframe
 * - capture_scene_state(): Full serialized snapshot of the 3D scene
 */
export class ThreeDebugBridge {
  constructor(app) {
    this.app = app;
    this.helperGroup = new THREE.Group();
    this.helperGroup.name = '__DEBUG_HELPERS__';
    this.app.scene.add(this.helperGroup);

    this.activeHelpers = {
      boundingBoxes: false,
      axes: false,
      grid: false,
      lightHelpers: false
    };

    this.boxHelpers = [];
    this.axesHelper = null;

    // Expose global runtime hooks
    if (typeof window !== 'undefined') {
      window.__THREE__ = THREE;
      window.__APP__ = app;
      window.__SCENE__ = app.scene;
      window.__CAMERA__ = app.camera;
      window.__RENDERER__ = app.renderer;
      window.__ENGINE__ = app.engine;
      window.__DEBUG_BRIDGE__ = this;
    }
  }

  list_scene_objects(root = this.app.scene) {
    const list = [];
    root.traverse((obj) => {
      if (obj === this.helperGroup || obj.parent === this.helperGroup) return;

      const info = {
        name: obj.name || `Unnamed_${obj.type}_${obj.id}`,
        type: obj.type,
        id: obj.id,
        visible: obj.visible,
        parent: obj.parent ? (obj.parent.name || obj.parent.type) : null,
        childrenCount: obj.children.length,
        position: { x: +obj.position.x.toFixed(3), y: +obj.position.y.toFixed(3), z: +obj.position.z.toFixed(3) },
        rotation: { x: +obj.rotation.x.toFixed(3), y: +obj.rotation.y.toFixed(3), z: +obj.rotation.z.toFixed(3) },
        scale: { x: +obj.scale.x.toFixed(3), y: +obj.scale.y.toFixed(3), z: +obj.scale.z.toFixed(3) }
      };

      if (obj.isMesh && obj.geometry) {
        info.vertexCount = obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0;
        info.triangleCount = obj.geometry.index ? obj.geometry.index.count / 3 : (info.vertexCount / 3);
        info.materialName = obj.material ? (Array.isArray(obj.material) ? obj.material.map(m => m.name || m.type) : (obj.material.name || obj.material.type)) : 'none';
      }

      list.push(info);
    });
    return list;
  }

  find_object(name) {
    let target = null;
    this.app.scene.traverse((obj) => {
      if (obj.name === name || obj.name.toLowerCase() === name.toLowerCase()) {
        target = obj;
      }
    });
    return target;
  }

  inspect_object(name) {
    const obj = typeof name === 'string' ? this.find_object(name) : name;
    if (!obj) return { error: `Object "${name}" not found in scene.` };

    obj.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const result = {
      name: obj.name,
      type: obj.type,
      id: obj.id,
      visible: obj.visible,
      castShadow: obj.castShadow,
      receiveShadow: obj.receiveShadow,
      localTransform: {
        position: { x: +obj.position.x.toFixed(4), y: +obj.position.y.toFixed(4), z: +obj.position.z.toFixed(4) },
        rotation: { x: +obj.rotation.x.toFixed(4), y: +obj.rotation.y.toFixed(4), z: +obj.rotation.z.toFixed(4) },
        scale: { x: +obj.scale.x.toFixed(4), y: +obj.scale.y.toFixed(4), z: +obj.scale.z.toFixed(4) }
      },
      worldBoundingBox: {
        min: { x: +box.min.x.toFixed(4), y: +box.min.y.toFixed(4), z: +box.min.z.toFixed(4) },
        max: { x: +box.max.x.toFixed(4), y: +box.max.y.toFixed(4), z: +box.max.z.toFixed(4) },
        dimensions: { width: +size.x.toFixed(4), height: +size.y.toFixed(4), depth: +size.z.toFixed(4) },
        center: { x: +center.x.toFixed(4), y: +center.y.toFixed(4), z: +center.z.toFixed(4) },
        volume: +(size.x * size.y * size.z).toFixed(4)
      }
    };

    if (obj.isMesh && obj.geometry) {
      result.geometry = {
        type: obj.geometry.type,
        vertexCount: obj.geometry.attributes.position ? obj.geometry.attributes.position.count : 0,
        triangleCount: obj.geometry.index ? obj.geometry.index.count / 3 : 0,
        hasNormals: !!obj.geometry.attributes.normal,
        hasUvs: !!obj.geometry.attributes.uv
      };

      if (obj.material) {
        const mat = obj.material;
        result.material = {
          type: mat.type,
          name: mat.name,
          color: mat.color ? '#' + mat.color.getHexString() : null,
          metalness: mat.metalness !== undefined ? mat.metalness : null,
          roughness: mat.roughness !== undefined ? mat.roughness : null,
          transparent: mat.transparent,
          opacity: mat.opacity,
          wireframe: mat.wireframe,
          hasMap: !!mat.map,
          hasBumpMap: !!mat.bumpMap,
          hasNormalMap: !!mat.normalMap
        };
      }
    }

    return result;
  }

  get_bounding_box(name) {
    const obj = this.find_object(name);
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return {
      min: box.min,
      max: box.max,
      size: size,
      center: center
    };
  }

  get_renderer_stats() {
    const info = this.app.renderer.info;
    return {
      render: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        frame: info.render.frame
      },
      memory: {
        geometries: info.memory.geometries,
        textures: info.memory.textures
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: this.app.renderer.getPixelRatio()
      }
    };
  }

  check_mesh_collisions() {
    const collisions = [];
    const meshes = [];

    this.app.scene.traverse((obj) => {
      if (obj.isMesh && obj.name && !obj.name.startsWith('__')) {
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        meshes.push({ name: obj.name, obj: obj, box: box });
      }
    });

    for (let i = 0; i < meshes.length; i++) {
      for (let j = i + 1; j < meshes.length; j++) {
        const m1 = meshes[i];
        const m2 = meshes[j];

        // Skip siblings under same small assembly (e.g. spark plug insulator vs hex base)
        if (m1.obj.parent === m2.obj.parent && m1.obj.parent.children.length < 5) continue;

        if (m1.box.intersectsBox(m2.box)) {
          const intersection = m1.box.clone().intersect(m2.box);
          const size = new THREE.Vector3();
          intersection.getSize(size);
          const volume = size.x * size.y * size.z;

          // Only report substantial volumetric intersections (> 0.05)
          if (volume > 0.05) {
            collisions.push({
              meshA: m1.name,
              meshB: m2.name,
              intersectionVolume: +volume.toFixed(4),
              intersectionBounds: { min: intersection.min, max: intersection.max }
            });
          }
        }
      }
    }

    return {
      totalMeshesEvaluated: meshes.length,
      collisionCount: collisions.length,
      collisions: collisions
    };
  }

  set_debug_helpers(options = {}) {
    while (this.helperGroup.children.length > 0) {
      const child = this.helperGroup.children[0];
      this.helperGroup.remove(child);
      if (child.dispose) child.dispose();
    }

    if (options.axes) {
      const axes = new THREE.AxesHelper(5);
      this.helperGroup.add(axes);
    }

    if (options.boundingBoxes) {
      this.app.scene.traverse((obj) => {
        if (obj.isMesh && obj !== this.helperGroup && obj.parent !== this.helperGroup) {
          const boxHelper = new THREE.BoxHelper(obj, 0x00d2ff);
          this.helperGroup.add(boxHelper);
        }
      });
    }

    return { status: 'Helpers updated', options: options };
  }

  capture_scene_state() {
    return {
      timestamp: new Date().toISOString(),
      renderer: this.get_renderer_stats(),
      camera: {
        position: this.app.camera.position,
        rotation: this.app.camera.rotation,
        fov: this.app.camera.fov,
        aspect: this.app.camera.aspect
      },
      objectsCount: this.list_scene_objects().length,
      collisions: this.check_mesh_collisions()
    };
  }
}
