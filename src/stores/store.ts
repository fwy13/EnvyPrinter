import { create } from "zustand";
import { CatPrinter } from "../utils/cat-protocol";

export type Printer = {
    isPrinter: { print: CatPrinter; rx: any } | null;
    setPrinter: (printer: { print: CatPrinter; rx: any } | null) => void;
};

export type File = {
    isFile: {
        data: FileReader | null;
        name: string;
        type: string;
        size: number;
    };
    setFile: (
        file: {
            data: FileReader | null;
            name: string;
            type: string;
            size: number;
        } | null
    ) => void;
};
export const usePrinter = create<Printer>((set) => ({
    isPrinter: null,
    setPrinter: (printer) =>
        set({ isPrinter: { print: printer.print, rx: printer.rx } }),
}));

export const useFile = create<File>((set) => ({
    isFile: null,
    setFile: (file) =>
        set({
            isFile: {
                data: file.data,
                name: file.name,
                type: file.type,
                size: file.size,
            },
        }),
}));
