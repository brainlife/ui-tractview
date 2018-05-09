'use strict';

(function() {
//
let debounce;

Vue.component('tractview', {
  props: [ "config" ],
  
  data () {
    return {
      load_percentage: 1,
      
      all_left: true,
      all_right: true,
      visible: true,
      
      meshes: [],
      
      dataMin: 0,
      dataMax: 0,
      gamma: 1,
      
      color_map: null,
      color_map_head: null,
      hist: [],
      focused: {},
      
      scene: null,
      renderer: null,
      camera: null,
      controls: null,
      
      tinyBrainScene: null,
      tinyBrainCam: null,
      brainRenderer: null,
      
      niftis: [],
      selectedNifti: 0
    };
  },
  
  mounted() {
    var vm = this;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.brainRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    this.scene = new THREE.Scene();

    // camera
    let viewbox = this.$refs.view.getBoundingClientRect();
    let tinybrainbox = this.$refs.tinybrain.getBoundingClientRect();
    
    this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 5000);
    this.tinyBrainCam = new THREE.PerspectiveCamera(45, tinybrainbox.width / tinybrainbox.height, 1, 5000);
    
    this.camera.position.z = 200;

    window.addEventListener("resize", this.resized);

    // add tiny brain (to show the orientation of the brain while the user looks at fascicles)
    let loader = new THREE.ObjectLoader();

    loader.load('models/brain.json', _scene => {
      this.tinyBrainScene = _scene;
      let brainMesh = this.tinyBrainScene.children[1],
        unnecessaryDirectionalLight = this.tinyBrainScene.children[2];
      // align the tiny brain with the model displaying fascicles

      brainMesh.rotation.z += Math.PI / 2;
      brainMesh.material = new THREE.MeshLambertMaterial({ color: 0xffcc99 });

      this.tinyBrainScene.remove(unnecessaryDirectionalLight);

      let amblight = new THREE.AmbientLight(0x101010);
      this.tinyBrainScene.add(amblight);

      this.brainlight = new THREE.PointLight(0xffffff, 1);
      this.brainlight.radius = 20;
      this.brainlight.position.copy(this.tinyBrainCam.position);
      this.tinyBrainScene.add(this.brainlight);
    });

    // start loading the tract
    let idx = 0;
    async.eachLimit(
      this.config.tracts, 3,
      (tract, next_tract) => {
        vm.load_tract(tract, idx++, (err, mesh) => {
          if (err) return next_tract(err);
          this.add_mesh_to_scene(mesh);
          this.load_percentage = idx / this.config.tracts.length;
          // this.config.num_fibers += res.coords.length;
          tract.mesh = mesh;
          next_tract();
        });
      },
      err => console.log
    )

    this.renderer.autoClear = false;
    this.renderer.setSize(viewbox.width, viewbox.height);
    this.$refs.view.appendChild(this.renderer.domElement);

    this.brainRenderer.autoClear = false;
    this.brainRenderer.setSize(tinybrainbox.width, tinybrainbox.height);
    this.$refs.tinybrain.appendChild(this.brainRenderer.domElement);

    // use OrbitControls and make camera light follow camera position
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    
    let info_json = getHashValue('info');
    if (info_json) {
      let info = JSON.parse(info_json);
      if (info.rotation) {
        this.camera.rotation.x = +info.rotation.x;
        this.camera.rotation.y = +info.rotation.y;
        this.camera.rotation.z = +info.rotation.z;
      }
      if (info.position) {
        this.camera.position.x = +info.position.x;
        this.camera.position.y = +info.position.y;
        this.camera.position.z = +info.position.z;
      }
      if (info.origin) {
        this.controls.target.x = +info.origin.x;
        this.controls.target.y = +info.origin.y;
        this.controls.target.z = +info.origin.z;
      }
      if (info.pan) {
        this.controls.setPubPanOffset(+info.pan.x, +info.pan.y, +info.pan.z);
      }
    } else this.controls.autoRotate = true;
    
    this.controls.addEventListener('change', function (e) {
      // rotation changes
      let pan = vm.controls.getPanOffset();
      
      // save camera information in url
      window.location = "#info=" +
        encodeURIComponent(JSON.stringify({
          rotation: {
            x: vm.camera.rotation.x,
            y: vm.camera.rotation.y,
            z: vm.camera.rotation.z
          },
          position: {
            x: vm.camera.position.x,
            y: vm.camera.position.y,
            z: vm.camera.position.z
          },
          origin: {
            x: vm.controls.target.x,
            y: vm.controls.target.y,
            z: vm.controls.target.z
          },
          pan: {
            x: pan.x,
            y: pan.y,
            z: pan.z
          }
        }));
    });
    
    this.controls.addEventListener('start', function () {
      // use interacting with control
      // gamma_input_el.trigger({ type: 'blur' })
      vm.controls.autoRotate = false;
    });

    // gamma_input_el.on('change', gamma_changed)
    // gamma_input_el.on('keyup', gamma_changed)
    this.updateAllShaders()
    this.appendStyle();
    
    this.animate_conview();
  },

  methods: {
    animate_conview: function() {
      this.controls.enableKeys = document.activeElement != this.$refs.gamma;
      this.controls.update();

      this.renderer.clear();
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);

      // handle display of the tiny brain preview
      if (this.tinyBrainScene) {
        // normalize the main camera's position so that the tiny brain camera is always the same distance away from <0, 0, 0>
        let pan = this.controls.getPanOffset();
        let pos3 = new THREE.Vector3(
          this.camera.position.x - pan.x,
          this.camera.position.y - pan.y,
          this.camera.position.z - pan.z
        ).normalize();
        this.tinyBrainCam.position.set(pos3.x * 10, pos3.y * 10, pos3.z * 10);
        this.tinyBrainCam.rotation.copy(this.camera.rotation);

        this.brainlight.position.copy(this.tinyBrainCam.position);

        this.brainRenderer.clear();
        this.brainRenderer.render(this.tinyBrainScene, this.tinyBrainCam);
      }

      requestAnimationFrame(this.animate_conview);
    },
    
    toggle_hide_show: function () {
      this.visible = !this.visible;
    },
    
    tractFocus: function(LR, basename) {
      if (this.load_percentage == 1) {
        this.focused[basename] = true;
        
        if (LR.left) {
          LR.left.material_previous = LR.left.material;
          LR.left.material = white_material;
        }
        if (LR.right) {
          LR.right.material_previous = LR.right.material;
          LR.right.material = white_material;
        }
      }
    },
    
    tractUnfocus: function(LR, basename) {
      if (this.load_percentage == 1) {
        this.focused[basename] = false;
        
        if (LR.left && LR.left.material_previous) LR.left.material = LR.left.material_previous;
        if (LR.right && LR.right.material_previous) LR.right.material = LR.right.material_previous;
      }
    },
    
    resized: function () {
      var viewbox = this.$refs.view.getBoundingClientRect();
      
      this.camera.aspect = viewbox.width / viewbox.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(viewbox.width, viewbox.height);
    },
    
    load_tract: function(tract, index, cb) {
      // console.log("loading tract", tract.url);
      fetch(tract.url).then(res=>{
          return res.json();
      }).then(json=>{
          var bundle = json.coords;
          
          /* this does not prevent chrome from crashing..
          if(bundle.length > 1000) {
              console.log(tract, "has too many bundles - trimming at 1000", bundle.length);
              bundle = bundle.slice(0, 1000);
          }
          */
    
          //convert each bundle to threads_pos array
          var threads_pos = [];
          bundle.forEach(function(fascicle) {
              if (fascicle[0] instanceof Array) fascicle = fascicle[0]; //for backward compatibility
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
    
          //then convert that to bufferedgeometry
          var vertices = new Float32Array(threads_pos);
          var geometry = new THREE.BufferGeometry();
          geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
          geometry.vertices = vertices;
          geometry.tract_index = index;
          geometry.tract = tract; //metadata..
          
          let mesh = this.calculateMesh(geometry);
          mesh.name = tract.name;
          
          cb(null, mesh);
      });
    },
    
    calculateMesh: function(geometry, mesh) {
      if (this.color_map) {
          var vertexShader = `
              attribute vec4 color;
              varying vec4 vColor;
              
              void main(){
                  vColor = color;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
          `;
    
          var fragmentShader = `
              varying vec4 vColor;
              uniform float dataMin;
              uniform float dataMax;
              uniform float gamma;
              
              float transformify(float value) {
                  return pow(value / dataMax, 1.0 / gamma) * dataMax;
              }
              
              void main(){
                  gl_FragColor = vec4(transformify(vColor.r), transformify(vColor.g), transformify(vColor.b), vColor.a);
              }
          `;
          
          var cols = [];
          var hist = [];
          for (var i = 0; i < geometry.vertices.length; i += 3) {
              //convert webgl to voxel coordinates
              var x = Math.round((geometry.vertices[i] - this.color_map_head.spaceOrigin[0]) / this.color_map_head.thicknesses[0]);
              var y = Math.round((geometry.vertices[i+1] - this.color_map_head.spaceOrigin[1]) / this.color_map_head.thicknesses[1]);
              var z = Math.round((geometry.vertices[i+2] - this.color_map_head.spaceOrigin[2]) / this.color_map_head.thicknesses[2]);
    
              //find voxel value
              var v = this.color_map.get(z, y, x);
              if (isNaN(v)) {
                  // if the color is invalid, then just gray out that part of the tract
                  cols.push(.5);
                  cols.push(.5);
                  cols.push(.5);
                  cols.push(1.0);
              }
              else {
                  var normalized_v = (v - this.dataMin) / (this.dataMax - this.dataMin);
                  
                  //clip..
                  if(normalized_v < 0.1) normalized_v = 0.1;
                  if(normalized_v > 1) normalized_v = 1;
    
                  //compute histogram
                  var hv = Math.round(normalized_v*256);
                  var glob_hv = Math.round(normalized_v*100);
                  hist[hv] = (hist[hv] || 0) + 1;
                  this.hist[glob_hv] = (this.hist[glob_hv] || 0) + 1;
                  
                  if (geometry.tract.color instanceof Array) {
                    cols.push(geometry.tract.color[0] * normalized_v);
                    cols.push(geometry.tract.color[1] * normalized_v);
                    cols.push(geometry.tract.color[2] * normalized_v);
                    cols.push(1.0);
                  }
                  else {
                    cols.push(geometry.tract.color.r * normalized_v);
                    cols.push(geometry.tract.color.g * normalized_v);
                    cols.push(geometry.tract.color.b * normalized_v);
                    cols.push(1.0);
                  }
              }
          }
          geometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 4));
          let material = new THREE.ShaderMaterial({
              vertexShader,
              fragmentShader,
              uniforms: {
                  "gamma": { value: this.gamma },
                  "dataMin": { value: 1 },
                  "dataMax": { value: 1 },
              },
              transparent: true,
          });
          
          if (mesh) {
            mesh.geometry = geometry;
            mesh.material = material;
            return mesh;
          }
          else {
            var m = new THREE.LineSegments( geometry, material );
            
            this.config.tracts[geometry.tract_index].mesh = m;
            return m;
          }
      }
      
      var material;
      if (geometry.tract.color instanceof Array) {
        material = new THREE.LineBasicMaterial({
            color: new THREE.Color(geometry.tract.color[0], geometry.tract.color[1], geometry.tract.color[2]),
            transparent: true,
            opacity: 0.7,
        });
      }
      else {
        material = new THREE.LineBasicMaterial({
          color: new THREE.Color(geometry.tract.color.r, geometry.tract.color.g, geometry.tract.color.b),
          transparent: true,
          opacity: 0.7,
        });
      }
      
      if (mesh) {
        mesh.geometry = geometry;
        mesh.material = material;
        return mesh;
      }
      
      var m = new THREE.LineSegments( geometry, material );
      this.config.tracts[geometry.tract_index].mesh = m;
      
      if (this.config.layers) {
        this.config.layers.forEach(layer => {
          let condensed_filename = layer.url;
          if (condensed_filename.indexOf('/') != -1) condensed_filename = condensed_filename.substring(condensed_filename.lastIndexOf('/'));
          
          niftis.push({ url: layer.url, user_uploaded: false, filename: condensed_filename });
        });
      }
      
      return m;
    },
    
    add_mesh_to_scene: function(mesh) {
      mesh.rotation.x = -Math.PI/2;
      this.meshes.push(mesh);
      this.scene.add(mesh);
    },
    
    updateAllShaders: function() {
      this.meshes.forEach(mesh => {
          if (mesh.material.uniforms) {
              // console.log(mesh.material.uniforms);
              mesh.material.uniforms["gamma"].value = this.gamma;
              if (mesh.material.uniforms["dataMin"]) mesh.material.uniforms["dataMin"].value = this.dataMin;
              if (mesh.material.uniforms["dataMax"]) mesh.material.uniforms["dataMax"].value = this.dataMax;
          }
      });
      
      // update background depending on gamma
      var transform96 = Math.pow(96 / 255, 1 / this.gamma);
      this.renderer.setClearColor(new THREE.Color(transform96,transform96,transform96));
    },
    
    recalculateMaterials: function() {
      this.hist = [];
      this.meshes.forEach(mesh => {
          this.calculateMesh(mesh.geometry, mesh);
      });
    },
    
    destroyPlot: function() {
      // plots_el.html('');
      Plotly.purge(this.$refs.hist);
      this.$refs.hist.style.display = "none";
    },
    
    makePlot: function() {
      this.destroyPlot();
      
      var zero_to_one = [];
      for (var x = 0; x <= 100; x++) {
          zero_to_one.push(x / 100);
          this.hist[x] = this.hist[x] || 0;
      }
      
      this.$refs.hist.style.display = "inline-block";
      Plotly.plot(this.$refs.hist, [{
          x: zero_to_one,
          y: this.hist,
      }], {
          xaxis: { gridcolor: '#444', tickfont: { color: '#aaa' }, title: "Image Intensity" },
          yaxis: { gridcolor: '#444', tickfont: { color: '#aaa' }, title: "Number of Voxels" },
          
          margin: {
              t: 5,
              b: 32,
              l: 52,
              r: 30
          },
          font: { color: '#ccc' },
          titlefont: { color: '#ccc' },
          
          plot_bgcolor: 'transparent',
          paper_bgcolor: 'transparent',
          autosize: true,
          
          //margin: {t: 0, b: 35, r: 0},
      }, { displayModeBar: false });
  },
  
  upload_file: function(e) {
    let vm = this;
    let file = e.target.files[0];
    let reader = new FileReader();
    reader.addEventListener('load', function(buffer) {
        vm.niftis.push({ user_uploaded: true, filename: file.name, buffer: reader.result });
        vm.selectedNifti = vm.niftis.length - 1;
        vm.niftiSelectChanged();
    });
    reader.readAsArrayBuffer(file);
  },
  
  niftiSelectChanged: function() {
    if (this.selectedNifti == -1) {
      this.color_map = undefined;
      
      this.recalculateMaterials();
      this.destroyPlot();
      this.showAll();
    } else {
      let nifti = this.niftis[this.selectedNifti];
      if (nifti.user_uploaded) this.processDeflatedNiftiBuffer(nifti.buffer);
      else {
        fetch(nifti.url)
        .then(res => res.arrayBuffer())
        .then(processDeflatedNiftiBuffer)
        .catch(err => console.error);
      }
    }
  },
  
  showAll: function() {
    this.meshes.forEach(m => m.visible = true);
  },
  
  processDeflatedNiftiBuffer: function(buffer) {
      var raw = pako.inflate(buffer);
      var N = nifti.parse(raw);

      this.color_map_head = nifti.parseHeader(raw);
      this.color_map = ndarray(N.data, N.sizes.slice().reverse());
      
      this.color_map.sum = 0;
      N.data.forEach(v=>{
        if (!isNaN(v)) this.color_map.sum+=v;
      });
      this.color_map.mean = this.color_map.sum / N.data.length;

      //compute sdev
      this.color_map.dsum = 0;
      N.data.forEach(v=>{
          if (!isNaN(v)) {
              var d = v - this.color_map.mean;
              this.color_map.dsum += d*d;
          }
      });
      this.color_map.sdev = Math.sqrt(this.color_map.dsum/N.data.length);

      //set min/max
      this.dataMin = this.color_map.mean - this.color_map.sdev*5;
      this.dataMax = this.color_map.mean + this.color_map.sdev*5;
      
      // console.log("color map");
      // console.dir(color_map);
      
      this.recalculateMaterials();
      this.makePlot();
      this.showAll();
    },
    
    appendStyle: function() {
      this.$refs.style.innerHTML = `<style scoped>
        .container {
            display:inline-block;
            position:relative;
            width: 100%;
            height: 100%;
            padding: 0px;
        }
        
        .conview {
            width:100%;
            height: 100%;
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
            padding-left: 1px;
            overflow-x:hidden;
            overflow-y:auto;
            white-space:nowrap;
            font-family:Roboto;
            font-size:13px;
            background:rgba(0, 0, 0, .7);
            line-height: 130%;
        }
        .tract_toggles {
            margin-right: 10px;
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
            padding: 5px;
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
            max-height:100%;
            padding: 4px 0px;
            overflow-y:auto;
            overflow-x:hidden;
            transition:max-width .5s, opacity .5s, padding .5s;
        }
        .container_toggles.hidden {
            max-width:0;
        }
        
        .nifti_chooser {
            padding-left:4px;
            display:inline-block;
        }
        
        .gamma_input {
            width: 55px;
        }
        
        .plots {
            display:none;
            width:300px;
            height:200px;
        }
        
        .nifti_select {
            margin-bottom:4px;
        }
        
        .upload_div {
            color:#9cc;
        }
        
        .upload_div:hover {
            color:#aff;
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
    
        tr.row {
            opacity:.7;
        }
        tr.row:hover {
            opacity:1;
            color:white;
        }
        tr.row label {
            color:#ccc;
        }
        tr.row.active label {
            color:#fff;
        }
        
        .bllogo {
          position: absolute;
          padding-left: 8px;
          padding-top: 8px;
          font-size: 20px;
          font-family: "Open Sans";
          font-weight: bold;
          opacity:.2;
          color:white;
          text-decoration:none;
        }
        
        .loading {
          position: absolute;
          bottom:15px;
          left: 100px;
          font-size: 16px;
          font-family: "Open Sans";
          opacity:.2;
          color:white;
        }
    </style>`;
    }
  },
  
  computed: {
    sortedMeshes: function() {
      let out = {};
      this.meshes.map(m=>m).sort((_a, _b) => {
        var a = _a.name; var b = _b.name;
        var a_has_lr = isLeftTract(a) || isRightTract(a);
        var b_has_lr = isLeftTract(b) || isRightTract(b);
  
        if (a_has_lr && !b_has_lr) return 1;
        if (!a_has_lr && b_has_lr) return -1;
        
        if (a > b) return 1;
        if (a == b) return 0;
        return -1;
      }).forEach(m => {
        if (m.previous_material && m.material == white_material) m.material = m.previous_material;
        
        if (isRightTract(m.name)) {
          let basename = removeRightText(m.name);
          out[basename] = out[basename] || {};
          out[basename].right = m;
        }
        else {
          let basename = removeLeftText(m.name);
          out[basename] = out[basename] || {};
          out[basename].left = m;
        }
      });
      
      return out;
    }
  },
  
  watch: {
    all_left: function() {
      this.meshes.forEach(m => {
        if (!isRightTract(m.name)) m.visible = this.all_left;
      });
    },
    
    all_right: function() {
      this.meshes.forEach(m => {
        if (isRightTract(m.name)) m.visible = this.all_right;
      });
    },
    
    gamma: function() {
      let vm = this;
      let tmp = setTimeout(function() {
        if (debounce == tmp)
            vm.updateAllShaders();
      }, 500);
      debounce = tmp;
    },
  },

  template: `
  <div class="container" style="display:inline-block;">
    <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet">
    <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;"></div>
    <div id="tinybrain" class="tinybrain" style="width:100px;height:100px;" ref="tinybrain"></div>
    <div v-if="load_percentage < 1" id="loading" class="loading">Loading... ({{Math.round(load_percentage*100)}}%)</div>
    <a id="bllogo" class="bllogo" href="https://brainlife.io">Brain Life</a>
    <div style="display:inline-block;">
      <div id="controls" class="controls">
        <div style="display:flex;">
            <!-- Hide/Show Panel -->
            <div id="hide_show" class="hide_show" @click="toggle_hide_show">
                <div class="table">
                    <div class="cell">
                        <div class="rotated" v-if="visible">Hide Controls</div>
                        <div class="rotated" v-if="!visible">Show Controls</div>
                    </div>
                </div>
            </div>
            
            <!-- Fascicle Toggling -->
            <div v-if="sortedMeshes" :class="{ 'container_toggles': true, 'hidden': !visible }" id="container_toggles">
                <table class="tract_toggles" id="tract_toggles">
                  <tr>
                    <td class='label' style='color:#bbb; font-weight:bold; text-align:center;'><label>Tract Name</label></td>
                    <td class='label' style='color:#bbb; font-weight:bold; text-align:center;'><label>L</label></td>
                    <td class='label' style='color:#bbb; font-weight:bold; text-align:center;'><label>R</label></td>
                  </tr>
                  <tr class='row'>
                    <td class='label'><label>All</label></td>
                    <td class='label'><input type='checkbox' v-model='all_left' /></td>
                    <td class='label'><input type='checkbox' v-model='all_right' /></td>
                  </tr>
                  <tr class="row">
                    <td colspan="3" style="padding-top: 5px; margin-bottom: 5px; border-bottom: 1px solid gray;"></td>
                  </tr>
                  <tr v-for="(LR, basename) in sortedMeshes" class='row' @mouseenter="tractFocus(LR, basename)" @mouseleave="tractUnfocus(LR, basename)">
                    <td class='label'><label>{{basename}}</label></td>
                    <td v-if="LR.left" class='label'><input type='checkbox' :name='LR.left.name' v-model='LR.left.visible' /></td>
                    <td v-if="LR.right" class='label'><input type='checkbox' :name='LR.right.name' v-model='LR.right.visible' /></td>
                  </tr>
                </table>
                
                <div v-if='controls' style='color:#ccc; margin-top:5px;'>
                  <input type="checkbox" name="enableRotation" v-model="controls.autoRotate" /> Rotate
                </div>
                
                <!-- Nifti Choosing -->
                <div class="nifti_chooser" style="display:inline-block; max-width:300px; margin-top:5px;">
                    <div style="display:inline-block;"><label style="color:#ccc; width: 120px;">Background Gamma</label> <input type="number" min=".0001" value="1" step=".1" id="gamma_input" class="gamma_input" v-model="gamma" ref="gamma"></input></div><br />
                    <div style="display:inline-block;" v-if="niftis.length > 0"><label style="color:#ccc; width: 120px;">Overlay</label> <select id="nifti_select" class="nifti_select" ref="upload_input" @change="niftiSelectChanged" v-model="selectedNifti">
                      <option :value="-1">(No Overlay)</option>
                      <option v-for="(n, i) in niftis" :value="i">{{n.filename}}</option>
                    </select></div><br />
                    <div class="upload_div">
                        <label for="upload_nifti">Upload Overlay Image (.nii.gz)</label>
                        <input type="file" style="visibility:hidden;max-height:0;max-width:5px;" name="upload_nifti" id="upload_nifti" @change="upload_file"></input>
                    </div>
                    <div class="plots" id="plots" ref="hist"></div>
                </div>
                
            </div>
        </div>
      </div>
      <div ref="style" scoped></div>
    </div>
    
  </div>
    `
})

let white_material = new THREE.LineBasicMaterial({
  color: new THREE.Color(1, 1, 1)
});

function getHashValue(key) {
  var matches = location.hash.match(new RegExp(key+'=([^&]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

// returns whether or not the tractName is considered to be a left tract
function isLeftTract(tractName) {
  return tractName.startsWith('Left ') || tractName.endsWith(' L');
}

// remove the 'left' part of the tract text
function removeLeftText(tractName) {
  if (tractName.startsWith('Left ')) tractName = tractName.substring(5);
  if (tractName.endsWith(' L')) tractName = tractName.substring(0, tractName.length - 2);
  return tractName;
}

// returns whether or not the tractName is considered to be a right tract
function isRightTract(tractName) {
  return tractName.startsWith('Right ') || tractName.endsWith(' R');
}

// remove the 'right' part of the tract text
function removeRightText(tractName) {
  if (tractName.startsWith('Right ')) tractName = tractName.substring(6);
  if (tractName.endsWith(' R')) tractName = tractName.substring(0, tractName.length - 2);
  return tractName;
}

})();
