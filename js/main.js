'use strict';

$(function() {
    var TractView = require('./tractview.js');
    var jwt = localStorage.getItem('jwt');
    var config = window.config || window.parent.config;
    if(localStorage.getItem('debug_config')) {
        config = JSON.parse(localStorage.getItem("debug_config"));
       //debug: let datauis/wmc view create a debug config
    }

    //set token for each tracts/layers
    config.tracts.forEach(tract=>{
        tract.url += "&at="+jwt;
    });
    if(config.layer) config.layers.forEach(layer=>{
        layer.url += "&at="+jwt;
    });
    console.dir(config);
    TractView.init({
        selector: '#tractview',
        preview_scene_path: 'models/brain.json',
        tracts: config.tracts,
        niftis: config.layers,
    });
});
