# ui-tractview

HTML5 White Matter Tractography Viewer - Used to visualize output from white matter tractography.

[Demo at brainlife.io](https://brainlife.io/ui/tractview/demo.html) 

[brainlife.io DOI](https://doi.org/10.25663/brainlife.ui.2)

### Authors
- Soichi Hayashi (hayashis@iu.edu)
- Steven O'Riley (stevengeeky@gmail.com)

### Project Director
- [Franco Pestilli](frakkopesto@gmail.com)

### Funding Acknowledgement
brainlife.io is publicly funded and for the sustainability of the project it is helpful to Acknowledge the use of the platform. We kindly ask that you acknowledge the funding below in your publications and code reusing this code.

[![NSF-BCS-1734853](https://img.shields.io/badge/NSF_BCS-1734853-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1734853)
[![NSF-BCS-1636893](https://img.shields.io/badge/NSF_BCS-1636893-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1636893)
[![NSF-ACI-1916518](https://img.shields.io/badge/NSF_ACI-1916518-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1916518)
[![NSF-IIS-1912270](https://img.shields.io/badge/NSF_IIS-1912270-blue.svg)](https://nsf.gov/awardsearch/showAward?AWD_ID=1912270)
[![NIH-NIBIB-R01EB029272](https://img.shields.io/badge/NIH_NIBIB-R01EB029272-green.svg)](https://grantome.com/grant/NIH/R01-EB029272-01)

### Citations
We kindly ask that you cite the following articles when publishing papers or code using this code. 

1. Avesani, P., McPherson, B., Hayashi, S. et al. The open diffusion data derivatives, brain data upcycling via integrated publishing of derivatives and reproducible open cloud services. Sci Data 6, 69 (2019). [https://doi.org/10.1038/s41597-019-0073-y](https://doi.org/10.1038/s41597-019-0073-y)

#### MIT Copyright (c) 2020 brainlife.io The University of Texas at Austin and Indiana University

![Preview Image](https://raw.githubusercontent.com/brain-life/brainlife.github.io/master/images/ui-logos/tractview.png)


## Dependencies

* npm
* git

## Installation

Install for general purpose use (visualize a set of tracts with optional 3-dimensional nifti masks)

```
git clone https://github.com/brain-life/ui-tractview.git
cd ui-tractview && npm install
```

Include script dependencies in your index.html file:

```html
<!-- Dep Scripts -->
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/three/build/three.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/three/examples/js/loaders/VTKLoader.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/bootstrap/dist/js/bootstrap.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/panning-orbit-controls/dist/panning-orbit-controls.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/pako/dist/pako_inflate.min.js"></script>
<script type="text/javascript" src="node_modules/ui-tractview/node_modules/vue/dist/vue.min.js"></script>

<!-- element to bind to the tract viewer -->
<div id="tractview">

<!-- Main Scripts -->
<script type="text/javascript" src="node_modules/ui-tractview/tractview.js"></script>
<script type="text/javascript" src="main.js"></script>

<!-- Dep Styles -->
<link rel="stylesheet" type="text/css" href="node_modules/bootstrap/dist/css/bootstrap.min.css" />
```

Initialize your main script after your target element to use with the tractviewer. The tractviewer is simply a Vue component that you can initialize in a few lines of JavaScript:

```javascript
new Vue({
  el: '#tractview',
  components: ['tractview'],
  template: `<tractview :config='config'></tractview>`
});
```

The `config` prop used above has the following layout:

```javascript
{
  "tracts": [{
    "name": "Left IFOF",
    "color": [0.1465684211,0.7597421053,0.6797052632],
    "url": "file/path/to/tract1.json" }/*, ...*/],
  "layers": [{
    "name": "faStd",
    "url": "url/path/to/faStd.nii.gz" }/*, ...*/]
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

If you are generating an output from AFQ in Matlab, you can use `savejson` and a script similar to the following in order to create a list of output json files:

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

Once you have main.js and your configuration set up, you're ready to go!

### Generating Data

* tracts/

* surfaces/

mri_convert $fsdir/mri/aparc+aseg.mgz --out_orientation RAS aparc+aseg.nii.g
