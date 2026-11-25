<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/brand/brainlife-mark-on-dark.svg">
    <img src=".github/brand/brainlife-mark-on-light.svg" alt="brainlife.io" width="140">
  </picture>
</p>

<h1 align="center">ui-tractview</h1>

<p align="center">
  White-matter tractography and surfaces viewer (Vue + three.js, Vite) for brainlife.io datasets.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-lightgrey.svg" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/Status-maintained-blue.svg" alt="Status: maintained">
  <a href="https://brainlife.io"><img src="https://img.shields.io/badge/brainlife.io-site-3b9fd0.svg" alt="brainlife.io"></a>
  <a href="https://brainlife.io/docs"><img src="https://img.shields.io/badge/Docs-brainlife.io%2Fdocs-005981.svg" alt="Documentation"></a>
  <a href="https://doi.org/10.1038/s41592-024-02237-2"><img src="https://img.shields.io/badge/DOI-10.1038%2Fs41592--024--02237--2-e57536.svg" alt="Nature Methods paper"></a>
</p>

## 🧠 At a glance

| | |
|---|---|
| 🧭 **What** | Static web page (White-matter tractography and surfaces viewer (Vue + three.js, Vite)) that brainlife.io opens for a dataset; it reads the dataset's files through the brainlife API |
| 🗂️ **Datatypes** | `neuro/wmc` |
| 🕰️ **Last change** | 2026-10-26 |

## 💻 Run it locally

```bash
git clone https://github.com/brainlife/ui-tractview && cd ui-tractview
npm ci && npm run dev    # Vite dev server; npm run build for production
```

brainlife.io serves the built files under `/ui/` and passes the dataset location to the page.

## 📝 Notes

[Demo](https://brainlife.io/ui/tractview/). Supports both WMC coordinate layouts (2026-10).

## 🔗 Related

[ui-niivue](https://github.com/brainlife/ui-niivue) (current in-browser viewer) · [abcd-novnc](https://github.com/brainlife/abcd-novnc) (desktop viewer launcher) · [warehouse-next](https://github.com/brainlife/warehouse-next) (datatypes and their viewers)

<details>
<summary><b>📜 Previous README (technical details)</b></summary>

# ui-tractview

Web-based White Matter Tractography and Surfaces Viewer for brainlife.io.

![Preview Image](https://raw.githubusercontent.com/brainlife/brainlife.hugo/master/static/images/ui-logos/tractview.png)

[Demo Instance](https://brainlife.io/ui/tractview/)

## Abstract

The white matter of the human brain can be found in subcortical areas of the brain, and it allows distal parts of the brain to communicate and transmit information. As the role of white matter is to interact with various parts of the brain, it is important to visualize white matter together with both cortical and subcortical areas that each tracts interact with. Although it is possible to visualize white-matter tracts together with segmented brain surfaces  using existing tools, they often require advanced expertise in data preprocessing and visualization techniques to correctly visualize them. Combined with brainlife.io; an easy-to-use neuroimaging platform, Tractview is a simple yet effective web-based visualizer for white matter tractography and brain surfaces. It enables researchers to quickly gain preliminary insights on the data being processed on bralinlife.io before a more thorough analysis can be performed. 

# Installation / Running locally

This App is used to visualize brainlife's [neuro/wmc datatype](https://brainlife.io/datatype/5cc1d64c44947d8aea6b2d8b) (white matter tractography) object. The easiest way to run it is to open it on brainlife.io. If you'd like to run it locally (maybe for development purpose), you can run the following command inside the git cloned repo.

> Dependencies

* nodejs (>14.17.1)
* npm (>6.14.13)
* tsc (>4.4.2)

> Installation

```
git clone https://github.com/brain-life/ui-tractview.git
cd ui-tractview && npm install
```

> Running..

```
$ npm run dev

> tractview@0.0.0 dev /home/hayashis/syncthing/git/tractview
> vite


  vite v2.5.7 dev server running at:

  > Local: http://localhost:3000/
  > Network: use `--host` to expose

  ready in 256ms.

```

You can then click on the localhost host link to launch a web browser and tractview should launch using brainlife.io's demo data.

## Configuration

To visualize your own data in stead of the demo data, you will have to prepare [`neuro/wmc` data structure](https://brainlife.io/datatype/5cc1d64c44947d8aea6b2d8b) according to the specification. You can download a few sample datasets from brainlife's [sample datasets project](https://brainlife.io/project/5d786647281b9525d8821011).

The `neuro/wmc` basically contains 2 directories (`tracts` and `surfaces`) that are used by tractview. `classification.mat` contains the actual classification of the tracts but it is not used by this visualizer.

How to organize data inside `tracts` and `surfaces` is beyond the scope of this README, but please feel free to contact us if you would like to have an assistance.

Create a directory named `testdata` under `./public` directory of the repo, and add the following `<script>` content in the `./index.html` right above `<script src="/src/main.ts"></script>`

```
  <script>
    window.config = {
        tracts: [
            {
                name: "forcepsMinor",
                color: [ 0.8147236864, 0.2550951155, 0.004634224134 ],
                url: "testdata/tracts/1.json"
            },
            {
                name: "forcepsMajor",
                color: [ 0.9057919371, 0.5059570517, 0.7749104647 ],
                url: "testdata/tracts/2.json"
            } 
        ],
        surfaces: [
            {
                label: "2",
                color: { "g": 245, "r": 245, "b": 245 },
                name: "Left-Cerebral-White-Matter",
                url: "testdata/surfaces/2.Left-Cerebral-White-Matter.vtk",
            },
            {
                label: "41",
                color: { "g": 245, "r": 245, "b": 245 },
                name: "Right-Cerebral-White-Matter",
                url: "testdata/surfaces/41.Right-Cerebral-White-Matter.vtk",
            },
            {
                label: "4",
                color: { "g": 18, "r": 120, "b": 134 },
                name: "Left-Lateral-Ventricle",
                url: "testdata/surfaces/4.Left-Lateral-Ventricle.vtk",
            },
            {
                label: "43",
                color: { "g": 18, "r": 120, "b": 134 },
                name: "Right-Lateral-Ventricle",
                url: "testdata/surfaces/43.Right-Lateral-Ventricle.vtk",
            },
        ]
    };
  </script>

```

You will need to enumerate all tracts / surfaces that are stored inside the `tracts` and `surfaces` directories. 

## Technical Notes

This project was initialized using `vite`. 

>  npm init vite-app tractview

## WMC coordinate formats

A bundle JSON contains `coords`, an array of streamlines. TractView accepts both
`[[x1, x2, ...], [y1, y2, ...], [z1, z2, ...]]` (axes) and
`[[x1, y1, z1], [x2, y2, z2], ...]` (points) for each streamline, plus legacy
MATLAB singleton wrappers. Each streamline must contain at least two finite XYZ
points. Invalid bundles display an error instead of leaving loading unfinished.

A 3-by-3 streamline is ambiguous. The viewer follows the other streamlines in the
bundle when possible; otherwise it retains the legacy axes interpretation.
Exporters can set `"coordinateLayout": "points"` or `"coordinateLayout": "axes"`
on the bundle JSON or its manifest entry to resolve this explicitly.

The warehouse viewer uses `tracts/tracts.json` when present. If it is missing,
it discovers JSON bundles through the dataset, publication, or staged-task file
listing. It derives display names and colors from filenames; an explicit manifest
is still preferred when descriptive names or specific colors are required.
Surfaces remain optional. No stored dataset is modified by this fallback.

Run the geometry regression tests with Node 18+:

```sh
node --test test/tract-geometry.test.cjs
```

Deployment requires both the warehouse UI bundle and this viewer's `dist/`.
Deploy TractView first, then the warehouse UI, so discovered point-layout bundles
are not sent to an older geometry parser.

</details>

## 📚 Citing

If you use brainlife.io in your work, please cite:

> Hayashi S, Caron BA, Heinsfeld AS, et al. brainlife.io: a decentralized and open-source cloud platform to support neuroscience research. *Nature Methods* 21:809–813 (2024). [doi:10.1038/s41592-024-02237-2](https://doi.org/10.1038/s41592-024-02237-2)

## 🤝 Contributing

Issues and pull requests are welcome in this repository. For help using brainlife.io, see the [documentation](https://brainlife.io/docs).

## ⚖️ License

[MIT](LICENSE).

<p align="center"><sub>brainlife.io · Brain data across scales. One place to analyze, share and publish it. · The University of Texas at Austin</sub></p>
