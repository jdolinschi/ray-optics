﻿var objTypes = {};
var canvas;
var canvasBelowLight;
var canvasLight;
var canvasGrid;
var scene;
var editor;
var simulator;
var objBar;
var xyBox_cancelContextMenu = false;
var isFromGallery = false;
var hasUnsavedChange = false;
var MQ;
var autoSyncUrl = false;
var warning = null;
var error = null;

window.onload = function (e) {
  let dpr = window.devicePixelRatio || 1;

  canvas = document.getElementById('canvasAboveLight');
  canvasBelowLight = document.getElementById('canvasBelowLight');
  canvasLight = document.getElementById('canvasLight');
  canvasGrid = document.getElementById('canvasGrid');

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  canvasBelowLight.width = window.innerWidth * dpr;
  canvasBelowLight.height = window.innerHeight * dpr;

  canvasLight.width = window.innerWidth * dpr;
  canvasLight.height = window.innerHeight * dpr;

  canvasGrid.width = window.innerWidth * dpr;
  canvasGrid.height = window.innerHeight * dpr;

  objBar = new ObjBar(document.getElementById('obj_bar_main'));

  objBar.on('showAdvancedEnabled', function (enabled) {
    if (enabled) {
      document.getElementById('showAdvanced').style.display = '';
      document.getElementById('showAdvanced_mobile_container').style.display = '';
    } else {
      document.getElementById('showAdvanced').style.display = 'none';
      document.getElementById('showAdvanced_mobile_container').style.display = 'none';
    }
  });

  objBar.on('edit', function () {
    simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
  });

  objBar.on('editEnd', function () {
    editor.onActionComplete();
  });

  objBar.on('requestUpdate', function () {
    editor.selectObj(editor.selectedObjIndex);
  });

  document.getElementById('apply_to_all').addEventListener('change', function () {
    objBar.shouldApplyToAll = this.checked;
  });

  scene = new Scene();

  simulator = new Simulator(scene,
    canvasLight.getContext('2d'),
    canvasBelowLight.getContext('2d'),
    canvasAboveLight.getContext('2d'),
    canvasGrid.getContext('2d'),
    document.createElement('canvas').getContext('2d'),
    true
  );

  simulator.dpr = dpr;

  simulator.on('simulationStart', function () {
    document.getElementById('forceStop').style.display = 'none';
  });

  simulator.on('simulationPause', function () {
    document.getElementById('forceStop').style.display = '';
    document.getElementById('simulatorStatus').innerHTML = getMsg("ray_count") + simulator.processedRayCount + '<br>' + getMsg("total_truncation") + simulator.totalTruncation.toFixed(3) + '<br>' + getMsg("brightness_scale") + ((simulator.brightnessScale <= 0) ? "-" : simulator.brightnessScale.toFixed(3)) + '<br>' + getMsg("time_elapsed") + (new Date() - simulator.simulationStartTime) + '<br>';
  });

  simulator.on('simulationStop', function () {
    document.getElementById('simulatorStatus').innerHTML = getMsg("ray_count") + simulator.processedRayCount + '<br>' + getMsg("total_truncation") + simulator.totalTruncation.toFixed(3) + '<br>' + getMsg("brightness_scale") + ((simulator.brightnessScale <= 0) ? "-" : simulator.brightnessScale.toFixed(3)) + '<br>' + getMsg("time_elapsed") + (new Date() - simulator.simulationStartTime) + '<br>' + getMsg("force_stopped");
    document.getElementById('forceStop').style.display = 'none';
  });

  simulator.on('simulationComplete', function () {
    document.getElementById('simulatorStatus').innerHTML = getMsg("ray_count") + simulator.processedRayCount + '<br>' + getMsg("total_truncation") + simulator.totalTruncation.toFixed(3) + '<br>' + getMsg("brightness_scale") + ((simulator.brightnessScale <= 0) ? "-" : simulator.brightnessScale.toFixed(3)) + '<br>' + getMsg("time_elapsed") + (new Date() - simulator.simulationStartTime);
    document.getElementById('forceStop').style.display = 'none';
  });

  editor = new Editor(scene, canvas, simulator);

  editor.on('positioningStart', function (e) {
    document.getElementById('xybox').style.left = (e.dragContext.targetPoint.x * scene.scale + scene.origin.x) + 'px';
    document.getElementById('xybox').style.top = (e.dragContext.targetPoint.y * scene.scale + scene.origin.y) + 'px';
    document.getElementById('xybox').value = '(' + (e.dragContext.targetPoint.x) + ',' + (e.dragContext.targetPoint.y) + ')';
    document.getElementById('xybox').size = document.getElementById('xybox').value.length;
    document.getElementById('xybox').style.display = '';
    document.getElementById('xybox').select();
    document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
    //console.log("show xybox");
    xyBox_cancelContextMenu = true;
  });

  editor.on('requestPositioningComfirm', function (e) {
    confirmPositioning(e.ctrl, e.shift);
  });

  editor.on('positioningEnd', function (e) {
    document.getElementById('xybox').style.display = 'none';
  });

  editor.on('mouseCoordinateChange', function (e) {
    if (e.mousePos) {
      const mousePosDigits = Math.max(Math.round(Math.log10(scene.scale)), 0);
      document.getElementById('mouseCoordinates').innerHTML = getMsg('mouse_coordinates') + "(" + e.mousePos.x.toFixed(mousePosDigits) + ", " + e.mousePos.y.toFixed(mousePosDigits) + ")";
    } else {
      document.getElementById('mouseCoordinates').innerHTML = getMsg('mouse_coordinates') + "-";
    }
  });

  editor.emit('mouseCoordinateChange', { mousePos: null });

  editor.on('selectionChange', function (e) {
    hideAllPopovers();
    if (objBar.pendingEvent) {
      // If the user is in the middle of editing a value, then clearing the innerHTML of obj_bar_main will cause the change event not to fire, so we need to manually fire it.
      objBar.pendingEvent();
      objBar.pendingEvent = null;
    }

    if (editor.selectedObjIndex >= 0) {
      if (scene.objs[editor.selectedObjIndex].constructor.type == 'Handle') {
      document.getElementById('obj_bar').style.display = 'none';
      return;
    }
    document.getElementById('obj_name').innerHTML = getMsg('toolname_' + scene.objs[editor.selectedObjIndex].constructor.type);
    document.getElementById('showAdvanced').style.display = 'none';
    document.getElementById('showAdvanced_mobile_container').style.display = 'none';

    document.getElementById('obj_bar_main').style.display = '';
    document.getElementById('obj_bar_main').innerHTML = '';
    scene.objs[editor.selectedObjIndex].populateObjBar(objBar);

    if (document.getElementById('obj_bar_main').innerHTML != '') {
      for (var i = 0; i < scene.objs.length; i++) {
        if (i != editor.selectedObjIndex && scene.objs[i].constructor.type == scene.objs[editor.selectedObjIndex].constructor.type) {
          // If there is an object with the same type, then show "Apply to All"
          document.getElementById('apply_to_all_box').style.display = '';
          document.getElementById('apply_to_all_mobile_container').style.display = '';
          break;
        }
        if (i == this.scene.objs.length - 1) {
          document.getElementById('apply_to_all_box').style.display = 'none';
          document.getElementById('apply_to_all_mobile_container').style.display = 'none';
        }
      }
    } else {
      document.getElementById('apply_to_all_box').style.display = 'none';
      document.getElementById('apply_to_all_mobile_container').style.display = 'none';
    }


    document.getElementById('obj_bar').style.display = '';
    } else {
      document.getElementById('obj_bar').style.display = 'none';
      objBar.shouldShowAdvanced = false;
    }
  });

  editor.on('sceneLoaded', function (e) {
    document.getElementById('welcome').style.display = 'none';
    if (e.needFullUpdate) {
      // Update the UI for the loaded scene.

      if (scene.name) {
        document.title = scene.name + " - " + getMsg("appName");
        document.getElementById('save_name').value = scene.name;
      } else {
        document.title = getMsg("appName");
      }

      if (Object.keys(scene.modules).length > 0) {
        updateModuleObjsMenu();
      }

      document.getElementById('showGrid').checked = scene.showGrid;
      document.getElementById('showGrid_more').checked = scene.showGrid;
      document.getElementById('showGrid_mobile').checked = scene.showGrid;

      document.getElementById('snapToGrid').checked = scene.snapToGrid;
      document.getElementById('snapToGrid_more').checked = scene.snapToGrid;
      document.getElementById('snapToGrid_mobile').checked = scene.snapToGrid;

      document.getElementById('lockObjs').checked = scene.lockObjs;
      document.getElementById('lockObjs_more').checked = scene.lockObjs;
      document.getElementById('lockObjs_mobile').checked = scene.lockObjs;

      if (scene.observer) {
        document.getElementById('observer_size').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
        document.getElementById('observer_size_mobile').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
      } else {
        document.getElementById('observer_size').value = 40;
        document.getElementById('observer_size_mobile').value = 40;
      }

      document.getElementById('gridSize').value = scene.gridSize;
      document.getElementById('gridSize_mobile').value = scene.gridSize;

      document.getElementById('lengthScale').value = scene.lengthScale;
      document.getElementById('lengthScale_mobile').value = scene.lengthScale;

      document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
      document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
      document.getElementById('simulateColors').checked = scene.simulateColors;
      document.getElementById('simulateColors_mobile').checked = scene.simulateColors;
      modebtn_clicked(scene.mode);
      document.getElementById('mode_' + scene.mode).checked = true;
      document.getElementById('mode_' + scene.mode + '_mobile').checked = true;
      editor.selectObj(editor.selectedObjIndex);
    }
  });

  editor.on('newAction', function (e) {
    if (aceEditor && e.newJSON != e.oldJSON && !aceEditor.isFocused()) {

      // Calculate the position of the first and last character that has changed
      var minLen = Math.min(e.newJSON.length, e.oldJSON.length);
      var startChar = 0;
      while (startChar < minLen && e.newJSON[startChar] == e.oldJSON[startChar]) {
        startChar++;
      }
      var endChar = 0;
      while (endChar < minLen && e.newJSON[e.newJSON.length - 1 - endChar] == e.oldJSON[e.oldJSON.length - 1 - endChar]) {
        endChar++;
      }

      // Convert the character positions to line numbers
      var startLineNum = e.newJSON.substr(0, startChar).split("\n").length - 1;
      var endLineNum = e.newJSON.substr(0, e.newJSON.length - endChar).split("\n").length - 1;

      // Set selection range to highlight changes using the Range object
      var Range = require("ace/range").Range;
      var selectionRange = new Range(startLineNum, 0, endLineNum + 1, 0);

      lastCodeChangeIsFromScene = true;
      aceEditor.setValue(e.newJSON);
      aceEditor.selection.setSelectionRange(selectionRange);

      // Scroll to the first line that has changed
      aceEditor.scrollToLine(startLineNum, true, true, function () { });
    }
    

    syncUrl();
    warning = "";
  });

  editor.on('newUndoPoint', function (e) {
    document.getElementById('undo').disabled = false;
    document.getElementById('redo').disabled = true;
    document.getElementById('undo_mobile').disabled = false;
    document.getElementById('redo_mobile').disabled = true;
  });

  editor.on('undo', function (e) {
    document.getElementById('redo').disabled = false;
    document.getElementById('redo_mobile').disabled = false;
    if (editor.undoIndex == editor.undoLBound) {
      // The lower bound of undo data is reached
      document.getElementById('undo').disabled = true;
      document.getElementById('undo_mobile').disabled = true;
    }
    if (aceEditor) {
      aceEditor.session.setValue(editor.lastActionJson);
    }
    syncUrl();
  });

  editor.on('redo', function (e) {
    document.getElementById('undo').disabled = false;
    document.getElementById('undo_mobile').disabled = false;
    if (editor.undoIndex == editor.undoUBound) {
      // The lower bound of undo data is reached
      document.getElementById('redo').disabled = true;
      document.getElementById('redo_mobile').disabled = true;
    }
    if (aceEditor) {
      aceEditor.session.setValue(editor.lastActionJson);
    }
    syncUrl();
  });

  editor.on('scaleChange', function (e) {
    document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
    document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  });

  init();

  document.getElementById('undo').disabled = true;
  document.getElementById('redo').disabled = true;

  document.getElementById('undo_mobile').disabled = true;
  document.getElementById('redo_mobile').disabled = true;


  window.onresize = function (e) {
    if (window.devicePixelRatio) {
      simulator.dpr = window.devicePixelRatio;
    }
    scene.setViewportSize(canvas.width / simulator.dpr, canvas.height / simulator.dpr);

    if (simulator.ctxAboveLight) {
      canvas.width = window.innerWidth * simulator.dpr;
      canvas.height = window.innerHeight * simulator.dpr;
      canvasBelowLight.width = window.innerWidth * simulator.dpr;
      canvasBelowLight.height = window.innerHeight * simulator.dpr;
      canvasLight.width = window.innerWidth * simulator.dpr;
      canvasLight.height = window.innerHeight * simulator.dpr;
      canvasGrid.width = window.innerWidth * simulator.dpr;
      canvasGrid.height = window.innerHeight * simulator.dpr;
      simulator.updateSimulation();
    }
  };

  window.onkeydown = function (e) {
    //Ctrl+Z
    if (e.ctrlKey && e.keyCode == 90) {
      if (document.getElementById('undo').disabled == false) {
        editor.undo();
      }
      return false;
    }
    //Ctrl+D
    if (e.ctrlKey && e.keyCode == 68) {
      if (scene.objs[editor.selectedObjIndex].constructor.type == 'Handle') {
        scene.cloneObjsByHandle(editor.selectedObjIndex);
      } else {
        scene.cloneObj(editor.selectedObjIndex);
      }

      simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
      editor.onActionComplete();
      return false;
    }
    //Ctrl+Y
    if (e.ctrlKey && e.keyCode == 89) {
      document.getElementById('redo').onclick();
    }

    //Ctrl+S
    if (e.ctrlKey && e.keyCode == 83) {
      save();
      return false;
    }

    //Ctrl+O
    if (e.ctrlKey && e.keyCode == 79) {
      document.getElementById('open').onclick();
      return false;
    }

    //esc
    if (e.keyCode == 27) {
      if (editor.isConstructing) {
        editor.undo();
      }
    }

    //Delete
    if (e.keyCode == 46 || e.keyCode == 8) {
      if (editor.selectedObjIndex != -1) {
        var selectedObjType = scene.objs[editor.selectedObjIndex].constructor.type;
        editor.removeObj(editor.selectedObjIndex);
        simulator.updateSimulation(!objTypes[selectedObjType].isOptical, true);
        editor.onActionComplete();
      }
      return false;
    }

    //Arrow Keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
      var step = scene.snapToGrid ? scene.gridSize : 1;
      if (editor.selectedObjIndex >= 0) {
        if (e.keyCode == 37) {
          scene.objs[editor.selectedObjIndex].move(-step, 0);
        }
        if (e.keyCode == 38) {
          scene.objs[editor.selectedObjIndex].move(0, -step);
        }
        if (e.keyCode == 39) {
          scene.objs[editor.selectedObjIndex].move(step, 0);
        }
        if (e.keyCode == 40) {
          scene.objs[editor.selectedObjIndex].move(0, step);
        }
        simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
      }
      else if (scene.mode == 'observer') {
        if (e.keyCode == 37) {
          scene.observer.c.x -= step;
        }
        if (e.keyCode == 38) {
          scene.observer.c.y -= step;
        }
        if (e.keyCode == 39) {
          scene.observer.c.x += step;
        }
        if (e.keyCode == 40) {
          scene.observer.c.y += step;
        }
        simulator.updateSimulation(false, true);
      }
      else {
        // TODO: Is this a historical remnant? Should the expected behavior be to change `scene.origin` instead? Note however that some users may be using the current behavior to align the scene with the background image or the grid.
        for (var i = 0; i < scene.objs.length; i++) {
          if (e.keyCode == 37) {
            scene.objs[i].move(-step, 0);
          }
          if (e.keyCode == 38) {
            scene.objs[i].move(0, -step);
          }
          if (e.keyCode == 39) {
            scene.objs[i].move(step, 0);
          }
          if (e.keyCode == 40) {
            scene.objs[i].move(0, step);
          }
        }
        simulator.updateSimulation();
      }
    }
  };

  window.onkeyup = function (e) {
    //Arrow Keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
      editor.onActionComplete();
    }
  };

  document.getElementById('undo').onclick = function () {
    this.blur();
    editor.undo();
  }
  document.getElementById('undo_mobile').onclick = document.getElementById('undo').onclick;
  document.getElementById('redo').onclick = function () {
    this.blur();
    editor.redo();
  }
  document.getElementById('redo_mobile').onclick = document.getElementById('redo').onclick;
  document.getElementById('reset').onclick = function () {
    history.replaceState('', document.title, window.location.pathname + window.location.search);
    init();
    document.getElementById("welcome").innerHTML = welcome_msgs[lang];
    document.getElementById('welcome').style.display = '';
    editor.onActionComplete();
    isFromGallery = false;
    hasUnsavedChange = false;
    if (aceEditor) {
      aceEditor.session.setValue(editor.lastActionJson);
    }
  };
  document.getElementById('reset_mobile').onclick = document.getElementById('reset').onclick

  document.getElementById('get_link').onclick = getLink;
  document.getElementById('get_link_mobile').onclick = getLink;
  document.getElementById('export_svg').onclick = function() {
    editor.enterCropMode();
  };
  document.getElementById('export_svg_mobile').onclick = function() {
    editor.enterCropMode();
  };
  document.getElementById('open').onclick = function () {
    document.getElementById('openfile').click();
  };
  document.getElementById('open_mobile').onclick = document.getElementById('open').onclick
  document.getElementById('view_gallery').onclick = function () {
    window.open(getMsg("gallery_url"));
  };
  document.getElementById('view_gallery_mobile').onclick = document.getElementById('view_gallery').onclick;


  document.getElementById('openfile').onchange = function () {
    openFile(this.files[0]);
  };

  document.getElementById('simulateColors').onclick = function () {
    scene.simulateColors = this.checked;
    document.getElementById('simulateColors').checked = scene.simulateColors;
    document.getElementById('simulateColors_mobile').checked = scene.simulateColors;
    editor.selectObj(editor.selectedObjIndex);
    this.blur();
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  };
  document.getElementById('simulateColors_mobile').onclick = document.getElementById('simulateColors').onclick;

  document.getElementById('show_help_popups').onclick = function () {
    this.blur();
    popoversEnabled = this.checked;
    localStorage.rayOpticsHelp = popoversEnabled ? "on" : "off";
  };

  document.getElementById('show_json_editor').onclick = function () {
    this.blur();

    document.getElementById('show_json_editor').checked = this.checked;
    document.getElementById('show_json_editor_mobile').checked = this.checked;

    if (this.checked) {
      enableJsonEditor();
    } else {
      disableJsonEditor();
    }

    localStorage.rayOpticsShowJsonEditor = this.checked ? "on" : "off";
  };
  document.getElementById('show_json_editor_mobile').onclick = document.getElementById('show_json_editor').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsShowJsonEditor && localStorage.rayOpticsShowJsonEditor == "on") {
    enableJsonEditor();
    document.getElementById('show_json_editor').checked = true;
    document.getElementById('show_json_editor_mobile').checked = true;
  } else {
    document.getElementById('show_json_editor').checked = false;
    document.getElementById('show_json_editor_mobile').checked = false;
  }

  document.getElementById('show_status').onclick = function () {
    this.blur();

    document.getElementById('show_status').checked = this.checked;
    document.getElementById('show_status_mobile').checked = this.checked;

    document.getElementById('status').style.display = this.checked ? '' : 'none';
    localStorage.rayOpticsShowStatus = this.checked ? "on" : "off";
  };
  document.getElementById('show_status_mobile').onclick = document.getElementById('show_status').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsShowStatus && localStorage.rayOpticsShowStatus == "on") {
    document.getElementById('show_status').checked = true;
    document.getElementById('show_status_mobile').checked = true;
    document.getElementById('status').style.display = '';
  } else {
    document.getElementById('show_status').checked = false;
    document.getElementById('show_status_mobile').checked = false;
    document.getElementById('status').style.display = 'none';
  }

  document.getElementById('auto_sync_url').onclick = function () {
    this.blur();

    document.getElementById('auto_sync_url').checked = this.checked;
    document.getElementById('auto_sync_url_mobile').checked = this.checked;

    localStorage.rayOpticsAutoSyncUrl = this.checked ? "on" : "off";
    autoSyncUrl = this.checked;

    editor.onActionComplete();
  };
  document.getElementById('auto_sync_url_mobile').onclick = document.getElementById('auto_sync_url').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsAutoSyncUrl && localStorage.rayOpticsAutoSyncUrl == "on") {
    document.getElementById('auto_sync_url').checked = true;
    document.getElementById('auto_sync_url_mobile').checked = true;
    autoSyncUrl = true;
  } else {
    document.getElementById('auto_sync_url').checked = false;
    document.getElementById('auto_sync_url_mobile').checked = false;
    autoSyncUrl = false;
  }

  document.getElementById('gridSize').onchange = function () {
    scene.gridSize = parseFloat(this.value);
    document.getElementById('gridSize').value = scene.gridSize;
    document.getElementById('gridSize_mobile').value = scene.gridSize;
    simulator.updateSimulation(true, false);
    editor.onActionComplete();
  }
  document.getElementById('gridSize_mobile').onchange = document.getElementById('gridSize').onchange;

  document.getElementById('gridSize').onclick = function () {
    this.select();
  }
  document.getElementById('gridSize_mobile').onclick = document.getElementById('gridSize').onclick;

  document.getElementById('gridSize').onkeydown = function (e) {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('gridSize_mobile').onkeydown = document.getElementById('gridSize').onkeydown;

  document.getElementById('observer_size').onchange = function () {
    document.getElementById('observer_size').value = this.value;
    document.getElementById('observer_size_mobile').value = this.value;
    if (scene.observer) {
      scene.observer.r = parseFloat(this.value) * 0.5;
    }
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  }
  document.getElementById('observer_size_mobile').onchange = document.getElementById('observer_size').onchange;

  document.getElementById('observer_size').onclick = function () {
    this.select();
  }
  document.getElementById('observer_size_mobile').onclick = document.getElementById('observer_size').onclick;

  document.getElementById('observer_size').onkeydown = function (e) {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('observer_size_mobile').onkeydown = document.getElementById('observer_size').onkeydown;

  document.getElementById('lengthScale').onchange = function () {
    scene.lengthScale = parseFloat(this.value);
    if (isNaN(scene.lengthScale)) {
      scene.lengthScale = 1;
    }
    if (scene.lengthScale < 0.1) {
      scene.lengthScale = 0.1;
    }
    if (scene.lengthScale > 10) {
      scene.lengthScale = 10;
    }
    document.getElementById('lengthScale').value = scene.lengthScale;
    document.getElementById('lengthScale_mobile').value = scene.lengthScale;
    editor.setScale(scene.scale);
    simulator.updateSimulation();
    editor.onActionComplete();
  }
  document.getElementById('lengthScale_mobile').onchange = document.getElementById('lengthScale').onchange;

  document.getElementById('lengthScale').onclick = function () {
    this.select();
  }
  document.getElementById('lengthScale_mobile').onclick = document.getElementById('lengthScale').onclick;

  document.getElementById('lengthScale').onkeydown = function (e) {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('lengthScale_mobile').onkeydown = document.getElementById('lengthScale').onkeydown;


  document.getElementById('zoomPlus').onclick = function () {
    editor.setScale(scene.scale * 1.1);
    editor.onActionComplete();
    this.blur();
  }
  document.getElementById('zoomMinus').onclick = function () {
    editor.setScale(scene.scale / 1.1);
    editor.onActionComplete();
    this.blur();
  }
  document.getElementById('zoomPlus_mobile').onclick = document.getElementById('zoomPlus').onclick;
  document.getElementById('zoomMinus_mobile').onclick = document.getElementById('zoomMinus').onclick;


  document.getElementById('rayDensity').oninput = function () {
    scene.rayDensity = Math.exp(this.value);
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    simulator.updateSimulation(false, true);
  };
  document.getElementById('rayDensity_more').oninput = document.getElementById('rayDensity').oninput;
  document.getElementById('rayDensity_mobile').oninput = document.getElementById('rayDensity').oninput;

  document.getElementById('rayDensity').onmouseup = function () {
    scene.rayDensity = Math.exp(this.value); // For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    this.blur();
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  };
  document.getElementById('rayDensity_more').onmouseup = document.getElementById('rayDensity').onmouseup;
  document.getElementById('rayDensity_mobile').onmouseup = document.getElementById('rayDensity').onmouseup;

  document.getElementById('rayDensity').ontouchend = function () {
    scene.rayDensity = Math.exp(this.value); // For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    this.blur();
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  };
  document.getElementById('rayDensity_more').ontouchend = document.getElementById('rayDensity').ontouchend;
  document.getElementById('rayDensity_mobile').ontouchend = document.getElementById('rayDensity').ontouchend;

  document.getElementById('rayDensityPlus').onclick = function () {
    rayDensityValue = Math.log(scene.rayDensity) * 1.0 + 0.1;
    scene.rayDensity = Math.exp(rayDensityValue);
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    this.blur();
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  };
  document.getElementById('rayDensityMinus').onclick = function () {
    rayDensityValue = Math.log(scene.rayDensity) * 1.0 - 0.1;
    scene.rayDensity = Math.exp(rayDensityValue);
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    this.blur();
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
  };
  document.getElementById('rayDensityPlus_mobile').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_mobile').onclick = document.getElementById('rayDensityMinus').onclick;
  document.getElementById('rayDensityPlus_more').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_more').onclick = document.getElementById('rayDensityMinus').onclick;


  document.getElementById('snapToGrid').onclick = function (e) {
    document.getElementById('snapToGrid').checked = e.target.checked;
    document.getElementById('snapToGrid_more').checked = e.target.checked;
    document.getElementById('snapToGrid_mobile').checked = e.target.checked;
    scene.snapToGrid = e.target.checked;
    this.blur();
    editor.onActionComplete();
    //simulator.updateSimulation();
  };
  document.getElementById('snapToGrid_more').onclick = document.getElementById('snapToGrid').onclick;
  document.getElementById('snapToGrid_mobile').onclick = document.getElementById('snapToGrid').onclick;

  document.getElementById('showGrid').onclick = function (e) {
    document.getElementById('showGrid').checked = e.target.checked;
    document.getElementById('showGrid_more').checked = e.target.checked;
    document.getElementById('showGrid_mobile').checked = e.target.checked;
    scene.showGrid = e.target.checked;
    this.blur();
    simulator.updateSimulation(true, false);
    editor.onActionComplete();
  };
  document.getElementById('showGrid_more').onclick = document.getElementById('showGrid').onclick;
  document.getElementById('showGrid_mobile').onclick = document.getElementById('showGrid').onclick;

  document.getElementById('lockObjs').onclick = function (e) {
    document.getElementById('lockObjs').checked = e.target.checked;
    document.getElementById('lockObjs_more').checked = e.target.checked;
    document.getElementById('lockObjs_mobile').checked = e.target.checked;
    scene.lockObjs = e.target.checked;
    this.blur();
    editor.onActionComplete();
  };
  document.getElementById('lockObjs_more').onclick = document.getElementById('lockObjs').onclick;
  document.getElementById('lockObjs_mobile').onclick = document.getElementById('lockObjs').onclick;

  document.getElementById('forceStop').onclick = function () {
    simulator.stopSimulation();
  };

  document.getElementById('apply_to_all').onclick = function () {
    this.blur();
    const checked = this.checked;
    document.getElementById('apply_to_all').checked = checked;
    document.getElementById('apply_to_all_mobile').checked = checked;
  }
  document.getElementById('apply_to_all_mobile').onclick = document.getElementById('apply_to_all').onclick;

  document.getElementById('copy').onclick = function () {
    this.blur();
    scene.cloneObj(editor.selectedObjIndex).move(scene.gridSize, scene.gridSize);
    editor.selectObj(scene.objs.length - 1);
    simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
    editor.onActionComplete();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    var selectedObjType = scene.objs[editor.selectedObjIndex].constructor.type;
    this.blur();
    editor.removeObj(editor.selectedObjIndex);
    simulator.updateSimulation(!objTypes[selectedObjType].isOptical, true);
    editor.onActionComplete();
  };
  document.getElementById('delete_mobile').onclick = document.getElementById('delete').onclick;

  document.getElementById('unselect').onclick = function () {
    editor.selectObj(-1);
    simulator.updateSimulation(true, true);
    editor.onActionComplete();
  };
  document.getElementById('unselect_mobile').onclick = document.getElementById('unselect').onclick;

  document.getElementById('showAdvanced').onclick = function () {
    objBar.shouldShowAdvanced = true;
    editor.selectObj(editor.selectedObjIndex);
  };
  document.getElementById('showAdvanced_mobile').onclick = document.getElementById('showAdvanced').onclick;



  document.getElementById('save_name').onkeydown = function (e) {
    if (e.keyCode == 13) {
      //enter
      document.getElementById('save_confirm').onclick();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('save_confirm').onclick = save;
  document.getElementById('save_rename').onclick = rename;

  document.getElementById('xybox').onkeydown = function (e) {
    //console.log(e.keyCode)
    if (e.keyCode == 13) {
      //enter
      confirmPositioning(e.ctrlKey, e.shiftKey);
    }
    if (e.keyCode == 27) {
      //esc
      editor.endPositioning();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };

  document.getElementById('xybox').oninput = function (e) {
    this.size = this.value.length;
  };

  document.getElementById('xybox').addEventListener('contextmenu', function (e) {
    if (xyBox_cancelContextMenu) {
      e.preventDefault();
      xyBox_cancelContextMenu = false;
    }
  }, false);


  window.ondragenter = function (e) {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondragover = function (e) {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondrop = function (e) {
    e.stopPropagation();
    e.preventDefault();

    var dt = e.dataTransfer;
    if (dt.files[0]) {
      var files = dt.files;
      openFile(files[0]);
    }
    else {
      var fileString = dt.getData('text');
      editor.loadJSON(fileString);
      editor.onActionComplete();
    }
  };

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, false);

  MQ = MathQuill.getInterface(2);

  window.onerror = function (msg, url) {
    error = `Error: ${msg} at ${url}`;
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  // Update the scene when the URL changes
  window.onpopstate = function (event) {
    if (window.location.hash.length > 70) {
      // The URL contains a compressed JSON scene.
      JsonUrl('lzma').decompress(window.location.hash.substr(1)).then(json => {
        scene.backgroundImage = null;
        editor.loadJSON(JSON.stringify(json));
        editor.onActionComplete();
        isFromGallery = true;
        hasUnsavedChange = false;
        if (aceEditor) {
          aceEditor.session.setValue(editor.lastActionJson);
        }
      }).catch(e => {
        error = "JsonUrl: " + e;
        document.getElementById('welcome').style.display = 'none';
        updateErrorAndWarning();
      });;
    } else if (window.location.hash.length > 1) {
      // The URL contains a link to a gallery item.
      openSample(window.location.hash.substr(1) + ".json");
      history.replaceState('', document.title, window.location.pathname + window.location.search);
      isFromGallery = true;
    }
  };

  window.onpopstate();

  window.addEventListener('message', function (event) {
    if (event.data && event.data.rayOpticsModuleName) {
      importModule(event.data.rayOpticsModuleName + '.json');
    }
  });
};

function openSample(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../gallery/' + name);
  client.onload = function () {
    if (client.status >= 300) {
      error = "openSample: HTTP Request Error: " + client.status;
      document.getElementById('welcome').style.display = 'none';
      updateErrorAndWarning();
      return;
    }
    scene.backgroundImage = null;
    editor.loadJSON(client.responseText);

    editor.onActionComplete();
    isFromGallery = true;
    hasUnsavedChange = false;
    if (aceEditor) {
      aceEditor.session.setValue(editor.lastActionJson);
    }
  }
  client.onerror = function () {
    error = "openSample: HTTP Request Error";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }
  client.ontimeout = function () {
    error = "openSample: HTTP Request Timeout";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  client.send();
}

function importModule(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../modules/' + name);
  client.onload = function () {
    document.getElementById('welcome').style.display = 'none';
    if (client.status >= 300) {
      error = "importModule: HTTP Request Error: " + client.status;
      updateErrorAndWarning();
      return;
    }
    try {
      const moduleJSON = JSON.parse(client.responseText);
      for (let moduleName in moduleJSON.modules) {
        if (moduleJSON.modules.hasOwnProperty(moduleName)) {
          let newModuleName = moduleName;
          if (scene.modules[moduleName] && JSON.stringify(scene.modules[moduleName]) != JSON.stringify(moduleJSON.modules[moduleName])) {
            newModuleName = prompt(getMsg('module_conflict'), moduleName);
            if (!newModuleName) {
              continue;
            }
          }
          scene.addModule(newModuleName, moduleJSON.modules[moduleName]);
        }
      }
    } catch (e) {
      error = "importModule: " + e.toString();
      updateErrorAndWarning();
      return;
    }
    simulator.updateSimulation(false, true);
    editor.onActionComplete();
    updateModuleObjsMenu();
  }
  client.onerror = function () {
    error = "importModule: HTTP Request Error";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }
  client.ontimeout = function () {
    error = "importModule: HTTP Request Timeout";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  client.send();
}









function init() {
  document.title = getMsg('appName');
  document.getElementById('save_name').value = "";

  editor.isConstructing = false;
  editor.endPositioning();

  scene.backgroundImage = null;
  scene.loadJSON(JSON.stringify({ version: DATA_VERSION }), () => { });

  let dpr = window.devicePixelRatio || 1;

  scene.setViewportSize(canvas.width / dpr, canvas.height / dpr);

  editor.selectObj(-1);

  document.getElementById("rayDensity").value = scene.rayModeDensity;
  document.getElementById("rayDensity_more").value = scene.rayModeDensity;
  document.getElementById("rayDensity_mobile").value = scene.rayModeDensity;
  document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  toolbtn_clicked('');
  modebtn_clicked('rays');
  scene.backgroundImage = null;

  //Reset new UI.

  resetDropdownButtons();
  updateModuleObjsMenu();

  document.getElementById('tool_').checked = true;
  document.getElementById('tool__mobile').checked = true;
  document.getElementById('mode_rays').checked = true;
  document.getElementById('mode_rays_mobile').checked = true;

  document.getElementById('lockObjs').checked = false;
  document.getElementById('snapToGrid').checked = false;
  document.getElementById('showGrid').checked = false;

  document.getElementById('lockObjs_more').checked = false;
  document.getElementById('snapToGrid_more').checked = false;
  document.getElementById('showGrid_more').checked = false;

  document.getElementById('lockObjs_mobile').checked = false;
  document.getElementById('snapToGrid_mobile').checked = false;
  document.getElementById('showGrid_mobile').checked = false;

  document.getElementById('simulateColors').checked = false;
  document.getElementById('simulateColors_mobile').checked = false;

  document.getElementById('apply_to_all').checked = false;
  document.getElementById('apply_to_all_mobile').checked = false;

  document.getElementById('gridSize').value = scene.gridSize;
  document.getElementById('gridSize_mobile').value = scene.gridSize;

  document.getElementById('observer_size').value = 40;
  document.getElementById('observer_size_mobile').value = 40;

  document.getElementById('lengthScale').value = scene.lengthScale;
  document.getElementById('lengthScale_mobile').value = scene.lengthScale;

  simulator.updateSimulation();
}





var lastFullURL = "";
var syncUrlTimerId = -1;

function syncUrl() {
  if (!autoSyncUrl) return;
  if (document.getElementById('welcome').style.display != 'none') return;

  if (syncUrlTimerId != -1) {
    clearTimeout(syncUrlTimerId);
  }
  syncUrlTimerId = setTimeout(function () {
    var compressed = JsonUrl('lzma').compress(JSON.parse(editor.lastActionJson)).then(output => {
      var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
      if (fullURL.length > 2041) {
        warning = getMsg('auto_sync_url_warning');
        updateErrorAndWarning();
      } else {
        if (Math.abs(fullURL.length - lastFullURL.length) > 200) {
          // If the length of the scene change significantly, push a new history state to prevent accidental data loss.
          lastFullURL = fullURL;
          window.history.pushState(undefined, undefined, '#' + output);
        } else {
          lastFullURL = fullURL;
          window.history.replaceState(undefined, undefined, '#' + output);
        }
        hasUnsavedChange = false;
        warning = "";
        updateErrorAndWarning();
      }
    });
  }, 1000);
}


function toolbtn_clicked(tool, e) {
  if (tool != "") {
    document.getElementById('welcome').style.display = 'none';
  }
  editor.addingObjType = tool;
}


function modebtn_clicked(mode1) {
  scene.mode = mode1;
  if (scene.mode == 'images' || scene.mode == 'observer') {
    document.getElementById("rayDensity").value = Math.log(scene.imageModeDensity);
    document.getElementById("rayDensity_more").value = Math.log(scene.imageModeDensity);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.imageModeDensity);
  }
  else {
    document.getElementById("rayDensity").value = Math.log(scene.rayModeDensity);
    document.getElementById("rayDensity_more").value = Math.log(scene.rayModeDensity);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.rayModeDensity);
  }
  if (scene.mode == 'observer' && !scene.observer) {
    // Initialize the observer
    scene.observer = geometry.circle(geometry.point((canvas.width * 0.5 / simulator.dpr - scene.origin.x) / scene.scale, (canvas.height * 0.5 / simulator.dpr - scene.origin.y) / scene.scale), parseFloat(document.getElementById('observer_size').value) * 0.5);
  }


  simulator.updateSimulation(false, true);
}




function rename() {
  scene.name = document.getElementById('save_name').value;
  if (scene.name) {
    document.title = scene.name + " - " + getMsg("appName");
  } else {
    document.title = getMsg("appName");
  }
  editor.onActionComplete();
}

function save() {
  rename();

  var blob = new Blob([editor.lastActionJson], { type: 'application/json' });
  saveAs(blob, (scene.name || "scene") + ".json");
  var saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
  if (saveModal) {
    saveModal.hide();
  }
  hasUnsavedChange = false;
}

function openFile(readFile) {
  var reader = new FileReader();
  reader.readAsText(readFile);
  reader.onload = function (evt) {
    var fileString = evt.target.result;

    let isJSON = true;
    try {
      const parsed = JSON.parse(fileString);
      if (typeof parsed !== 'object' || parsed === null) {
        isJSON = false;
      }
    } catch (e) {
      isJSON = false;
    }

    if (isJSON) {
      // Load the scene file
      editor.loadJSON(fileString);
      hasUnsavedChange = false;
      editor.onActionComplete();
      if (aceEditor) {
        aceEditor.session.setValue(editor.lastActionJson);
      }
    } else {
      // Load the background image file
      reader.onload = function (e) {
        scene.backgroundImage = new Image();
        scene.backgroundImage.src = e.target.result;
        scene.backgroundImage.onload = function (e1) {
          simulator.updateSimulation(true, true);
        }
        scene.backgroundImage.onerror = function (e1) {
          scene.backgroundImage = null;
          error = "openFile: The file is neither a valid JSON scene nor an image file.";
          updateErrorAndWarning();
        }
      }
      reader.readAsDataURL(readFile);
    }
  };

}

function getLink() {
  JsonUrl('lzma').compress(JSON.parse(editor.lastActionJson)).then(output => {
    var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
    lastFullURL = fullURL;
    window.history.pushState(undefined, undefined, '#' + output);
    //console.log(fullURL.length);
    navigator.clipboard.writeText(fullURL);
    if (fullURL.length > 2041) {
      alert(getMsg("get_link_warning"));
    } else {
      hasUnsavedChange = false;
    }
  });
}


window.onbeforeunload = function (e) {
  if (hasUnsavedChange) {
    return "You have unsaved change.";
  }
}

function confirmPositioning(ctrl, shift) {
  var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
  if (xyData.length == 2) {
    editor.confirmPositioning(xyData[0], xyData[1], ctrl, shift);
  }
}
