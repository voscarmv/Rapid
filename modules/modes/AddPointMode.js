import { AbstractMode } from './AbstractMode';

import { actionAddEntity } from '../actions/add_entity';
import { actionChangeTags } from '../actions/change_tags';
import { actionAddMidpoint } from '../actions/add_midpoint';
import { geoChooseEdge } from '../geo';
import { osmNode } from '../osm/node';

const DEBUG = false;


/**
 * `AddPointMode`
 * In this mode, we are waiting for the user to place a point somewhere
 */
export class AddPointMode extends AbstractMode {

  /**
   * @constructor
   * @param  `context`  Global shared application context
   */
  constructor(context) {
    super(context);
    this.id = 'add-point';

    this.defaultTags = {};

    // Make sure the event handlers have `this` bound correctly
    this._click = this._click.bind(this);
    this._cancel = this._cancel.bind(this);
  }


  /**
   * enter
   * Enters the mode.
   */
  enter() {
    if (DEBUG) {
      console.log('AddPointMode: entering');  // eslint-disable-line no-console
    }

    this._active = true;
    const context = this.context;

    const eventManager = context.systems.map.renderer.events;
    eventManager.setCursor('crosshair');

    context.enableBehaviors(['hover', 'draw', 'map-interaction']);
    context.behaviors.draw
      .on('click', this._click)
      .on('cancel', this._cancel)
      .on('finish', this._cancel);

    return true;
  }


  /**
   * exit
   */
  exit() {
    if (!this._active) return;
    this._active = false;

    if (DEBUG) {
      console.log('AddPointMode: exiting');  // eslint-disable-line no-console
    }

    const context = this.context;

    const eventManager = context.systems.map.renderer.events;
    eventManager.setCursor('grab');

    context.behaviors.draw
      .off('click', this._click)
      .off('cancel', this._cancel)
      .off('finish', this._cancel);
  }


  /**
   * _click
   * Process whatever the user clicked on
   */
  _click(eventData) {
    // console.log('HITTT');
    const context = this.context;
    const editor = context.systems.editor;
    const graph = editor.staging.graph;
    const locations = context.systems.locations;
    const projection = context.projection;
    const coord = eventData.coord;

    const loc = projection.invert(coord);
    if (locations.blocksAt(loc).length) return;   // editing is blocked here
    // Allow snapping only for OSM Entities in the actual graph (i.e. not Rapid features)
    const datum = eventData?.target?.data;
    const choice = eventData?.target?.choice;
    const target = datum && graph.hasEntity(datum.id);

    // Snap to a node
    if (target?.type === 'node') {
      this._clickNode(target.loc, target);
      return;
    }

    // Snap to a way
//    if (target?.type === 'way' && choice) {
//      const edge = [ target.nodes[choice.index - 1], target.nodes[choice.index] ];
//      this._clickWay(choice.loc, edge);
//      return;
//    }
    if (target?.type === 'way') {
      const choice = geoChooseEdge(graph.childNodes(target), coord, projection);
      const SNAP_DIST = 6;  // hack to avoid snap to fill, see #719
      if (choice && choice.distance < SNAP_DIST) {
        const edge = [target.nodes[choice.index - 1], target.nodes[choice.index]];
        this._clickWay(choice.loc, edge);
        return;
      }
    }
    // Now that the user has clicked, let them nudge the map by moving to the edge.
    context.behaviors['map-nudging'].allow();
    this._clickNothing(loc);
  }


  /**
   * _click
   * Clicked on nothing, create the point at given `loc`
   */
  _clickNothing(loc) {
    const context = this.context;
    const editor = context.systems.editor;
    const l10n = context.systems.l10n;

    const node = osmNode({ loc: loc, tags: this.defaultTags });

    editor.perform(actionAddEntity(node));
    editor.commit({ annotation: l10n.t('operations.add.annotation.point'), selectedIDs: [node.id] });
    context.enter('select-osm', { selection: { osm: [node.id] }, newFeature: true });
  }


  /**
   * _clickWay
   * Clicked on an existing way, add a midpoint along the `edge` at given `loc`
   */
  _clickWay(loc, edge) {
    const context = this.context;
    const editor = context.systems.editor;
    const l10n = context.systems.l10n;

    const node = osmNode({ tags: this.defaultTags });
    editor.perform(actionAddMidpoint({ loc: loc, edge: edge }, node));
    editor.commit({ annotation: l10n.t('operations.add.annotation.vertex'), selectedIDs: [node.id] });
    context.enter('select-osm', { selection: { osm: [node.id] }, newFeature: true });
  }


  /**
   * _clickNode
   * Clicked on an existing node, merge `defaultTags` into it, if any, then select the node
   */
  _clickNode(loc, node) {
    const context = this.context;
    const editor = context.systems.editor;
    const l10n = context.systems.l10n;

    if (Object.keys(this.defaultTags).length === 0) {
      context.enter('select-osm', { selection: { osm: [node.id] }, newFeature: false });
      return;
    }

    const tags = Object.assign({}, node.tags);  // shallow copy
    for (const k in this.defaultTags) {
      tags[k] = this.defaultTags[k];
    }

    editor.perform(actionChangeTags(node.id, tags));
    editor.commit({ annotation: l10n.t('operations.add.annotation.point'), selectedIDs: [node.id] });
    context.enter('select-osm', { selection: { osm: [node.id] }, newFeature: false });
  }


  /**
   * _cancel
   * Return to browse mode without doing anything
   */
  _cancel() {
    this.context.enter('browse');
  }
}
