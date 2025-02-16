function rgbaToGray(rgba, brightness, alpha_as_white) {
    // use clamped array to prevent obscure bugs
    const mono = new Uint8ClampedArray(rgba.length);
    let r = 0.0,
        g = 0.0,
        b = 0.0,
        a = 0.0,
        m = 0.0,
        n = 0;
    for (let i = 0; i < mono.length; ++i) {
        n = rgba[i];
        (r = n & 0xff), (g = (n >> 8) & 0xff), (b = (n >> 16) & 0xff);
        a = ((n >> 24) & 0xff) / 0xff;
        if (a < 1 && alpha_as_white) {
            a = 1 - a;
            r += (0xff - r) * a;
            g += (0xff - g) * a;
            b += (0xff - b) * a;
        } else {
            r *= a;
            g *= a;
            b *= a;
        }
        m = r * 0.2125 + g * 0.7154 + b * 0.0721;
        m += (brightness - 0x80) * (1 - m / 0xff) * (m / 0xff) * 2;
        mono[i] = m;
    }
    return mono;
}
function index(x: number, y: number, width: number) {
    return x + y * width;
}
function grayToRgba(mono, white_as_transparent) {
    const rgba = new Uint32Array(mono.length);
    for (let i = 0; i < mono.length; ++i) {
        const base = mono[i] === 0xff && white_as_transparent ? 0 : 0xff000000;
        // little endian
        rgba[i] = base | (mono[i] << 16) | (mono[i] << 8) | mono[i];
    }
    return rgba;
}
function rgbaToBits(data: Uint32Array) {
    const length = (data.length / 8) | 0;
    const result = new Uint8Array(length);
    for (let i = 0, p = 0; i < data.length; ++p) {
        result[p] = 0;
        for (let d = 0; d < 8; ++i, ++d)
            result[p] |= data[i] & 0xff & (0b1 << d);
        result[p] ^= 0b11111111;
    }
    return result;
}
function Algorithm(
    pixels: Uint8ClampedArray<any>,
    w: number,
    h: number,
    pixelData: any[],
    isFactor: number
) {
    let Pixels = pixels;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let oldPixel = Pixels[index(x, y, w)];
            let newPixel =
                Math.round((oldPixel * isFactor) / 255) * (255 / isFactor);
            let err = oldPixel - newPixel;
            Pixels[index(x, y, w)] = newPixel;
            for (let [dx, dy, error_weight, factor] of pixelData) {
                if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) {
                    Pixels[index(x + dx, y + dy, w)] +=
                        (err * error_weight) / factor;
                }
            }
        }
    }
    const imagedata = new ImageData(
        new Uint8ClampedArray(grayToRgba(Pixels, true).buffer),
        w,
        h
    );
    return imagedata;
}

function nameAndPixelData(type: number) {
    switch (type) {
        case 0:
            return {
                name: "Floyd-Steinberg",
                pixelData: [
                    [1, 0, 7, 16],
                    [-1, 1, 3, 16],
                    [0, 1, 5, 16],
                    [1, 1, 1, 16],
                ],
            };
        case 1:
            return {
                name: "Atkinson Algorithm",
                pixelData: [
                    [1, 0, 1, 8],
                    [2, 0, 1, 8],
                    [-1, 1, 1, 8],
                    [0, 1, 1, 8],
                    [1, 1, 1, 8],
                    [0, 2, 1, 8],
                ],
            };
        case 2:
            return {
                name: "Jarvis, Judice, and Ninke Dithering",
                pixelData: [
                    [1, 0, 7, 48],
                    [2, 0, 5, 48],
                    [-2, 1, 3, 48],
                    [-1, 1, 5, 48],
                    [0, 1, 7, 48],
                    [1, 1, 5, 48],
                    [2, 1, 3, 48],
                    [-2, 2, 1, 48],
                    [-1, 2, 3, 48],
                    [0, 2, 5, 48],
                    [1, 2, 3, 48],
                    [2, 2, 1, 48],
                ],
            };
    }
}

self.addEventListener("message", (event) => {
    const {
        data: pixelsBuffer,
        type,
        w: width,
        h: height,
        brightness: isBrightness,
        factor: isFactor,
    } = event.data;
    const data = new Uint32Array(pixelsBuffer);
    const Grayscale = rgbaToGray(data, isBrightness, true);

    // arrData.push({
    //     arr: Algorithm(
    //         arrGrayscale[0],
    //         width,
    //         height,
    //         [
    //             [1, 0, 7, 16],
    //             [-1, 1, 3, 16],
    //             [0, 1, 5, 16],
    //             [1, 1, 1, 16],
    //         ],
    //         1
    //     ),
    //     name: "Floyd-Steinberg",
    // });
    // arrData.push({
    //     arr: Algorithm(
    //         arrGrayscale[1],
    //         width,
    //         height,
    //         [
    //             [1, 0, 7, 48],
    //             [2, 0, 5, 48],
    //             [-2, 1, 3, 48],
    //             [-1, 1, 5, 48],
    //             [0, 1, 7, 48],
    //             [1, 1, 5, 48],
    //             [2, 1, 3, 48],
    //             [-2, 2, 1, 48],
    //             [-1, 2, 3, 48],
    //             [0, 2, 5, 48],
    //             [1, 2, 3, 48],
    //             [2, 2, 1, 48],
    //         ],
    //         1
    //     ),
    //     name: "Jarvis, Judice, and Ninke Dithering",
    // });

    // arrData.push({
    //     arr: Algorithm(
    //         arrGrayscale[2],
    //         width,
    //         height,
    //         [
    //             [1, 0, 1, 8],
    //             [2, 0, 1, 8],
    //             [-1, 1, 1, 8],
    //             [0, 1, 1, 8],
    //             [1, 1, 1, 8],
    //             [0, 2, 1, 8],
    //         ],
    //         1
    //     ),
    //     name: "Atkinson’s Algorithm",
    // });
    self.postMessage({
        data: {
            arr: Algorithm(
                Grayscale,
                width,
                height,
                nameAndPixelData(type).pixelData,
                1
            ),
            name: nameAndPixelData(type).name,
        },
        type: type,
        w: width,
        h: height,
    });
});
