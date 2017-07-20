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
        debug: false,
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
            var a_has_lr = isLeftTract(a) || isRightTract(a);
            var b_has_lr = isLeftTract(b) || isRightTract(b);
            
            if (a_has_lr && !b_has_lr) return 1;
            if (!a_has_lr && b_has_lr) return -1;
            
            if (a > b) return 1;
            if (a == b) return 0;
            return -1;
        });
        
        // group together tract names in the following way:
        // tractName -> { left: {tractNameLeft, mesh}, right: {tractNameRight, mesh} }
        // or tractName -> {mesh} if there are no children
        keys.forEach(tractName => {
            var rawName = tractName.replace(/ [LR]$|^(Left|Right) /g, "");
            if (rawName != tractName) {
                LRtractNames[rawName] = LRtractNames[rawName] || {};
                if (isLeftTract(tractName)) LRtractNames[rawName].left = { name: tractName, mesh: config.tracts[tractName] };
                else LRtractNames[rawName].right = { name: tractName, mesh: config.tracts[tractName] };
            }
            else LRtractNames[rawName] = { mesh: config.tracts[tractName] };   // standalone, not left or right
        });
        
        // make 'All' button that toggles everything on/off
        var checkbox_all = $('<input type="checkbox" id="checkbox_all" checked />');
        checkbox_all.on('change', e => {
            for (let tractName in LRtractNames) {
                let toggle = LRtractNames[tractName];
                if (toggle.left) {
                    if (toggle.left.checkbox[0].checked != e.target.checked) toggle.left.checkbox.click();
                    if (toggle.right.checkbox[0].checked != e.target.checked) toggle.right.checkbox.click();
                }
                else {
                    if (toggle.checkbox[0].checked != e.target.checked) toggle.checkbox.click();
                }
            }
        });
        
        // add header toggles to controls
        tract_toggles_el.append(
            $('<tr/>').addClass('header').append([
                $('<td><label class="all" for="checkbox_all">All</label></td>').append(
                    checkbox_all),
                $('<td><label>Left</label></td>'),
                $('<td><label>Right</label></td>')
        ]));
        
        // add tract toggles to controls
        for (let tractName in LRtractNames) {
            let subTracts = LRtractNames[tractName], row;
            
            // toggles that only have a name and a single checkbox
            if (!~Object.keys(subTracts).indexOf('left')) {
                row = makeToggle(tractName, {
                    hideRightToggle: true,
                    onchange_left: (left_checked) => {
                        // set up restore variables for hiding/showing later
                        LRtractNames[tractName].mesh.visible = left_checked;
                        LRtractNames[tractName]._restore.visible = left_checked;
                        
                        if (!left_checked) row.addClass('disabled');
                        else row.removeClass('disabled');
                    },
                    onmouseenter: e => {
                        LRtractNames[tractName].mesh.visible = true;
                        LRtractNames[tractName].mesh.material.color = new THREE.Color(1, 1, 1);
                    },
                    onmouseleave: e => {
                        var restore = LRtractNames[tractName]._restore;
                        LRtractNames[tractName].mesh.visible = restore.visible;
                        LRtractNames[tractName].mesh.material.color = restore.color;
                    }
                });
                
                LRtractNames[tractName].checkbox = row.checkbox_left;
                LRtractNames[tractName]._restore = {
                    visible: subTracts.mesh.visible,
                    color: subTracts.mesh.material.color
                };
            }
            // toggles that have both L + R checkboxes, almost the same as code above, just done twice
            else {
                row = makeToggle(tractName, {
                    onchange_left: (left_checked, none_checked) => {
                        LRtractNames[tractName].left.mesh.visible = left_checked;
                        LRtractNames[tractName].left._restore.visible = left_checked;
                        
                        if (none_checked) row.addClass('disabled');
                        else row.removeClass('disabled');
                    },
                    onchange_right: (right_checked, none_checked) => {
                        LRtractNames[tractName].right.mesh.visible = right_checked;
                        LRtractNames[tractName].right._restore.visible = right_checked;
                        
                        if (none_checked) row.addClass('disabled');
                        else row.removeClass('disabled');
                    },
                    onmouseenter: e => {
                        LRtractNames[tractName].left.mesh.visible = true;
                        LRtractNames[tractName].left.mesh.material.color = new THREE.Color(1, 1, 1);
                        
                        LRtractNames[tractName].right.mesh.visible = true;
                        LRtractNames[tractName].right.mesh.material.color = new THREE.Color(1, 1, 1);
                    },
                    onmouseleave: e => {
                        var restore_left = LRtractNames[tractName].left._restore,
                            restore_right = LRtractNames[tractName].right._restore;
                        
                        LRtractNames[tractName].left.mesh.visible = restore_left.visible;
                        LRtractNames[tractName].left.mesh.material.color = restore_left.color;
                        
                        LRtractNames[tractName].right.mesh.visible = restore_right.visible;
                        LRtractNames[tractName].right.mesh.material.color = restore_right.color;
                    }
                });
                
                LRtractNames[tractName].left.checkbox = row.checkbox_left;
                LRtractNames[tractName].left._restore = {
                    visible: subTracts.left.mesh.visible,
                    color: subTracts.left.mesh.material.color
                };
                
                LRtractNames[tractName].right.checkbox = row.checkbox_right;
                LRtractNames[tractName].right._restore = {
                    visible: subTracts.right.mesh.visible,
                    color: subTracts.right.mesh.material.color
                };
            }
            tract_toggles_el.append(row);
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
    
    // helper method for making toggles
    function makeToggle(tractName, options) {
        options = options || {};
        
        // row that contains the text of the toggle, as well as the left/right checkboxes
        let row = $("<tr/>"),
            td_label = $("<td/>"),
            label = $("<label/>"),
            td_left = $("<td/>"),
            checkbox_left = $("<input/>").attr({ 'type': 'checkbox', 'checked': true }),
            td_right = $("<td/>"),
            checkbox_right = $("<input/>").attr({ 'type': 'checkbox', 'checked': true });
        
        label.text(tractName);
        
        // mouse events
        row.on('mouseenter', e => {
            row.addClass('active');
            if (options.onmouseenter)
                options.onmouseenter(e);
        });
        row.on('mouseleave', e => {
            row.removeClass('active');
            if (options.onmouseleave)
                options.onmouseleave(e);
        });
        
        checkbox_left.on('change', e => {
            var left_checked = checkbox_left[0].checked,
                right_checked = checkbox_right[0].checked || options.hideRightToggle;
            
            if (options.onchange_left)
                options.onchange_left(left_checked, !left_checked && !right_checked);
        });
        checkbox_right.on('change', e => {
            var left_checked = checkbox_left[0].checked,
                right_checked = checkbox_right[0].checked || options.hideRightToggle;
            
            if (options.onchange_right)
                options.onchange_right(right_checked, !left_checked && !right_checked);
        });
        
        // add everything
        td_label.addClass('label').append(label);
        td_left.addClass('left').append(checkbox_left);
        td_right.addClass('right');
        if (!options.hideRightToggle)
            td_right.append(checkbox_right)
        
        row.addClass('row');
        row.append([td_label, td_left, td_right]);
        
        row.checkbox_left = checkbox_left;
        row.checkbox_right = checkbox_right;
        
        return row;
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
    
    // returns whether or not the tractName is considered to be a left tract
    function isLeftTract(tractName) {
        return tractName.startsWith('Left ') || tractName.endsWith(' L');
    }
    // returns whether or not the tractName is considered to be a right tract
    function isRightTract(tractName) {
        return tractName.startsWith('Right ') || tractName.endsWith(' R');
    }
    
});
