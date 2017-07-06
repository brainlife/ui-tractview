/**
 * UI to display output tracts from AFQ using THREE.js
 */

'use strict';

(()=>{

var config = {
    wf: '/api/wf',
    jwt: localStorage.getItem('jwt')
};

$(document).ready(() => {
    // element.on('$destroy', function() {
    //     scope.destroyed = true;
    // });
    
    if (!config.jwt)
        throw "Error: jwt not set";
    
    // get the url and wrap it in a URL object, for getting GET params later
    var url = new URL(window.location.href);
    
    // first thing to do, retrieve instance ids from tasks by getting tasks from given task ids in the url
    // get freesurfer task id
    var taskids = {
        freesurfer: url.searchParams.get('free'),
        afq: url.searchParams.get('afq')
    };
    
    var tasks = {
        freesurfer: null,
        afq: null
    };
    
    function getTask(taskid, success, error) {
        $.ajax({
            url: config.wf+'/task',
            data: {
                find: JSON.stringify({_id:taskid})
            },
            beforeSend: xhr => xhr.setRequestHeader('Authorization', 'Bearer '+config.jwt),
            error: err => {
                if (error)
                    error(err);
            },
            success: data => {
                var _tasks = data.tasks;
                if (_tasks.length == 1)  // good
                    success(_tasks[0]);
                else                    // bad
                    console.error("Error: Invalid tasks returned: ", _tasks);
            }
        });
    }
    
    // get task for freesurfer + afq
    if (taskids.freesurfer) {
        getTask(taskids.freesurfer, task => {
            tasks.freesurfer = task;
        }, err => {
            console.error(err);
        });
    }
    if (taskids.afq) {
        getTask(taskids.afq, task => {
            tasks.afq = task;
        }, err => {
            console.error(err);
        });
    }
    
    
    
    // 
    
    function init_conview() {
        var view = $("#conview");
        var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});

        //scenes - back scene for brain siluet
        var scene_back = new THREE.Scene();
        //scene_back.background = new THREE.Color(0x333333);
        var scene = new THREE.Scene();
        
        //camera
        var camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
        camera.position.z = 200;

        //resize view
        $(window).on('resize', function() {
            camera.aspect = view.width() / view.height();
            camera.updateProjectionMatrix();
            renderer.setSize(view.width(), view.height());
        });

        //load vtk brain model from freesurfer
        
        var rid = url.searchParams.get('r');
        if (!rid)
            throw "No resource id given in url (specified as ?r)";
        
        var jwt = localStorage.getItem('jwt');
        if (!jwt)
            throw "No jwt discovered in localStorage. Please authenticate."
        
        var base = url.searchParams.get('b');
        if (!base)
            throw "No base path given in url (specified as ?b)"
        
        //load left
        // var base = scope.freesurfer.instance_id+"/"+scope.freesurfer._id;
        var path = encodeURIComponent(base+"/lh.10.vtk");
        vtk.get(appconf.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+jwt).then(function(geometry) {
            //var material = new THREE.MeshLambertMaterial({color: 0xffcc99, transparent: true, opacity: 0.5});
            var material = new THREE.MeshBasicMaterial();
            var mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            scene_back.add(mesh);
        });
        //load right
        var path = encodeURIComponent(base+"/rh.10.vtk");
        vtk.get(appconf.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+jwt).then(function(geometry) {
            //var material = new THREE.MeshLambertMaterial({color: 0xffcc99, transparent: true, opacity: 0.5});
            var material = new THREE.MeshBasicMaterial();
            var mesh = new THREE.Mesh( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            scene_back.add(mesh);
        });
        
        //TODO - 21 might not be the correct number of tracts
        var afq_rid = scope.afq.resource_id;
        var afq_base = scope.afq.instance_id+"/"+scope.afq._id;
        for(var i = 1;i < 21;++i) {
            //load_tract("tracts/tracts_110411/tracts."+i+".json", function(err, mesh) {
            var path = encodeURIComponent(afq_base+"/tracts/"+i+".json");
            load_tract(appconf.wf_api+"/resource/download?r="+afq_rid+"&p="+path+"&at="+jwt, function(err, mesh) {
                scene.add(mesh);
            });
        }

        renderer.autoClear = false;
        renderer.setSize(view.width(), view.height());
        view.append(renderer.domElement);

        //use OrbitControls and make camera light follow camera position
        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.autoRotate = true;
        controls.addEventListener('change', function() {
            //rotation changes
        });
        controls.addEventListener('start', function(){
            //use interacting with control
            controls.autoRotate = false;
        });
        function animate_conview() {
            controls.update();

            renderer.clear();
            renderer.render( scene_back, camera );
            renderer.clearDepth();
            renderer.render( scene, camera );

            requestAnimationFrame( animate_conview );
        }
        animate_conview();
    }
    
    function load_tract(path, cb) {
        //console.log("loading tract "+path);
        //$scope.loading = true;
        $http.get(path)
        .then(function(res) {
            if(scope.destroyed) return;

            var name = res.data.name;
            var color = res.data.color;
            var bundle = res.data.coords;

            var threads_pos = [];
            //bundle = [bundle[0]];
            bundle.forEach(function(fascicle) {

                var xs = fascicle[0][0];
                var ys = fascicle[0][1];
                var zs = fascicle[0][2];

                for(var i = 1;i < xs.length;++i) {
                    threads_pos.push(-xs[i-1]);
                    threads_pos.push(ys[i-1]);
                    threads_pos.push(zs[i-1]);
                    threads_pos.push(-xs[i]);
                    threads_pos.push(ys[i]);
                    threads_pos.push(zs[i]);
                }
            });

            //now show bundle
            var vertices = new Float32Array(threads_pos);
            var geometry = new THREE.BufferGeometry();
            geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
            var material = new THREE.LineBasicMaterial( {
                color: new THREE.Color(color[0], color[1], color[2]),
                transparent: true,
                opacity: 0.7,
            } );
            var mesh = new THREE.LineSegments( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            //temporarly hack to fit fascicles inside
            mesh.position.z = -20;
            mesh.position.y = -20;

            cb(null, mesh);
        });
    }
    
});

}).call(window);