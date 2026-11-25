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

## 📚 Citing

If you use brainlife.io in your work, please cite:

> Hayashi S, Caron BA, Heinsfeld AS, et al. brainlife.io: a decentralized and open-source cloud platform to support neuroscience research. *Nature Methods* 21:809–813 (2024). [doi:10.1038/s41592-024-02237-2](https://doi.org/10.1038/s41592-024-02237-2)

## 🤝 Contributing

Issues and pull requests are welcome in this repository. For help using brainlife.io, see the [documentation](https://brainlife.io/docs).

## ⚖️ License

[MIT](LICENSE).

<p align="center"><sub>brainlife.io · Brain data across scales. One place to analyze, share and publish it. · The University of Texas at Austin</sub></p>
