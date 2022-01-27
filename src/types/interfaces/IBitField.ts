export interface IBitField {
    field: number;
    overrides: [any];
    FLAGS: any;

    has(bit: number): boolean;
}