import * as PIXI from 'pixi.js';
import { DashLine } from 'pixi-dashed-line';

import { AbstractFeature } from './AbstractFeature';
import { getLineSegments, lineToPolygon, lineToPoly } from './helpers';

const ONEWAY_SPACING = 35;
const SIDED_SPACING = 30;


/**
 * PixiFeatureLine
 *
 * Properties you can access:
 *   `geometry`   PixiGeometry() class containing all the information about the geometry
 *   `points`     Array of projected points in scene coordinates
 *   `style`      Object containing styling data
 *   `container`  PIXI.Container containing the display objects used to draw the line
 *   `casing`     PIXI.Graphic for the casing (below)
 *   `stroke`     PIXI.Graphic for the stroke (above)
 *
 *   (also all properties inherited from `AbstractFeature`)
 */
export class PixiFeatureLine extends AbstractFeature {

  /**
   * @constructor
   * @param  layer       The Layer that owns this Feature
   * @param  featureID   Unique string to use for the name of this Feature
   */
  constructor(layer, featureID) {
    super(layer, featureID);

    this.type = 'line';

    const casing = new PIXI.Graphics();
    casing.name = 'casing';
    casing.interactive = false;
    casing.interactiveChildren = false;
    casing.sortableChildren = false;
    this.casing = casing;

    const stroke = new PIXI.Graphics();
    stroke.name = 'stroke';
    stroke.interactive = false;
    stroke.interactiveChildren = false;
    stroke.sortableChildren = false;
    this.stroke = stroke;

    this.container.addChild(casing, stroke);
  }


  /**
   * destroy
   * Every Feature should have a destroy function that frees all the resources
   * Do not use the Feature after calling `destroy()`.
   */
  destroy() {
    super.destroy();
    this.casing = null;
    this.stroke = null;

    if (this._bufferdata) {
      delete this._bufferdata.inner;
      delete this._bufferdata.outer;
      delete this._bufferdata.perimeter;
      this._bufferdata = null;
    }
  }


  /**
   * update
   * @param  projection  Pixi projection to use for rendering
   * @param  zoom        Effective zoom to use for rendering
   */
  update(projection, zoom) {
    if (!this.dirty) return;  // nothing to do

    const wireframeMode = this.context.map().wireframeMode;
    const context = this.context;
    const textures = context.pixi.rapidTextures;
    const container = this.container;
    const style = this._style;

    //
    // GEOMETRY
    //
    if (this.geometry.dirty) {
      this.geometry.update(projection, zoom);

      // Calculate bounds
      const [minX, minY] = this.geometry.extent.min;
      const [maxX, maxY] = this.geometry.extent.max;
      const [w, h] = [maxX - minX, maxY - minY];
      this.localBounds.x = minX;
      this.localBounds.y = minY;
      this.localBounds.width = w;
      this.localBounds.height = h;
      this.sceneBounds = this.localBounds.clone();  // for lines, they are the same

      this.updateHitArea();
    }


    //
    // STYLE
    //
    if (this._styleDirty) {
      const {width, height} = this.localBounds;

      // Apply effectiveZoom style adjustments
      let showMarkers = true;

      // Cull really tiny shapes
      if (width < 4 && height < 4) {  // so tiny
        this.lod = 0;  // off
        this.visible = false;
        this.stroke.renderable = false;
        this.casing.renderable = false;
        showMarkers = false;

      } else {
        this.visible = true;
        this.stroke.renderable = true;

        if (zoom < 16) {
          this.lod = 1;  // simplified
          this.casing.renderable = false;
          showMarkers = false;

        } else {
          this.lod = 2;  // full
          this.casing.renderable = true;
          showMarkers = true;
        }
      }

      //
      // Update line markers, if any..
      // Todo: left/right markers (like for coastlines, retaining walls, etc)
      //
      let lineMarkers = container.getChildByName('lineMarkers');

      if (showMarkers && ((style.lineMarkerTexture || style.lineMarkerName) || (style.sidedMarkerTexture || style.sidedMarkerName))) {
        // Create line marker container, if necessary
        if (!lineMarkers) {
          lineMarkers = new PIXI.Container();
          lineMarkers.name = 'lineMarkers';
          lineMarkers.interactiveChildren = false;
          lineMarkers.sortableChildren = false;
          lineMarkers.roundPixels = false;
          container.addChild(lineMarkers);
        }

        const lineMarkerTexture = style.lineMarkerTexture || textures.get(style.lineMarkerName) || PIXI.Texture.WHITE;
        const sidedMarkerTexture = style.sidedMarkerTexture || textures.get(style.sidedMarkerName) || PIXI.Texture.GREEN;
        const sided = style.sidedMarkerName === 'sided';
        const oneway = style.lineMarkerName === 'oneway';
        lineMarkers.removeChildren();

        if (oneway) {
          const segments = getLineSegments(this.geometry.data, ONEWAY_SPACING, false, true);  /* sided = false, limited = true */

          segments.forEach(segment => {
            segment.coords.forEach(([x, y]) => {
              const arrow = new PIXI.Sprite(lineMarkerTexture);
              arrow.interactive = false;
              arrow.interactiveChildren = false;
              arrow.sortableChildren = false;
              arrow.anchor.set(0.5, 0.5); // middle, middle
              arrow.position.set(x, y);
              //segments with directional 'sides' get rotated 90 degrees
              arrow.rotation = segment.angle;
              // arrow.rotation = segment.angle;
              arrow.tint = style.lineMarkerTint;
              lineMarkers.addChild(arrow);
            });
          });
        }

        if (sided) {
          const segments = getLineSegments(this.geometry.data, SIDED_SPACING, true, true);  /* sided = true, limited = true */

          segments.forEach(segment => {
            segment.coords.forEach(([x, y]) => {
              const arrow = new PIXI.Sprite(sidedMarkerTexture);
              arrow.interactive = false;
              arrow.interactiveChildren = false;
              arrow.sortableChildren = false;
              arrow.anchor.set(0.5, 0.5); // middle, middle
              arrow.position.set(x, y);
              arrow.rotation = segment.angle;
              arrow.tint = style.stroke.color;
              lineMarkers.addChild(arrow);
            });
          });
        }

      } else if (lineMarkers) {  // No line markers, remove if it exists
        container.removeChild(lineMarkers);
        lineMarkers.destroy({ children: true });
      }

      this._styleDirty = false;
    }


    if (this.casing.renderable) {
      updateGraphic('casing', this.casing, this.geometry.data, style, wireframeMode);
    }
    if (this.stroke.renderable) {
      updateGraphic('stroke', this.stroke, this.geometry.data, style, wireframeMode);
    }

    this.updateHalo();


    function updateGraphic(which, graphic, points, style, wireframeMode) {
      const minwidth = which === 'casing' ? 3 : 2;
      let width = style[which].width;

      // Apply effectiveZoom style adjustments
      if (zoom < 16) {
        width -= 4;
      } else if (zoom < 17) {
        width -= 2;
      }
      if (width < minwidth) {
        width = minwidth;
      }

      if (wireframeMode) {
        width = 1;
      }

      let g = graphic.clear();
      if (style[which].alpha === 0) return;

      if (style[which].dash) {
        g = new DashLine(g, {
          dash: style[which].dash,
          color: style[which].color,
          width: width,
          alpha: style[which].alpha || 1.0,
          join: style[which].join || PIXI.LINE_JOIN.ROUND,
          cap: style[which].cap || PIXI.LINE_CAP.ROUND,
        });
      } else {
        g = g.lineStyle({
          color: style[which].color,
          width: width,
          alpha: style[which].alpha || 1.0,
          join: style[which].join || PIXI.LINE_JOIN.ROUND,
          cap: style[which].cap || PIXI.LINE_CAP.ROUND,
        });
      }

      points.forEach(([x, y], i) => {
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      });
    }

  }


// experiment
  updateHitArea() {
    if (!this.visible || !this.geometry.data) return;

    const hitWidth = Math.max(3, this._style.casing.width || 0);
    const hitStyle = {
      alignment: 0.5,  // middle of line
      color: 0x0,
      width: hitWidth + 10,
      alpha: 1.0,
      join: PIXI.LINE_JOIN.BEVEL,
      cap: PIXI.LINE_CAP.BUTT
    };

    this._bufferdata = lineToPoly(this.geometry.data, hitStyle);
    this.container.hitArea = new PIXI.Polygon(this._bufferdata.perimeter);
  }


// experiment
// Show/Hide halo (requires `this.container.hitArea` to be already set up as a PIXI.Polygon)
  updateHalo() {
    if (this.visible && (this.hovered || this.selected || this.drawing)) {
      if (!this.halo) {
        this.halo = new PIXI.Graphics();
        this.halo.name = `${this.id}-halo`;
        const mapUIContainer = this.scene.layers.get('map-ui').container;
        mapUIContainer.addChild(this.halo);
      }

      const HALO_STYLE = {
        alpha: 0.9,
        dash: [6, 3],
        width: 2,   // px
        color: 0xffff00
      };

      this.halo.clear();
       const dl = new DashLine(this.halo, HALO_STYLE);
      if (this._bufferdata) {
        if (this._bufferdata.outer && this._bufferdata.inner) {
          dl.drawPolygon(this._bufferdata.outer);
          dl.drawPolygon(this._bufferdata.inner);
        } else {
          dl.drawPolygon(this._bufferdata.perimeter);
        }
      }

    } else {
      if (this.halo) {
        this.container.filters = null;
        this.halo.destroy({ children: true });
        this.halo = null;
      }
    }
  }


  /**
   * style
   * @param  obj  Style `Object` (contents depends on the Feature type)
   *
   * 'point' - see PixiFeaturePoint.js
   * 'line'/'multipolygon' - see styles.js
   */
  get style() {
    return this._style;
  }
  set style(obj) {
    this._style = Object.assign({}, STYLE_DEFAULTS, obj);
    this._styleDirty = true;
  }

}


const STYLE_DEFAULTS = {
  lineMarkerName: '',
  lineMarkerTint: 0x000000,
  labelTint: 0xffffff,

  fill:   { width: 2, color: 0xaaaaaa, alpha: 0.3 },
  casing: { width: 5, color: 0x444444, alpha: 1, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND },
  stroke: { width: 3, color: 0xcccccc, alpha: 1, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND }
};

