'use strict';

$(function() {
    var TractView = require('./tractview.js');
    var jwt = localStorage.getItem('jwt');
    var config = window.config || window.parent.config;
    if(localStorage.getItem('debug_config')) {
        config = JSON.parse(localStorage.getItem("debug_config"));
       //debug: let datauis/wmc view create a debug config
    }

    // code to get steven's instance to work without remote loading
    if (localStorage.getItem("steven_debug")) {
        config.tracts.forEach(tract => {
            tract.url = encodeURI(`http://otherhost/temp/wmc_59b2c17a76fddd0027308fb8/1_tracts/${tract.filename}`);
        });
        if (config.layers) config.layers.forEach(layer => {
            layer.url = encodeURI(`http://otherhost/temp/dtiinit_5a26f2c34e57c077cf5e3472/1_./dti/bin/${layer.filename}`);
        });
        if (config.extend) config.extend.forEach(extension => {
            extension.url = encodeURI(`http://localhost:8080/temp/life_599ec73d8aca550029071e2f/${extension.filename}`);
        });
    }
    else {
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
    
    console.log("dump");
    console.dir(config);
    TractView.init({
        selector: '#tractview',
        preview_scene_path: 'models/brain.json',
        tracts: config.tracts,
        niftis: config.layers,
        extend: config.extend,
    });
});
