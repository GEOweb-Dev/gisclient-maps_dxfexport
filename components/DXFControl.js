// **** DXF Export control
window.GCComponents["Controls"].addControl('control-dxfexport', function (map) {
    return new OpenLayers.Control.DXFExport({
        gc_id: 'control-dxfexport',
        tbarpos: "first",
        //type: OpenLayers.Control.TYPE_TOGGLE,
        baseUrl: self.baseUrl,
        defaultLayers: self.mapsetTiles ? self.activeLayers.slice(0) : [],
        formId: 'dxfexportpanel',
        exclusiveGroup: 'sidebar',
        iconclass: "glyphicon-white glyphicon-export",
        title: "Esporta DXF",
        waitFor: 'panelready',
        allowDrag: true,
        trigger: function () {
            if (sidebarPanel.handleEvent) {
                if (this.active) {
                    this.deactivate();
                    sidebarPanel.hide('exportpanel');
                }
                else {
                    this.activate();
                    var me = this;
                    if ($.trim($('#exportpanel').html()) == '') {
                        var rnd = Math.floor((Math.random() * 100000) + 1); //rimozione manuale della cache
                        $("#exportpanel").load('../../panels/export_panel.html?' + rnd, function () {
                            me.events.triggerEvent('panelready');
                        });
                    }
                    else {
                        //this.drawPrintArea();
                    }

                    sidebarPanel.show('exportpanel');
                }
                sidebarPanel.handleEvent = false;
            }
        },
        eventListeners: {
            'panelready': function (event) {
                var me = this, timerid;
                var themeList = me.getThemesToExport();
                var container = $('#dxfexport_themes_group');
                var inputs = container.find('input');
                var id = inputs.length + 1;
                var atLeastOneCheck = false;
                var retValue = {result: 'ok'};
                //scarico le funzioni di sistema
                $.ajax({
                    url: clientConfig.DXF_SERVICE_URL + 'services/plugins/dxfexport/dxfUserConfig.php?',
                    method: 'GET',
                    dataType: 'json',
                    data: params,
                    success: function(response) {
                        clientConfig.DXF_USER_CONFIG = response;
                        return retValue;
                    },
                    error: function() {
                        letretValue.result = 'error';
                        retValue.message = 'Errore di sistema';
                        return retValue;
                    }
                });

                themeList.forEach(function (element) {
                    $('<input />', {
                        type: 'checkbox',
                        id: 'dxfexport_theme_' + id,
                        class: 'dxfexport_themes',
                        value: element.mapsetName + ',' + element.themeIds.join(',')
                    }).appendTo(container);
                    if ($.inArray(element.themeLabel.toLowerCase(), clientConfig.DXF_THEME_SELECTED) > -1) {
                        atLeastOneCheck = true;
                        $('#' + 'dxfexport_theme_' + id).prop('checked', true)
                    }
                    $('<label />', { 'for': 'dxfexport_theme_' + id, text: element.themeLabel }).appendTo(container);
                    if ($.mobile) {
                        $('#dxfexport_theme_' + id).checkboxradio();
                    }
                    else {
                        container.append('<br>');
                    }

                    id++;
                });

                if (!atLeastOneCheck) {
                    //    $('.dxfexport_themes').first().prop('checked', true).checkboxradio("refresh");
                    $('.dxfexport_themes').first().prop('checked', true);
                }
                $("#exportAreaSize").html((this.initialBBEdge * this.initialBBEdge) + " mq");
                $("#exportMaxAreaSize").html(this.maxArea + " mq");
                $("#exportMaxAreaSize").html(this.maxArea + " mq");
                $('.dxfexport_themes').on('change', function (event) {
                    event.preventDefault();
                    //$('#'+me.formId+' a[role="pdf"], #exportpanel a[role="html"]').attr('href', '#');
                    //$('#'+me.formId+' span[role="icon"]').removeClass('glyphicon-white').addClass('glyphicon-disabled');
                    me.updateUrlDownloadDxf();
                });
                $("#map-select-scale").on('change', function (event) {
                    me.updateUrlDownloadDxf();
                });

                $('#btnExportDxf').on('click', function (event) {
                    event.preventDefault();
                    me.downloadDXF();
                    return false;
                });

                //eventi per le opzioni avanzate
                $("#enableTemplateLayer").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#enableColors").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#enableLineThickness").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#exportEmptyLayers").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#textScaleMultiplier").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#labelScaleMultiplier").change(function () {
                    me.updateUrlDownloadDxf();
                });
                $("#insertScaleMultiplier").change(function () {
                    me.updateUrlDownloadDxf();
                });
                var mapSetDxfConfig = clientConfig.DXF_MAPSET_CONFIG.filter(function (element) {
                    return element.mapset === GisClientMap.mapsetName;
                });

                let textScaleMultiplier = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.textScaleMultiplier : 1;
                let labelScaleMultiplier = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.labelScaleMultiplier : 1;
                let insertScaleMultiplier = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.insertScaleMultiplier : 1;
                let enableTemplateLayerChecked = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.enableTemplateLayerChecked : true;
                let enableColorsChecked = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.enableColorsChecked : true;
                let enableLineThicknessChecked = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.enableLineThicknessChecked : true;
                let exportEmptyLayersChecked = mapSetDxfConfig.length ? mapSetDxfConfig[0].config.exportEmptyLayersChecked : false;
                $("#textScaleMultiplier").val(textScaleMultiplier);
                $("#labelScaleMultiplier").val(labelScaleMultiplier);
                $("#insertScaleMultiplier").val(insertScaleMultiplier);
                $("#enableTemplateLayer").prop('checked', enableTemplateLayerChecked);
                $("#enableColors").prop('checked', enableColorsChecked);
                $("#enableLineThickness").prop('checked', enableLineThicknessChecked);
                $("#exportEmptyLayers").prop('checked', exportEmptyLayersChecked);

                //sezione panello di ricerca
                $('#dxfExportTabButton').on('click', function (event) {
                    event.preventDefault();
                    $('#dxfExportPanel').show();
                    $('#tabExport_btn_dxf').addClass('active');
                    $('#shpExportPanel').hide();
                    $('#tabExport_btn_shp').removeClass('active');
                    $('#processingDxfExportPanel').hide();
                    $('#tabExport_btn_processing').removeClass('active');
                    tabExport_btn_field
                    return false;
                });
                $('#shpExportTabButton').on('click', function (event) {
                    event.preventDefault();
                    $('#dxfExportPanel').hide();
                    $('#tabExport_btn_dxf').removeClass('active');
                    $('#shpExportPanel').show();
                    $('#tabExport_btn_shp').addClass('active');
                    $('#processingDxfExportPanel').hide();
                    $('#tabExport_btn_processing').removeClass('active');
                    return false;
                });
                $('#fieldExportTabButton').on('click', function (event) {
                    event.preventDefault();
                    $('#dxfExportPanel').hide();
                    $('#tabExport_btn_dxf').removeClass('active');
                    $('#shpExportPanel').hide();
                    $('#tabExport_btn_shp').removeClass('active');
                    $('#processingDxfExportPanel').show();
                    $('#tabExport_btn_processing').addClass('active');
                    return false;
                });

                //caricamento della sezione del filtro per attributi
                me.loadExportFilterSelectTheme(themeList);
                $('#exportFilter_theme').val("__select__");
                $('#exportFilter_theme').change(function () {
                    var selectedTheme = $(this).val()
                    me.loadExportFilterSelectLayer(selectedTheme);

                });
                $('#exportFilter_layer').change(function () {
                    var selectedFeatureType = $(this).val()
                    if (selectedFeatureType == "__select__") {
                        return;
                    }
                    me.renderExportFilter(selectedFeatureType);
                });

                //caricamento della sezione elaborazioni speciali
                //load della tendina
                me.loadProcessingFilterSelectLayer();

                //Aggiornamento iniziale degli url
                me.updateUrlDownloadDxf();

            },
            'deactivate': function (event) {
                sidebarPanel.hide('exportpanel');
                this.removeExportBox();
            },
            'activate': function (event) {
                var me = this;
                if (me.map.currentControl != me) {
                    me.map.currentControl.deactivate();
                    me.map.currentControl = me;
                }
                //$('#'+me.formId+' input[name="scale_mode"]:checked').val() == 'user' ? me.boxScale = $('#'+me.formId+' input[name="scale"]').val() : me.boxScale = null;
                me.drawExportBox.apply(me);
            },
            'exporterd': function (event) {
                var me = this;
                if (event.format == 'HTML') {
                    $('#' + me.formId + ' a[role="html"]').attr('href', event.file);
                    $('#' + me.formId + ' a[role="html"] span[role="icon"]').removeClass('glyphicon-disabled').addClass('glyphicon-white');
                } else if (event.format == 'PDF') {
                    $('#' + me.formId + ' a[role="pdf"]').attr('href', event.file);
                    $('#' + me.formId + ' a[role="pdf"] span[role="icon"]').removeClass('glyphicon-disabled').addClass('glyphicon-white');
                }
                var win = window.open(event.file, '_blank');
                win.focus();
            }
        }
    });
});


let mapSetDxfConfig = clientConfig.DXF_MAPSET_CONFIG.filter(function (element) {
    return element.mapset === GisClientMap.mapsetName;
});

let dxfToolIsVisible = true;
//controllo se è impostato il blocco forzato del plugin
if(mapSetDxfConfig.length){
    dxfToolIsVisible = !mapSetDxfConfig[0].config.hideDxfPlugin;
}
//visualizzazione di default
if(dxfToolIsVisible){
    // **** Toolbar button
    window.GCComponents["SideToolbar.Buttons"].addButton(
        'button-dxfexport',
        'Esporta DXF',
        'glyphicon-white glyphicon-export',
        function () {
            if (sidebarPanel.handleEvent || typeof (sidebarPanel.handleEvent) === 'undefined') {
                var ctrlDXFExport = this.map.getControlsBy('gc_id', 'control-dxfexport')[0];

                if (ctrlDXFExport.active) {
                    ctrlDXFExport.deactivate();
                    this.deactivate();
                    sidebarPanel.hide('dxfexportpanel');
                }
                else {
                    ctrlDXFExport.activate();
                    this.activate();
                    var panelPath = GisClientMap.rootPath + 'plugins/gisclient-maps_dxfexport/panels/';
                    var rnd = Math.floor((Math.random() * 100000) + 1); //rimozione manuale della cache
                    if ($.mobile) {
                        panelPath += 'dxf_export_panel_mobile.html?' + rnd;
                    }
                    else {
                        panelPath += 'dxf_export_panel.html?' + rnd;
                    }
                    if ($.trim($('#dxfexportpanel').html()) == '') {
                        $("#dxfexportpanel").load(panelPath, function () {
                            ctrlDXFExport.events.triggerEvent('panelready');
                        });
                    }
                    else {
                        //this.drawPrintArea();
                    }

                    sidebarPanel.show('dxfexportpanel');
                }
                if (typeof (sidebarPanel.handleEvent) !== 'undefined')
                    sidebarPanel.handleEvent = false;
            }
        },
        { button_group: 'print', sidebar_panel: 'dxfexportpanel', gc_control: 'control-dxfexport' }
    );
}