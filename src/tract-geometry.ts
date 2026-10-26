/** Self-contained: simple-web-worker serializes this function into a worker. */
export function buildTractGeometry(json: any) {
    const fail = () => { throw new Error('Invalid tract coordinates: expected finite XYZ points or three equal coordinate arrays.'); };
    const matrix = (value: any): boolean => Array.isArray(value) && value.length > 0 &&
        value.every((row: any) => Array.isArray(row) && row.every((v: any) => typeof v === 'number' && Number.isFinite(v)));
    let bundle = json && json.coords;
    if (!Array.isArray(bundle) || !bundle.length) return fail();
    // Accept the additional singleton dimensions emitted by older MATLAB exporters.
    while (bundle.length === 1 && Array.isArray(bundle[0]) && !matrix(bundle[0])) bundle = bundle[0];
    const fibers = bundle.map((fiber: any) => {
        while (Array.isArray(fiber) && fiber.length === 1 && !matrix(fiber)) fiber = fiber[0];
        if (!matrix(fiber)) return fail();
        return fiber as number[][];
 });
    const explicit = json.coordinateLayout;
    if (explicit !== undefined && explicit !== 'axes' && explicit !== 'points') return fail();
    // 3x3 alone is ambiguous: preserve the legacy axes interpretation unless
    // the exporter declares a layout or other fibers establish points layout.
    const inferredPoints = fibers.some((fiber: number[][]) => fiber.length !== 3 && fiber.every(row => row.length === 3));
    const inferredAxes = fibers.some((fiber: number[][]) => fiber.length === 3 && fiber[0].length !== 3);
    if (!explicit && inferredPoints && inferredAxes) return fail();
    const points = explicit ? explicit === 'points' : inferredPoints;
    const lines: number[] = [], starts: number[] = [], ends: number[] = [];
    fibers.forEach((fiber: number[][]) => {
        let axes: number[][];
        if (points) {
            if (fiber.length < 2 || !fiber.every(row => row.length === 3)) return fail();
            axes = [0, 1, 2].map(axis => fiber.map(point => point[axis]));
        } else {
            if (fiber.length !== 3 || fiber[0].length < 2 || !fiber.every(row => row.length === fiber[0].length)) return fail();
            axes = fiber;
        }
        const [xs, ys, zs] = axes, n = xs.length;
        starts.push(xs[0], ys[0], zs[0]);
        ends.push(xs[n-1], ys[n-1], zs[n-1]);
        for (let i = 1; i < n; i++) lines.push(xs[i-1], ys[i-1], zs[i-1], xs[i], ys[i], zs[i]);
    });
    return {lines: new Float32Array(lines), startPoints: new Float32Array(starts), endPoints: new Float32Array(ends)};
}
