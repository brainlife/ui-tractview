export interface ITractConfig {
    name: string, //"forcepsMinor"
    color: THREE.Color,
    filename: string, //"1.json"
    url?: string, //created from filename and basepath like.."https://brainlife.io/ui/tractview/testdata/0001/tracts/1.json"

    mesh?: THREE.LineSegments //not always?

    //these gets applied to mesh.material to swap out material
    highlight_material: THREE.Material
    normal_material: THREE.Material

    start: THREE.Points
    end: THREE.Points
}

export interface ISurfaceConfig {
    name: string, //"Left-Cerebral-White-Matter"
    label: string, //"2"
    color: THREE.Color,
    filename: string, //"0.Unknown.vtk",
    url?: string, //created from filename and basepath like.."https://brainlife.io/ui/tractview/testdata/0001/surfaces/0.Unknown.vtk"

    mesh?: THREE.Mesh //could be other thing?

    //these gets applied to mesh.material to swap out material
    highlight_material: THREE.Material
    normal_material: THREE.Material
    xray_material: THREE.Material //used when pressed
}

export interface ITractLR {
    left_check: boolean
    right_check: boolean
    left?: ITractConfig 
    right?: ITractConfig
}

export interface ISurfaceLR {
    left_check: boolean
    right_check: boolean
    left?: ISurfaceConfig 
    right?: ISurfaceConfig
}
