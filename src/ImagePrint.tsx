import React, { useEffect, useRef, useState } from "react";
import {
    delay,
    grayToRgba,
    index,
    rgbaToBits,
    rgbaToGray,
} from "./utils/helper";
import {
    CAT_ADV_SRV,
    CAT_PRINT_RX_CHAR,
    CAT_PRINT_SRV,
    CAT_PRINT_TX_CHAR,
    DEF_ENERGY,
    DEF_FINISH_FEED,
    DEF_SPEED,
} from "./utils/const";
import { CatPrinter } from "./utils/cat-protocol";

const ImageToXlsxConverter = () => {
    const [file, setFile] = useState(null);
    const [isImage, setImage] = useState<string>();
    const [isFactor, setFactor] = useState<number>(1);
    const [isBrightness, setBrightness] = useState<number>(0);
    const [isDataPrint, setDataPrint] = useState<Uint8Array>();
    const useCanvas = useRef<HTMLCanvasElement>(null);
    const [isDataImage, setDataImage] = useState<{
        w: number;
        h: number;
    }>();

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleConvert = () => {
        if (!file) {
            alert("Please select an image file first.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const width = 384;
                const height = Math.round((384 / img.width) * img.height);
                canvas.width = width;
                canvas.height = height;
                setDataImage({ w: width, h: height });
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const pixelsBuffer = imageData.data.buffer;
                const data = new Uint32Array(pixelsBuffer);
                const Grayscale = rgbaToGray(data, isBrightness, true);
                for (let y = 0; y < height - 1; y++) {
                    for (let x = 0; x < width - 1; x++) {
                        let oldPixel = Grayscale[index(x, y, width)];
                        let newPixel =
                            Math.round((oldPixel * isFactor) / 255) *
                            (255 / isFactor);
                        let err = oldPixel - newPixel;
                        Grayscale[index(x, y, width)] = newPixel; // Important!

                        // TODO: FLOYD
                        // Grayscale[index(x + 1, y, width)] += (err * 7) / 16;
                        // Grayscale[index(x - 1, y + 1, width)] += (err * 3) / 16;
                        // Grayscale[index(x, y + 1, width)] += (err * 5) / 16;
                        // Grayscale[index(x + 1, y + 1, width)] += (err * 1) / 16;

                        // TODO: ATKINSON
                        const pos = [
                            [1, 0],
                            [2, 0],
                            [-1, 1],
                            [0, 1],
                            [1, 1],
                            [0, 2],
                        ];
                        for (let [dx, dy] of pos) {
                            if (
                                x + dx >= 0 &&
                                x + dx < width &&
                                y + dy >= 0 &&
                                y + dy < height
                            ) {
                                Grayscale[index(x + dx, y + dy, width) * 1] +=
                                    err / 8;
                            }
                        }

                        // Grayscale[index(x + 1, y, width)] += (err * 7) / 48;
                        // Grayscale[index(x + 2, y, width)] += (err * 5) / 48;

                        // Grayscale[index(x - 2, y + 1, width)] += (err * 3) / 48;
                        // Grayscale[index(x - 1, y + 1, width)] += (err * 5) / 48;
                        // Grayscale[index(x, y + 1, width)] += (err * 7) / 48;
                        // Grayscale[index(x + 1, y + 1, width)] += (err * 5) / 48;
                        // Grayscale[index(x + 2, y + 1, width)] += (err * 3) / 48;

                        // Grayscale[index(x - 2, y + 2, width)] += (err * 1) / 48;
                        // Grayscale[index(x - 1, y + 2, width)] += (err * 3) / 48;
                        // Grayscale[index(x, y + 2, width)] += (err * 5) / 48;
                        // Grayscale[index(x + 1, y + 2, width)] += (err * 3) / 48;
                        // Grayscale[index(x + 2, y + 2, width)] += (err * 1) / 48;
                    }
                }
                const rgba = grayToRgba(Grayscale, true).buffer;
                const imagedata = new ImageData(
                    new Uint8ClampedArray(rgba),
                    width,
                    height
                );
                setDataPrint(new Uint8Array(imagedata.data.buffer));
                ctx.putImageData(imagedata, 0, 0);
                useCanvas
                    .current!.getContext("2d")
                    .putImageData(imagedata, 0, 0);
                setImage(canvas.toDataURL());
            };
            img.src = event.target.result as any;
        };
        reader.readAsDataURL(file);
    };

    const print = async () => {
        const bitImage = rgbaToBits(new Uint32Array(isDataPrint?.buffer));
        const pitch = (isDataImage.w / 8) | 0;
        const speed = +(localStorage.getItem("speed") || DEF_SPEED);
        const energy = +(localStorage.getItem("energy") || DEF_ENERGY);
        const finish_feed = +120;
        const device = await (navigator as any).bluetooth.requestDevice({
            filters: [{ services: [CAT_ADV_SRV] }],
            optionalServices: [CAT_PRINT_SRV],
        });
        const server = await device.gatt.connect();
        try {
            const service = await server.getPrimaryService(CAT_PRINT_SRV);
            const [tx, rx] = await Promise.all([
                service.getCharacteristic(CAT_PRINT_TX_CHAR),
                service.getCharacteristic(CAT_PRINT_RX_CHAR),
            ]);
            const printer = new CatPrinter(
                device.name,
                tx.writeValueWithoutResponse.bind(tx),
                false
            );
            const notifier = (event: Event) => {
                //@ts-ignore:
                const data: DataView = event.target.value;
                const message = new Uint8Array(data.buffer);
                printer.notify(message);
            };

            let blank = 0;

            // TODO: be aware of other printer state, like low power, no paper, overheat, etc.
            await rx
                .startNotifications()
                .then(() =>
                    rx.addEventListener("characteristicvaluechanged", notifier)
                )
                .catch((error: Error) => console.log(error));

            await printer.prepare(speed, energy);
            for (let i = 0; i < isDataImage.h * pitch; i += pitch) {
                const line = bitImage.slice(i, i + pitch);
                if (line.every((byte) => byte === 0)) {
                    blank += 1;
                } else {
                    if (blank > 0) {
                        await printer.setSpeed(8);
                        await printer.feed(blank);
                        await printer.setSpeed(speed);
                        blank = 0;
                    }
                    await printer.draw(line);
                }
            }
            await printer.finish(blank + finish_feed);
        } finally {
            await delay(500);
            if (server) server.disconnect();
        }
    };

    return (
        <div>
            

            <div>
                <label>
                    <strong className="font-bold text-2xl">
                        Select Image:
                    </strong>{" "}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </label>
            </div>
            <div>
                <span>Grayscale:</span>
                <input
                    type="number"
                    onChange={(e) => setFactor(Number(e.target.value))}
                    value={isFactor}
                />
                <br />
                <span>Brightness</span>
                <input
                    type="number"
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    value={isBrightness}
                />
            </div>
            <div style={{ marginTop: "16px" }}>
                <button onClick={handleConvert}>Convert</button>
                <button onClick={print}>Print</button>
            </div>
            <img src={isImage} width={384} />
            <canvas ref={useCanvas} width={384} height={isDataImage?.h ?? 0} />
        </div>
    );
};

export default ImageToXlsxConverter;
