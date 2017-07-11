import BaseWidget = require("jimu/BaseWidget");
import lang = require("dojo/_base/lang");
import array = require("dojo/_base/array");
import event = require("dojo/_base/event");
import json = require('dojo/_base/json');
import domConstruct = require("dojo/dom-construct");
import Button = require("dijit/form/Button");
import FeatureLayer = require("esri/layers/FeatureLayer");
import geometryEngine = require("esri/geometry/geometryEngine");
import Graphic = require("esri/graphic");
import SimpleFillSymbol = require("esri/symbols/SimpleFillSymbol");
import SimpleLineSymbol = require("esri/symbols/SimpleLineSymbol");
import Color = require("esri/Color");
import Polygon = require("esri/geometry/Polygon");
import Edit = require("esri/toolbars/edit");
import Draw = require("esri/toolbars/draw");
import TemplatePicker = require("esri/dijit/editing/TemplatePicker");
import AttributeInspector = require("esri/dijit/AttributeInspector");
import Query = require("esri/tasks/query");
import Point = require("esri/geometry/Point");
import InfoTemplate = require("esri/InfoTemplate");

class Widget extends BaseWidget {

  public baseClass: string = "jimu-widget-kauflandworkflow";
  public config: SpecificWidgetConfig;
  private attInspector : AttributeInspector;
  private subnode: HTMLElement;

  constructor(args?) {
    super(lang.mixin({baseClass: "jimu-widget-kauflandworkflow"}, args));  // replaces "this.inherited(args)" from Esri tutorials
  }

  startup() {
    console.log('startup', this.config, this.map);
  }

  postCreate() {
    console.log('postCreate', this.config);
  }

  onOpen() {
    console.log('onOpen lala popo fifi mumu kaka');
  }

  onClose() {
    console.log('onClose');
  }

  onMinimize() {
    console.log('onMinimize');
  }

  onMaximize() {
    console.log('onMaximize');
  }

  onSignIn(credential){
    /* jshint unused:false*/
    console.log('onSignIn');
  }

  onSignOut() {
    console.log('onSignOut');
  }

  generateBufferAroundPointSelection() {
    var pointLayer = this.map.getLayer(this.config.pointLayerId) as FeatureLayer;
    var pointSelection = pointLayer.getSelectedFeatures();

    var pointGeometries = pointSelection.map(
      currentValue => currentValue.geometry
    )
    var pointBuffers = geometryEngine.geodesicBuffer(pointGeometries, this.bufferRadiusMeters.value, "meters") as Polygon[];

    var symbol = new SimpleFillSymbol();
    symbol.setColor(new Color([100,100,100,0.25]));
    symbol.setOutline(new SimpleLineSymbol(
            SimpleLineSymbol.STYLE_SOLID,
            new Color('#000'), 
            1
          ));

    // add buffers to map default graphic layer with attributes from original points
    pointBuffers.map(
      (pointBuffer, pointIndex) => this.map.graphics.add(new Graphic(pointBuffer,symbol,{
        "title": pointSelection[pointIndex].attributes.title,
        "pointidentifier": pointSelection[pointIndex].attributes.pointidentifier,
        "category": "buffer"
      }))
    );
  }

  resetBuffers() {
    var graphicsToRemove = this.map.graphics.graphics.filter(function(graphic) {
        return graphic.attributes && graphic.attributes.category==="buffer";
    });
    graphicsToRemove.map(graphic => this.map.graphics.remove(graphic));
  }

  editPolygons() {
    var editLayer = this.map.getLayer(this.config.polygonLayerId) as FeatureLayer;

    var editToolbar = new Edit(this.map);
    editToolbar.on("deactivate", function(evt) {
      editLayer.applyEdits(null, [evt.graphic], null);
    });

    var editingEnabled = false;
    editLayer.on("dbl-click", function(evt) {
      event.stop(evt);
      if (editingEnabled === false) {
        editingEnabled = true;
        editToolbar.activate(Edit.EDIT_VERTICES , evt.graphic);
      } else {
        editLayer = this;
        editToolbar.deactivate();
        editingEnabled = false;
      }
    });

/*    editLayer.on("click", function(evt) {
      event.stop(evt);
      if (evt.ctrlKey === true || evt.metaKey === true) {  //delete feature if ctrl key is depressed
        editLayer.applyEdits(null,null,[evt.graphic]);
        editLayer = this;
        editToolbar.deactivate();
        editingEnabled=false;
      }
    });*/

    this.initializeTemplatePicker(editLayer, editToolbar);

    this.initializeAttributeInspector(editLayer);
  }

  initializeTemplatePicker(editLayer: FeatureLayer, editToolbar: Edit) {
    var layers = [];
    layers.push(editLayer);
    var templatePicker = new TemplatePicker({
      featureLayers: layers,
      rows: "auto",
      columns: "auto",
      grouping: true,
      style: "height: auto; overflow: auto;"
    }, "templatePickerDiv");

    templatePicker.startup();

    var drawToolbar = new Draw(this.map);

    var selectedTemplate;
    templatePicker.on("selection-change", function() {
      if( templatePicker.getSelected() ) {
        selectedTemplate = templatePicker.getSelected();
      }
      switch (selectedTemplate.featureLayer.geometryType) {
        case "esriGeometryPoint":
          drawToolbar.activate(Draw.POINT);
          break;
        case "esriGeometryPolyline":
          drawToolbar.activate(Draw.POLYLINE);
          break;
        case "esriGeometryPolygon":
          drawToolbar.activate(Draw.POLYGON);
          break;
      }
    });

    drawToolbar.on("draw-end", function(evt) {
      drawToolbar.deactivate();
      editToolbar.deactivate();
      var newAttributes = lang.mixin({}, selectedTemplate.template.prototype.attributes);
      var newGraphic = new Graphic(evt.geometry, null, newAttributes);
      selectedTemplate.featureLayer.applyEdits([newGraphic], null, null);
    });
  }

  initializeAttributeInspector(editLayer: FeatureLayer) {
    var layerInfos = [
      {
        'featureLayer': editLayer,
        'showAttachments': false,
        'showDeleteButton': true,
        'isEditable': true,
        'fieldInfos': [
          {
            "fieldName": "title",
            "isEditable": true,
            "tooltip": "Title",
            "label": "Title:"
          },
          {
            "fieldName": "description",
            "isEditable": true,
            "tooltip": "Description",
            "label": "Description:"
          },
          {
            "fieldName": "date",
            "isEditable": false,
            "tooltip": "Date",
            "label": "Date:"
          },
          {
            "fieldName": "typeid",
            "isEditable": false,
            "tooltip": "TypeID",
            "label": "TypeID:"
          },
          {
            "fieldName": "pointidentifier",
            "isEditable": true,
            "tooltip": "Unique Point Identifier",
            "label": "Unique Point Identifier:"
          }
        ]
      }
    ];

    //Initialize Attribute Inspector
    this.attInspector = new AttributeInspector({
      layerInfos: layerInfos
    }, domConstruct.create("div"));

    //add a save button next to the delete button
    var saveButton = new Button({ label: "Save", "class": "saveButton"},domConstruct.create("div"));
    domConstruct.place(saveButton.domNode, this.attInspector.deleteBtn.domNode, "after");

    var updateFeature : Graphic;

    saveButton.on("click", function() {
      updateFeature.getLayer().applyEdits(null, [updateFeature], null);
    });

    this.attInspector.on("attribute-change", function(evt) {
      //store the updates to apply when the save button is clicked
      updateFeature.attributes[evt.fieldName] = evt.fieldValue;
    });

    this.attInspector.on("next", function(evt) {
      updateFeature = evt.feature;
      console.log("Next " + updateFeature.attributes.OBJECTID);
    });

    this.attInspector.on("delete", function(evt) {
      evt.feature.getLayer().applyEdits(null, null, [evt.feature]);
      this.map.infoWindow.hide();
    });


/*    var infoTemplate = editLayer.infoTemplate;
      infoTemplate.setTitle("Population");
      infoTemplate.setContent("<b>2007 :D: </b>${objectid}<br/>" +
                              "<b>2007 density: </b>${ruleid}<br/>" +
                              "<b>2000: </b>${name}");
    editLayer.setInfoTemplate(infoTemplate);*/

/*    var infoTemplate = new InfoTemplate(); //editLayer.infoTemplate;
    infoTemplate.setContent(attInspector.domNode);
    editLayer.setInfoTemplate(infoTemplate);*/

    
/*    this.map.infoWindow.setContent(attInspector.domNode);
    this.map.infoWindow.resize(350, 240);*/

    var selectQuery = new Query();
    this.map.on("click", lang.hitch(this, function(evt) {
      selectQuery.geometry = evt.mapPoint;
/*      selectQuery.distance = 50;
      selectQuery.units = "miles"*/
      selectQuery.returnGeometry = true;
      editLayer.selectFeatures(selectQuery, FeatureLayer.SELECTION_NEW, lang.hitch(this, function(features) {
        if (features.length > 0) {
          //store the current feature
          updateFeature = features[0];
          this.map.infoWindow.setTitle(features[0].getLayer().name);
          this.map.infoWindow.setContent(this.attInspector.domNode);
          editLayer.infoTemplate.setContent(this.attInspector.domNode);
          //this.map.infoWindow.show(evt.screenPoint, this.map.getInfoWindowAnchor(evt.screenPoint));
        }
        else {
          this.map.infoWindow.hide();
        }
      }));
    }));

    this.map.infoWindow.on("hide", function() {
      editLayer.clearSelection();
    });

  }

}

interface SpecificWidgetConfig{
  value: string;
  elements: Item[];
}

interface Item{
  name: string;
  href: string;
}

export = Widget;