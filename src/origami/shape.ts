import * as THREE from 'three';
import { OrigamiModel } from './core/model';
import * as plainMath from './core/plain-math';
import { Polygon } from './core/polygon';

const LEGACY = true;

const VERTEX_POSITION = {
  COPLANAR: 0,
  FRONT: 1,
  BACK: 2
};

export class OrigamiShape {
  public model: OrigamiModel;
  private cutpolygonNodes = [];
  private cutpolygonPairs = [];
  private lastCutPolygons = [];

  constructor() {
    this.model = new OrigamiModel();
    window.addEventListener('keydown', (event) => {
      if ( event.keyCode === 66 ) { // Key: B
        this.model.diagnostics();
      }
    });
  }

  public resetCutHistory() {
    this.cutpolygonNodes = [];
    this.cutpolygonPairs = [];
    this.lastCutPolygons = [];
  }

  public getVertex(index) {
    return this.model.data.getVertex(index);
  }

  public getVertices() {
    return this.model.data.getVertices();
  }

  public getPolygon(index) {
    return this.model.data.getPolygon(index);
  }

  public cut(plane: THREE.Plane) {
    const polygons = this.model.getPolygons();
    polygons.forEach((polygon, index) => {
      this.cutPolygon(index, plane);
    });
  }

  public cutPolygon(index, plane) {
    const polygon = new Polygon(this.model.getPolygonVertices(index), this.model.data.getPolygon(index));

    if (polygon.canCut(plane) === false) {
      // console.warn('cant cut polygon #', index);
      return false;

    } else {

      this.cutpolygonPairs.push([index, this.model.getPolygons().length]);
      this.lastCutPolygons.push(this.getPolygon(index));

      const cutResult = polygon.cut(plane, this.cutpolygonNodes);

      // this will update our overall model with new indices, vertices and polygons
      const newCutPolygonNodes = this.model.processCutResult(index, cutResult);
      this.cutpolygonNodes = this.cutpolygonNodes.concat(newCutPolygonNodes);
    }
  }

  public reflect(plane) {
    this.model.shrink();
    this.resetCutHistory();

    this.cut(plane);

    this.getVertices().forEach( (vertex) => {
      if (this.vertexPosition(vertex, plane) === VERTEX_POSITION.FRONT) {
        const vertexReflected = this.reflectVertex(vertex, plane);
        vertex.copy(vertexReflected);
      }
    });

  }

  public reflectIndex(plane, polygonIndex) {
    const selection = this.polygonSelect(plane, polygonIndex);
    if (polygonIndex === 54) {
      // debugger;
    }

    this.getVertices().forEach((vertex, index) => {
      selection.every( (selectedPolygon) => {
        const polygon = this.getPolygon(selectedPolygon);
        if (polygon.indexOf(index) !== -1) {
          const vertexReflected = this.reflectVertex(vertex, plane);
          vertex.copy(vertexReflected);

          // break the loop
          return false;
        }

        return true;
      });
    });

    this.mergeUnaffectedPolygons(selection);
    this.model.shrinkWithIndex(polygonIndex);
  }

  public crease(plane) {
    this.fold(plane, 0);
  }

  public fold(plane: THREE.Plane, angle = 0) {
    this.model.shrink();

    this.resetCutHistory();
    this.cut(plane);

    const foldingpoints = this.getVertices().filter((vertex) => {
      const distance = plane.distanceToPoint(vertex);
      return Math.abs(distance) < 1;
    });

    const referencePoint = foldingpoints[0];
    let maxDistance = 0;
    let farpoint;

    // start self-collision testing
    let collin = false;

    foldingpoints.forEach((vertex) => {
      const distance = referencePoint.distanceTo(vertex);
      if (distance > 0) {
        collin = true;
        // 1. ok found at least two points on the plane to rotate around
        if (distance > maxDistance) {
          farpoint = vertex;
          maxDistance = distance;
        }
      }
    });

    for (let i = 1; i < foldingpoints.length; i++) {
      const foldingPoint = foldingpoints[i];
      if (foldingPoint === farpoint) {
        continue;
      }

      const v1 = referencePoint.clone().sub(foldingPoint);
      const v2 = farpoint.clone().sub(foldingPoint);
      const v3 = referencePoint.clone().sub(farpoint);

      if (v1.cross(v2).length() > v3.length()) {
        collin = false;
        break;
      }
    }

    if (collin) {
      const axis = referencePoint.clone().sub(farpoint).normalize();
      this.getVertices().forEach( (vertex) => {
        if (this.vertexPosition(vertex, plane) === VERTEX_POSITION.FRONT) {
          const v2 = vertex
            .clone().sub( referencePoint )
            .applyAxisAngle( axis, angle * Math.PI / 180 ).add( referencePoint );

          vertex.copy(v2);
        }
      });
    }else {
      // console.warn("can't fold, would tear");
    }
  }

  public foldIndex(plane: THREE.Plane, angle = 0, polygonIndex = -1) {
    const selection = this.polygonSelect(plane, polygonIndex);

    const vertices = this.getVertices();
    const foldingpoints = [];
    const foldingpointsIndices = [];

    for (let index = 0, l = vertices.length; index < l; index++) {
      const vertex = vertices[index];
      const distance = plane.distanceToPoint(vertex);

      if (Math.abs(distance) < 1) {
        for (let j = 0; j < selection.length; j++) {
          const polygon = this.getPolygon(selection[j]);

          if (polygon.indexOf(index) !== -1) {
            foldingpoints.push(vertex);
            foldingpointsIndices.push(index);
            break;
          }
        }
      }

    }

    const referencePoint = foldingpoints[0];
    let maxDistance = 0;
    let farpoint;

    // start self-collision testing
    let collin = false;
    let farpointIndex = -1;
    foldingpoints.forEach((fp, index) => {

      const distance = fp.distanceTo(referencePoint);
      if (polygonIndex === 54) {
        console.log(`${foldingpointsIndices[index]} -> ${foldingpointsIndices[0]}: ${distance}`);
        // console.log('test farpoint', distance, 'fp to reference', 'maxDistance:', maxDistance)
        // debugger;
        // console.log(phi)
      }

      if (distance > 0) {
        collin = true;
        // 1. ok found at least two points on the plane to rotate around
        if (distance > maxDistance) {
          farpoint = fp;
          farpointIndex = foldingpointsIndices[index];

          if (polygonIndex === 54) {
            // console.log('new farpoint', farpoint, farpointIndex);
          }

          maxDistance = distance;
        }
      }

    });

    if (polygonIndex === 112 ) {
      //  debugger;
    }

    for (let i = 1; i < foldingpoints.length; i++) {
      const foldingPoint = foldingpoints[i];

      if (foldingPoint === farpoint) {
        continue;
      }

      const v1 = referencePoint.clone().sub(foldingPoint);
      const v2 = farpoint.clone().sub(foldingPoint);
      const v3 = referencePoint.clone().sub(farpoint);

      if (v1.cross(v2).length() > v3.length()) {
        collin = false;
        break;
      }
    }

    if (collin) {
      // this.showPoint(referencePoint, 0xff0000);
      console.log('referencePoint', referencePoint);
      console.log('farpoint', farpoint);

      const axis = referencePoint.clone().sub(farpoint).normalize();
      this.getVertices().forEach((vertex, index) => {
        // this.showPoint(vertex,0x00ff00);
        // console.log('foldingpoints', index)

        for (let i = 0; i < selection.length; i++) {
          const polygon = this.getPolygon(selection[i]);
          // console.log('test index', index, polygon.containsIndex(index))
          if (polygon.indexOf(index) !== -1) {
            const v2 = vertex
              .clone().sub( referencePoint )
              .applyAxisAngle( axis, angle * Math.PI / 180 )
              .add( referencePoint );

            vertex.copy(v2);
            break;
          }
        }

      });
    }

    this.mergeUnaffectedPolygons(selection);
    this.model.shrinkWithIndex(polygonIndex);
  }

  public reflectVertex(vertex, plane) {

    // that's using a ported algorithm to use the not normalized plane values
    // and prevent precision errors.
    const result =  plainMath.reflection(vertex, plane);
    return result;
    // that's the three js way
    // const projected = plane.projectPoint(vertex);
    // const v2 = new THREE.Vector3().subVectors(projected, vertex);
    // const newPos = projected.clone().add(v2);
    // return newPos;
  }

  public polygonSelect(plane, index) {
    const selection = [index];

    for ( let j = 0; j < selection.length; j++) {
        const selectedPolygon = this.getPolygon(selection[j]);
        if (selectedPolygon === undefined) {
          throw new Error('Selected Polygon Index out of bounds (happens because of mismatching polygon indices. ');
        }
        for (let i = 0; i < this.model.getPolygons().length; i++) {
          if (selection.indexOf(i) === -1) {
            const polygon = this.getPolygon(i);

            // check the new polygon. At least
            // 1.one point must be on the cutting plane
            // 2. one point must be part of the original selected  polygon
            for (let ii = 0; ii < polygon.length; ii++ ) {
              if (selectedPolygon.indexOf(polygon[ii]) !== -1) {
                const vertex = this.getVertex(polygon[ii]);
                const distance = plane.distanceToPoint(vertex);

                if (Math.abs(distance) > 1) {
                  selection.push(i);
                  break;
                }
              }
            }
          }
        }
    }

    return selection;
  }

  public vertexPosition(vertex, plane) {
    const distance = plane.distanceToPoint(vertex);
    if (distance === 0 ) {
      return VERTEX_POSITION.COPLANAR;
    }else {
      if (distance > 0) {
        return VERTEX_POSITION.FRONT;
      }else {
        return VERTEX_POSITION.BACK;
      }
    }
  }

  public mergeUnaffectedPolygons(selection) {
    this.model.mergeUnaffectedPolygons(selection, this.cutpolygonPairs, this.lastCutPolygons);

    this.cutpolygonPairs = [];
    this.lastCutPolygons = [];
  }

  public reset(model) {
    this.model = model;
    this.resetCutHistory();
    this.cutpolygonPairs = [];
    this.lastCutPolygons = [];
  }
}
