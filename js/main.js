'use strict';

var TractView = require('./tractview.js');

$(function() {
    var niftis = [],
        plots = [];
    
    function path_to_url(path) {
        return "https://brainlife.duckdns.org/files/data/" + encodeURIComponent(path);
    }
    
    fetch(path_to_url('config.json')).then(res => res.json())
    .then(function(json) {
        if (!json._datatypes) old_style();
        else {
            // TODO: Place hardcodings somewhere else, or at least make them more flexible
            for (let key in json._datatypes) {
                var datatype = json._datatypes[key];
                switch (datatype.name) {
                    case "neuro/dtiinit":
                        // nifti overlay
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "wmProb.nii.gz",
                            url: path_to_url(`${key}/dti/bin/wmProb.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "wmMask.nii.gz",
                            url: path_to_url(`${key}/dti/bin/wmMask.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "brainMask.nii.gz",
                            url: path_to_url(`${key}/dti/bin/brainMask.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "b0.nii.gz",
                            url: path_to_url(`${key}/dti/bin/b0.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "vectorRGB.nii.gz",
                            url: path_to_url(`${key}/dti/bin/vectorRGB.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "mdStd.nii.gz",
                            url: path_to_url(`${key}/dti/bin/mdStd.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "wmMask.nii.gz",
                            url: path_to_url(`${key}/dti/bin/wmMask.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "faStd.nii.gz",
                            url: path_to_url(`${key}/dti/bin/faStd.nii.gz`)
                        });
                        
                        niftis.push({
                            datatype: JSON.parse(JSON.stringify(datatype)),
                            filename: "pddDispersion.nii.gz",
                            url: path_to_url(`${key}/dti/bin/pddDispersion.nii.gz`)
                        });
                        
                        break;
                    
                    case "neuro/life":
                        //life stuff (plot, etc.)
                        break;
                    
                    case "neuro/wmc":
                        // tracts
                        fetch(path_to_url(`${key}/tracts/tracts.json`)).then(res=>res.json())
                        .then(tracts => init_tractview(tracts, key)).catch(res=>{
                            console.log("couldn't find tracts.json - assuming it's old afq output");
                            fetch('afq.tracts.json').then(res=>res.json()).then(tracts => init_tractview(tracts, key));
                        });
                        break;
                }
            }
            
        }
    }, err => console.error);
    
    function old_style() {
        var config = {
            wf_api: '/api/wf',
            jwt: localStorage.getItem('jwt'),
        };
        
        if (!config.jwt) throw "Error: jwt not set";
        
        // get the url and wrap it in a URL object, for getting GET params later
        var url = new URL(window.location.href);
        var task_id = url.searchParams.get('taskid') || url.searchParams.get('afq'); //afq is deprecated
        var subdir = url.searchParams.get('sdir');

        //for debugging
        if(url.hostname == "localhost") {
            console.log("using debug configuration");
            task_id = "59c02dc23199680e9d12a863"; //subdir = "output";
            config.wf_api = "https://dev1.soichi.us/api/wf";
        }
        
        //load the task detail (to find brain-life instance ID / resource ID)
        $.ajax({
            beforeSend: xhr => xhr.setRequestHeader('Authorization', 'Bearer '+config.jwt),
            url: config.wf_api+'/task',
            data: {
                find: JSON.stringify({ _id: task_id, })
            },
            success: data => {
                var task = data.tasks[0];
                var urlbase = config.wf_api+"/resource/download?r="+task.resource_id+"&at="+config.jwt;
                var pathbase = task.instance_id+"/"+task._id;
                if (subdir) pathbase +='/'+subdir;
                //pathbase += "/tracts";

                //load tracts.json
                fetch(urlbase+"&p="+encodeURIComponent(`${pathbase}/tracts/tracts.json`)).then(res=>res.json())
                .then(tracts => init_tractview(tracts, pathbase)).catch(res=>{
                    console.log("couldn't find tracts.json - assuming it's old afq output");
                    fetch('afq.tracts.json').then(res=>res.json()).then(tracts => init_tractview(tracts, pathbase));
                });
            },
        });
    }
    
    function init_tractview(tracts, base) {
        tracts.forEach(tract=>{
            tract.url = path_to_url(`${base}/tracts/${tract.filename}`);
        });
        
        TractView.init({
            selector: '#tractview',
            preview_scene_path: 'models/brain.json',
            tracts,
            niftis,
        });
    }
});
