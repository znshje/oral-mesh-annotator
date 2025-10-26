const toothColorBase = ('234 234 234\n' +
    '128 174 128\n' +
    '241 214 145\n' +
    '177 122 101\n' +
    '111 184 210\n' +
    '216 101 79\n' +
    '144 238 144\n' +
    '220 245 20\n' +
    '78 63 0\n' +
    '0 145 30\n' +
    '214 230 130').split('\n').map(line => line.split(' ').map(s => parseInt(s)))

const baseColors = [
    [57, 74, 244],
    [255, 75, 75],
    [55, 158, 50],
    [223, 91, 236]
]

export const getColor = (i: number, norm: boolean = false) => {
    if (i === 0) {
        return norm ? [toothColorBase[0][0] / 255., toothColorBase[0][1] / 255., toothColorBase[0][2] / 255.] : toothColorBase[0]
    }
    if (norm) {
        return toothColorBase[(i - 1) % 8 + 1].map(t => t / 255.)
    }
    return toothColorBase[(i - 1) % 8 + 1]
}

export const getToothColor = (i: number, norm: boolean = false) => {
    if (i === 0) {
        return norm ? [toothColorBase[0][0] / 255., toothColorBase[0][1] / 255., toothColorBase[0][2] / 255.] : toothColorBase[0]
    }

    const district = Math.floor(i / 10) - 1;

    try {
        return getColor(i % 10)
            .map((t, i) => t * 0.8 + baseColors[district][i] * 0.2)
            .map(x => norm ? Math.min(1.0, x / 255.) : Math.min(255, Math.floor(x)));
    } catch {
        return norm ? [toothColorBase[0][0] / 255., toothColorBase[0][1] / 255., toothColorBase[0][2] / 255.] : toothColorBase[0]
    }
}