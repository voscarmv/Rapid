import { geoBounds as d3_geoBounds } from 'd3-geo';
import { select as d3_select } from 'd3-selection';
import { Extent } from '@id-sdk/math';

import { t } from '../core/localizer';
// import { behaviorLasso } from '../behaviors/lasso';
// import { BehaviorSelect } from '../behaviors/BehaviorSelect';
import { modeDragNode } from './drag_node';
import { modeDragNote } from './drag_note';
import { uiDataEditor } from '../ui/data_editor';
import { utilKeybinding } from '../util';


export function modeSelectData(context, selectedDatum) {
    var mode = {
        id: 'select-data',
        button: 'browse'
    };

    var keybinding = utilKeybinding('select-data');
    var dataEditor = uiDataEditor(context);

//    var behaviors = [
//        new BehaviorSelect(context),
//        behaviorLasso(context),
//        modeDragNode(context).behavior,
//        // modeDragNote(context).behavior
//    ];


    // class the data as selected, or return to browse mode if the data is gone
    function selectData(d3_event, drawn) {
        var selection = context.surface().selectAll('.layer-mapdata .data' + selectedDatum.__featurehash__);

        if (selection.empty()) {
            // Return to browse mode if selected DOM elements have
            // disappeared because the user moved them out of view..
            var source = d3_event && d3_event.type === 'zoom' && d3_event.sourceEvent;
            if (drawn && source && (source.type === 'pointermove' || source.type === 'mousemove' || source.type === 'touchmove')) {
                context.enter('browse');
            }
        } else {
            selection.classed('selected', true);
        }
    }


    function esc() {
        if (context.container().select('.combobox').size()) return;
        context.enter('browse');
    }


    mode.zoomToSelected = function () {
        var bounds = d3_geoBounds(selectedDatum);
        var extent = new Extent(bounds[0], bounds[1]);
        context.map().centerZoomEase(extent.center(), context.map().trimmedExtentZoom(extent));
    };


    mode.enter = function() {
      context.enableBehaviors(['hover', 'select', 'drag']);
      // behaviors.forEach(context.install);

      keybinding
        .on(t('inspector.zoom_to.key'), mode.zoomToSelected)
        .on('⎋', esc, true);

      d3_select(document)
        .call(keybinding);

      selectData();

      var sidebar = context.ui().sidebar;
      sidebar.show(dataEditor.datum(selectedDatum));

      // expand the sidebar, avoid obscuring the data if needed
      var bounds = d3_geoBounds(selectedDatum);
      var extent = new Extent(bounds[0], bounds[1]);
      sidebar.expand(sidebar.intersects(extent));

      context.map()
        .on('drawn.select-data', selectData);

      return true;
    };


    mode.exit = function() {
        // behaviors.forEach(context.uninstall);

        d3_select(document)
            .call(keybinding.unbind);

        context.map()
            .on('drawn.select-data', null);

        context.ui().sidebar
            .hide();
    };


    return mode;
}
