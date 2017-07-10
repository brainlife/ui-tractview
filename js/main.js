/**
 * UI to display output surface from Freesurfer using THREE.js
 */

'use strict';

(()=>{

var config = {
    wf_api: '/api/wf',
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
    var task = null;
    var subdir = url.searchParams.get('sdir');
    
    $.ajax({
        beforeSend: xhr => xhr.setRequestHeader('Authorization', 'Bearer '+config.jwt),
        url: config.wf_api+'/task',
        data: {
            find: JSON.stringify({
                _id: url.searchParams.get('afq')
            })
        },
        success: data => {
            task = data.tasks[0];
            init_conview();
        },
    });
    
    function init_conview() {
        var view = $("#conview");
        var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        //renderer.setClearColor(0xffffff, 0);

        //scenes - back scene for brain siluet
        var scene = new THREE.Scene();
        
        //scene_back.background = new THREE.Color(0x333333);
        
        //camera
        var camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
        camera.position.z = 200;

        //resize view
        $(window).on('resize', function() {
            camera.aspect = view.width() / view.height();
            camera.updateProjectionMatrix();
            renderer.setSize(view.width(), view.height());
        });
        
        // lighting
        var ambLight = new THREE.AmbientLight(0x303030);
        scene.add(ambLight);
        var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
        directionalLight.position.set( 0, 1, 0 );
        scene.add( directionalLight );
        var camlight = new THREE.PointLight(0xffffff);
        camlight.position.copy(camera.position);
        scene.add(camlight);
        
        //load vtk brain model from freesurfer
        var rid = task.resource_id;
        var base = task.instance_id + '/' + task._id;
        if (subdir) base += '/' + subdir;
        
        //load left
        // var path = encodeURIComponent(base+"/lh.10.vtk");
        // var vtk = new THREE.VTKLoader();
        
        // vtk.load(config.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+config.jwt, geometry => {
        //     var material = new THREE.MeshLambertMaterial({color: 0xcc9966});
        //     //var material = new THREE.MeshBasicMaterial();
        //     var mesh = new THREE.Mesh( geometry, material );
        //     mesh.rotation.x = -Math.PI/2;
        //     scene.add(mesh);
        // });
        // //load right
        // var path = encodeURIComponent(base+"/rh.10.vtk");
        
        // vtk.load(config.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+config.jwt, geometry => {
        //     var material = new THREE.MeshLambertMaterial({color: 0xcc9966});
        //     //var material = new THREE.MeshBasicMaterial();
        //     var mesh = new THREE.Mesh( geometry, material );
        //     mesh.rotation.x = -Math.PI/2;
        //     scene.add(mesh);
            
        //     console.log("loaded mesh: ", mesh);
        // });
        
        //TODO - 21 might not be the correct number of tracts
        // var afq_rid = scope.afq.resource_id;
        // var afq_base = scope.afq.instance_id+"/"+scope.afq._id;
        
        for(var i = 1;i < 21;++i) {
            //load_tract("tracts/tracts_110411/tracts."+i+".json", function(err, mesh) {
            var path = encodeURIComponent(base+"/tracts/"+i+".json");
            load_tract(config.wf_api+"/resource/download?r="+rid+"&p="+path+"&at="+config.jwt, function(err, mesh) {
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
            renderer.clearDepth();
            renderer.render( scene, camera );
            //renderer.render( scene, camera );

            requestAnimationFrame( animate_conview );
        }
        
        animate_conview();
    }
    
    function load_tract(path, cb) {
        //console.log("loading tract "+path);
        //$scope.loading = true;
        $.get(path, res => {
            var name = res.name;
            var color = res.color;
            var bundle = res.coords;

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
