// Based from Disord.js bitfields

export class BitField {
    constructor(flags: any, bitfield: number = 0) {
        this.FLAGS = flags;
        this.field = bitfield;
    }

    has(bit: number): boolean {
        return (this.field & bit) === bit;
    }

    field: number;
    FLAGS: any;
}