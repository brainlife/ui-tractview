# ui-tractview
HTML5 Tract Viewer - Used to visualize output from AFQ

![Preview Image](https://raw.githubusercontent.com/stevengeeky/ui-tractview/master/images/preview.png)

## Install

Install for general purpose use (visualize a set of tracts with optional 3-dimensional nifti masks)

```bash
npm install ui-tractview
```

Get browserify so that you can use `require` locally:

```bash
npm install -g browserify
```

Include script dependencies in your index.html file:

```html
<!-- Dep Scripts -->
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/jquery/dist/jquery.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/three/build/three.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/three/examples/js/loaders/VTKLoader.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/bootstrap/dist/js/bootstrap.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/panning-orbit-controls/dist/panning-orbit-controls.js">

<script type="text/javascript" src="node_modules/ui-tractview/node_modules/pako/dist/pako_inflate.min.js"></script>

<!-- Main Scripts -->
<!-- bundle.js will be generated from a later step -->
<script type="text/javascript" src="bundle.js"></script>

<!-- Dep Styles -->
<link rel="stylesheet" type="text/css" href="node_modules/bootstrap/dist/css/bootstrap.min.css" />
```

Make an element to hook the tractviewer onto:

```html
<div id="tractview" style="height: 100%;"></div>
```

Make a main javascript file which we will denote as `main.js` for this demonstration. Then require `tractview` inside it:

```javascript
$(function() {
    var tractview = require('./node_modules/ui-tractview/tractview.js');

    var config = {/* read below */};

    tractview.init({
        selector: '#tractview',
        preview_scene_path: 'node_modules/ui-tractview/models/brain.json',
        tracts: config.tracts,  // read below
        niftis: config.niftis   // read below
    });
});
```

The `config` value used above has the following layout:

```javascript
{
    "tracts": [{
        "name": "Left IFOF",
        "color": [0.1465684211,0.7597421053,0.6797052632],
        "filename": "file/path/to/tract1.json" }/*, ...*/],
    "niftis": [{
        "name": "faStd",
        "filename": "file/path/to/faStd.nii.gz" }/*, ...*/]
}
```

The list of tracts contains a set of objects which each specify what the name of a given tract is, what its color should be represented as in tractview ([r, g, b], each ranging from 0 to 1), and what file or url path leads to the tract's json file, which should look like this:

```javascript
{
    "coords": [[
            // x coords
            [-21.69491386, -21.64446831, -21.4675293/*, ...*/],
            // y coords
            [43.13895035, 42.14380264, 41.15979385/*, ...*/],
            // z coords
            [1.224040627, 1.165375113, 1.165637732/*, ...*/]
        ]/*, ...*/]
}
```

If you are generating an output from AFQ in Matlab, you can use savejson and a script similar to the following in order to create a list of output json files:

```matlab
[fg_classified,~,classification] = AFQ_SegmentFiberGroups(config.dt6, fg, [], [], false);
tracts = fg2Array(fg_classified);
mkdir('tracts');
cm = parula(length(tracts));
for it = 1:length(tracts)
  tract.name   = tracts(it).name;
  tract.color  = cm(it,:);
  tract.coords = tracts(it).fibers;
  savejson('', tract, fullfile('tracts',sprintf('%i.json',it)));
end
```

After you have set up your main javascript file, simply run

```bash
browserify main.js > bundle.js
```

And all of your code will be assembled into a single file (in this case `bundle.js`) which can be run standalone on a local machine.