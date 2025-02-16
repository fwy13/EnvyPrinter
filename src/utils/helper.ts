export function rgbaToGray(rgba, brightness, alpha_as_white) {
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
export function index(x: number, y: number, width: number) {
    return x + y * width;
}
export function grayToRgba(mono, white_as_transparent) {
    const rgba = new Uint32Array(mono.length);
    for (let i = 0; i < mono.length; ++i) {
        const base = mono[i] === 0xff && white_as_transparent ? 0 : 0xff000000;
        // little endian
        rgba[i] = base | (mono[i] << 16) | (mono[i] << 8) | mono[i];
    }
    return rgba;
}
export function rgbaToBits(data: Uint32Array) {
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
export function delay(msecs: number) {
    return new Promise<void>((resolve) => setTimeout(() => resolve(), msecs));
}
