declare const isCidr: {
    (str: string): 4 | 6 | 0;
    v4(str: string): boolean;
    v6(str: string): boolean;
};
export declare const v4: (str: string) => boolean;
export declare const v6: (str: string) => boolean;
export default isCidr;
//# sourceMappingURL=index.d.ts.map