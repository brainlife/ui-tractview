[![Run on Brainlife.io](https://img.shields.io/badge/brainlife-ui.tractview-blue.svg)](https://brainlife.io/ui/tractview)

# ui-tractview

Web-based White Matter Tractography and Surfaces Viewer for brainlife.io.

![Preview Image](https://raw.githubusercontent.com/brainlife/brainlife.github.io/master/images/ui-logos/tractview.png)

## Abstract

The white matter of the human brain can be found in subcortical areas of the brain, and it allows distal parts of the brain to communicate and transmit information. As the role of white matter is to interact with various parts of the brain, it is important to visualize white matter together with both cortical and subcortical areas of the brain. Although it is possible to visualize white-matter tracts with segmented brain surfaces simultaneously using existing tools, they often require advanced expertise in data preprocessing and visualization techniques to correctly visualize them. Combined with an easy-to-use neuroimaging platform called brainlife.io, Tractview provides a simple yet effective web-based visualizer for white matter tractography and brain surfaces. It enables researchers to quickly gain preliminary insights on the data being processed on bralinlife.io before a more thorough analysis can be performed. 

### Authors
- [Soichi Hayashi](hayashis@iu.edu)

### Contributors
- [Steven O'Riley](stevengeeky@gmail.com)

### Project Director
- [Franco Pestilli](frakkopesto@gmail.com)

# Installation / Running locally

This App is used to visualize brainlife's [neuro/wmc datatype](https://brainlife.io/datatype/5cc1d64c44947d8aea6b2d8b) (white matter tractography) object. The easiest way to run it to run it on brainlife.io. If you'd like to run it locally (maybe for development purpose), you can run the following command inside the git cloned repo.

> Dependencies

    * nodejs (>14.17.1)
    * npm (>6.14.13)
    * tsc (>4.4.2)

```
git clone https://github.com/brain-life/ui-tractview.git
cd ui-tractview && npm install
```

To launch the UI run..

```
$ npm run dev

> tractview@0.0.0 dev /home/hayashis/syncthing/git/tractview
> vite


  vite v2.5.7 dev server running at:

  > Local: http://localhost:3000/
  > Network: use `--host` to expose

  ready in 256ms.

```

You can click on the localhost host link to launch a web browser and tractview should launch using brainlife.io's demo data.

## Configuration

Instead of using the demo data, you can provide your own data to visualize. 

> TODO

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

## Technical Notes

This project was initialized using `vite`. 

>  npm init vite-app tractview
