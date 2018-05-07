'use strict';

$(function() {
    var TractView = require('./tractview.js');
    var jwt = localStorage.getItem('jwt');
    var config = window.config || window.parent.config;
    var stevenHost = localStorage.getItem("stevenHost");
    
    if(localStorage.getItem('debug_config')) {
        config = JSON.parse(localStorage.getItem("debug_config"));
        config.debug = true;
    }
    
    //TODO for steven .. please use debug_config
    //code to get steven's instance to work without remote loading
    if (stevenHost) {
        config.tracts.forEach(tract => {
            tract.url = encodeURI(`${stevenHost}/files/wmc/tracts/${tract.filename}`);
        });
        if (config.layers) config.layers.forEach(layer => {
            layer.url = encodeURI(`${stevenHost}/files/dtiinit/${layer.filename}`);
        });
        if (config.extend) config.extend.forEach(extension => {
            extension.url = encodeURI(`${stevenHost}/files/life_599ec73d8aca550029071e2f/${extension.filename}`);
        });
    } else {
        if(!config) alert("no config object found");
        console.log("using config");
        console.dir(config);

        //set token for each tracts/layers
        config.tracts.forEach(tract=>{
            if(~tract.url.indexOf("?")) tract.url += "&";
            else tract.url += "?";
            tract.url += "at="+jwt;
        });
        if(config.layers) config.layers.forEach(layer=>{
            if(~layer.url.indexOf("?")) layer.url += "&";
            else layer.url += "?";
            layer.url += "at="+jwt;
        });
    }
    
    TractView.init({
        selector: '#tractview',
        preview_scene_path: 'models/brain.json',
        tracts: config.tracts,
        niftis: config.layers,
        extend: config.extend,
        debug: config.debug,
    });
});
