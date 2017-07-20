/**
 * UI to display output surface from Freesurfer using THREE.js
 */

'use strict';
$(function() {

    var config = {
        wf_api: '/api/wf',
        jwt: localStorage.getItem('jwt'),
        num_tracts: 20,
        
        // to be set later
        num_fibers: 0,
        tracts: {},     // toggle on/off fascicles
        debug: true,
    };
    
    // element.on('$destroy', function() {
    //     scope.destroyed = true;
    // });
    
    if (!config.jwt)
        throw "Error: jwt not set";
    
    // get the url and wrap it in a URL object, for getting GET params later
    var url = new URL(window.location.href);
    var task_id = url.searchParams.get('afq');
    var subdir = url.searchParams.get('sdir');

    var task = null, LRtractNames = {};
 
	if(config.debug) {
        task_id = "59651c4ea7d3861d94eec67e";
        //subdir = "output";
        config.wf_api = "https://dev1.soichi.us/api/wf";
	}
    
    if (!config.jwt)
        throw "Error: jwt not set";
   
    var view = $("#conview"),
        tinyBrain = $("#tinybrain"),
        controls_el = $("#controls"),
        container_toggles = $("#container_toggles"),
        tract_toggles_el = $("#tract_toggles"),
        hide_show_el = $("#hide_show"),
        hide_show_text_el = $("#hide_show_text");
    
    $.ajax({
        beforeSend: xhr => xhr.setRequestHeader('Authorization', 'Bearer '+config.jwt),
        url: config.wf_api+'/task',
        data: {
            find: JSON.stringify({ _id: task_id, })
        },
        success: data => {
            task = data.tasks[0];
            init_conview();
        },
    });
    
    function init_conview() {
        var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        var brainRenderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        //renderer.setClearColor(0xffffff, 0);

        //scenes - back scene for brain siluet
        var scene = new THREE.Scene();
        
        //scene_back.background = new THREE.Color(0x333333);
        
        //camera
        var camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
        var brainCam = new THREE.PerspectiveCamera( 45, tinyBrain.width() / tinyBrain.height(), 1, 5000 );
        camera.position.z = 200;
        
        //resize view
        function resized() {
            camera.aspect = view.width() / view.height();
            camera.updateProjectionMatrix();
            renderer.setSize(view.width(), view.height());
        }
        $(window).on('resize', resized);
        view.on('resize', resized);
        
        // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
        var loader = new THREE.ObjectLoader();
        var tinyBrainScene, brainlight;
        loader.load('models/brain.json', _scene => {
            tinyBrainScene = _scene;
            var brainMesh = tinyBrainScene.children[1], unnecessaryDirectionalLight = tinyBrainScene.children[2];
            // align the tiny brain with the model displaying fascicles
            
            brainMesh.rotation.z += Math.PI / 2;
            brainMesh.material = new THREE.MeshLambertMaterial({color: 0xffcc99});
            
            tinyBrainScene.remove(unnecessaryDirectionalLight);
            
            var amblight = new THREE.AmbientLight(0x101010);
            tinyBrainScene.add(amblight);
            
            brainlight = new THREE.PointLight(0xffffff, 1);
            brainlight.radius = 20;
            brainlight.position.copy(brainCam.position);
            tinyBrainScene.add(brainlight);
        });
        
        var base = task.instance_id + '/' + task._id;
        if (subdir) base += '/' + subdir;
        
        for(var i = 1;i <= config.num_tracts;++i) {
            // load the tract
            var path = encodeURIComponent(base+"/tracts/"+i+".json");
            load_tract(config.wf_api+"/resource/download?r="+task.resource_id+"&p="+path+"&at="+config.jwt, function(err, mesh, res) {
                scene.add(mesh);
                
                config.num_fibers += res.coords.length;
                
                config.tracts[res.name] = mesh;
                
                // when all tracts are loaded, add the toggles to the side banner
                if (Object.keys(config.tracts).length == config.num_tracts)
                    makeTractToggles();
            });
        }
        
        renderer.autoClear = false;
        renderer.setSize(view.width(), view.height());
        view.append(renderer.domElement);

        brainRenderer.autoClear = false;
        brainRenderer.setSize(tinyBrain.width(), tinyBrain.height());
        tinyBrain.append(brainRenderer.domElement);

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
            
            // handle display of the tiny brain preview
            if (tinyBrainScene) {
                // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
                var pan = controls.getPanOffset();
                var pos3 = new THREE.Vector3(camera.position.x - pan.x, camera.position.y - pan.y, camera.position.z - pan.z).normalize();
                brainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
                brainCam.rotation.copy(camera.rotation);
                
                brainlight.position.copy(brainCam.position);
                
                brainRenderer.clear();
                brainRenderer.render(tinyBrainScene, brainCam);
            }

            requestAnimationFrame( animate_conview );
        }
        
        animate_conview();
    }
    
    // add tract toggles to side panel
    function makeTractToggles() {
        // sort + make non-LR based tracts appear first
        var keys = Object.keys(config.tracts).sort((a, b) => {
            var a_has_lr = a.endsWith(" L") || a.endsWith(" R");
            var b_has_lr = b.endsWith(" L") || b.endsWith(" R");
            
            if (a_has_lr && !b_has_lr) return 1;
            if (!a_has_lr && b_has_lr) return -1;
            
            if (a > b) return 1;
            if (a == b) return 0;
            return -1;
        });
        
        // group together tract names in the following way:
        // tractName -> { left: tractNameLeft, right: tractNameRight }
        // or tractName -> {} if there are no children
        LRtractNames['All'] = {};
        keys.forEach(tractName => {
            var rawName = tractName.replace(/ [LR]/g, "");
            if (rawName != tractName) {
                LRtractNames[rawName] = LRtractNames[rawName] || {};
                if (tractName.endsWith(" L")) LRtractNames[rawName].left = { name: tractName };
                else LRtractNames[rawName].right = { name: tractName };
            }
            else LRtractNames[rawName] = {};   // standalone, not left or right
        });
        
        // add the toggles to controls
        for (var tractName in LRtractNames) {
            var subTracts = LRtractNames[tractName], li;
            if (!Object.keys(subTracts).length) {
                li = makeToggle(tractName);
                LRtractNames[tractName].checkbox = li.checkbox;
            }
            else {
                let li_left = makeToggle(subTracts.left.name);
                let li_right = makeToggle(subTracts.right.name);
                let tr = $("<tr/>"),
                    left_cell = $("<td/>"),
                    right_cell = $("<td/>");
                li = $("<li/>"),
                
                li.addClass("parent table");
                li_left.wrapper.addClass("toggle-switch");
                li_right.wrapper.addClass("toggle-switch");
                
                left_cell.append(li_left.wrapper);
                right_cell.append(li_right.wrapper);
                tr.append([left_cell, right_cell])
                li.append(tr)
                
                LRtractNames[tractName].left.checkbox = li_left.checkbox;
                LRtractNames[tractName].right.checkbox = li_right.checkbox;
            }
            tract_toggles_el.append(li);
        }
        
        // configure hiding/showing the panel
        hide_show_text_el.text('Hide Controls');
        hide_show_el.on("click", e => {
            if (container_toggles.css('opacity') == '0') {
                container_toggles.css({ 'max-width': '500px', 'opacity': 1 });
                controls_el.css({ 'overflow-y': 'auto' });
                hide_show_text_el.text('Hide Controls');
            }
            else {
                hide_show_el.css('min-height', container_toggles.height() + 'px');
                container_toggles.css({ 'max-width': '0px', 'opacity': 0 });
                controls_el.css({ 'overflow-y': 'hidden' });
                hide_show_text_el.text('Show Controls');
            }
        });
    }
    
    function makeToggle(tractName, options) {
        options = options || {};
        
            // parents
        let li = $("<li/>"),
            wrapper = $("<span/>"),
            switch_el = $("<span/>"),
            // text next to the checkbox
            label = $("<label/>"),
            // checkbox
            input = $("<input/>"),
            input_label = $("<label/>");
        
        li.addClass("parent");
        
        // item that contains the name of the tract as well as the toggle
        wrapper.addClass("toggle-switch");
        wrapper.on("mouseenter", e => {
            label.addClass("active");
            if (tractName != "All") {
                config.tracts[tractName]._restore = {
                    color: config.tracts[tractName].material.color,
                    visible: config.tracts[tractName].visible
                };
                // make the tract white and visible
                config.tracts[tractName].material.color = new THREE.Color(1, 1, 1);
                config.tracts[tractName].visible = true;
            }
        });
        wrapper.on("mouseleave", e => {
            label.removeClass("active");
            if (tractName != "All") {
                config.tracts[tractName].material.color = config.tracts[tractName]._restore.color;
                config.tracts[tractName].visible = config.tracts[tractName]._restore.visible;
            }
        });
        
        // text that appears beside the toggle switch
        var switchText = tractName;
        if (switchText == 'All')
            switchText += ` (Fibers: ${config.num_fibers})`;
        label.text(switchText);
        label.attr({'title': tractName, 'for': tractName});
        label.addClass("identifier");
        
        // the toggle switch itself
        switch_el.addClass("material-switch");
        input.attr({'type': 'checkbox','id': tractName, 'checked': true});
        input.on('change', e => {
            if (e.target.checked) wrapper.removeClass("disabled");
            else wrapper.addClass("disabled");
            
            if (tractName == "All") Object.keys(LRtractNames).forEach(key =>  {
                if (key == 'All') return;
                var subTracts = LRtractNames[key];
                
                if (subTracts.checkbox) {
                    if (subTracts.checkbox.checked != e.target.checked) subTracts.checkbox.click();
                }
                else {
                    var checkboxLeft = LRtractNames[key].left.checkbox,
                        checkboxRight = LRtractNames[key].right.checkbox;
                    
                    if (checkboxLeft.checked != e.target.checked) checkboxLeft.click();
                    if (checkboxRight.checked != e.target.checked) checkboxRight.click();
                }
            } );
            else {
                config.tracts[tractName].visible = e.target.checked;
                config.tracts[tractName]._restore = config.tracts[tractName]._restore || {};
                config.tracts[tractName]._restore.visible = e.target.checked;
            }
        });
        input_label.addClass("label-default");
        input_label.attr('for', tractName);
        
        switch_el.append([input, input_label]);
        
        // wrapper div to avoid word wrap issues
        wrapper.addClass("wrapper");
        
        wrapper.append([label, switch_el]);
        li.append(wrapper);
        
        if (tractName == 'all') li.addClass("all");
        li.checkbox = input[0];
        li.wrapper = wrapper;
        return li;
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

            cb(null, mesh, res);
        });
    }
});
