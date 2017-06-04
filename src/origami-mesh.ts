import * as THREE from 'three';
import { OrigamiShape } from './origami-shape';
import * as chroma from 'chroma-js';
import World from './world';
import { Polygon } from './polygon';

class OrigamiMesh extends THREE.Object3D {
  private materials;
  private group;
  private currentGeometry;

  constructor(private shape: OrigamiShape){
    super();
    this.init();
  }

    init(){
      this.group = new THREE.Group();
      this.add(this.group);

      this.materials =[
          new THREE.MeshBasicMaterial({
          color: chroma('aquamarine').luminance(0.5).hex(),
          side: THREE.FrontSide,
          transparent: true,
          opacity: 0.8
        }),
        new THREE.MeshBasicMaterial({
          color: chroma('hotpink').luminance(0.5).hex(),
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.8
        })
      ]
    }

    getWorldCenter(){
      let geometry = this.currentGeometry;

      var middle = new THREE.Vector3();
      geometry.computeBoundingBox();
      middle.x = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
      middle.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
      middle.z = (geometry.boundingBox.max.z + geometry.boundingBox.min.z) / 2;

      return middle;
    }
    
    toLineGeometry(){
      let combinedGeometry = new THREE.Geometry();
      let counter = 1;
      
      
      let polygonInstances = this.shape.model
        .getPolygonWrapped()
        .filter((polygon) => {
          return (polygon.isNonDegenerate() === false || polygon.size < 3) === false;
        });
      
      
      polygonInstances.forEach((polygon: Polygon) => {
        let geometry = new THREE.Geometry();
        let vertices = polygon.getPoints();

        for(let i = 0; i< vertices.length;i++){
          geometry.vertices.push(vertices[i], vertices[(i + 1) % vertices.length]);
        }

        combinedGeometry.merge(geometry, new THREE.Matrix4());
        counter++
      })

      return combinedGeometry;
    }

    toGeometry(){
      let combinedGeometry = new THREE.Geometry();
 
      let polygonInstances = this.shape.model
        .getPolygonWrapped()
        .filter((polygon) => {
          return (polygon.isNonDegenerate() === false || polygon.size < 3) === false;
        });
      
      polygonInstances.forEach((polygon: Polygon) => {
        let geometry = new THREE.Geometry();
        let vertices = polygon.getPoints();
        let triangles = THREE.ShapeUtils.triangulate(vertices, true);
        let faces = triangles.map(triangle => new THREE.Face3(triangle[0], triangle[1], triangle[2]));

        geometry.vertices.push(...vertices);
        geometry.faces.push(...faces);
        geometry.computeFaceNormals();

        combinedGeometry.merge(geometry, new THREE.Matrix4());
      });

      return combinedGeometry;
    }

    update(){
      this.group.remove(...this.group.children);

      //creates a combined mesh of front, back and wireframe display
      let geometry = this.toGeometry();
      let mesh = THREE.SceneUtils.createMultiMaterialObject(geometry, this.materials)

      let pointGeometry = new THREE.Geometry();
      let lines = new THREE.LineSegments(this.toLineGeometry(), new THREE.LineBasicMaterial());

      this.group.add(mesh);
      this.group.add(lines);

      this.currentGeometry = geometry;
    }

}

export default OrigamiMesh;
