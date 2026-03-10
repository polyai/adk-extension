type Options = {
    /**
    Only match an exact string. Useful with `RegExp#test()` to check if a string is an IP address. *(`false` matches any IP address in a string)*
  
    @defaultValue false
    */
    readonly exact?: boolean;
};
declare const cidrRegex: {
    ({ exact }?: Options): RegExp;
    v4({ exact }?: Options): RegExp;
    v6({ exact }?: Options): RegExp;
};
export declare const v4: ({ exact }?: Options) => RegExp;
export declare const v6: ({ exact }?: Options) => RegExp;
export default cidrRegex;
//# sourceMappingURL=index.d.ts.map