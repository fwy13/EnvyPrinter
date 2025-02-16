import { use, useEffect, useRef, useState } from "react";
import FileInput from "./components/FileInput.tsx";
import ImagePrint from "./ImagePrint.tsx";
import { useFile, usePrinter } from "./stores/store.ts";
import {
    CAT_ADV_SRV,
    CAT_PRINT_RX_CHAR,
    CAT_PRINT_SRV,
    CAT_PRINT_TX_CHAR,
} from "./utils/const.ts";
import { CatPrinter } from "./utils/cat-protocol.ts";
import { grayToRgba, index, rgbaToGray } from "./utils/helper.ts";

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
    const [isFactor, setFactor] = useState<number>(1);
    const [isBrightness, setBrightness] = useState<number>(0);
    const [isDataPrint, setDataPrint] = useState<Uint8Array>();
    const [isPage, setPage] = useState<number>(1);
    const useCanvas = useRef<HTMLCanvasElement>(null);
    const [isCanvas, setCanvas] = useState<{
        canvas: HTMLCanvasElement | null;
        ctx: CanvasRenderingContext2D | null;
    }>();
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
            filters: [{ services: [CAT_ADV_SRV, 0x180F] }],
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
        setPrinter(printer);
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
                        // 0=> Floyd, 1=> Atkinson, 2=> Jarvis Judice Ninke
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
                    ctx.putImageData(msg.data.arr, 0, 0);
                    setImage(canvas.toDataURL());
                };
                img.src = e.target.result as any;
            };
        }
    }, [isFile]);
    const getDataImageBuffer = async () => {
        if (isDataImage) {
            const canvas = document.createElement("canvas");
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
                // 0=> Floyd, 1=> Atkinson, 2=> Jarvis Judice Ninke
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
            setImage(canvas.toDataURL());
        }
    };
    useEffect(() => {
        getDataImageBuffer();
    }, [isPage]);
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
                            defaultChecked
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Hoá đơn 🧾</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            className="radio radio-success"
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Tài liệu 📖</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            className="radio radio-success"
                        />
                    </div>
                    <div className="flex gap-2 justify-between">
                        <span>Văn bản 📄</span>
                        <input
                            type="radio"
                            name="radio-0"
                            id="radio-0"
                            className="radio radio-success"
                        />
                    </div>
                </div>
            </div>
            <FileInput />
            <span>{isFile?.name}</span>
            <button
                className="btn btn-dash w-[280px] btn-success hover:text-white"
                disabled={!isPrinter}
            >
                In
            </button>
            <div className="flex flex-col gap-2 justify-center items-center">
                <h1 className="text-white text-[1.25em]">
                    Xem trước tại đây 👇 (nhớ chọn thuật toán!)
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
                        className="btn btn-circle btn-dash text-white hover:btn-success"
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
                        <img
                            src={isImage}
                            width={384}
                            className="border-2 border-dashed animate-fade-left"
                        />
                        <canvas
                            width={384}
                            className="border-2 border-dashed animate-fade-left hidden"
                            ref={useCanvas}
                        ></canvas>
                    </div>
                    <button
                        className="btn btn-circle btn-dash text-white hover:btn-success"
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
                <h1 className="text-white text-[1.15em]">
                    {isNameAlgorithm} 🚀
                </h1>
            </div>
        </div>
    );
}

export default App;
