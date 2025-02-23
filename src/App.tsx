import { useEffect, useRef, useState } from "react";
import FileInput from "./components/FileInput.tsx";
import { useFile, usePrinter } from "./stores/store.ts";
import {
    CAT_ADV_SRV,
    CAT_PRINT_RX_CHAR,
    CAT_PRINT_SRV,
    CAT_PRINT_TX_CHAR,
    DEF_ENERGY,
    DEF_SPEED,
} from "./utils/const.ts";
import { CatPrinter } from "./utils/cat-protocol.ts";
import { rgbaToBits } from "./utils/helper.ts";

export type MessageWorker = {
    data: ImageData[];
    w: number;
    h: number;
    type: string;
};

function App() {
    const { isPrinter, setPrinter } = usePrinter();
    const [isServerPrint, setServerPrint] = useState<any>();
    const [isLoading, setLoading] = useState<boolean>(false);
    const [isImage, setImage] = useState<string>();
    const [isNameAlgorithm, setNameAlgorithm] = useState<string>();
    const [isDataPrint, setDataPrint] = useState<Uint8Array>();
    const [isPage, setPage] = useState<number>(0);
    const useCanvas = useRef<HTMLCanvasElement>(null);
    const useCanvasBill = useRef<HTMLCanvasElement>(null);
    const [isMode, setMode] = useState<number>(0);
    const useWorker = useRef<Worker>(null);
    const [isDataImage, setDataImage] = useState<{
        w: number;
        h: number;
        buffer: ArrayBufferLike;
    }>();
    const { isFile } = useFile();
    const connectPrinter = async () => {
        setLoading(true);
        const device = await (navigator as any).bluetooth?.requestDevice({
            filters: [{ services: [CAT_ADV_SRV] }],
            optionalServices: [CAT_PRINT_SRV],
        });
        const server = await device.gatt?.connect();
        setServerPrint(server);
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
        setPrinter({ print: printer, rx: rx });
    };
    const disconnectPrinter = async () => {
        isServerPrint.disconnect();
        setPrinter(null);
    };
    useEffect(() => {
        if (isPrinter !== null) {
            setLoading(false);
        }
    }, [isPrinter]);
    useEffect(() => {
        useWorker.current = new Worker(
            new URL("./worker/processImage.ts", import.meta.url)
        );
        return () => {
            useWorker.current.terminate();
        };
    }, []);
    useEffect(() => {
        if (isMode === 1) {
            setImage("abc");
            const canvas = useCanvas.current!;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = "14px Arial";
            ctx.fillStyle = "black";

            const text = "HÓA ĐƠN THANH TOÁN";
            ctx.fillText(
                text,
                canvas.width / 2 - ctx.measureText(text).width / 2,
                20
            );
            ctx.fillText("Cửa hàng: Mini Portable Cat Printer", 10, 60);
            ctx.fillText("Ngày: 16/02/2025 16:40", 10, 80);
            ctx.fillText("Mã hóa đơn: #INV-20250216-1640", 10, 100);
            ctx.beginPath();
            ctx.moveTo(10, 110); // Điểm bắt đầu (10, 10)
            ctx.lineTo(canvas.width - 10, 110); // Điểm kết thúc (200, 100)
            ctx.stroke();
            ctx.fillText("Tên", 10, 130);
            ctx.fillText("Số lượng", 200, 130);
            ctx.fillText(
                "Tổng tiền",
                384 - ctx.measureText("Tổng tiền").width - 10,
                130
            );
            const products = [
                {
                    name: "Iphone 16 Pro Max",
                    quantity: "1",
                    price: "36.000.000",
                },
                {
                    name: "Iphone 16 Pro Max",
                    quantity: "1",
                    price: "36.000.000",
                },
                {
                    name: "Iphone 16 Pro Max",
                    quantity: "1",
                    price: "36.000.000",
                },
            ];
            products.map((item, index) => {
                ctx.fillText(item.name, 10, 140 + (index + 1) * 20);
                ctx.fillText(item.quantity, 200, 140 + (index + 1) * 20);
                ctx.fillText(
                    item.price,
                    384 - ctx.measureText(item.price).width - 10,
                    140 + (index + 1) * 20
                );
            });
        } else {
            setImage("");
        }
    }, [isMode]);
    useEffect(() => {
        if (isFile !== null) {
            isFile.data!.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = useCanvas.current!;
                    const width = 384;
                    const height = Math.round((384 / img.width) * img.height);
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const pixelsBuffer = imageData.data.buffer;
                    setDataImage({ w: width, h: height, buffer: pixelsBuffer });
                    useWorker.current.postMessage({
                        data: pixelsBuffer,
                        w: width,
                        h: height,
                        brightness: 0,
                        factor: 1,
                        type: 0,
                    });
                    let msg: any;
                    msg = await new Promise<MessageWorker>((resolve) => {
                        const callback = (
                            event: MessageEvent<MessageWorker>
                        ) => {
                            useWorker.current!.removeEventListener(
                                "message",
                                callback
                            );
                            resolve(event.data);
                        };
                        useWorker.current!.addEventListener(
                            "message",
                            callback
                        );
                    });
                    setNameAlgorithm(msg.data.name);
                    setDataPrint(new Uint8Array(msg.data.arr.data));
                    ctx.putImageData(msg.data.arr, 0, 0);
                    setImage(canvas.toDataURL());
                };
                img.src = e.target.result as any;
            };
        }
    }, [isFile]);
    const getDataImageBuffer = async () => {
        if (isDataImage) {
            const canvas = useCanvas.current!;
            canvas.width = isDataImage.w;
            canvas.height = isDataImage.h;
            const ctx = canvas.getContext("2d");
            useWorker.current.postMessage({
                data: isDataImage.buffer,
                w: isDataImage.w,
                h: isDataImage.h,
                brightness: 0,
                factor: 1,
                type: isPage,
            });
            let msg: any;
            msg = await new Promise<MessageWorker>((resolve) => {
                const callback = (event: MessageEvent<MessageWorker>) => {
                    useWorker.current!.removeEventListener("message", callback);
                    resolve(event.data);
                };
                useWorker.current!.addEventListener("message", callback);
            });
            setNameAlgorithm(msg.data.name);
            ctx.putImageData(msg.data.arr, 0, 0);
            setDataPrint(new Uint8Array(msg.data.arr.data));
            setImage(canvas.toDataURL());
        }
    };
    useEffect(() => {
        getDataImageBuffer();
    }, [isPage, isMode]);
    useEffect(() => {
        console.log(isMode);
    }, [isMode]);
    const print = async () => {
        const bitImage = rgbaToBits(new Uint32Array(isDataPrint?.buffer));
        const pitch = (isDataImage.w / 8) | 0;
        const speed = +(localStorage.getItem("speed") || DEF_SPEED);
        const energy = +(localStorage.getItem("energy") || DEF_ENERGY);
        const finish_feed = +120;

        const notifier = (event: Event) => {
            //@ts-ignore:
            const data: DataView = event.target.value;
            const message = new Uint8Array(data.buffer);
            const msg = isPrinter.print.notify(message);
            console.log(msg);
        };
        let blank = 0;

        // TODO: be aware of other printer state, like low power, no paper, overheat, etc.
        await isPrinter.rx
            .startNotifications()
            .then(() =>
                isPrinter.rx.addEventListener(
                    "characteristicvaluechanged",
                    notifier
                )
            )
            .catch((error: Error) => console.log(error));

        await isPrinter.print.prepare(speed, energy);
        for (let i = 0; i < isDataImage.h * pitch; i += pitch) {
            const line = bitImage.slice(i, i + pitch);
            if (line.every((byte) => byte === 0)) {
                blank += 1;
            } else {
                if (blank > 0) {
                    await isPrinter.print.setSpeed(8);
                    await isPrinter.print.feed(blank);
                    await isPrinter.print.setSpeed(speed);
                    blank = 0;
                }
                await isPrinter.print.draw(line);
            }
        }
        await isPrinter.print.finish(blank + finish_feed);
    };
    return (
        <div className="flex flex-col items-center h-screen pt-5 gap-3">
            <h1 className="text-3xl text-gray-200">
                In mọi thứ tại EnvyPrinter 🖨️
            </h1>
            <div className="flex items-center gap-3 text-white">
                <h1 className="text-[1.2em]">
                    Trạng thái kết nối: {isPrinter ? "✅" : "❌"}{" "}
                    {isLoading ? (
                        <span className="loading loading-spinner text-success"></span>
                    ) : (
                        ""
                    )}
                </h1>
                {isPrinter ? (
                    <button
                        className="btn btn-dash btn-error hover:text-white animate-fade-right"
                        onClick={disconnectPrinter}
                    >
                        Ngắt kết nối
                    </button>
                ) : (
                    <button
                        className="btn btn-dash btn-success hover:text-white animate-fade-right"
                        onClick={connectPrinter}
                    >
                        Kết nối
                    </button>
                )}
            </div>
            <div className="flex gap-3 text-white">
                <h1 className="text-[1.2em]">Bạn muốn in:</h1>
                <div className="text-[1.1em] flex flex-col gap-2">
                    <div className="flex gap-2 justify-between">
                        <span>Ảnh 🖼️</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            className="radio radio-success"
                            onClick={() => setMode(0)}
                            defaultChecked
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Hoá đơn 🧾</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            onClick={() => setMode(1)}
                            className="radio radio-success"
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Tài liệu 📖</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            onClick={() => setMode(2)}
                            className="radio radio-success"
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Văn bản 📄</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            onClick={() => setMode(3)}
                            className="radio radio-success"
                        />
                    </div>
                </div>
            </div>
            <FileInput isMode={isMode} />
            <span>{isFile?.name}</span>
            <button
                className="btn btn-dash w-[280px] btn-success hover:text-white"
                disabled={!isPrinter}
                onClick={print}
            >
                In
            </button>
            <div className="flex flex-col gap-2 justify-center items-center">
                <h1 className="text-white text-[1.25em]">
                    Xem trước tại đây 👇
                </h1>
                <div
                    className={`w-[384px] border-2 ${
                        !(isImage?.length > 0) ? "flex" : "hidden"
                    } border-dashed justify-center items-center h-[300px] mb-10`}
                >
                    Vui lòng thêm ảnh hoặc tài liệu ...
                </div>
                <div
                    className={`${
                        isImage?.length > 0 ? "flex" : "hidden"
                    } items-center gap-2`}
                >
                    <button
                        className={`btn btn-circle btn-dash text-white hover:btn-success ${
                            isMode !== 0 ? "hidden" : ""
                        }`}
                        disabled={isPage === 0}
                        onClick={() => {
                            setPage(isPage - 1);
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="size-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                            />
                        </svg>
                    </button>
                    <div className="bg-white">
                        <canvas
                            width={384}
                            height={400}
                            className="border-2 border-dashed animate-fade-left"
                            ref={useCanvas}
                        />
                    </div>
                    <button
                        className={`btn btn-circle btn-dash text-white hover:btn-success ${
                            isMode !== 0 ? "hidden" : ""
                        }`}
                        disabled={isPage === 2}
                        onClick={() => {
                            setPage(isPage + 1);
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="size-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3"
                            />
                        </svg>
                    </button>
                </div>
                {isNameAlgorithm && (
                    <h1 className="text-white text-[1.15em]">
                        {isNameAlgorithm} 🚀
                    </h1>
                )}
            </div>
        </div>
    );
}

export default App;
