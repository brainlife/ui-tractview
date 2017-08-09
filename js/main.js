/**
 * Display tracts from afq_output using the TractView UI
 */

'use strict';

$(function() {
    var config = {
        wf_api: '/api/wf',
        jwt: localStorage.getItem('jwt'),
        num_tracts: 20,
        
        debug: true,
    };
    
    if (!config.jwt)
        throw "Error: jwt not set";
    
    // get the url and wrap it in a URL object, for getting GET params later
    var url = new URL(window.location.href),
        task_id = url.searchParams.get('afq'),
        subdir = url.searchParams.get('sdir');

    var task = null;

    if(config.debug) {
        task_id = "59651c4ea7d3861d94eec67e";
        //subdir = "output";
        config.wf_api = "https://dev1.soichi.us/api/wf";
    }
    
    $.ajax({
        beforeSend: xhr => xhr.setRequestHeader('Authorization', 'Bearer '+config.jwt),
        url: config.wf_api+'/task',
        data: {
            find: JSON.stringify({ _id: task_id, })
        },
        success: data => {
            task = data.tasks[0];
            init_tractview();
        },
    });
    
    function init_tractview() {
        var base = task.instance_id + '/' + task._id;
        if (subdir) base += '/' + subdir;
        
        TractView.init({
            selector: '#tractview',
            num_tracts: config.num_tracts,
            preview_scene_path: 'models/brain.json',
            
            get_json_file: tractNumber => config.wf_api+"/resource/download?r="+
                                           task.resource_id+"&p="+
                                           encodeURIComponent(base+"/tracts/"+tractNumber+".json")+
                                           "&at="+config.jwt
        });
    }
});
