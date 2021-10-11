OpenLayers.Control.DXFExport = OpenLayers.Class(OpenLayers.Control, {
    //type: OpenLayers.Control.TYPE_TOGGLE,
    formId: null, //id del form di stampa
    loadingControl: null,
    baseUrl: null,
    offsetLeft: 0, //pannelli che se aperti riducono l'area della mappa
    offsetRight: 0,
    offsetTop: 0,
    offsetBottom: 0,
    margin: 25,
    boxScale: null,
    printDate: null,
    layerBox: null,
    allowDrag: false,
    allowResize: true,
    allowRotation: false,
    autoCenter: false,
    styleBox: null,
    defaultLayers: [],
    waitFor: undefined,//se il pannello viene caricato async, il tool aspetta il caricamento prima di far partire la richiesta per il box
    initialBBEdge: 100,
    maxArea: clientConfig.DXF_MAX_AREA, //mq di area massima estraibile
    EVENT_TYPES: ["activate", "deactivate", "panelready", "updateboxInfo", "exported"],
    pages: null,
    exportFilter: null,

    initialize: function (options) {
        OpenLayers.Control.prototype.initialize.apply(this, arguments);
    },
    setMap: function (map) {
        //si pu� spostare in initialize quando togliamo i parametri che dipendono da map
        var me = this;
        OpenLayers.Control.prototype.setMap.apply(me, arguments);
        if (!me.loadingControl) {
            var query = me.map.getControlsByClass('OpenLayers.Control.LoadingPanel');
            if (query.length) me.loadingControl = query[0];
        }

        this.layerbox = new OpenLayers.Layer.Vector("LayerBox", { styleMap: me.styleBox });
        this.map.addLayer(this.layerbox);

        if (this.allowDrag || this.allowResize || this.allowRotate) {
            this.modifyControl = new OpenLayers.Control.ModifyFeature(this.layerbox);
            this.map.addControl(this.modifyControl);
            this.layerbox.events.register('featuremodified', this, this.boxModify);
        }

        //controllo per nascondere il bottone
        map.events.register('zoomend', null, function () {
            var zoom = map.getZoom();
            if (zoom >= 1) {
                $("a[title=\"Esporta DXF\"]").css("display", "block");

            } else {
                $("a[title=\"Esporta DXF\"]").css("display", "none");
            }
        });
    },

    getParams: function () {
        var self = this;
        var size = this.map.getCurrentSize();
        var center = this.map.getCenter();
        var copyrightString = null;
        var searchControl = this.map.getControlsByClass('OpenLayers.Control.Attribution');
        if (searchControl.length > 0) {
            copyrightString = searchControl[0].div.innerText;
        }

        var srid;
        var extent = this.map.calculateBounds();
        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            center.transform(this.map.getProjectionObject(), projCOK);
            extent.transform(this.map.getProjectionObject(), projCOK);
            srid = this.map.displayProjection;
        }
        else {
            srid = this.map.getProjection();
        }
        if (srid == 'EPSG:900913') srid = 'EPSG:3857';

        params = {
            viewport_size: [size.w, size.h],
            center: [center.lon, center.lat],
            srid: srid,
            copyrightString: copyrightString,
            extent: extent.toBBOX() //Non serve ma me lo chiede da vedere
        }

        return params;
    },



    boxModify: function (e) {

        var bounds = e.feature.geometry.getBounds();
        //calcoli in metri. Sul sistema 3857 sarebbe da rivedere
        //devo limitare l'area di definizione
        var area = (bounds.right - bounds.left) * (bounds.top - bounds.bottom);
        if (area > this.maxArea) {
            area = this.maxArea;
            var maxBBEdge = Math.sqrt(this.maxArea);
            var bounds = this.exportBox.geometry.getBounds();
            var center = bounds.getCenterLonLat();
            var newBounds;
            //if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            //	var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            //	center.transform(this.map.getProjectionObject(), projCOK);
            //	newBounds = new OpenLayers.Bounds(center.lon - maxBBEdge/2, center.lat - maxBBEdge/2, center.lon + maxBBEdge/2,  center.lat + maxBBEdge/2);
            //	newBounds.transform(projCOK, this.map.getProjectionObject());
            //}
            //else {
            newBounds = new OpenLayers.Bounds(center.lon - maxBBEdge / 2, center.lat - maxBBEdge / 2, center.lon + maxBBEdge / 2, center.lat + maxBBEdge / 2);
            //}
            //????????????????????????????????????????? non aggiorna
            //NON RIESCO A MODIFICARE LA FEATURE. QUINDI LA TOLGO E LA RIAGGIUNGO POI VEDIAMO
            if (this.modifyControl)
                if (this.modifyControl.feature)
                    this.modifyControl.unselectFeature(this.exportBox);
            this.exportBox.destroy();
            this.exportBox = new OpenLayers.Feature.Vector(newBounds.toGeometry());
            this.layerbox.addFeatures(this.exportBox);
        }
        this.updateUrlDownloadDxf();
        $("#exportAreaSize").html(Math.round(area) + " mq");
        this.events.triggerEvent("updateboxInfo");
    },

    updateUrlDownloadDxf: function () {
        var me = this;
        var params = me.getParams();
        //params["tiles"] = me.getTiles();
        //params["format"] = me.printFormat;
        var bounds = me.exportBox.geometry.getBounds().clone();
        if (this.map.displayProjection && this.map.displayProjection != this.map.projection) {
            var projCOK = new OpenLayers.Projection(this.map.displayProjection);
            bounds.transform(this.map.getProjectionObject(), projCOK);
        }
        //definisco il BB da estrarre
        var center = bounds.getCenterLonLat();
        var width = bounds.getWidth();
        var height = bounds.getHeight();
        params["center"] = [center.lon, center.lat];
        params["extent"] = [center.lon - width / 2, center.lat - height / 2, center.lon + width / 2, center.lat + height / 2].join(",");
        params = {};
        params.project = GisClientMap.projectName;
        var mapSetThemes = $('.dxfexport_themes:checked').map(function () { return this.value; }).get().join(';');
        if (!mapSetThemes) {
            alert("Selezionare almeno un tema.");
            //seleziono il primo tema
            $('.dxfexport_themes').first().prop('checked', true);
            return;
        }
        //ricavo i temi/mapset
        var mapSetThemes = mapSetThemes.split(';');
        var themes = new Array();
        var mapSet = new Array();
        for (var i = 0; i < mapSetThemes.length; i++) {
            var mapSetTheme = mapSetThemes[i].split(',');
            mapSet.push(mapSetTheme[0]);
            for (var k = 1; k < mapSetTheme.length; k++) {
                themes.push(mapSetTheme[k]);
            }
        }
        //setto i parametri
        params.themes = themes.join();
        params.mapset = mapSet.join();
        params.epsg = clientConfig.DXF_EPSG;
        params.template = clientConfig.DXF_TEMPLATE;
        params.miny = center.lat - height / 2;
        params.maxy = center.lat + height / 2;
        params.minx = center.lon - width / 2;
        params.maxx = center.lon + width / 2;

        //parametri avanzati
        params.enableTemplateLayer = document.getElementById('enableTemplateLayer').checked ? 1 : 0;
        params.enableColors = document.getElementById('enableColors').checked ? 0 : 1;
        params.enableLineThickness = document.getElementById('enableLineThickness').checked ? 0 : 1;
        if (document.getElementById('exportEmptyLayers')) {
            params.exportEmptyLayers = document.getElementById('exportEmptyLayers').checked ? 1 : 0;
        } else {
            params.exportEmptyLayers = 0;
        }
        var textScaleMultiplier = document.getElementById('textScaleMultiplier');
        if (textScaleMultiplier.value)
            params.textScaleMultiplier = textScaleMultiplier.value;
        var labelScaleMultiplier = document.getElementById('labelScaleMultiplier');
        if (labelScaleMultiplier.value)
            params.labelScaleMultiplier = labelScaleMultiplier.value;
        var insertScaleMultiplier = document.getElementById('insertScaleMultiplier');
        if (insertScaleMultiplier.value)
            params.insertScaleMultiplier = insertScaleMultiplier.value;

        //Aggiorno il link per il download
        var url = clientConfig.DXF_SERVICE_URL + 'services/plugins/dxfexport/gcExportService.php?' + $.param(params);
        $("#hdnExportDxfUrl").val(url);

    },
    updateUrlDownloadDxfSingle: function () {
        var me = this;
        var params = {};

        //setto i parametri
        params.project = GisClientMap.projectName;
        params.themes = $('#exportFilter_theme').val();
        params.layers = $('#exportFilter_layer').val();
        params.attributeFilters = JSON.stringify(this.exportFilter);
        params.mapset = GisClientMap.mapsetName;
        params.epsg = 25832;//clientConfig.DXF_EPSG;
        params.template = clientConfig.DXF_TEMPLATE;

        //parametri avanzati
        params.enableTemplateLayer = document.getElementById('enableTemplateLayer').checked ? 1 : 0;
        params.enableColors = document.getElementById('enableColors').checked ? 0 : 1;
        params.enableLineThickness = document.getElementById('enableLineThickness').checked ? 0 : 1;
        if (document.getElementById('exportEmptyLayers')) {
            params.exportEmptyLayers = document.getElementById('exportEmptyLayers').checked ? 1 : 0;
        } else {
            params.exportEmptyLayers = 0;
        }
        var textScaleMultiplier = document.getElementById('textScaleMultiplier');
        if (textScaleMultiplier.value)
            params.textScaleMultiplier = textScaleMultiplier.value;
        var labelScaleMultiplier = document.getElementById('labelScaleMultiplier');
        if (labelScaleMultiplier.value)
            params.labelScaleMultiplier = labelScaleMultiplier.value;
        var insertScaleMultiplier = document.getElementById('insertScaleMultiplier');
        if (insertScaleMultiplier.value)
            params.insertScaleMultiplier = insertScaleMultiplier.value;

        //Aggiorno il link per il download
        var url = clientConfig.DXF_SERVICE_URL + 'services/plugins/dxfexport/gcExportService.php?' + $.param(params);
        return url;
    },
    updateUrlDownloadShpSingle: function () {
        var me = this;
        var params = {};// me.getParams();

        //setto i parametri
        params.project = GisClientMap.projectName;
        params.themes = $('#exportFilter_theme').val();
        params.layers = $('#exportFilter_layer').val();
        params.attributeFilters = JSON.stringify(this.exportFilter);
        params.mapset = GisClientMap.mapsetName;
        params.epsg = clientConfig.DXF_EPSG;
        params.template = clientConfig.DXF_TEMPLATE;
        params.miny = 4824646.28977;
        params.maxy = 5156356.89301;
        params.minx = 302647.17954;
        params.maxx = 824846.55925;
        //Aggiorno il link per il download
        var url = clientConfig.DXF_SERVICE_URL + 'services/plugins/dxfexport/gcExportShapeZipService.php?' + $.param(params);
        return url;
    },
    activate: function () {
        var activated = OpenLayers.Control.prototype.activate.call(this);
        if (activated) {
            //.................

        }
    },

    updateMode: function () {
        this.modifyControl.mode = 0;
        if (this.allowDrag) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.DRAG;
        if (this.allowResize) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.RESIZE;
        if (this.allowRotation) this.modifyControl.mode |= OpenLayers.Control.ModifyFeature.ROTATE;
    },

    drawExportBox: function () {
        var self = this;
        //calcolo l'area libera per il box di esportazione in metri
        var boxW = this.initialBBEdge; //metri
        var boxH = this.initialBBEdge; //metri

        var centerWPix = parseInt((this.map.size.w) / 2);
        var centerHPix = parseInt((this.map.size.h) / 2);
        var ct = this.map.getLonLatFromPixel(new OpenLayers.Pixel(centerWPix, centerHPix));
        var bounds = new OpenLayers.Bounds(ct.lon - (boxW / 2), ct.lat - (boxH / 2), ct.lon + (boxW / 2), ct.lat + (boxW / 2));

        this.geometryBox = bounds.toGeometry();
        this.originalBounds = bounds.clone();
        this.exportBox = new OpenLayers.Feature.Vector(bounds.toGeometry());
        this.layerbox.addFeatures(this.exportBox);
        if (this.allowDrag || this.allowResize || this.allowRotate) {
            this.updateMode();
            this.modifyControl.pageRotation = 0;

            this.origLayerIndex = this.map.getLayerIndex(this.layerbox);
            var maxIndex = this.map.getLayerIndex(this.map.layers[this.map.layers.length - 1]);
            if (this.origLayerIndex < maxIndex) this.map.raiseLayer(this.layerbox, (maxIndex - this.origLayerIndex));
            this.map.resetLayersZIndex();
            this.modifyControl.activate();
        }

        var map = this.map;
        var area = (bounds.right - bounds.left) * (bounds.top - bounds.bottom);
        $("#exportAreaSize").html(Math.round(area) + " mq");
        map.events.register("moveend", map, function () {
            if (self.autoCenter) self.moveExportBox(map.getCenter());
        });



    },

    moveExportBox: function (position) {
        //if(!this.editMode) return;
        if (this.modifyControl && this.modifyControl.feature) this.modifyControl.unselectFeature(this.exportBox);
        this.exportBox.move(position);
        this.events.triggerEvent("updateboxInfo");

    },

    removeExportBox: function () {
        if (this.modifyControl) {
            if (this.modifyControl.feature)
                this.modifyControl.unselectFeature(this.exportBox);
            this.modifyControl.deactivate();
            this.map.setLayerIndex(this.layerbox, this.origLayerIndex);
            this.map.resetLayersZIndex();
        }
        if (this.exportBox)
            this.exportBox.destroy();
    },

    getBounds: function () {
        return this.exportBox.geometry.getBounds();

    },

    roundScale: function (scale) {
        // if(scale > 1000000)
        //     scale = Math.ceil(scale/1000000) * 1000000;
        // else if(scale > 10000)
        //     scale = Math.ceil(scale/10000) * 10000;
        // else if(scale > 1000)
        //     scale = Math.ceil(scale/1000) * 1000;
        // else if(scale > 100)

        scale = Math.ceil(scale / 100) * 100;
        return scale;
    },

    downloadDXF: function () {

        var me = this;
        if (me.loadingControl) me.loadingControl.maximizeControl();
        $.ajax({
            type: "GET",
            dataType: "json",
            url: $("#hdnExportDxfUrl").val(),
            headers: {
                Accept: 'application/json',
            }
        }).done(function (res) {

            if (me.loadingControl) me.loadingControl.minimizeControl();
            const a = document.createElement('a');
            a.style = 'display: none';
            document.body.appendChild(a);
            //const blob = new Blob([res], {type: 'octet/stream'});
            //const url = URL.createObjectURL(blob);
            a.href = clientConfig.DXF_DOWNLOAD_URL + res.fileName;
            a.download = res.fileName;
            a.click();
            //URL.revokeObjectURL(url);
        }).fail(function (err) {
            alert("Si � verificato un errore nell'estrazione dei dati. Si consiglia di limitare i temi estratti o ridurre l'area di selezione. Se il problema persiste contattare gli amministratori.");
        });
    },
    downloadDXFSingleLayer: function () {
        if (!this.exportFilter.filters.length) {
            alert("Impostare almeno un filtro");
            return;
        }
        var me = this;
        if (me.loadingControl) me.loadingControl.maximizeControl();
        $.ajax({
            type: "GET",
            dataType: "json",
            url: this.updateUrlDownloadDxfSingle(),
            headers: {
                Accept: 'application/json',
            }
        }).done(function (res) {

            if (me.loadingControl) me.loadingControl.minimizeControl();
            const a = document.createElement('a');
            a.style = 'display: none';
            document.body.appendChild(a);
            //const blob = new Blob([res], {type: 'octet/stream'});
            //const url = URL.createObjectURL(blob);
            a.href = clientConfig.DXF_DOWNLOAD_URL + res.fileName;
            a.download = res.fileName;
            a.click();
            //URL.revokeObjectURL(url);
        }).fail(function (err) {
            alert("Si è verificato un errore nell'estrazione dei dati. Si consiglia di limitare i temi estratti o ridurre l'area di selezione. Se il problema persiste contattare gli amministratori.");
        });
    },
    downloadSHPSingleLayer: function () {
        var me = this;
        if (me.loadingControl) me.loadingControl.maximizeControl();
        $.ajax({
            type: "GET",
            dataType: "json",
            url: this.updateUrlDownloadShpSingle(),
            headers: {
                Accept: 'application/json',
            }
        }).done(function (res) {

            if (me.loadingControl) me.loadingControl.minimizeControl();
            const a = document.createElement('a');
            a.style = 'display: none';
            document.body.appendChild(a);
            //const blob = new Blob([res], {type: 'octet/stream'});
            //const url = URL.createObjectURL(blob);
            a.href = clientConfig.DXF_DOWNLOAD_URL + res.fileName;
            a.download = res.fileName;
            a.click();
            //URL.revokeObjectURL(url);
        }).fail(function (err) {
            alert("Si è verificato un errore nell'estrazione dei dati. Si consiglia di limitare i temi estratti o ridurre l'area di selezione. Se il problema persiste contattare gli amministratori.");
        });
    },
    getThemesToExport: function () {
        var themeList = []; //contiene gli elementi che genereranno gli input
        for (var i = 0; i < this.map.config.layers.length; i++) {
            var cfgLayer = this.map.config.layers[i];
            if (cfgLayer.typeId == 4 || cfgLayer.typeId == 5 || cfgLayer.typeId == 7 || cfgLayer.typeId == 8)
                continue;
            if (typeof (cfgLayer.options) !== 'undefined') {
                var layerOpts = cfgLayer.options;
            }
            else {
                var layerOpts = cfgLayer.parameters;
            }
            var theme = $.grep(themeList, function (e) { return e.themeLabel == layerOpts.theme });
            if (theme.length == 0) {
                var theme = {};
                theme.themeLabel = layerOpts.theme;
                theme.themeIds = [];
                theme.themeIds.push(layerOpts.theme_id);
                theme.mapsetName = this.map.config.mapsetName;
                themeList.push(theme);
            } else {
                theme = theme[0];
                if (!theme.themeIds.includes(layerOpts.theme_id)) {
                    theme.themeIds.push(layerOpts.theme_id);
                }
            }
        }
        return themeList;
    },
    loadExportFilterSelectTheme: function (themeList) {
        //sezione caricamento della tendina
        $('#exportFilter_theme').append(new Option("Seleziona tema", "__select__"));
        themeList.forEach(function (element) {
            let lOption = new Option(element.themeLabel, element.themeIds.join(','));
            $('#exportFilter_theme').append(lOption);
        });

    },
    loadExportFilterSelectLayer: function (themeIds, layerNames) {
        var addNodeRecursive = function (nodes, groupLayer) {
            nodes = [...nodes].sort(function (a, b) {
                if (a.title < b.title)
                    return -1;
                if (a.title > b.title)
                    return 1;
                return 0;
            });
            for (var k = 0; k < nodes.length; k++) {
                let isLayer = GisClientMap.featureTypes.filter(function (element) {
                    if (!nodes[k].layer) return false;
                    return element.typeName == nodes[k].layer;
                }).length;
                if (nodes[k].nodes) {
                    let lOption = document.createElement("optgroup");
                    lOption.label = nodes[k].title;
                    options.push(lOption);
                    addNodeRecursive(nodes[k].nodes, nodes[k].title);
                }
                if (isLayer) {
                    let layerOk = true;
                    if (nodes[k].layer.indexOf('ricerca') > 0)
                        layerOk = false;
                    if (layerOk) {
                        let lOption = new Option(nodes[k].title, nodes[k].layer);
                        options.push(lOption);
                        var optionValue = {
                            text: !groupLayer ? nodes[k].title : nodes[k].title + " (" + groupLayer + ")",
                            id: nodes[k].layer,
                            groupLayer: groupLayer
                        }
                        optionsValues.push(optionValue);
                    }
                }
            }
        }

        //sezione caricamento della tendina
        //$('#exportFilter_layer').append(new Option("Seleziona layer", "__select__"));
        //var option;
        var layerGroups = GisClientMap.layers;
        var options = [];
        var optionsValues = [];
        //var option = null;

        for (var i = 0; i < layerGroups.length; i++) {
            //verifico che sia un tema esportabile
            if (!layerGroups[i].options) continue;
            if (!themeIds.split(',').includes(layerGroups[i].options.theme_id)) continue;
            if (layerGroups[i].nodes) {
                addNodeRecursive(layerGroups[i].nodes);
            }
        }
        //for (var i = 0; i < options.length; i++)  $('#exportFilter_layer').append(options[i]);
        optionsValues.sort(function (a, b) {
            if (a.text < b.text)
                return -1;
            if (a.text > b.text)
                return 1;
            return 0;
        });
        $("#exportFilter_layer").select2({
            placeholder: 'Select an option',
            minimumInputLength: 0,
            data: optionsValues
        });

    },
    addExportFilter: function (logic, field, operator, operatorLabel, value) {
        if (!field) {
            alert("Selezionare un campo");
            return;
        }
        if (!operator) {
            alert("Selezionare una funzione");
            return;
        }
        if (!value) {
            alert("Selezionare un valore");
            return;
        }
        this.exportFilter.logic = logic;
        this.exportFilter.filters.push({
            field: field, operator: operator, value: value, operatorLabel: operatorLabel
        })
        this.renderExportFilter();
    },
    removeExportFilter: function (index) {
        this.exportFilter.filters.splice(index, 1);
        this.renderExportFilter();
    },
    renderExportFilter: function (featureTypeName) {
        let me = this;
        $("#exportFilter_container").html("");
        if (featureTypeName) {
            this.exportFilter = {
                featureTypeName: featureTypeName,
                filters: []
            };
        }
        let parentContainer = jQuery('<div />', {
            "class": ''
        }).appendTo($("#exportFilter_container"));

        let tableContainer = jQuery('<table class="bg-eee"/>', {
            id: 'exportFilter_table_container',
        }).appendTo(parentContainer);;

        let featureType = GisClientMap.getFeatureType(this.exportFilter.featureTypeName);
        let selectFieldsContainer = jQuery('<tr></tr>');
        jQuery(selectFieldsContainer).appendTo(tableContainer);
        selectFieldsContainer = jQuery('<td></td>').appendTo(selectFieldsContainer);
        let selectFields = '<select class="op form-control small-select" id="exportFilterField"><option value="">Campo...</option>';
        let props = [...featureType.properties].sort(function (a, b) {
            if (a.name < b.name)
                return -1;
            if (a.name > b.name)
                return 1;
            return 0;
        });

        for (let index = 0; index < props.length; index++) {
            selectFields += '<option value="' + props[index].name + '" data-fieldId=' + props[index].fieldId + ' >' + props[index].name + '</option>';
        }
        selectFields += "</select>";
        selectFields = jQuery(selectFields);
        selectFields.change(function () {
            me.autocompleteField();
        });

        selectFieldsContainer.html(selectFields);

        let tdOperator = jQuery('<tr><td><select class="op form-control small-select" id="exportFilterOperator"><option value="">Funzione...</option>' +
            '<option value=""></option>' +
            '<option value="equalto">Uguale</option>' +
            '<option value="notequalto">Diverso</option>' +
            '<option value="contains">Contiene</option>' +
            '<option value="startswith">Inizia con</option>' +
            '<option value="endswith">Finisce con</option>' +
            // '<option value="isnull">Is null</option>' +
            // '<option value="isnotnull">Is not null</option>' +
            '<option value="lessthan">Minore</option>' +
            '<option value="greaterthan">Maggiore</option>' +
            '<option value="in">In</option>' +
            '<option value="in2">In (grandi dati)</option>' +
            '</select></td></tr>', {
            "class": ''
        }).appendTo(tableContainer);
        let tdValue = jQuery('<tr><td><textarea type="text" class="op form-control small-select" id="exportFilterValue" placeholder="Valore..."></textarea></div></td></tr>', {
            "class": ''
        }).appendTo(tableContainer);

        let tdLogic = jQuery('<tr><td>I filtri saranno in <br /><select class="form-control small-select" id="exportFilterLogic"><option value="and">AND</option><option value="OR">OR</option></select></td></tr>', {
            "class": ''
        }).appendTo(tableContainer);

        if (this.exportFilter.logic)
            jQuery('#exportFilterLogic').val(this.exportFilter.logic);

        let trButton = jQuery('<tr></tr>', {
            "class": ''
        }).appendTo(tableContainer);
        let tdButton = jQuery('<td></td>', {
            "class": ''
        }).appendTo(tableContainer);
        let button = jQuery('<button class="btn btn-primary">Aggiungi</button>', {
        }).appendTo(tdButton);
        button.click(function () {
            me.addExportFilter(
                $("#exportFilterLogic").val(),
                $("#exportFilterField").val(),
                $("#exportFilterOperator").val(),
                $("#exportFilterOperator  option:selected").text(),
                $("#exportFilterValue").val()
            )
        });

        //riepilogo filtri
        jQuery("<h5>Filtro applicato</h5>", {
        }).appendTo(parentContainer);
        for (let index = 0; index < this.exportFilter.filters.length; index++) {
            let filter = this.exportFilter.filters[index];
            let filterStrContainer = jQuery('<div class="p-1"></div>').appendTo(parentContainer);
            let deleteButton = jQuery('<a href="#" class="mr-1">X<a/>').appendTo(filterStrContainer);
            deleteButton.click(function () {
                me.removeExportFilter(index);
            });
            let filterStr = "<span>";
            if (index > 0)
                if (this.exportFilter.logic) filterStr += this.exportFilter.logic + " ";
            filterStr += filter.field + ' ' + filter.operatorLabel + ' ' + filter.value + '</span>'
            jQuery(filterStr, {
            }).appendTo(filterStrContainer);

        }

        let buttonContainer = jQuery('<div />', {
            "class": ''
        }).appendTo(parentContainer);
        button = jQuery('<button class="btn btn-primary">Esporta Dxf</button>', {

        }).appendTo(buttonContainer);
        button.click(function () {
            me.downloadDXFSingleLayer();
        });
        //button = jQuery('<button class="btn btn-primary">Esporta Shapefile</button>', {
        //}).appendTo(buttonContainer);
        //button.click(function () {
        //    me.downloadSHPSingleLayer();
        //});
    },
    autocompleteField: function () {
        var fieldId = $("#exportFilterField option:selected").data('fieldid');
        // $("#exportFilterValue").select2({
        //     minimumInputLength: 0,
        //     query: function (query) {
        //         $.ajax({
        //             url: GisClientMap.baseUrl + 'services/xSuggest.php',
        //             data: {
        //                 suggest: query.term,
        //                 field_id: fieldId
        //             },
        //             dataType: 'json',
        //             success: function (data) {
        //                 var results = [];
        //                 $.each(data.data, function (e, val) {
        //                     results.push({
        //                         id: val.value,
        //                         text: val.value
        //                     });
        //                 });
        //                 query.callback({ results: results });
        //             }
        //         });
        //     }
        // });
    }

    // toggleExportUI: function (uiMode) {
    //     switch (uiMode) {
    //         case "shp":

    //             break;

    //         default:
    //             break;
    //     }

    // }

});

//TODO Eliminare in favore di un evento sul pannello
setTimeout(function () {
    $("a[title=\"Esporta DXF\"]").css("display", "none");
}, 2000);
