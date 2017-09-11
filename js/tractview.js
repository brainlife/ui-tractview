/**
 * UI to display output surface from tract classification using THREE.js
 */

var TractView = {
    
    /**
     * Inits the tractography viewer
     * 
     * @param {String} config.selector -> Query selector for the element that will contain the tractview control
     * @param {Number} config.num_tracts -> Number of tracts to be loaded
     * @param {Function} config.get_json_file -> Function that returns the path to the json file containing a tract, given the tract number
     * 
     * (Optional)
     * @param {String} config.preview_scene_path -> Path to the scene to use which portrays the orientation of the brain
     */
    init: function(config) {
        if (!config)
            throw "Error: No config provided";
        // set up for later
        config.tracts = {};
        config.num_fibers = 0;
        config.LRtractNames = {};
        
        if (typeof config.selector != 'string')
            throw "Error: config.selector not provided or not set to a string";
        if (typeof config.num_tracts != 'number')
            throw "Error: config.num_tracts not provided or not set to a number";
        if (typeof config.get_json_file != 'function')
            throw "Error: config.get_json_file not provided or not set to a function";
        
        var user_container = $(config.selector);
        if (user_container.length == 0)
            throw `Error: Selector '${selector}' did not match any elements`;
        
        populateHtml(user_container);
        
        var view = user_container.find("#conview"),
            tinyBrain = user_container.find("#tinybrain"),
            controls_el = user_container.find("#controls"),
            container_toggles = user_container.find("#container_toggles"),
            tract_toggles_el = user_container.find("#tract_toggles"),
            hide_show_el = user_container.find("#hide_show"),
            hide_show_text_el = user_container.find("#hide_show_text");
        
        init_conview();
        
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
            
            if (config.preview_scene_path) {
                loader.load(config.preview_scene_path, _scene => {
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
            }
            
            for(var i = 1;i <= config.num_tracts;++i) {
                // load the tract
                load_tract(config.get_json_file(i), function(err, mesh, res) {
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
                    config.LRtractNames[rawName] = config.LRtractNames[rawName] || {};
                    if (isLeftTract(tractName)) config.LRtractNames[rawName].left = { name: tractName, mesh: config.tracts[tractName] };
                    else config.LRtractNames[rawName].right = { name: tractName, mesh: config.tracts[tractName] };
                }
                else config.LRtractNames[rawName] = { mesh: config.tracts[tractName] };   // standalone, not left or right
            });
            
            // make 'All' button that toggles everything on/off
            var checkbox_all = $('<input type="checkbox" id="checkbox_all" checked />');
            checkbox_all.on('change', e => {
                for (let tractName in config.LRtractNames) {
                    let toggle = config.LRtractNames[tractName];
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
            for (let tractName in config.LRtractNames) {
                let subTracts = config.LRtractNames[tractName], row;
                
                // toggles that only have a name and a single checkbox
                if (!~Object.keys(subTracts).indexOf('left')) {
                    row = makeToggle(tractName, {
                        hideRightToggle: true,
                        onchange_left: (left_checked) => {
                            // set up restore variables for hiding/showing later
                            config.LRtractNames[tractName].mesh.visible = left_checked;
                            config.LRtractNames[tractName]._restore.visible = left_checked;
                            
                            if (!left_checked) row.addClass('disabled');
                            else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            config.LRtractNames[tractName].mesh.visible = true;
                            config.LRtractNames[tractName].mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            var restore = config.LRtractNames[tractName]._restore;
                            config.LRtractNames[tractName].mesh.visible = restore.visible;
                            config.LRtractNames[tractName].mesh.material.color = restore.color;
                        }
                    });
                    
                    config.LRtractNames[tractName].checkbox = row.checkbox_left;
                    config.LRtractNames[tractName]._restore = {
                        visible: subTracts.mesh.visible,
                        color: subTracts.mesh.material.color
                    };
                }
                // toggles that have both L + R checkboxes, almost the same as code above, just done twice
                else {
                    row = makeToggle(tractName, {
                        onchange_left: (left_checked, none_checked) => {
                            config.LRtractNames[tractName].left.mesh.visible = left_checked;
                            config.LRtractNames[tractName].left._restore.visible = left_checked;
                            
                            if (none_checked) row.addClass('disabled');
                            else row.removeClass('disabled');
                        },
                        onchange_right: (right_checked, none_checked) => {
                            config.LRtractNames[tractName].right.mesh.visible = right_checked;
                            config.LRtractNames[tractName].right._restore.visible = right_checked;
                            
                            if (none_checked) row.addClass('disabled');
                            else row.removeClass('disabled');
                        },
                        onmouseenter: e => {
                            config.LRtractNames[tractName].left.mesh.visible = true;
                            config.LRtractNames[tractName].left.mesh.material.color = new THREE.Color(1, 1, 1);
                            
                            config.LRtractNames[tractName].right.mesh.visible = true;
                            config.LRtractNames[tractName].right.mesh.material.color = new THREE.Color(1, 1, 1);
                        },
                        onmouseleave: e => {
                            var restore_left = config.LRtractNames[tractName].left._restore,
                                restore_right = config.LRtractNames[tractName].right._restore;
                            
                            config.LRtractNames[tractName].left.mesh.visible = restore_left.visible;
                            config.LRtractNames[tractName].left.mesh.material.color = restore_left.color;
                            
                            config.LRtractNames[tractName].right.mesh.visible = restore_right.visible;
                            config.LRtractNames[tractName].right.mesh.material.color = restore_right.color;
                        }
                    });
                    
                    config.LRtractNames[tractName].left.checkbox = row.checkbox_left;
                    config.LRtractNames[tractName].left._restore = {
                        visible: subTracts.left.mesh.visible,
                        color: subTracts.left.mesh.material.color
                    };
                    
                    config.LRtractNames[tractName].right.checkbox = row.checkbox_right;
                    config.LRtractNames[tractName].right._restore = {
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
                    
                    if (fascicle[0] instanceof Array)
                        fascicle = fascicle[0];
                    var xs = fascicle[0];
                    var ys = fascicle[1];
                    var zs = fascicle[2];

                    for(var i = 1;i < xs.length;++i) {
                        threads_pos.push(xs[i-1]);
                        threads_pos.push(ys[i-1]);
                        threads_pos.push(zs[i-1]);
                        threads_pos.push(xs[i]);
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
                //mesh.position.z = -20;
                //mesh.position.y = -20;

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
        
        function populateHtml(element) {
            element.html(`
            <div class="container">
                <!-- Main Connectome View -->
                <div id="conview" class="conview"></div>
                
                <!-- Tiny Brain to Show Orientation -->
                <div id="tinybrain" class="tinybrain"></div>
                
                <div id="controls" class="controls">
                    <div style="display:flex;">
                        <!-- Hide/Show Panel -->
                        <div id="hide_show" class="hide_show">
                            <div class="table">
                                <div class="cell">
                                    <div class="rotated" id="hide_show_text"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Fascicle Toggling -->
                        <div class="container_toggles" id="container_toggles">
                            <table class="tract_toggles" id="tract_toggles"></table>
                        </div>
                    </div>
                </div>
            </div>
            
            <style scoped>
                .container {
                    width: 100%;
                    height: 100%;
                    padding: 0px;
                }
                .conview {
                    width:100%;
                    height: 100%;
                    background:black;
                }
                .tinybrain {
                    position:absolute;
                    pointer-events:none;
                    left:0;
                    bottom:0;
                    width:100px;
                    height:100px;
                }
                
                .controls {
                    display:inline-block;
                    position:absolute;
                    right:0;
                    top:0;
                    width:auto;
                    height:auto;
                    max-height:100%;
                    padding-left:1px;
                    overflow-x:hidden;
                    overflow-y:auto;
                    white-space:nowrap;
                    font-family:Roboto;
                    font-size:12px;
                    background:rgba(0, 0, 0, .7);
                }
                
                .hide_show {
                    display:inline-block;
                    position:relative;
                    vertical-align:top;
                    text-align:left;
                    width:auto;
                    flex:1;
                    color: #777;
                    overflow:hidden;
                    cursor:default;
                    transition:background 1s, color 1s;
                }
                .hide_show:hover {
                    background:black;
                    color:white;
                }
                
                /* Hide/Show Vertical Alignment */
                .parent {
                    padding-right:4px;
                }
                .list-group-item.table {
                    height:auto !important;
                }
                .table {
                    display:table;
                    height:100%;
                    margin-bottom:0 !important;
                }
                .cell {
                    display:table-cell;
                    vertical-align:middle;
                }
                
                .hide_show .rotated {
                    display:inline-block;
                    min-width:16px;
                    max-width:16px;
                    vertical-align:middle;
                    transform:rotate(-90deg);
                }
                
                .container_toggles {
                    display:inline-block;
                    max-width:500px;
                    width:auto;
                    height:auto;
                    padding-top:2px;
                    overflow:hidden;
                    transition:max-width .5s, opacity .5s, padding .5s;
                }
                
                label {
                    font-weight:100;
                    font-size:12px;
                }
                tr.header {
                    color:white;
                    text-align:center;
                    margin:0;
                }
                tr.header label {
                    margin-right:4px;
                    cursor:pointer;
                }
                
                input[type="checkbox"] {
                    vertical-align:middle;
                    margin:0;
                    cursor:pointer;
                }
                
                td.label {
                    text-overflow:ellipsis;
                }
                
                tr.row.disabled {
                    opacity:.5;
                }
                tr.row label {
                    color:#ccc;
                }
                tr.row.active label {
                    color:#fff;
                }
            </style>
            `);
        }
    }
    
};
