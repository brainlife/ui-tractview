'use strict';

$(function() {
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
            pathbase += "/tracts";

            function init_tractview(tracts) {
                tracts.forEach(tract=>{
                    tract.url = urlbase+"&p="+encodeURIComponent(pathbase+"/"+tract.filename);
                });
                TractView.init({
                    selector: '#tractview',
                    preview_scene_path: 'models/brain.json',
                    tracts,
                });
            }

            //load tracts.json
            fetch(urlbase+"&p="+encodeURIComponent(pathbase+"/tracts.json")).then(res=>res.json())
            .then(init_tractview).catch(res=>{
                console.log("couldn't find tracts.json - assuming it's old afq output");
                fetch('afq.tracts.json').then(res=>res.json()).then(init_tractview);
            });
        },
    });
});
