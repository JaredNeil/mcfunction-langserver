import { StringReader } from "../../../../../brigadier_components/string_reader";
import { NBTError } from "../util/nbt_error";
import { NBTTag } from "./nbt_tag";

export const FLOAT_TAG_SUFFIX = "f";

export class NBTTagFloat extends NBTTag {

    protected tagType: "float" = "float";

    private val: number;

    constructor(val: number = 0) {
        super();
        this.val = val;
    }

    public getVal() {
        return this.val;
    }

    public parse(reader: StringReader): void {
        try {
            this.val = reader.readFloat();
            reader.expect(FLOAT_TAG_SUFFIX);
        } catch (e) {
            throw new NBTError(e);
        }
        this.correct = 2;
    }
}
