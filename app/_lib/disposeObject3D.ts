import * as THREE from "three";

/**
 * 通用的 Object3D 释放函数
 * 会递归释放 Mesh/Line/Points 的几何体、材质、纹理，并从父节点移除
 */
export function disposeObject3D(object: THREE.Object3D) {
    object.traverse((child) => {
        // Mesh / Line / Points 都可能有 geometry + material
        const meshLike = child as THREE.Mesh | THREE.Line | THREE.Points;

        if ((meshLike as THREE.Mesh).isMesh ||
            (meshLike as THREE.Line).isLine ||
            (meshLike as THREE.Points).isPoints) {

            // 释放 geometry
            if (meshLike.geometry) {
                if (!!meshLike.geometry.boundsTree) {
                    meshLike.geometry.disposeBoundsTree()
                }
                meshLike.geometry.dispose();
            }

            // 释放材质
            const material = (meshLike as THREE.Mesh).material;
            if (Array.isArray(material)) {
                material.forEach((m) => disposeMaterial(m));
            } else if (material) {
                disposeMaterial(material);
            }
        }
    });

    // 从父级移除对象
    if (object.parent) {
        object.parent.remove(object);
    }
}

/**
 * 释放材质及其贴图
 */
function disposeMaterial(material: THREE.Material) {
    // 遍历材质的所有属性，释放贴图
    for (const key in material) {
        const value = (material as unknown)[key];
        if (value instanceof THREE.Texture) {
            value.dispose();
        }
    }
    material.dispose();
}
